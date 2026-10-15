#!/usr/bin/env node
/**
 * test-audio-url-lifecycle.mjs — 「点击播放哑巴」根因链哨兵（2026-10-15）
 *
 * 病灶链（多因叠加）：
 *   P0-1 前端克隆写入：tableRows 是 {...row} 浅克隆，三个 TTS handler 把
 *       record.audioUrl 写克隆上，applyAgentBV2Timeline 重建后蒸发 →
 *       导出/播放读真源全空 → '音频暂未生成' 占位串 → row-player 静音。
 *   P0-2 决策 #017 被回滚：36a960c（dependabot squash 基于旧 main）删掉
 *       normalizeDeliverableAssetPaths（/audio-cache/ → ../audio-cache/），
 *       导出 HTML file:// 双击必 404 → onerror 静默降级 = 哑巴。
 *   P1   Check/ASR 洗字段：重建 rows 只留 4 内容字段，音频三字段被剥。
 *
 * 哨兵分四层：
 *   A. normalizeDeliverableAssetPaths 行为级（#017 归一 + mp3 契约净化 + 幂等）
 *   B. renderDeliverableHtml / writeDeliverableFile 双出口归一集成
 *   C. parseCheckResponse / polishRowsASR 音频字段回填行为级
 *   D. AgentBDirect 真源写入口 + row-player 双胞胎一致性（源码级）
 */
import { strict as assert } from 'node:assert'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

import { normalizeDeliverableAssetPaths, renderDeliverableHtml } from '../server/renderDeliverableHtml.js'
import { writeDeliverableFile } from '../server/deliverableStoreHandler.js'
import { parseCheckResponse } from '../server/checkAgentHandler.js'
import { polishRowsASR } from '../src/check-agent/asrPolish.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('音频 URL 生命周期哨兵（哑巴根因链）')

/* ============ A. normalizeDeliverableAssetPaths 行为级 ============ */
console.log('\n[A] #017 归一 normalizeDeliverableAssetPaths')

const mk = (mp3, audioUrl, extra = {}) => ({ stage: '分析', speech: '讲', board: { content: 'x' }, ...extra, ...(mp3 !== undefined ? { mp3 } : {}), ...(audioUrl !== undefined ? { audioUrl } : {}) })

ok('真缓存 URL 归一上级目录（mp3+audioUrl 双写）', () => {
  const d = { rows: [mk(undefined, '/audio-cache/abc.mp3')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[0].mp3, '../audio-cache/abc.mp3')
  assert.strictEqual(d.rows[0].audioUrl, '../audio-cache/abc.mp3')
})

ok('/audio/ 与 /pic/ 前缀同样归一（save-local 产物）', () => {
  const d = { rows: [mk(undefined, '/audio/audio-20260101-step1.mp3'), mk(undefined, '/pic/p.mp3')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[0].mp3, '../audio/audio-20260101-step1.mp3')
  assert.strictEqual(d.rows[1].mp3, '../pic/p.mp3')
})

ok('占位串不进 mp3 契约字段（audioUrl 保留供展示层判断）', () => {
  const d = { rows: [mk(undefined, '音频暂未生成')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[0].mp3, '')
  assert.strictEqual(d.rows[0].audioUrl, '音频暂未生成')
})

ok('mp3 字段优先于 audioUrl（前端契约字段先消费）', () => {
  const d = { rows: [mk('/audio-cache/new.mp3', '/audio-cache/old.mp3')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[0].mp3, '../audio-cache/new.mp3')
  assert.strictEqual(d.rows[0].audioUrl, '../audio-cache/new.mp3')
})

ok('data:/blob:/http(s) 可播形态不重写', () => {
  const d = { rows: [mk(undefined, 'https://cdn.example.com/a.mp3'), mk(undefined, 'data:audio/mp3;base64,AAA')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[0].mp3, 'https://cdn.example.com/a.mp3')
  assert.strictEqual(d.rows[1].mp3, 'data:audio/mp3;base64,AAA')
})

ok('null / 无 rows / 行非对象防御', () => {
  assert.strictEqual(normalizeDeliverableAssetPaths(null), null)
  const d = { rows: [null, 42, mk(undefined, '/audio-cache/x.mp3')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.rows[2].mp3, '../audio-cache/x.mp3')
})

ok('幂等：连续跑两遍结果一致', () => {
  const d = { rows: [mk(undefined, '/audio-cache/a.mp3'), mk(undefined, '音频暂未生成')] }
  normalizeDeliverableAssetPaths(d)
  const first = JSON.stringify(d)
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(JSON.stringify(d), first)
})

/* ============ B. 双出口集成 ============ */
console.log('\n[B] #017 双出口（HTML 渲染 / JSON 写盘）')

ok('renderDeliverableHtml：导出 HTML 注入数据含相对上级音频路径', () => {
  const d = {
    projectCode: 'TEST-audiohtml-1',
    rows: [mk(undefined, '/audio-cache/abc.mp3')],
  }
  const html = renderDeliverableHtml(d)
  assert.ok(html.includes('__INITIAL_DELIVERABLE__'), '应注入初始数据')
  assert.ok(html.includes('../audio-cache/abc.mp3'), '注入数据应含 ../audio-cache/ 相对路径')
  assert.ok(!html.includes('"/audio-cache/abc.mp3"'), '不应再含站点根绝对路径')
})

let written = null
try {
  written = writeDeliverableFile({
    projectCode: 'TEST-audiourl-1',
    problemText: '测试',
    rows: [
      mk(undefined, '/audio-cache/abc.mp3', { audioDurationMs: 1234, duration: 1.2 }),
      mk(undefined, '音频暂未生成'),
    ],
  })
  const saved = JSON.parse(readFileSync(join(root, 'public/deliverable/deliverable-TEST-audiourl-1.json'), 'utf-8'))
  ok('writeDeliverableFile：JSON 出口归一 + mp3 补齐 + 占位串净化', () => {
    assert.strictEqual(saved.rows[0].mp3, '../audio-cache/abc.mp3', 'JSON 落盘应为相对上级路径')
    assert.strictEqual(saved.rows[0].audioUrl, '../audio-cache/abc.mp3')
    assert.strictEqual(saved.rows[1].mp3, '', '未生成行 mp3 应为空串')
    assert.strictEqual(saved.rows[1].audioUrl, '音频暂未生成', 'audioUrl 占位串保留（展示层判断用）')
    assert.strictEqual(written.projectCode, 'TEST-audiourl-1')
  })
  const savedHtml = readFileSync(join(root, 'public/deliverable/deliverable-TEST-audiourl-1.html'), 'utf-8')
  ok('writeDeliverableFile：配套 HTML 出口同样归一', () => {
    assert.ok(savedHtml.includes('../audio-cache/abc.mp3'), 'HTML 应含相对路径')
  })
} finally {
  // 测试产物清理：恢复 public/deliverable 原状（原本无这些文件）
  for (const f of ['deliverable-TEST-audiourl-1.json', 'deliverable-TEST-audiourl-1.html', 'current.json', 'current.html']) {
    const p = join(root, 'public/deliverable', f)
    if (existsSync(p)) rmSync(p)
  }
}

/* ============ C. Check / ASR 通道音频字段回填 ============ */
console.log('\n[C] Check/ASR 通道音频回填')

const checkOriginal = [
  { stage: '题目', speech: '原口播', board: { content: '原板书' }, audioUrl: '/audio-cache/a.mp3', audioDurationMs: 1234, duration: 1.2 },
  { stage: '分析', speech: '分析口播', board: { content: '分析板书' } },
]
const checkText = JSON.stringify({
  rows: [
    { stage: '题目', speech: '改后口播', board: { content: '改后板书' } },
    { stage: '分析', speech: '分析口播改', board: { content: '分析板书改' } },
  ],
  changes: [],
})

ok('parseCheckResponse：Check 重建行按索引保留 audioUrl/audioDurationMs/duration', () => {
  const result = parseCheckResponse(checkText, checkOriginal)
  assert.ok(result.ok, '应解析成功: ' + (result.error || ''))
  const rows = result.value.rows
  assert.strictEqual(rows[0].audioUrl, '/audio-cache/a.mp3', 'audioUrl 应随原行保留')
  assert.strictEqual(rows[0].audioDurationMs, 1234)
  assert.strictEqual(rows[0].duration, 1.2)
  assert.strictEqual(rows[0].speech, '改后口播', '内容字段仍以 Check 改写为准')
  assert.ok(!('audioUrl' in rows[1]), '无音频行不得臆造音频字段')
})

ok('polishRowsASR：ASR 兜底行同样按索引保留音频字段', () => {
  const result = polishRowsASR(checkOriginal)
  assert.strictEqual(result.rows[0].audioUrl, '/audio-cache/a.mp3')
  assert.strictEqual(result.rows[0].audioDurationMs, 1234)
  assert.ok(!('audioUrl' in result.rows[1]), '无音频行不得臆造音频字段')
})

/* ============ D. AgentBDirect 真源写入口 + 双胞胎 ============ */
console.log('\n[D] 前端真源写入口 + row-player 双胞胎')

const src = readFileSync(join(root, 'src/agent-b-v2/AgentBDirect.vue'), 'utf8')
const twinA = readFileSync(join(root, 'row-player.html'), 'utf8')
const twinB = readFileSync(join(root, 'public/row-player.html'), 'utf8')

ok('AgentBDirect：setRowAudioUrl 真源写入口存在且写 rows.value[index]', () => {
  assert.ok(/function setRowAudioUrl\(index, url\)[\s\S]{0,400}?rows\.value\[index\]\s*=\s*\{\s*\.\.\.rows\.value\[index\],\s*audioUrl: url\s*\}/.test(src),
    'setRowAudioUrl 应以 updateRow 同款模式写真源')
})

ok('AgentBDirect：音频字段唯一写入口（4 个调用点全走 setRowAudioUrl，克隆写法零残留）', () => {
  // 5 处 = 1 函数定义 + 4 调用（试听合成 / 重新生成 / 保存本地 / 试听 ended 回填）
  assert.strictEqual((src.match(/setRowAudioUrl\(index,/g) || []).length, 5,
    '应为 1 定义 + 4 调用')
  assert.ok(!/record\.audioUrl\s*=/.test(src), 'record.audioUrl = 克隆写法不得残留')
  assert.ok(!/record\.audioDurationMs\s*=/.test(src), 'record.audioDurationMs = 克隆写法不得残留')
})

ok('AgentBDirect：recordAudioMetadata 新签名（真源模式，无 record 形参）', () => {
  assert.ok(/async function recordAudioMetadata\(index, url\)/.test(src), '签名应为 (index, url)')
})

ok('AgentBDirect：序列化补 mp3 契约字段（真 URL 透传 / 空串兜底）', () => {
  assert.ok(/mp3:\s*r\.audioUrl\s*\|\|\s*''/.test(src), 'cleanRows 应写 mp3: r.audioUrl || \'\'')
})

ok('AgentBDirect：setRowAudioUrl 同步刷新 B 缓存（防刷新丢音频）', () => {
  assert.ok(/function setRowAudioUrl[\s\S]{0,500}?bCacheSet\(rows\.value,\s*generatedModel\.value\)/.test(src),
    '合成成功后应 bCacheSet 回写缓存')
})

ok('row-player 双胞胎 md5 一致 + onerror 可观测性', () => {
  const ha = createHash('md5').update(twinA).digest('hex')
  const hb = createHash('md5').update(twinB).digest('hex')
  assert.strictEqual(ha, hb, '根目录与 public/ 双胞胎必须逐字节一致')
  assert.ok(twinA.includes("[row-player] 音频加载失败"), 'onerror 应留 warn 痕迹（哑巴可诊断）')
  assert.ok(twinB.includes("[row-player] 音频加载失败"), '双胞胎同步携带 warn')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
