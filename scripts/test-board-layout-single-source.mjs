#!/usr/bin/env node
/**
 * test-board-layout-single-source.mjs — Task 60 坐标归一哨兵（防「一处改动镜像不同步」老路坑）
 * 背景：历史上四区默认坐标有 7 份手抄副本（AgentBDirect×3 / deliverableStoreHandler×2 /
 * speechMarkdown×2），其中 13.32/40.32 是某次 layoutSeed 抖动快照被误冻结成常量、
 * 40.62/54.38 是程序规划输出——两个值系并存导致「同一缺省场景、不同页面见到不同默认」。
 * Task 60 归一后唯一真源 = boardLayout.js 的 DEFAULT_BOARD_PLAN = planLabelsFromTopic({...})派生，
 * 本哨兵锁死：
 *   1. DEFAULT_BOARD_PLAN 结构与关键数值（防派生源被改动后悄悄漂移）
 *   2. 全仓 src/+server/ 不再出现抖动快照字面量 13.32/40.32（防手抄复活）
 *   3. 三处消费方都 import DEFAULT_BOARD_PLAN（防改回手抄）
 *   4. applyBoardPlanRevision 三处同步契约（布局修订不再只覆写 boardPlan）
 *   5. row-player 异端兜底已对齐（y:12/w:42 不得复活，三胞胎一致）
 *   6. 死 localStorage 键不得复活写入（qinghuabu.topicLayout / qinghuabu.problemText）
 *   7. bCache 缓存键含 boardPlan 九键摘要（布局指纹不再只有 question.x）
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf-8')
let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('── 四区坐标单一真源哨兵（Task 60 归一）──')

// ── 1. 派生真源存在与结构 ──────────────────────────────────────────────
ok('A1: boardLayout.js 导出 DEFAULT_BOARD_PLAN（派生非手抄）', () => {
  const s = read('src/utils/boardLayout.js')
  assert.ok(/export const DEFAULT_BOARD_PLAN = planLabelsFromTopic\(/.test(s),
    'DEFAULT_BOARD_PLAN 必须由 planLabelsFromTopic 派生，不得手抄数字')
})

ok('A2: boardLayout.js 导出两个口径显式常量（40.4 文字宽 / 38 竖图宽）', () => {
  const s = read('src/utils/boardLayout.js')
  assert.ok(/export const TOPIC_TEXT_W_PCT = 40\.4/.test(s), 'TOPIC_TEXT_W_PCT 常量缺失')
  assert.ok(/export const TOPIC_IMAGE_W_PCT = 38/.test(s), 'TOPIC_IMAGE_W_PCT 常量缺失')
})

// 动态 import 跑真派生（与运行时同一条代码路径）
const mod = await import(join(root, 'src/utils/boardLayout.js'))
const { DEFAULT_BOARD_PLAN, BOARD_LAYOUT } = mod

ok('A3: DEFAULT_BOARD_PLAN 九键齐全', () => {
  const keys = ['topicLabel', 'question', 'image', 'analysisLabel', 'analysis',
    'solutionLabel', 'solution', 'summaryLabel', 'summary']
  for (const k of keys) assert.ok(k in DEFAULT_BOARD_PLAN, `缺键: ${k}`)
})

ok('A4: DEFAULT_BOARD_PLAN question = {6, 13.2, 40.4, 30}（去抖动真值）', () => {
  assert.equal(DEFAULT_BOARD_PLAN.question.x, 6)
  assert.equal(DEFAULT_BOARD_PLAN.question.y, 13.2)
  assert.equal(DEFAULT_BOARD_PLAN.question.w, 40.4)
  assert.equal(DEFAULT_BOARD_PLAN.question.fontSize, 30)
})

ok('A5: DEFAULT_BOARD_PLAN analysis = {6, 40.62, 44, 54.38}（程序规划真产物）', () => {
  assert.equal(DEFAULT_BOARD_PLAN.analysis.x, 6)
  assert.equal(DEFAULT_BOARD_PLAN.analysis.y, 40.62)
  assert.equal(DEFAULT_BOARD_PLAN.analysis.w, 44)
  assert.equal(DEFAULT_BOARD_PLAN.analysis.h, 54.38)
})

ok('A6: DEFAULT_BOARD_PLAN solution/summary 与 BOARD_LAYOUT 一致', () => {
  assert.deepEqual(
    { ...DEFAULT_BOARD_PLAN.solution, ...DEFAULT_BOARD_PLAN.summary },
    { ...BOARD_LAYOUT.solution, ...BOARD_LAYOUT.summary },
  )
})

ok('A7: 标签键与 BOARD_LAYOUT 一致（topicLabel/analysisLabel 等）', () => {
  for (const k of ['topicLabel', 'analysisLabel', 'solutionLabel', 'summaryLabel']) {
    assert.deepEqual(DEFAULT_BOARD_PLAN[k], BOARD_LAYOUT[k], `${k} 与 BOARD_LAYOUT 分叉`)
  }
})

// ── 2. 抖动快照字面量不得复活 ─────────────────────────────────────────
const jitterWatchFiles = [
  'src/agent-b-v2/AgentBDirect.vue',
  'server/deliverableStoreHandler.js',
  'src/lib/speechMarkdown.js',
  'src/components/Step1Entry.vue',
  'src/components/BoardContentLayer.vue',
  'src/components/RealBoardPreview.vue',
  'src/board-preview/BoardPreviewApp.vue',
]
ok('B1: 消费方源码无抖动快照字面量 13.32（7 文件扫描）', () => {
  for (const f of jitterWatchFiles) {
    assert.ok(!/13\.32/.test(read(f)), `${f} 出现 13.32——抖动快照手抄复活`)
  }
})
ok('B2: 消费方源码无抖动快照字面量 40.32（7 文件扫描）', () => {
  for (const f of jitterWatchFiles) {
    assert.ok(!/40\.32/.test(read(f)), `${f} 出现 40.32——抖动快照手抄复活`)
  }
})

// ── 3. 三处消费方 import 真源 ─────────────────────────────────────────
ok('C1: AgentBDirect.vue import DEFAULT_BOARD_PLAN（3 处 fallback 用真源）', () => {
  const s = read('src/agent-b-v2/AgentBDirect.vue')
  assert.ok(/import \{ DEFAULT_BOARD_PLAN \} from '\.\.\/utils\/boardLayout\.js'/.test(s),
    'import 缺失')
  assert.ok(s.includes('|| DEFAULT_BOARD_PLAN'), 'hbp 兜底未用真源')
  assert.ok((s.match(/\?\? DEFAULT_BOARD_PLAN\./g) || []).length >= 12,
    'payload.boardPlan 逐键兜底应 ≥12 处 DEFAULT_BOARD_PLAN 引用')
})

ok('C2: deliverableStoreHandler.js import DEFAULT_BOARD_PLAN（2 处 fallback 用真源）', () => {
  const s = read('server/deliverableStoreHandler.js')
  assert.ok(/import \{ DEFAULT_BOARD_PLAN \} from '\.\.\/src\/utils\/boardLayout\.js'/.test(s),
    'import 缺失')
  assert.ok(s.includes('|| DEFAULT_BOARD_PLAN'), 'hbp 兜底未用真源')
})

ok('C3: speechMarkdown.js import DEFAULT_BOARD_PLAN（fallback + 表格逐键用真源）', () => {
  const s = read('src/lib/speechMarkdown.js')
  assert.ok(/import \{ DEFAULT_BOARD_PLAN \} from '\.\.\/utils\/boardLayout\.js'/.test(s),
    'import 缺失')
  assert.ok(s.includes('|| DEFAULT_BOARD_PLAN'), 'rawHbp 兜底未用真源')
})

// ── 4. 布局修订三处同步契约 ───────────────────────────────────────────
ok('D1: stepHandoff.js 导出 applyBoardPlanRevision + extractZoneAnchors', () => {
  const s = read('src/services/stepHandoff.js')
  assert.ok(/export function applyBoardPlanRevision/.test(s), 'applyBoardPlanRevision 未导出')
  assert.ok(/export function extractZoneAnchors/.test(s), 'extractZoneAnchors 未导出')
})

const handoffMod = await import(join(root, 'src/services/stepHandoff.js'))
ok('D2: applyBoardPlanRevision 三处同步（boardPlan+zoneAnchors+topicLayout）', () => {
  const fakeHandoff = {
    problemText: '测试题',
    boardPlan: { topicLabel: { x: 1, y: 1, w: 1 }, question: { x: 1, y: 1, w: 10 }, analysis: { x: 1, y: 1, w: 10, h: 10 } },
    zoneAnchors: { question: { labelStartCoord: { x: 1, y: 1 } } },
    topicLayout: { topicLabel: { x: 1, y: 1, w: 1 }, question: { x: 1, y: 1, w: 10 } },
  }
  const newPlan = {
    topicLabel: { x: 5.7, y: 6.6, w: 7.1 },
    question: { x: 6, y: 20, w: 40.4, fontSize: 30 },
    analysis: { x: 6, y: 45, w: 44, h: 50 },
    image: null,
  }
  const out = handoffMod.applyBoardPlanRevision(fakeHandoff, newPlan)
  assert.equal(out.boardPlan, newPlan, 'boardPlan 未覆写')
  assert.equal(out.zoneAnchors?.analysis?.regionStartCoord?.y, 45, 'zoneAnchors 未按新 boardPlan 重派生')
  assert.equal(out.topicLayout.question.y, 20, 'topicLayout.question 未同步新坐标')
  assert.equal(out.topicLayout.topicLabel.x, 5.7, 'topicLayout.topicLabel 未同步新坐标')
  assert.equal(out.topicLayout.image, null, 'topicLayout.image 未同步')
})

ok('D3: AgentBDirect 修订链走 applyBoardPlanRevision（不再裸覆写 boardPlan）', () => {
  const s = read('src/agent-b-v2/AgentBDirect.vue')
  assert.ok(s.includes('applyBoardPlanRevision(localHandoff.value, revision.boardPlan)'),
    '修订链必须经 applyBoardPlanRevision 三处同步')
  assert.ok(!s.includes('{ ...localHandoff.value, boardPlan: revision.boardPlan }'),
    '旧裸覆写形态不得残留（会漏同步 zoneAnchors/topicLayout）')
})

// ── 5. row-player 异端兜底不复活 ─────────────────────────────────────
ok('E1: row-player 题目兜底对齐真源口径 {x:6,y:13.2,w:40.4}（三胞胎一致）', () => {
  const s = read('row-player.html')
  assert.ok(!/y:12,w:42/.test(s), '异端兜底 {y:12,w:42} 复活')
  assert.ok(s.includes('{x:6,y:13.2,w:40.4,h:26}'), '对齐后的兜底形态缺失')
})
ok('E2: row-player Tuner 恢复预设仍用 BOARD_LAYOUT 名义值（镜像注释可查）', () => {
  const s = read('row-player.html')
  // Tuner 恢复预设九键 = BOARD_LAYOUT 名义值（Set A：question y:13.2、analysis y:41.0/h:48）——
  // 独立 HTML 无法 import，此处锁「名义值不变」防悄悄漂移（Task 60 归一保留的刻意镜像）
  assert.ok(/x:5\.7,y:6\.6/.test(s), 'Tuner 预设 topicLabel 名义值缺失')
  assert.ok(/y:13\.2,w:44\.0,h:22\.0/.test(s), 'Tuner 预设 question 名义值缺失')
  assert.ok(/y:41\.0,w:44\.0,h:48\.0/.test(s), 'Tuner 预设 analysis 名义值缺失（Set A 41/48）')
})

// ── 6. 死 localStorage 键不得复活 ─────────────────────────────────────
ok('F1: 死键 qinghuabu.topicLayout / qinghuabu.problemText 不再写入（全 src 扫描）', () => {
  const files = [
    'src/components/Step1Entry.vue',
    'src/components/BoardContentLayer.vue',
  ]
  for (const f of files) {
    const s = read(f)
    assert.ok(!s.includes("setItem('qinghuabu.topicLayout'"), `${f} 复活死键 topicLayout`)
    assert.ok(!s.includes("setItem('qinghuabu.problemText'"), `${f} 复活死键 problemText`)
  }
})

// ── 7. bCache 布局指纹九键化 ──────────────────────────────────────────
ok('G1: bCache 缓存键含 boardPlan 九键摘要（不再只有 question.x）', () => {
  const s = read('src/agent-b-v2/composables/useBCache.js')
  assert.ok(s.includes('boardPlanDigest'), 'boardPlanDigest 缺失')
  assert.ok(!s.includes('h.boardPlan?.question?.x'), '旧单值指纹残留')
  for (const k of ['analysis', 'solution', 'summary']) {
    assert.ok(new RegExp(`'${k}',`).test(s), `九键清单缺 ${k}`)
  }
})

// ── 8. 文档镜像不失真 ─────────────────────────────────────────────────
ok('H1: board-zone-layout SKILL.md 字号镜像已同步 40px（Task 56 宪法）', () => {
  const s = read('skills/board-zone-layout/SKILL.md')
  assert.ok(!/~38px/.test(s), '38px 旧字号残留（Task 56 已改 40）')
  assert.ok(/~40px/.test(s), '40px 新字号缺失')
})

ok('H2: 幽灵引用 boardMathPolicy 全仓清挖（SKILL.md/meta.json/doc）', () => {
  for (const f of ['skills/board-zone-layout/SKILL.md', 'doc/board_resource_list.md']) {
    const s = read(f)
    assert.ok(!/src\/services\/boardMathPolicy\.js/.test(s), `${f} 仍有幽灵文件活引用`)
  }
  const meta = read('skills/board-zone-layout/meta.json')
  assert.ok(!meta.includes('"src/services/boardMathPolicy.js"'), 'meta.json sources 仍有幽灵条目')
})

console.log(`\n== 坐标单一真源哨兵: ${pass} 通过 / ${fail} 失败 ==`)
if (fail > 0) process.exit(1)
