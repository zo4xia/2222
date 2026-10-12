/* 下载物唯一真相源贯通验证（可复跑）
 * 跑法：node scripts/verifyDeliverableTruthSource.mjs
 * 检查四件事：
 *   1. 完整要素表 MD 与分镜表 MD 都包含同一份「规范说明参数」段落（buildStandardExplainParamsSection）；
 *   2. 说明段落四节齐全，且关键值来自 handoff 动态读取（画布 1726×980 / 题目 30px / 板书 38px / 行高 1.65 / 160 字/分兜底 / 截图地址 / 环节配比）；
 *   3. serializeDeliverableState 根节点完整注入 canvasParams / uiSettings / problemInfo；
 *   4. writeDeliverableFile 写入的实体 JSON、current.json 指针、模板注入的单页 HTML 三者一致携带真相源块。
 * 安全：本脚本会临时生成一个归档产物并覆盖 current 指针，跑完立即恢复并删除临时产物。
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  buildElementsMarkdown,
  buildStoryboardMarkdown,
  parseBoardField,
} from '../src/lib/speechMarkdown.js'
import { serializeDeliverableState } from '../src/agent-b-v2/serializeDeliverableState.js'
import { computeRowGroupTimeline } from '../src/agent-b-v2/timing.js'
import { writeDeliverableFile } from '../server/deliverableStoreHandler.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HANDOFF_DIR = resolve(root, 'public/handoff')
const DELIVERABLE_DIR = resolve(root, 'public/deliverable')
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// ---------- 1. 读真实 handoff（真相源输入） ----------
const pointer = JSON.parse(readFileSync(resolve(HANDOFF_DIR, 'current.json'), 'utf8'))
const handoff = JSON.parse(readFileSync(resolve(HANDOFF_DIR, pointer.filename), 'utf8'))

const uiSettings = {
  coordinateMode: 'percentage',
  questionFontSize: 30,
  questionFontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  questionLineHeight: 1.65,
  rowGapMs: 1500,
  speechSpeed: 160,
}
// 与 AgentBDirect.buildProblemInfoSnapshot 同构：全部从 handoff 动态读取
const problemInfo = {
  screenshotUrl: handoff.screenshotUrl || '',
  problemType: handoff.problemType || '',
  boardFocus: handoff.boardFocus || '',
  imageKind: handoff.imageKind || '',
  gradeLevel: handoff.suggestedGrade || '',
  relatedKnowledge: handoff.relatedKnowledge || [],
  knowledgeAnalysis: handoff.knowledgeAnalysis || null,
  essence: handoff.essence || '',
  stageRatio: handoff.stageRatioSuggestion || handoff.环节配比占比 || null,
  zoneAnchors: handoff.zoneAnchors || null,
}

const meta = {
  problemText: handoff.problemText || '',
  model: 'unit-test',
  generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  canvasParams: uiSettings,
  handoffCanvasParams: handoff.canvasParams || null,
  handoffBoardPlan: handoff.boardPlan || null,
  handoffZoneAnchors: handoff.zoneAnchors || null,
  problemInfo,
  screenshotUrl: handoff.screenshotUrl || '',
}
const rows = [
  { stage: '分析', speech: '先看清题目给了什么。', board: { content: '已知：8列', startCoord: '[6%,41%]' }, audioUrl: '', audioDurationMs: 0, actionSpec: [] },
  { stage: '解答', speech: '列式计算总人数。', board: { content: '8 x 8 = 64（人）', triggerKeyword: '列式' }, audioUrl: '/audio/a.mp3', audioDurationMs: 4200, actionSpec: [] },
]

// ---------- 2. 两份 MD 的规范说明段落 ----------
const SECTIONS = [
  '## 规范说明参数（下载物唯一真相源）',
  '### 1. handoff 画布参数（真相源）',
  '### 2. handoff 四区布局（真相源）',
  '### 3. UI 可调参数（B 页面设置）',
  '### 4. 题目全量信息与环节配比',
]
const elementsMd = buildElementsMarkdown(rows, meta)
const storyboardMd = buildStoryboardMarkdown(rows, meta)
for (const [label, md] of [['完整要素表', elementsMd], ['分镜表', storyboardMd]]) {
  const missing = SECTIONS.filter((s) => !md.includes(s))
  check(`${label} MD 含完整规范说明段落`, missing.length === 0, missing.length ? `缺：${missing.join(' / ')}` : '四节齐全')
}

const truthBlock = elementsMd.slice(elementsMd.indexOf('## 规范说明参数'), elementsMd.indexOf('## 规范说明参数') + 2600)
const values = {
  '画布 1726 × 980': /1726 × 980 px/,
  '题目 30px': /30px/,
  '板书 38px': /38px/,
  '行高 1.65': /1\.65/,
  '音频 160 字/分兜底': /160 字\/分估算兜底/,
  '截图地址': new RegExp(String(handoff.screenshotUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  '环节配比（解答占比）': new RegExp(problemInfo.stageRatio?.suggestedRatio?.solution || '__never__'),
  '动态锚点': /区域\(|标签\(/,
  '板书速度（1秒2~3字±10%）': /1秒约2~3个汉字，每行±10%轻微抖动/,
}
for (const [name, re] of Object.entries(values)) check(`说明段落含 ${name}`, re.test(truthBlock))

// ---------- 3. 序列化根节点注入 ----------
const parseBoard = (board) => {
  const parsed = parseBoardField(board)
  const raw = board && typeof board === 'object' ? board : {}
  return {
    content: parsed.content,
    lines: parsed.lines,
    startCoord: raw.startCoord ?? null,
    triggerKeyword: raw.triggerKeyword ?? null,
    startDelay: typeof raw.startDelay === 'number' ? raw.startDelay : 0,
  }
}
const payload = serializeDeliverableState({
  rows,
  projectCode: 'unit-test-000',
  problemText: handoff.problemText || '',
  sourceImageUrl: '',
  keepOriginal: Boolean(handoff.keepOriginal),
  topicLayout: handoff.topicLayout || null,
  boardPlan: handoff.boardPlan || null,
  screenshotUrl: handoff.screenshotUrl || '',
  handoffCanvasParams: handoff.canvasParams || null,
  uiSettings,
  problemInfo,
  problemType: handoff.problemType || '',
  boardFocus: handoff.boardFocus || '',
  gradeLevel: handoff.suggestedGrade || '',
  knowledgeTitle: '单元测试',
  canvasSize: { width: 1726, height: 980 },
  totalDuration: 10,
  totalDurationText: '10秒',
  charCount: 20,
  actionCount: 0,
  checkApplied: false,
  changeCount: 0,
  parseBoard,
  safeDeepClone: (v) => JSON.parse(JSON.stringify(v ?? null)),
  computeRowGroupTimeline,
})
check('序列化根节点注入 canvasParams', !!payload.canvasParams?.canvasSize, `画布 ${payload.canvasParams?.canvasSize?.width}×${payload.canvasParams?.canvasSize?.height}`)
check('序列化根节点注入 uiSettings', !!payload.uiSettings?.coordinateMode, `坐标方式 ${payload.uiSettings?.coordinateMode}`)
check('序列化根节点注入 problemInfo', !!payload.problemInfo?.stageRatio, `解答配比 ${payload.problemInfo?.stageRatio?.suggestedRatio?.solution}`)

// ---------- 4. 落盘对齐（实体 JSON / current 指针 / 单页 HTML） ----------
const pointerPath = resolve(DELIVERABLE_DIR, 'current.json')
const currentHtmlPath = resolve(DELIVERABLE_DIR, 'current.html')
const backup = {
  pointer: existsSync(pointerPath) ? readFileSync(pointerPath, 'utf8') : null,
  html: existsSync(currentHtmlPath) ? readFileSync(currentHtmlPath, 'utf8') : null,
}
let written
try {
  written = writeDeliverableFile(payload)
  const entityPath = resolve(DELIVERABLE_DIR, written.filename)
  const entity = JSON.parse(readFileSync(entityPath, 'utf8'))
  const html = readFileSync(resolve(DELIVERABLE_DIR, written.htmlFilename), 'utf8')
  const ptr = JSON.parse(readFileSync(pointerPath, 'utf8'))

  check('实体 JSON 归档含三个真相源块',
    !!entity.canvasParams && !!entity.uiSettings && !!entity.problemInfo,
    Object.keys(entity).filter((k) => ['canvasParams', 'uiSettings', 'problemInfo'].includes(k)).join('/'))
  check('current.json 指针含完整 deliverable（含三块）',
    ptr?.deliverable?.canvasParams && ptr?.deliverable?.uiSettings && ptr?.deliverable?.problemInfo && ptr.htmlFilename === written.htmlFilename,
    `filename=${ptr.filename}`)
  check('单页 HTML 由模板注入驱动且含真相源块',
    html.includes('window.__INITIAL_DELIVERABLE__') && html.includes('"canvasParams"') && html.includes('"problemInfo"'),
    `${Math.round(html.length / 1024)}KB`)
} finally {
  if (written) {
    rmSync(resolve(DELIVERABLE_DIR, written.filename), { force: true })
    rmSync(resolve(DELIVERABLE_DIR, written.htmlFilename), { force: true })
  }
  if (backup.pointer) writeFileSync(pointerPath, backup.pointer, 'utf8'); else rmSync(pointerPath, { force: true })
  if (backup.html) writeFileSync(currentHtmlPath, backup.html, 'utf8'); else rmSync(currentHtmlPath, { force: true })
}

// ---------- 输出：参数表全文（肉眼核对要素完整性） ----------
console.log('\n===== 规范说明参数段落（完整要素表 MD 实测输出）=====')
console.log(elementsMd.slice(elementsMd.indexOf('## 规范说明参数'), elementsMd.indexOf('## 规范说明参数') + 2600))

const failed = results.filter((r) => !r.ok)
console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length ? 1 : 0)
