#!/usr/bin/env node
/**
 * test-player-mirror-parity.mjs — 播放器镜像行为对拍哨兵（★ Task 61 根治归一）
 *
 * 背景（61-a 全仓镜像普查实锤）：row-player.html 是单文件离线播放器（三胞胎 root/public/dist），
 *   无法 import src/ 真源，历史上靠「改那边必须同步这边」的注释约定人肉维护镜像，已炸出 3 处活 Bug：
 *   ① isRuleLine 双反斜杠正则（\\s 只删字面「\s」、\\- 构成 U+005C–U+2013 大区间）→ "abc"/"ok" 纯
 *      小写板书行被误判成横线整行画掉；
 *   ② superFilter ①' 字面量 \n 还原正则两侧语义分叉（真源窄正则连自家注释宣称保护的 \nS/\na 都护不住）；
 *   ③ PRINT_FONT 镜像比真源 QUESTION_FONT_FAMILY 多一层 system-ui，且 test-font D2 锁的是镜像自身
 *      字面量 = 把漂移焊死。
 *
 * 本哨兵把所有「约定同步」升级为「门禁同步」——四组锁：
 *   A. superFilter §5c 整节行为对拍：同一语料双跑播放器镜像块（沙箱求值）与真源，输出必须逐字一致
 *   B. 时序族行为对拍：isRuleLine / visualLen / readBrace / actionDurationMs / estSpeech 兜底公式 /
 *      isAudioSrc，播放器提取代码 vs src/agent-b-v2/timing.js 真源
 *   C. boardPlan 五处值锁：demo DATA / TAG_FALLBACK / 帮助面板文本 / Tuner 恢复预设 / question 兜底，
 *      全部与 boardLayout.js 真源 import 派生值比对（不锁镜像字面量——锁「真源值」防漂移）
 *   D. 值级锁：PRINT_FONT 与字体宪法逐值一致；CDN 六链 id 集合三文件（row-player/index/board-preview）一致
 *
 * 提取基建 = scripts/playerMirrorExtract.mjs（锚点全用函数名/banner，不依赖行号——行号会化石）。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  readPlayer, extractSection, extractTopLevelFunction,
  extractBracedObject, evalPure, evalEstSpeech,
} from './playerMirrorExtract.mjs'
import { normalizeBoardLine, toBoardLines, findUnsafeChars, boardTextToPlain } from '../src/utils/superFilter.js'
import {
  isRuleLine, visualLen, readBrace, isAudioSrc,
  estimateActionDuration, estimateSpeechDurationMs,
} from '../src/agent-b-v2/timing.js'
import { BOARD_LAYOUT, DEFAULT_BOARD_PLAN } from '../src/utils/boardLayout.js'
import { QUESTION_FONT_FAMILY } from '../src/services/stepHandoff.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(ROOT, f), 'utf-8')
let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

const player = readPlayer()
const noWs = (s) => String(s).replace(/\s+/g, '')

console.log('── 播放器镜像行为对拍哨兵（Task 61 根治归一）──')

// ═══ A. superFilter §5c 整节行为对拍 ═════════════════════════════════
const sfSection = extractSection(player, '5c. 板书文本规范化', '============ 6.')
const pm = evalPure(sfSection, ['normalizeBoardLine', 'toBoardLines', 'findUnsafeChars', 'boardTextToPlain'])

ok('A0 §5c 镜像节可提取可求值（节自足、无 DOM 依赖）', () => {
  assert.equal(typeof pm.normalizeBoardLine, 'function', 'normalizeBoardLine 未从镜像节求出')
  assert.equal(typeof pm.boardTextToPlain, 'function', 'boardTextToPlain 未从镜像节求出')
})

const SF_CASES = [
  'a\\r\\nb', '第一行\\n第二行', 'a \\neq b',
  '\\nS = 9', '\\na = 3', '\\nu 是希腊字母', '\\nabla 算子', '\\nnotin 保护',
  '\\nstep 2：画辅助线',
  'a\t\tb', '5 &times; 3', '3 &divide; 4',
  '5 × 3 = 15', 'x → y', 'a ≤ b', '温度 25℃', '∠A = 90°', 'a ≈ b', 'x ≠ y',
  '\\frac{1}{2}', '3/4',
  '<b>粗体</b>测试', 'a<br>b', '3 < x, 5 > x',
  '² ³ 上标', '第一行\n\n\n\n\n第二行', '\\$\\$公式\\$\\$',
  '，。、；：？！（）《》【】…—', 'hello WORLD 123', '解：设未知数为 x', '',
]
ok(`A1 normalizeBoardLine 共享语料 ${SF_CASES.length} 例双跑逐字一致（真源 vs 镜像）`, () => {
  for (const c of SF_CASES) {
    const a = JSON.stringify(pm.normalizeBoardLine(c))
    const b = JSON.stringify(normalizeBoardLine(c))
    assert.equal(a, b, `分叉用例 ${JSON.stringify(c)}：镜像=${a} 真源=${b}`)
  }
})

ok('A2 ①\' 单字母变量保护回归锁：\\nS / \\na 不再被还原成换行（Task 61 新语义）', () => {
  for (const c of ['\\nS = 9', '\\na = 3', '\\nu ²']) {
    const out = normalizeBoardLine(c)
    assert.ok(!out.includes('\n'), `${JSON.stringify(c)} 不应被还原为真实换行，实际: ${JSON.stringify(out)}`)
    assert.equal(JSON.stringify(pm.normalizeBoardLine(c)), JSON.stringify(out), `${JSON.stringify(c)} 两侧分叉`)
  }
})

ok('A3 ①\' 转义损伤修复保活：\\nstep / \\n中文 仍还原为换行', () => {
  assert.ok(normalizeBoardLine('\\nstep 2').includes('\n'), '\\nstep 应还原为换行')
  assert.ok(normalizeBoardLine('第一行\\n第二行').includes('\n'), 'CJK 后随 \\n 应还原')
  assert.equal(pm.normalizeBoardLine('\\nstep 2'), normalizeBoardLine('\\nstep 2'))
})

ok('A4 ①\' 超集正则双侧源文本同构（防一侧悄悄改回窄/宽正则）', () => {
  const re = String.raw`(?!(?:eq|ot|abla|otin|e\b|[a-zA-Z]\b))`
  assert.ok(player.includes(re), 'row-player ①\' 超集正则缺失')
  assert.ok(read('src/utils/superFilter.js').includes(re), '真源 superFilter.js ①\' 超集正则缺失')
})

ok('A5 toBoardLines / findUnsafeChars / boardTextToPlain 共享语料双跑一致', () => {
  const cases = ['第一行\n第二行', 'a\n\nb', '单行', '', null]
  for (const c of cases) {
    assert.equal(JSON.stringify(pm.toBoardLines(c)), JSON.stringify(toBoardLines(c)), `toBoardLines 分叉: ${JSON.stringify(c)}`)
  }
  for (const c of ['→ x', '中文，标点。', 'abc 123', '≤≥≠', 'ok']) {
    assert.equal(JSON.stringify(pm.findUnsafeChars(c)), JSON.stringify(findUnsafeChars(c)), `findUnsafeChars 分叉: ${c}`)
  }
  for (const c of ['\\frac{1}{2}', '→ 结果', '普通板书']) {
    assert.equal(JSON.stringify(pm.boardTextToPlain(c)), JSON.stringify(boardTextToPlain(c)), `boardTextToPlain 分叉: ${c}`)
  }
})

// ═══ B. 时序族行为对拍（播放器提取代码 vs timing.js 真源）═══════════════
const p_isRuleLine = evalPure(extractTopLevelFunction(player, 'isRuleLine'), ['isRuleLine']).isRuleLine
const p_readBrace = evalPure(extractTopLevelFunction(player, 'readBrace'), ['readBrace']).readBrace
const p_visualLen = evalPure(
  extractTopLevelFunction(player, 'readBrace') + '\n' + extractTopLevelFunction(player, 'visualLen'),
  ['visualLen'],
).visualLen
const p_actionDurationMs = evalPure(extractTopLevelFunction(player, 'actionDurationMs'), ['actionDurationMs']).actionDurationMs
const p_isAudioSrc = evalPure(extractTopLevelFunction(player, 'isAudioSrc'), ['isAudioSrc']).isAudioSrc
const p_estSpeech = evalEstSpeech(player)

ok('B0 时序族六件全可提取求值（isRuleLine/readBrace/visualLen/actionDurationMs/isAudioSrc/estSpeech）', () => {
  for (const f of [p_isRuleLine, p_readBrace, p_visualLen, p_actionDurationMs, p_isAudioSrc, p_estSpeech]) {
    assert.equal(typeof f, 'function')
  }
})

const RULE_CASES = ['————', '——', '— —', 'abc', 'ok', 'yes', 'cm', 'kg', '12', 'x', '',
  '解：x=1', '_ _', '======', '~~~~~~', '1———2', '──', '══', '━━', 'a-b-c', '　—', null, undefined]
ok(`B1 isRuleLine 共享语料 ${RULE_CASES.length} 例双跑一致`, () => {
  for (const c of RULE_CASES) {
    assert.equal(p_isRuleLine(c), isRuleLine(c), `isRuleLine 分叉: ${JSON.stringify(c)}`)
  }
})
ok('B2 isRuleLine 修复回归锁：纯小写行不再误判横线（旧 \\- 大区间病理不复活）', () => {
  for (const c of ['abc', 'ok', 'yes', 'cm', 'kg']) assert.equal(p_isRuleLine(c), false, `${c} 应为普通文字行`)
  for (const c of ['————', '——', '_ _', '======']) assert.equal(p_isRuleLine(c), true, `${c} 应为横线行`)
  assert.equal(isRuleLine('abc'), false)
})

ok('B3 visualLen 语料一致（\\frac 记 a+b+1 视觉单位）', () => {
  for (const c of ['\\frac{1}{2}', '普通中文文本', 'abc 123', '\\frac{12}{34}+x', '\\frac{a+b}{c-d}', '', '一——二']) {
    assert.equal(p_visualLen(c), visualLen(c), `visualLen 分叉: ${JSON.stringify(c)}`)
  }
})

ok('B4 readBrace 非嵌套语料一致', () => {
  for (const s of ['\\frac{1}{2}', '\\frac{12}{34}', '\\frac{a+b}{c-d}']) {
    assert.deepEqual(p_readBrace(s, 5), readBrace(s, 5), `readBrace 分叉: ${s}`)
  }
})
ok('B5 readBrace 嵌套差异显式锁档（估算域已知分工：镜像剥内层花括号 7 字 vs 真源 slice 保留 9 字）', () => {
  const nested = '\\frac{\\frac{1}{2}}{3}'
  const a = p_readBrace(nested, 5).text
  const b = readBrace(nested, 5).text
  assert.notEqual(a, b, '嵌套 readBrace 两侧实现不同——若此处变为相等，说明有一侧实现被改动，须重新评估锁档')
  assert.equal(a, '\\frac12', '镜像剥花括号口径锁档')
  assert.equal(b, '\\frac{1}{2}', '真源 slice 口径锁档')
})

ok('B6 actionDurationMs 分档语料一致（circle 1000 / ≤5字 1000 / >5字 1500 / >10字 2000 / 横线兜底 1000）', () => {
  const cases = [
    { tool: 'rough-notation', action: 'circle' },
    { tool: 'rough-notation', action: 'underline', target: { exactText: '三字' } },
    { tool: 'rough-notation', action: 'underline', target: { exactText: '六个字的锚' } },
    { tool: 'rough-notation', action: 'underline', target: { exactText: '这是一个超过十字的超长锚文本' } },
    { tool: 'rough-notation', action: 'underline' },
    { tool: 'rough-line' },
    { tool: 'unknown-tool' },
    null,
    { action: { tool: 'rough-notation', action: 'circle' } },
    'just a string',
  ]
  for (const c of cases) {
    assert.equal(p_actionDurationMs(c), estimateActionDuration(c), `动作分档分叉: ${JSON.stringify(c)}`)
  }
})

ok('B7 estSpeech 兜底公式语料一致（160cpm + 标点停顿 + 1500 下限；替代旧 G1 手抄第三份）', () => {
  for (const c of ['这道题我们来看一下。', '我们来看第一步，先读题。', '纯英文没有标点', '12345', '',
    '带省略号……的句子', '这题很简单。真的，很简单。', '   空白开头   ']) {
    assert.equal(p_estSpeech({ speech: c }), estimateSpeechDurationMs(c), `estSpeech 分叉: ${JSON.stringify(c)}`)
  }
})

ok('B8 isAudioSrc URL 语料一致（data:/blob:/http:/相对路径/扩展名五通道）', () => {
  for (const c of ['https://a.com/x.mp3', 'data:audio/mp3;base64,AAA', 'blob:http://x/y', './a.mp3',
    '../a.wav', '/abs/path/a.m4a', 'x.ogg', 'plain text', '', 'audio.mp4?start=1', 'x.jpeg', 'a.MP3', 123, null]) {
    assert.equal(p_isAudioSrc(c), isAudioSrc(c), `isAudioSrc 分叉: ${JSON.stringify(c)}`)
  }
})

// ═══ C. boardPlan 五处值锁（真源 import 派生，不锁镜像字面量）════════════
const parseObj = (text) => new Function(`return ${text}`)()
const checkPlanAgainstTruth = (plan, name, extra) => {
  assert.deepEqual(plan.canvas, { w: 1726, h: 980 }, `${name} canvas 尺寸分叉`)
  for (const k of ['topicLabel', 'analysisLabel', 'solutionLabel', 'summaryLabel', 'analysis', 'solution', 'summary']) {
    assert.deepEqual(plan[k], BOARD_LAYOUT[k], `${name}.${k} 与 BOARD_LAYOUT 分叉`)
  }
  for (const p of ['x', 'y', 'w']) {
    assert.equal(plan.question[p], BOARD_LAYOUT.question[p], `${name}.question.${p} 与 BOARD_LAYOUT 分叉`)
  }
  if (extra) for (const [k, v] of Object.entries(extra)) {
    assert.equal(plan.question[k], v, `${name}.question.${k} 锁档值漂移`)
  }
}

ok('C1 demo DATA.boardPlan 九键 == BOARD_LAYOUT 真源（question.h:22 播放器私档锁档）', () => {
  const demo = parseObj(extractBracedObject(player, 'boardPlan: {'))
  checkPlanAgainstTruth(demo, 'demo', { h: 22 })
})
ok('C2 Tuner 恢复预设九键 == BOARD_LAYOUT 真源（含 question.h:22 锁档）', () => {
  const tuner = parseObj(extractBracedObject(player, 'DATA.boardPlan={'))
  checkPlanAgainstTruth(tuner, 'Tuner', { h: 22 })
})
ok('C3 TAG_FALLBACK 四标签锚 == BOARD_LAYOUT 标签 x/y', () => {
  const tf = parseObj(extractBracedObject(player, 'const TAG_FALLBACK='))
  const expect = {
    题目: { x: BOARD_LAYOUT.topicLabel.x, y: BOARD_LAYOUT.topicLabel.y },
    分析: { x: BOARD_LAYOUT.analysisLabel.x, y: BOARD_LAYOUT.analysisLabel.y },
    解答: { x: BOARD_LAYOUT.solutionLabel.x, y: BOARD_LAYOUT.solutionLabel.y },
    总结: { x: BOARD_LAYOUT.summaryLabel.x, y: BOARD_LAYOUT.summaryLabel.y },
  }
  assert.deepEqual(tf, expect, 'TAG_FALLBACK 与真源标签锚分叉')
})
ok('C4 帮助面板标签锚文本 == BOARD_LAYOUT 派生串（防文本副本悄悄改数）', () => {
  const expected = `题目 topicLabel (${BOARD_LAYOUT.topicLabel.x}, ${BOARD_LAYOUT.topicLabel.y})`
    + ` / 分析 analysisLabel (${BOARD_LAYOUT.analysisLabel.x}, ${BOARD_LAYOUT.analysisLabel.y})`
    + ` / 解答 solutionLabel (${BOARD_LAYOUT.solutionLabel.x}, ${BOARD_LAYOUT.solutionLabel.y})`
    + ` / 总结 summaryLabel (${BOARD_LAYOUT.summaryLabel.x}, ${BOARD_LAYOUT.summaryLabel.y})`
  assert.ok(player.includes(expected), `帮助面板文本副本失真，期望含: ${expected}`)
})
ok('C5 question 兜底 {x:6,y:13.2,w:40.4} == DEFAULT_BOARD_PLAN.question 三键（文字宽口径）', () => {
  assert.ok(player.includes('{x:6,y:13.2,w:40.4,h:26}'), 'question 兜底字面量缺失')
  assert.equal(DEFAULT_BOARD_PLAN.question.x, 6)
  assert.equal(DEFAULT_BOARD_PLAN.question.y, 13.2)
  assert.equal(DEFAULT_BOARD_PLAN.question.w, 40.4)
})

// ═══ D. 值级锁 ═══════════════════════════════════════════════════════
ok('D1 PRINT_FONT 与字体宪法 QUESTION_FONT_FAMILY 逐值一致（system-ui 漂移不复活）', () => {
  const m = player.match(/const PRINT_FONT='([^']*)';/)
  assert.ok(m, 'PRINT_FONT 行未命中')
  assert.equal(noWs(m[1]), noWs(QUESTION_FONT_FAMILY), `PRINT_FONT 分叉: 镜像=${m[1]} 真源=${QUESTION_FONT_FAMILY}`)
})
ok('D2 CDN 六链 id 集合三文件一致（row-player / index.html / board-preview.html；双 507=主链+noscript 合法）', () => {
  const re = /fontsapi\.zeoseven\.com\/(\d+)\/main\/result\.css/g
  // 去重后锁 id 集合：index/board-preview 各有 507 主链+noscript 回退双份（test-font C1/C3 锁的正是双份形态）
  const pick = (s) => [...new Set([...s.matchAll(re)].map((x) => x[1]))].sort().join(',')
  const rp = pick(player)
  assert.equal(rp, '157,490,507,509,510,511', `row-player CDN 链漂移: ${rp}`)
  assert.equal(pick(read('index.html')), rp, 'index.html CDN 链与播放器分叉')
  assert.equal(pick(read('board-preview.html')), rp, 'board-preview.html CDN 链与播放器分叉')
})

console.log(`\n== 播放器镜像对拍哨兵: ${pass} 通过 / ${fail} 失败 ==`)
if (fail > 0) process.exit(1)
