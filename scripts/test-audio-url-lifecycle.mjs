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
 *
 * Task 40 扩容（2026-10-16，导出内容真实性审计四缺口闭环）：
 *   A.+ sequence（流水线形状）行归一 + screenshotUrl 题目图三落点（顶层/topicSpec/problemInfo）归一
 *   B.+ 导出 HTML 标题随题目注入（拔“平行四边形”示例题名残留）
 *   D.+ 三胞胎（含 dist）+ 题目图兜底链 + syncDocTitle 装载咽喉
 *   E.  新增：客户端 JSON 双出口接线 / openDeliverablePage 打开前重新固化 /
 *       要素表字体选择补传 / 每行落笔延迟真源写入口（branch2 被 squash 丢失功能回归）
 */
import { strict as assert } from 'node:assert'
import { readFileSync, existsSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'

import { normalizeDeliverableAssetPaths, renderDeliverableHtml, deliverableTitle } from '../server/renderDeliverableHtml.js'
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

ok('Task 40-A：sequence（流水线形状）行同规归一', () => {
  const d = { sequence: [{ stage: '分析', audioUrl: '/audio-cache/seq.mp3' }, { audioUrl: '音频暂未生成' }] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.sequence[0].mp3, '../audio-cache/seq.mp3')
  assert.strictEqual(d.sequence[0].audioUrl, '../audio-cache/seq.mp3')
  assert.strictEqual(d.sequence[1].mp3, '')
})

ok('Task 40-B：顶层 screenshotUrl 归一上级目录（题目图离线不再 404）', () => {
  const d = { screenshotUrl: '/pic/shot-20261016.jpg', rows: [mk(undefined, '/audio-cache/a.mp3')] }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.screenshotUrl, '../pic/shot-20261016.jpg')
})

ok('Task 40-B：topicSpec / problemInfo 两个题目图落点同规', () => {
  const d = { topicSpec: { screenshotUrl: '/pic/p1.jpg' }, problemInfo: { screenshotUrl: '/pic/p2.jpg' } }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.topicSpec.screenshotUrl, '../pic/p1.jpg')
  assert.strictEqual(d.problemInfo.screenshotUrl, '../pic/p2.jpg')
})

ok('题目图非字符串 / null / 外链不重写', () => {
  const d = { screenshotUrl: null, topicSpec: { screenshotUrl: 'https://cdn.example.com/p.png' }, problemInfo: {} }
  normalizeDeliverableAssetPaths(d)
  assert.strictEqual(d.screenshotUrl, null)
  assert.strictEqual(d.topicSpec.screenshotUrl, 'https://cdn.example.com/p.png')
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

ok('Task 40：renderDeliverableHtml 标题随题目注入（拔“平行四边形”示例残留）', () => {
  const d = {
    projectCode: 'TEST-title-1',
    problemText: '一个长方形的长是12厘米，宽是8厘米，求它的周长和面积各是多少？',
    rows: [mk(undefined, '/audio-cache/abc.mp3')],
  }
  const html = renderDeliverableHtml(d)
  assert.ok(html.includes('<title>一个长方形的长是12厘米，宽是8厘米 · 仿人板书微课</title>'), '标题应为题目前 18 字 + 固定后缀')
  assert.ok(!html.includes('平行四边形面积 · 仿人板书'), '模板示例题名残留必须被替换')
})

ok('deliverableTitle：截断 18 字 / 空题兑底 / 空白折叠', () => {
  assert.strictEqual(deliverableTitle({ problemText: '  题目\n有两个空格   与换行 ' }), '题目 有两个空格 与换行 · 仿人板书微课')
  assert.strictEqual(deliverableTitle({ problemText: '' }), '仿人板书微课')
  assert.strictEqual(deliverableTitle({}), '仿人板书微课')
})

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

ok('Task 43 G 缺口：recordAudioMetadata 也刷 bCache（audioDurationMs 防刷新丢）', () => {
  assert.ok(/async function recordAudioMetadata\(index, url\)[\s\S]{0,900}?bCacheSet\(rows\.value,\s*generatedModel\.value\)/.test(src),
    'recordAudioMetadata 函数体应含 bCacheSet（时长元数据写入缓存）')
})

ok('Task 43 C 口径：totalEstimatedStats 认实测音频优先链', () => {
  assert.ok(/totalEstimatedStats[\s\S]{0,1400}?Number\(r\.audioDurationMs\)[\s\S]{0,300}?estimateSpeechDurationMs/.test(src),
    '总时长统计应先认 audioDurationMs 再退估算')
  assert.ok(!/totalSpeechMs \+= estimateSpeechDurationMs\(r\.speech, \{ speed: canvasParams\.value\?\.speechSpeed \|\| AGENT_B_V2_SPEECH_RATE \}\)\s*\}\)\s*\n\s*\}\)\s*\n\s*const totalGapMs/.test(src),
    '无音频优先链的旧写法不得回归')
})

ok('AgentBDirect：序列化补 mp3 契约字段（真 URL 透传 / 空串兜底）', () => {
  assert.ok(/mp3:\s*r\.audioUrl\s*\|\|\s*''/.test(src), 'cleanRows 应写 mp3: r.audioUrl || \'\'')
})

ok('AgentBDirect：setRowAudioUrl 同步刷新 B 缓存（防刷新丢音频）', () => {
  assert.ok(/function setRowAudioUrl[\s\S]{0,500}?bCacheSet\(rows\.value,\s*generatedModel\.value\)/.test(src),
    '合成成功后应 bCacheSet 回写缓存')
})

ok('row-player 三胞胎 md5 一致（root/public/dist）+ onerror 可观测性', () => {
  const ha = createHash('md5').update(twinA).digest('hex')
  const hb = createHash('md5').update(twinB).digest('hex')
  assert.strictEqual(ha, hb, '根目录与 public/ 双胞胎必须逐字节一致')
  const distPath = join(root, 'dist/row-player.html')
  if (existsSync(distPath)) {
    const hc = createHash('md5').update(readFileSync(distPath, 'utf8')).digest('hex')
    assert.strictEqual(hc, ha, 'dist 构建产物（若存在）也必须与母版一致')
  }
  assert.ok(twinA.includes("[row-player] 音频加载失败"), 'onerror 应留 warn 痕迹（哑巴可诊断）')
  assert.ok(twinB.includes("[row-player] 音频加载失败"), '双胞胎同步携带 warn')
})

ok('Task 43 GAP=1000：三胞胎对齐真源 AGENT_B_V2_ROW_GAP_MS（销 1500 挂账）', () => {
  assert.ok(/const GAP=1000;/.test(twinA), 'row-player GAP 应为 1000')
  assert.ok(!/const GAP=1500;/.test(twinA), 'GAP=1500 旧值不得回归')
  assert.ok(/const GAP=1000;/.test(twinB), '双胞胎同步 GAP=1000')
  const timingSrc = readFileSync(join(root, 'src/agent-b-v2/timing.js'), 'utf8')
  assert.ok(timingSrc.includes('AGENT_B_V2_ROW_GAP_MS = 1000'), '真源 ROW_GAP 应为 1000（锚点不动）')
})

ok('Task 43 keyword 触发：row-player 三胞胎编译消费 entry 级 triggerKeyword', () => {
  assert.ok(/const kwTimeMs=\(a\)=>\{/.test(twinA), 'kwTimeMs 比例映射函数应存在')
  assert.ok(/kwRaw\!=null\)cursor=Math\.max\(kwRaw,cursor\)/.test(twinA), '互斥钳制 max(kwRaw,cursor) 应存在')
  assert.ok(/keywordStartOffsetMs:kwRaw/.test(twinA), 'plan 项应携带 keywordStartOffsetMs 可观测字段')
  assert.ok(/const actsSorted=\[\.\.\.acts\]\.sort/.test(twinA), '动作按 action.order 排序应存在')
  assert.ok(twinB.includes('const kwTimeMs=(a)=>{'), '双胞胎同步 kwTimeMs')
})

ok('Task 43 幽灵槽拔除：board 级 triggerKeyword 不再清零 startDelay（3025bad 反语义陷阱销账）', () => {
  assert.ok(!/const sd=keyword\?0:/.test(twinA), 'keyword?0:startDelay 反语义分支不得残留')
  assert.ok(/const sd=Math\.max\(0,Number\(r\.board\?\.startDelay/.test(twinA), 'sd 应只认 startDelay')
  // normRow：startDelay 无条件透传（不与 triggerKeyword 互斥）
  assert.ok(/startDelay: Number\(startDelay\)\|\|0,\n      \.\.\.\(triggerKeyword\?\{triggerKeyword:triggerKeyword\}:\{\}\)/.test(twinA),
    'normRow board 槽 startDelay 应无条件透传')
})

ok('Task 43 keyword 触发：timing.js 真源 + prompt 教学接线', () => {
  const timingSrc = readFileSync(join(root, 'src/agent-b-v2/timing.js'), 'utf8')
  assert.ok(/export function resolveKeywordTimeMs/.test(timingSrc), 'resolveKeywordTimeMs 真源应导出')
  assert.ok(/Math\.max\(kwTime, cursorMs\)/.test(timingSrc), 'timing 互斥钳制应存在')
  const promptSrc = readFileSync(join(root, 'src/agent-b-v2/prompt.js'), 'utf8')
  assert.ok(promptSrc.includes('triggerKeyword'), '生成 prompt 应教 triggerKeyword')
  assert.ok(/triggerKeyword.*逐字存在/.test(promptSrc) || /triggerKeyword（若填）是否逐字存在/.test(promptSrc), '§7.3 检查项应验关键词在 speech 中逐字存在')
})

ok('row-player Task 40：题目图兜底链 + 标题装载咽喉接线', () => {
  assert.ok(/function setProblemImage\(src,fallbacks\)/.test(twinA), 'setProblemImage 应携带兜底链参数')
  assert.ok(twinA.includes('problemImageFallbacks: imgCands.slice(1)'), 'normData 应产出兜底链候选')
  assert.ok(twinA.includes('题目图加载失败，降级兜底链'), 'onerror 应逐级降试并 warn 留痕')
  assert.ok(/function load\(data\)\{[\s\S]{0,200}?syncDocTitle\(\);/.test(twinA), 'load() 装载咽喉应同步 document.title')
  assert.ok(/function syncDocTitle\(\)/.test(twinA), 'syncDocTitle 函数应存在')
  assert.ok(!twinA.includes('平行四边形面积 · 仿人板书'), '模板示例题名残留必须清零')
})

/* ============ E. Task 40：客户端导出出口接线 / 重新固化 / 落笔延迟（源码级） ============ */
console.log('\n[E] Task 40：客户端导出出口接线 / 打开前重新固化 / 落笔延迟真源写入口')

const bpa = readFileSync(join(root, 'src/board-preview/BoardPreviewApp.vue'), 'utf8')
const sharedLib = readFileSync(join(root, 'src/lib/deliverableAssetPaths.js'), 'utf8')
const serverRender = readFileSync(join(root, 'server/renderDeliverableHtml.js'), 'utf8')

ok('共享真源存在：src/lib/deliverableAssetPaths.js 本体（零 node 依赖，浏览器可加载）', () => {
  assert.ok(sharedLib.includes('export function normalizeDeliverableAssetPaths'), '共享模块应导出归一函数')
  assert.ok(!sharedLib.includes("from 'fs'") && !sharedLib.includes("from 'path'"), '共享模块必须零 node 依赖')
})

ok('服务端 re-export 共享真源（不平行另写一套）', () => {
  assert.ok(serverRender.includes("from '../src/lib/deliverableAssetPaths.js'"), 'renderDeliverableHtml 应 import 共享真源')
  assert.ok(!/export function normalizeDeliverableAssetPaths\(deliverable\)\s*\{/.test(serverRender), '服务端不得残留平行实现')
})

ok('AgentBDirect 客户端 JSON 出口接线共享归一（downloadDeliverableJson）', () => {
  assert.ok(src.includes("import { normalizeDeliverableAssetPaths } from '../lib/deliverableAssetPaths.js'"), '应 import 共享真源')
  assert.ok(/function downloadDeliverableJson\(\)[\s\S]{0,600}?normalizeDeliverableAssetPaths\(serializeCurrentDeliverableState\(\)\)/.test(src), '导出前应过归一')
})

ok('BoardPreviewApp 流水线 JSON 出口接线共享归一（pipelineJsonString，sequence+topicSpec 形状）', () => {
  assert.ok(bpa.includes("import { normalizeDeliverableAssetPaths } from '../lib/deliverableAssetPaths.js'"), '应 import 共享真源')
  assert.ok(/normalizeDeliverableAssetPaths\(data\)/.test(bpa), 'computed 内应调用归一')
})

ok('Task 40-F：BoardPreviewApp 要素表导出传字体选择（韶华档不再错写乔木）', () => {
  assert.ok(/function exportElementsMarkdown\(\)[\s\S]{0,600}?handwritingFontChoice:\s*meta\.value\?\.canvasParams\?\.fontSource\?\.handwriting\?\.choice/.test(bpa), '应从 canvasParams.fontSource 派生传选择')
})

ok('Task 40-E：openDeliverablePage 打开前重新固化（旧快照病根拔除）', () => {
  const fn = src.match(/async function openDeliverablePage\(\)[\s\S]{0,900}?\n\}/)
  assert.ok(fn, 'openDeliverablePage 应为 async 版本')
  assert.ok(fn[0].includes('serializeCurrentDeliverableState()'), '函数体内应实时序列化当前状态')
  assert.ok(fn[0].includes("method: 'POST'") && fn[0].includes("'/api/deliverable'"), '应 POST 重新固化后再开窗')
  assert.ok(!/openDeliverablePageFresh/.test(src), '不得残留平行双胞胎函数名')
})

ok('Task 40-②：updateBoardStartDelay 真源写入口（时间轴重算 + bCache 同步）', () => {
  assert.ok(/function updateBoardStartDelay\(index, delay\)[\s\S]{0,700}?applyAgentBV2Timeline\(rows\.value\)/.test(src), '改延迟必须重算时间轴')
  assert.ok(/function updateBoardStartDelay\(index, delay\)[\s\S]{0,800}?bCacheSet\(rows\.value,\s*generatedModel\.value\)/.test(src), '必须同步刷 B 缓存（防刷新蒸发，setRowAudioUrl 铁律）')
  assert.ok(/board-delay-input/.test(src) && /updateBoardStartDelay\(index, value\)/.test(src), '编辑卡应有延迟输入控件接线')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
