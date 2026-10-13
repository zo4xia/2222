#!/usr/bin/env node
/**
 * test-check-ratio.mjs — R8-③ 终裁版：Check 行数守恒 + 收尾金句保护 + 配比纯背景
 * 夏夏终裁（原话）："路虽远，行则将至，加油！这句结束语不可以删除的！
 * 分析最多多少行纯属胡扯，我让 agent 自己决定的东西。"
 * 断言：prompt 撤销一切行数管制、金句硬保护入规、代码级行数守恒钢门、
 * 配比仅背景参考、structure 只报告不动手。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const { buildStageRatioGuidance, parseCheckResponse } = await import('../server/checkAgentHandler.js')
const { CHECK_AGENT_SYSTEM_PROMPT } = await import('../src/check-agent/prompt.js')
const handlerSource = readFileSync(join(root, 'server/checkAgentHandler.js'), 'utf8')
const serviceSource = readFileSync(join(root, 'src/check-agent/service.js'), 'utf8')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('R8-③ 终裁版：行数守恒 + 金句保护 + 配比纯背景')

// ── prompt 口径（夏夏终裁）──
ok('系统提示词：行数守恒硬约束已立（不得增删合并任何行）', () => {
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('行数守恒硬约束'), '应有行数守恒硬约束')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('不得增加、不得删除、不得合并任何一行'), '三不得应齐全')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('Agent B 自主决定的结构性决策'), '行数归属 B 应明确')
})

ok('系统提示词：收尾金句绝对保护（含"路虽远"实例点名）', () => {
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('收尾金句绝对保护'), '应有金句保护段')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('路虽远，行则将至，加油！'), '应点名夏夏的金句实例')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('不得删除、不得合并、不得改写语义'), '三不得应齐全')
})

ok('系统提示词：行数管制旧口径连根拔除（无任何"最多几行"）', () => {
  assert.ok(!/撑死最多\s*3\s*行/.test(CHECK_AGENT_SYSTEM_PROMPT), '兜底 3 行死规则应已撤销')
  assert.ok(!/不能超过总步骤数的\s*1\/2/.test(CHECK_AGENT_SYSTEM_PROMPT), '1/2 上限应已撤销')
  assert.ok(!/总行数 × 分析区间上限/.test(CHECK_AGENT_SYSTEM_PROMPT), '配比换算核对口径应已撤销')
})

ok('系统提示词：structure 只报告不动手（冗余建议通道）', () => {
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('只在 changes 里报告建议'), '应只报告')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('你绝不直接动手'), '应明确不执行')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('"structure"'), 'field 枚举应含 structure')
})

// ── 代码级钢门：parseCheckResponse 行数守恒 ──
const sampleRows = [
  { stage: '题目', speech: '看题', board: { content: '', startDelay: 0 }, actionSpec: [] },
  { stage: '分析', speech: '先想', board: { content: '想', startDelay: 1 }, actionSpec: [] },
  { stage: '总结', speech: '路虽远，行则将至，加油！', board: { content: '', startDelay: 0 }, actionSpec: [] },
]

ok('钢门：模型删 1 行（金句行被并）→ ok:false 拒收回退', () => {
  const attacked = JSON.stringify({
    rows: [sampleRows[0], sampleRows[1]],   // 金句行被删
    changes: [],
  })
  const r = parseCheckResponse(attacked, sampleRows)
  assert.strictEqual(r.ok, false, '删行必须被拒')
  assert.ok(r.error.includes('无删行权限'), '拒收理由应点名无删行权限')
  assert.ok(r.error.includes('收尾金句不可删'), '应点名金句保护')
})

ok('钢门：模型并行（20 行砍成 15 行）→ ok:false', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ stage: i === 0 ? '题目' : '分析', speech: `行${i}`, board: '', actionSpec: [] }))
  const merged = JSON.stringify({ rows: many.slice(0, 15), changes: [] })
  const r = parseCheckResponse(merged, many)
  assert.strictEqual(r.ok, false)
  assert.ok(r.error.includes('输入 20 行，返回 15 行'), '行数差异应写明')
})

ok('钢门：行数守恒、只改 speech → 正常放行（不误伤正当润色）', () => {
  const legit = JSON.stringify({
    rows: sampleRows.map(r => ({ ...r, speech: r.speech + '呀' })),
    changes: [{ row: 1, field: 'speech', before: '看题', after: '看题呀', reason: '语气自然' }],
  })
  const r = parseCheckResponse(legit, sampleRows)
  assert.strictEqual(r.ok, true, '行数守恒的润色应放行')
  assert.ok(r.value.rows.length === 3, '三行齐全')
  assert.ok(r.value.rows[2].speech.includes('路虽远'), '金句行内容应在')
})

ok('钢门：增行（模型加行）→ 同样 ok:false（守恒是双向的）', () => {
  const added = JSON.stringify({ rows: [...sampleRows, sampleRows[2]], changes: [] })
  const r = parseCheckResponse(added, sampleRows)
  assert.strictEqual(r.ok, false, '增行也违约')
})

ok('解析层死语义拔除：行数变化 structure 报告段不可达（源码无该分支）', () => {
  assert.ok(!/合并\/精简了\s*\$\{/.test(handlerSource), '"合并/精简了 N 行"报告段应已删除')
})

// ── 配比纯背景 ──
const fullRatio = {
  cuCode: 'CU-03', type: 'b·方法确定', confidence: 'high',
  suggestedRatio: { analysis: '5-15%', solution: '55-65%', summary: '5-10%', introAndClosing: '23%' },
}

ok('配比注入：仅背景参考措辞（无核对口径、无行数指令）', () => {
  const text = buildStageRatioGuidance(fullRatio)
  assert.ok(text.includes('仅作理解本题结构的背景参考'), '应声明背景定位')
  assert.ok(text.includes('不得以此数据为依据核对、合并或删除任何行'), '应明确不做行数核对')
  assert.ok(!text.includes('总行数 × 分析区间上限'), '换算核对口径应已撤')
  assert.ok(!text.includes('撑死最多 3 行'), '3 行死规则应已撤')
  assert.ok(text.includes('b·方法确定') && text.includes('5-15%'), '题型与区间照常给出（背景价值保留）')
})

ok('配比缺失：声明不影响检查（不再是兜底规则）', () => {
  for (const empty of [null, undefined, {}, [{ analysis: '10%' }]]) {
    const text = buildStageRatioGuidance(empty)
    assert.ok(text.includes('未提供'), '缺数据标未提供')
    assert.ok(text.includes('Check 不做行数核对'), '应声明不影响检查')
    assert.ok(!text.includes('撑死最多 3 行'), '不得再退任何行数兜底')
  }
})

ok('handler 接线保持：userContent 配比块仍注入（双键名兼容）', () => {
  assert.ok(handlerSource.includes("buildStageRatioGuidance(handoff?.stageRatioSuggestion || handoff?.['环节配比占比'] || null)"),
    '双键名兼容调用应保持')
})

ok('B 侧政策源声明未被削弱（B 自主决定行数分配的政策依据仍在）', () => {
  const bPrompt = readFileSync(join(root, 'src/agent-b-v2/prompt.js'), 'utf8')
  assert.ok(bPrompt.includes('禁止套用任何固定比例'), 'B 侧政策声明应保持')
})

ok('service.js 未越权：前端请求体仍只传 rows（配比由服务端活档补齐）', () => {
  assert.ok(!/stageRatio|配比/.test(serviceSource), '前端不应自带配比（避免双源漂移）')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
