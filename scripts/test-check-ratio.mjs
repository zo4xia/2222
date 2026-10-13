#!/usr/bin/env node
/**
 * test-check-ratio.mjs — R8-③ Check 配比盲视修复契约
 * 病灶：checkAgentRows 只传 rows 不传配比；checkAgentHandler 读了 handoff
 * 却唯独不拼 stageRatioSuggestion → Check 拿静态死规则（撑死 3 行）
 * 误砍 B 按题型配比（如 c 类分析 25-35%）合规生成的分析行。
 * 断言：配比政策源进 Check 视野、prompt 口径改为配比优先+兜底、双键名兼容接线。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const { buildStageRatioGuidance } = await import('../server/checkAgentHandler.js')
const { CHECK_AGENT_SYSTEM_PROMPT } = await import('../src/check-agent/prompt.js')
const handlerSource = readFileSync(join(root, 'server/checkAgentHandler.js'), 'utf8')
const serviceSource = readFileSync(join(root, 'src/check-agent/service.js'), 'utf8')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('R8-③ Check 配比盲视修复')

// ── buildStageRatioGuidance 纯函数 ──
const fullRatio = {
  cuCode: 'CU-03',
  type: 'b·方法确定',
  confidence: 'high',
  suggestedRatio: { analysis: '5-15%', solution: '55-65%', summary: '5-10%', introAndClosing: '23%' },
}

ok('有配比 → 政策源声明 + 四区间 + 换算核对口径', () => {
  const text = buildStageRatioGuidance(fullRatio)
  assert.ok(text.includes('stageRatioSuggestion'), '应含政策源字段名')
  assert.ok(text.includes('唯一配比政策源'), '应声明政策源地位')
  assert.ok(text.includes('b·方法确定'), '应含题型')
  assert.ok(text.includes('CU-03') && text.includes('high'), '应含题型码与置信度')
  assert.ok(text.includes('分析 (analysis)：5-15%'), '应含分析区间')
  assert.ok(text.includes('解答 (solution)：55-65%'), '应含解答区间')
  assert.ok(text.includes('总结 (summary)：5-10%'), '应含总结区间')
  assert.ok(text.includes('开收场 (introAndClosing)：23%'), '应含开收场区间')
  assert.ok(text.includes('总行数 × 分析区间上限'), '应含换算核对口径')
  assert.ok(text.includes('不得以任何固定数字为由砍行'), '应明确禁止固定数字砍行')
})

ok('无配比（null/undefined/缺对象）→ 数据缺失兜底声明 + 保守 3 行', () => {
  for (const empty of [null, undefined, {}]) {
    const text = buildStageRatioGuidance(empty)
    assert.ok(text.includes('未提供'), `nullish 输入应判数据缺失：${String(empty)}`)
    assert.ok(text.includes('撑死最多 3 行'), '兜底应保留保守 3 行规则')
    assert.ok(!text.includes('唯一配比政策源'), '缺数据不应声称有政策源')
  }
})

ok('数组输入（防脏数据）→ 走兜底不炸', () => {
  const text = buildStageRatioGuidance([{ analysis: '10%' }])
  assert.ok(text.includes('未提供'), '数组应按数据缺失处理')
})

ok('suggestedRatio 部分缺失 → 逐字段"未提供"不臆造', () => {
  const text = buildStageRatioGuidance({ cuCode: 'CU-01', suggestedRatio: { analysis: '20-30%' } })
  assert.ok(text.includes('分析 (analysis)：20-30%'), '有值字段照常输出')
  assert.ok(text.includes('解答 (solution)：未提供'), '缺值字段标未提供')
  assert.ok(text.includes('总结 (summary)：未提供'), '缺值字段标未提供')
  assert.ok(text.includes('开收场 (introAndClosing)：未提供'), '缺值字段标未提供')
  assert.ok(text.includes('未提供'), '题型缺失也标未提供')
})

ok('配比区间含空串 → 按"未提供"处理（防 String("") 伪造空值行）', () => {
  const text = buildStageRatioGuidance({ suggestedRatio: { analysis: '' } })
  assert.ok(text.includes('分析 (analysis)：未提供'), '空串应归一为未提供')
})

// ── prompt 口径 ──
ok('系统提示词：配比优先口径已立（政策源唯一+换算+禁固定数字）', () => {
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('配比政策优先'), '应立配比优先原则')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('stageRatioSuggestion'), '应点名配比数据来源')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('总行数 × 分析区间上限'), '应给换算方法')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('绝不以"撑死 3 行"之类固定数字为由'), '应禁固定数字砍行')
})

ok('系统提示词：无配比时才退回保守死规则（兜底分支保留 3 行）', () => {
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('数据缺失兜底'), '应有兜底分支声明')
  assert.ok(CHECK_AGENT_SYSTEM_PROMPT.includes('撑死最多 3 行'), '兜底 3 行应保留')
  // 顺序断言：配比优先段必须在兜底段之前（政策优先级方向不可倒置）
  const prio = CHECK_AGENT_SYSTEM_PROMPT.indexOf('配比政策优先')
  const fallback = CHECK_AGENT_SYSTEM_PROMPT.indexOf('数据缺失兜底')
  assert.ok(prio >= 0 && fallback > prio, '配比优先在兜底之前')
})

// ── 接线（handler 源码静态断言）──
ok('handler：userContent 已注入配比块（双键名兼容与 AgentBDirect 同法）', () => {
  assert.ok(handlerSource.includes('buildStageRatioGuidance(handoff?.stageRatioSuggestion || handoff?.[\'环节配比占比\'] || null)'),
    'userContent 应以双键名兼容调用 buildStageRatioGuidance')
})

ok('handler：注入位置在 boardPlan 块之后、四字段 rows 之前（政策先于内容）', () => {
  const boardPlanIdx = handlerSource.indexOf('【参考 boardPlan】')
  const ratioIdx = handlerSource.indexOf('buildStageRatioGuidance(handoff')
  const rowsIdx = handlerSource.indexOf('【当前 B 生成结果四字段】')
  assert.ok(boardPlanIdx > 0 && ratioIdx > boardPlanIdx && rowsIdx > ratioIdx, '注入顺序应正确')
})

ok('服务链一致性：B 侧政策源声明仍在（agent-b-v2 prompt 禁固定比例未被削弱）', () => {
  const bPrompt = readFileSync(join(root, 'src/agent-b-v2/prompt.js'), 'utf8')
  assert.ok(bPrompt.includes('禁止套用任何固定比例'), 'B 侧政策声明应保持')
  assert.ok(bPrompt.includes('stageRatioSuggestion'), 'B 侧仍认 handoff 真实值')
})

ok('service.js 未越权：前端请求体仍只传 rows（配比由服务端活档补齐，不双源）', () => {
  assert.ok(!/stageRatio|配比/.test(serviceSource), '前端不应自带配比（避免双源漂移）')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
