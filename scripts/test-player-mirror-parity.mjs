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
// ★ B13（Task 63 片1 抽核，夏夏「做减法」）：锚定引擎唯一 ESM 真源——与 row-player 内嵌版字节级同源对拍
import {
  findRange as core_findRange,
  sameBoardLine as core_sameBoardLine,
  tokenizeLine as core_tokenizeLine,
  readBrace as core_readBrace,
  REGION_STAGE_ZH,
  buildBoardAnchorFlow,
  buildQuestionAnchorFlow,
} from '../src/board-tools/boardAnchorCore.js'
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

// ── B9+ Task 62 下划线落点根治锁：findRange 行内匹配 + region 路由（夏夏实锤「画线位置/长度」）──
const p_findRange = evalPure(
  extractTopLevelFunction(player, 'findRange') + '\n' + extractTopLevelFunction(player, 'sameBoardLine'),
  ['findRange', 'sameBoardLine'],
).findRange

ok('B9 findRange 行内匹配行为锁：跨行/跨列目标不再命中（旧整池滑窗会把 x1 取自行尾、x2 取自次行行首）', () => {
  // 三行字池（行基线 y 递增，全局 li 不撞号）：行0「甲乙丙」/行1「乙丙丁」/行2「丙丁戊"
  const realPool = [
    { ch: '甲', x: 50, y: 100, w: 20, size: 40, li: 0 },
    { ch: '乙', x: 70, y: 100, w: 20, size: 40, li: 0 },
    { ch: '丙', x: 90, y: 100, w: 20, size: 40, li: 0 },
    { ch: '乙', x: 50, y: 140, w: 20, size: 40, li: 1 },
    { ch: '丙', x: 70, y: 140, w: 20, size: 40, li: 1 },
    { ch: '丁', x: 90, y: 140, w: 20, size: 40, li: 1 },
    { ch: '丙', x: 50, y: 180, w: 20, size: 40, li: 2 },
    { ch: '丁', x: 70, y: 180, w: 20, size: 40, li: 2 },
    { ch: '戊', x: 90, y: 180, w: 20, size: 40, li: 2 },
  ]
  // 行内命中：x1=首字x、x2=尾字x+w、y=行基线
  const r1 = p_findRange(realPool, '乙丙', 1)
  assert.equal(r1 && r1.x1, 70, '行内命中 x1 应为首字 x')
  assert.equal(r1 && r1.x2, 110, '行内命中 x2 应为尾字 x+w (90+20)')
  assert.equal(r1 && r1.size, 40, '板书命中应取实际字号 40')
  // 跨行拒绝：旧实现整池滑窗会命中（行0 尾「丙」+行1 首「乙丙」…），新实现必须 null
  assert.equal(p_findRange(realPool, '丙乙', 1), null, '跨行目标不得命中（位置/长度会乱）')
  assert.equal(p_findRange(realPool, '甲乙丙乙', 1), null, '跨行拼接目标不得命中')
  // 行内存在才命中：'丙丁' 在行1（丙 70 + 丁 90）与行2（丙 50 + 丁 70）各一次
  const r2 = p_findRange(realPool, '丙丁', 1)
  assert.ok(r2 && r2.x1 === 70 && r2.y1 === 140, 'occ=1 应命中行1 的 丙丁')
  const r3 = p_findRange(realPool, '丙丁', 2)
  assert.ok(r3 && r3.x1 === 50 && r3.y1 === 180, 'occ=2 应命中行2 的 丙丁（region 内第 N 次语义）')
  assert.equal(p_findRange(realPool, '丙丁', 3), null, 'occ 超界应 miss')
  // y 兜底分行（无 li 旧池）：同基线同行、跨基线拒绝
  const legacy = [
    { ch: '子', x: 10, y: 50, w: 20 },
    { ch: '丑', x: 30, y: 50, w: 20 },
    { ch: '寅', x: 10, y: 90, w: 20 },
  ]
  assert.ok(p_findRange(legacy, '子丑', 1), '无 li 池同基线应命中')
  assert.equal(p_findRange(legacy, '丑寅', 1), null, '无 li 池跨基线应拒绝')
  assert.equal(p_findRange(realPool, '', 1), null, '空串防御保留')
})

ok('B10 drawAction region 路由契约锁：契约教的 target.region 必须被执行器消费（校验放行、播放画错区的分叉不复活）', () => {
  // 源断言：路由分支读 tg.region 并按四区分流（与 textTargetRegistry VALID_REGIONS 同源）
  assert.ok(player.includes("String(tg.region||'').trim()"), 'drawAction 必须读取 target.region（旧实现无视 region 的病理不复活）')
  assert.ok(player.includes("c.stage===stg"), '板书区路由必须按字符 stage 过滤字池')
  for (const region of ["'question'", "'analysis'", "'solution'", "'summary'"]) {
    assert.ok(player.includes(`stg===${region}`) || player.includes(`===${region}`), `路由白名单必须含 ${region}`)
  }
  assert.ok(player.includes("if(!rg&&!stg)"), '缺 region 必须保留旧档兼容兜底（有 region 不得跨区兜底）')
  assert.ok(player.includes('跨行目标不画'), 'miss 文案必须含跨行语义（宁可不画，不可画错）')
  // 字池身份字段：boardCharPool 必须塞 stage + 全局 li
  assert.ok(player.includes('function boardCharPool(L,stage,liBase)'), 'boardCharPool 必须带 stage+liBase 双参（Task 62 路由/分行的地基）')
  assert.ok(player.includes('stage:stage,li:liBase+li'), '字池字符必须带 stage+li 身份字段')
  assert.ok(player.includes('liBase+=(L.layout||[]).length'), '全局行号基座必须按行数累加（防多 row 同名 li 撞号）')
})

ok('B11 occurrence 语义对齐锁：播放器桶内计数 = App 侧 region 内第 N 次（textTargetRegistry 契约同源）', () => {
  // region 路由后 findRange 只在分桶池内计数——B9 的 occ=1/2 行内用例已锁行为；
  // 此处锁契约源：prompt.js 必须教 Agent 输出 region（教了没消费才是 Task 62 修的病；两侧都不得退化）
  const promptSrc = read('src/agent-b-v2/prompt.js')
  assert.ok(promptSrc.includes('"region": "question"'), 'prompt §5.2 必须教 target.region=question（契约真源不退化）')
  assert.ok(promptSrc.includes('"region": "analysis"'), 'prompt §5.2 必须教板书区 region（四区白名单完整）')
  assert.ok(player.includes("c.stage===stg||c.stage===zh"), '板书区字池过滤必须走中英词汇桥双试（region 英文 / stage 中文两套契约词汇）')
  // 词汇桥中文值必须与 prompt.js §行结构 stage 硬约束枚举逐字一致（防映射单侧漂移）
  const bridge = player.match(/\{analysis:'([^']*)',solution:'([^']*)',summary:'([^']*)'\}/)
  assert.ok(bridge, '中英词汇桥常量缺失')
  assert.equal(bridge[1], '分析', 'analysis→分析 必须与 prompt stage 枚举一致')
  assert.equal(bridge[2], '解答', 'solution→解答 必须与 prompt stage 枚举一致')
  assert.equal(bridge[3], '总结', 'summary→总结 必须与 prompt stage 枚举一致')
  assert.ok(promptSrc.includes('题目 / 分析 / 解答 / 总结'), 'prompt stage 中文硬约束枚举在场（词汇桥的上游真源）')
})

ok('B12 题目区跨折行分段锁（Task 63 夏夏「题目字号 30、自动文本换行」）：allowWrap 连续流匹配+按行切段，跨折行 exactText 分段命中不再整条拒画；板书语义（无 allowWrap 跨行=null）不破', () => {
  // 题目形池（layoutText 产：无 size 字段、li 行号、基线 y 递增）三行
  const qPool = [
    { ch: '甲', x: 50, y: 100, w: 20, li: 0 },
    { ch: '乙', x: 70, y: 100, w: 20, li: 0 },
    { ch: '丙', x: 90, y: 100, w: 20, li: 0 },
    { ch: '乙', x: 50, y: 140, w: 20, li: 1 },
    { ch: '丙', x: 70, y: 140, w: 20, li: 1 },
    { ch: '丁', x: 90, y: 140, w: 20, li: 1 },
    { ch: '丙', x: 50, y: 180, w: 20, li: 2 },
    { ch: '丁', x: 70, y: 180, w: 20, li: 2 },
    { ch: '戊', x: 90, y: 180, w: 20, li: 2 },
  ]
  // ① 跨折行分段命中：'丙乙' = 行0 末字 + 行1 首字 → 2 段、每段行内几何（乱线不可能）
  const w1 = p_findRange(qPool, '丙乙', 1, { allowWrap: true })
  assert.ok(w1, 'allowWrap 跨折行必须命中（旧行内匹配整条拒画=静默丢下划线）')
  assert.equal(w1.segments.length, 2, '跨折行命中必须按行切 2 段')
  assert.deepEqual(w1.segments[0], { x1: 90, y1: 100, x2: 110, y2: 100 }, '段0 必须是行0 行内几何（丙 x90-w110）')
  assert.deepEqual(w1.segments[1], { x1: 50, y1: 140, x2: 70, y2: 140 }, '段1 必须是行1 行内几何（乙 x50-w70）')
  assert.equal(w1.x1, 90, '顶层 bbox x1=首段 x1（向后兼容字段）')
  assert.equal(w1.size, 30, '题目池无 size → 兜底 30（题目排版字号 30 同值）')
  // ② 跨三行 → 3 段（'丙乙丙丁丙' = 行0末丙 + 行1 乙丙丁整段 + 行2首丙）
  const w2 = p_findRange(qPool, '丙乙丙丁丙', 1, { allowWrap: true })
  assert.equal(w2.segments.length, 3, '跨三行命中必须切 3 段')
  assert.deepEqual(w2.segments.map((s) => s.y1), [100, 140, 180], '3 段基线必须逐行递增（上行→中行→下行）')
  // ③ 板书语义不破：同池同目标不传 allowWrap → null（B9 realPool 行内语义的题目版护栏）
  assert.equal(p_findRange(qPool, '丙乙', 1), null, '无 allowWrap 跨行必须仍拒画（板书区行为零变化）')
  // ④ 行内命中也带 segments 单段（drawAction 统一消费路径，不分叉）
  const w3 = p_findRange(qPool, '乙丙', 1, { allowWrap: true })
  assert.equal(w3.segments.length, 1, '行内命中必须带单段 segments（drawAction 单一消费路径）')
  assert.ok(w3.x1 === 70 && w3.x2 === 110, '行内命中顶层字段照旧（B9 兼容）')
  // ⑤ occ 连续流语义 + 超界 miss
  const w4 = p_findRange(qPool, '乙丙', 2, { allowWrap: true })
  assert.ok(w4 && w4.y1 === 140, 'occ=2 必须命中行1 的 乙丙（连续流池内第 N 次）')
  assert.equal(p_findRange(qPool, '乙丙', 3, { allowWrap: true }), null, 'occ 超界必须 miss')
  // ⑥ 源断言：题目路由传参 + 旧档兜底同开 + 贴底公式 + 分段绘制 + circle 跨行拒绝 + 契约教学
  assert.ok(player.includes("stg==='question'?{allowWrap:true}"), 'drawAction 题目池必须传 allowWrap（自动折行池分段的地基）')
  assert.ok(player.includes('findRange(Q.chars,tg.exactText||\'\',tg.occurrence||1,{allowWrap:true})'), '旧档兜底题目池必须同开 allowWrap（同一排版同一行为，不分叉）')
  assert.ok(player.includes('Math.round(fs*0.15)+1'), 'underline 贴字底公式必须在场（旧 fs*0.27+12 侵入下一行字区不复活）')
  assert.ok(!player.includes('yy=by2+4'), 'underline 不得再吃 circle bbox 的 by2（贴底公式唯一真源）')
  assert.ok(player.includes('for(const g of segs)'), 'underline 必须逐段生长绘制（上行画完接下行）')
  assert.ok(player.includes('if(segs.length>1)'), 'circle 跨折行必须明示拒绝（圈两行必歪，宁可不画）')
  const promptSrc2 = read('src/agent-b-v2/prompt.js')
  assert.ok(promptSrc2.includes('允许跨折行'), 'prompt §5.2 必须教题目自动折行下 underline 可跨折行（Agent 无从预知折行点）')
  assert.ok(promptSrc2.includes('必须落在同一行内'), 'prompt §5.2 必须教 circle 单行约束（跨折行不画圈）')
})

// ── B13 Task 63 片1 锚定引擎抽核（夏夏「最安全办+做减法」）：boardAnchorCore.js 唯一 ESM 真源 ──
//    与 row-player 内嵌版字节级同源；AgentBDirect 旧 pool.includes 近似镜像退役、换真引擎。
//    语义链：校验放行 ⇒ 播放必画（行内/跨折行/occ/frac 占位符四向归一）。
ok('B13 锚定引擎同源锁：boardAnchorCore 四函数与 row-player 内嵌版源文本字节级一致（半边改当场撞墙）+ 行为对拍 + AgentBDirect 近似校验退役不复活', () => {
  // ① 源文本对拍（去空白后逐字节）：抽取工具同源同逻辑，双边提取必须一致
  const coreSrc = read('src/board-tools/boardAnchorCore.js')
  for (const fn of ['findRange', 'sameBoardLine', 'tokenizeLine', 'readBrace']) {
    assert.ok(extractTopLevelFunction(coreSrc, fn), `boardAnchorCore 缺顶层函数: ${fn}`)
    assert.equal(
      noWs(extractTopLevelFunction(coreSrc, fn)),
      noWs(extractTopLevelFunction(player, fn)),
      `${fn} 源文本与 row-player 分叉（boardAnchorCore 与 row-player 必须同步改：哨兵 B13）`,
    )
  }
  // ② 行为对拍：板书形池两行（跨行拒/行内命中/occ 桶内）
  const bPool = [
    { ch: '平', x: 10, y: 90, w: 20, size: 40, stage: '解答', li: 0 },
    { ch: '行', x: 30, y: 90, w: 20, size: 40, stage: '解答', li: 0 },
    { ch: '四', x: 50, y: 90, w: 20, size: 40, stage: '解答', li: 0 },
    { ch: '边', x: 10, y: 150, w: 20, size: 40, stage: '解答', li: 1 },
    { ch: '形', x: 30, y: 150, w: 20, size: 40, stage: '解答', li: 1 },
  ]
  assert.equal(core_findRange(bPool, '四边', 1), null, 'core 版跨行必须拒（B9 同语义）')
  assert.deepEqual(core_findRange(bPool, '平行四', 1), p_findRange(bPool, '平行四', 1), '行内命中两版输出必须同构')
  assert.deepEqual(core_findRange(bPool, '边', 2), p_findRange(bPool, '边', 2), 'occ=2 桶内计数两版同构')
  // ③ 行为对拍：题目形池 allowWrap（跨折行分段 + 行内单段 + occ 超界）
  const qPool13 = [
    { ch: '甲', x: 50, y: 100, w: 20, li: 0 },
    { ch: '乙', x: 70, y: 100, w: 20, li: 0 },
    { ch: '丙', x: 90, y: 100, w: 20, li: 0 },
    { ch: '乙', x: 50, y: 140, w: 20, li: 1 },
    { ch: '丙', x: 70, y: 140, w: 20, li: 1 },
  ]
  assert.deepEqual(
    core_findRange(qPool13, '丙乙丙', 1, { allowWrap: true }),
    p_findRange(qPool13, '丙乙丙', 1, { allowWrap: true }),
    '跨折行分段两版输出必须同构',
  )
  assert.equal((core_findRange(qPool13, '丙乙', 1, { allowWrap: true }) || {}).segments.length, 2, 'core allowWrap 必须切 2 段')
  assert.equal(core_findRange(qPool13, '乙丙', 3, { allowWrap: true }), null, 'occ 超界两版同判 null')
  assert.equal(core_findRange(qPool13, '丙乙', 1), null, '题目形池无 allowWrap 跨行仍拒（板书语义不破）')
  // ④ 辅助函数行为对拍
  assert.equal(core_sameBoardLine({ li: 0 }, { li: 1 }), false, 'sameBoardLine li 分行')
  assert.equal(core_sameBoardLine({ y: 5 }, { y: 5 }), true, 'sameBoardLine 无 li 同基线兑底')
  assert.deepEqual(
    core_tokenizeLine('\\frac{1}{2}+x'),
    evalPure(extractTopLevelFunction(player, 'tokenizeLine') + '\n' + extractTopLevelFunction(player, 'readBrace'), ['tokenizeLine', 'readBrace']).tokenizeLine('\\frac{1}{2}+x'),
    'tokenizeLine 两版输出必须同构',
  )
  // ⑤ 校验流构造语义：零坐标流（li 保真）+ 行内严格 + \frac 占位符
  const flow = buildBoardAnchorFlow(['平行四边形', 'AB'])
  assert.equal(flow.length, 7, '板书校验流长度（7 字）')
  assert.ok(flow[6].li === 1 && flow[6].ch === 'B', '第二行字符 li=1 保真（零坐标不影响行界判定）')
  assert.equal(core_findRange(buildBoardAnchorFlow(['平行四边形', 'AB']), '形A', 1), null, '校验流真跨行目标（行0末字+行1首字）必须 null；旧 includes 靠 \\n 阻隔纯属巧合，occ/frac/region 三向分叉仍在')
  assert.ok(core_findRange(buildBoardAnchorFlow(['平行四边形', '边形AB']), '边形AB', 1), '行内完整存在必须命中（行内命中语义本身照旧）')
  assert.equal(buildBoardAnchorFlow(['\\frac{1}{2}+1'])[0].ch, '\uE000', '\\frac 必须打占位符（与 boardCharPool 同语义）')
  assert.equal(core_findRange(buildBoardAnchorFlow(['\\frac{1}{2}+1']), '2}+', 1, { allowWrap: true }), null, 'exactText 含公式字面量必 miss（校验/播放同判）')
  const qFlow = buildQuestionAnchorFlow('甲乙丙')
  assert.ok(qFlow.length === 3 && core_findRange(qFlow, '乙丙', 1, { allowWrap: true }), '题目校验流连续流命中')
  // ⑥ 词汇桥同源：REGION_STAGE_ZH 与 row-player drawAction 内联桥字面量一致
  assert.ok(player.includes("{analysis:'分析',solution:'解答',summary:'总结'}"), 'row-player 中英词汇桥字面量必须在场（REGION_STAGE_ZH 同源锚）')
  assert.deepEqual(REGION_STAGE_ZH, { analysis: '分析', solution: '解答', summary: '总结' }, 'REGION_STAGE_ZH 值漂移')
  // ⑦ 消费端源断言：AgentBDirect 近似校验退役不复活
  const ab = read('src/agent-b-v2/AgentBDirect.vue')
  assert.ok(ab.includes("from '../board-tools/boardAnchorCore.js'"), 'AgentBDirect 必须 import 锚定真源')
  assert.ok(!ab.includes('pool.includes(text)'), '近似校验不得复活（无视行界=校验放行播放拒画的静默丢线源）')
  assert.ok(ab.includes('REGION_STAGE_ZH[region]'), 'region 分桶必须走词汇桥（对齐播放器双试过滤）')
  assert.ok(ab.includes('{ allowWrap: true }'), '题目池校验必须 allowWrap（自动折行同判）')
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

// ═══ B14（Task 67 一笔一笔揭示 · 68 评审会补锁）：drawWriting 行内节奏块行为对拍 ══════
//   锁结构不锁口味（0.18/0.06 顿份与 ±18% 时长是夏夏一句话可调的常数，不锁数值）：
//   ①确定性（防 Math.random 复活）②pr 0→1 单调不回退 ③pr=1 揭满（常行/垫宽尾行双路径）
//   ④无 gs（rough 横线行）回退线性 ⑤at 增量极差>0.005lw（防整行幕布扫复活；71 由 pr=0.5 单点采样升级，正交于曲线口味）。
//   锚 = drawWriting 函数体内 ['let at=pr, ab=pr;' → 'const slPx=') 唯一片段（rg 实证全文件唯一）。
ok('B14 一笔一笔揭示节奏块：确定性/单调/pr=1 揭满/rough 行回退/非线性 五断言', () => {
  const fn = extractTopLevelFunction(player, 'drawWriting')
  const i0 = fn.indexOf('let at=pr, ab=pr;')
  const i1 = fn.indexOf('const slPx=')
  assert.ok(i0 > 0 && i1 > i0, `节奏块锚点缺失（drawWriting 被改？B14 需同步）i0=${i0} i1=${i1}`)
  const block = fn.slice(i0, i1)
  const mulberry32 = (a) => function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const f = new Function('pr', 'R', 'L', 'lw', 'seed', 's', 'mulberry32', block + '\nreturn {at:at, ab:ab, ry:R.ry};')
  const run = (pr, gs, L, lw, seed) => f(pr, { gs: gs }, L, lw, seed, { li: 0 }, mulberry32)
  const L4 = { x: 100, size: 40 }
  const gs4 = [{ x: 100, w: 40 }, { x: 140, w: 40 }, { x: 180, w: 40 }, { x: 220, w: 40 }]   // 4 全角字，末 g1=240=lw
  // ① 同参双跑逐项相等（节奏表构建流与复用流一致 = 确定性，Math.random 复活当场炸）
  const r1 = run(0.5, gs4, L4, 240, 7), r2 = run(0.5, gs4, L4, 240, 7)
  assert.deepEqual(r2.ry, r1.ry, 'R.ry 双跑分叉（随机源复活？）')
  assert.equal(r2.at, r1.at, 'at 双跑分叉')
  // ② pr 0→1 步进 200 单调不减
  let prev = -1
  for (let i = 0; i <= 200; i++) {
    const at = run(i / 200, gs4, L4, 240, 7).at
    assert.ok(at >= prev - 1e-9, `at 回退 @pr=${(i / 200).toFixed(4)}`)
    prev = at
  }
  // ③ pr=1 揭满：常行（末 g1=lw）与短行（Math.max(size,…) 垫宽尾巴段）都到 1
  assert.equal(run(1, gs4, L4, 240, 7).at, 1, 'pr=1 常行未揭满')
  assert.equal(run(1, [{ x: 100, w: 20 }], L4, 40, 7).at, 1, 'pr=1 垫宽尾行未揭满')
  // ④ 无 gs（rough 横线行）回退线性扫
  assert.equal(run(0.37, [], L4, 240, 7).at, 0.37, 'gs 空数组未回退线性')
  assert.equal(run(0.37, null, L4, 240, 7).at, 0.37, 'gs 缺失未回退线性')
  // ⑤ 非线性=at 增量不恒定（防整行线性幕布复活）：增量极差 > 0.005lw
  //   （71 夏夏拍板「缓缓写」换缓出 easeOutCubic 后，旧「pr=0.5 单点偏离>2%」采样法与新曲线
  //    「字间等时+字内缓出」的叠加偶然相撞 at(0.5)=0.4852 误报；且旧单点法对顿份加权下的纯线性
  //    也误判非线性=本来就不严密。增量极差法才是本质：线性幕布增量恒定极差≈0.002，
  //    任何字级非线性曲线必有过山车增量（旧 smoothstep 0.009 / 缓出 0.018），阈值分离度 4~8 倍，
  //    正交于曲线口味——换任何曲线族都不用再动这条断言）
  const steps5 = []
  for (let i = 0; i <= 200; i++) steps5.push(run(i / 200, gs4, L4, 240, 7).at)
  const inc5 = []
  for (let i = 1; i < steps5.length; i++) inc5.push(steps5[i] - steps5[i - 1])
  const spread5 = Math.max(...inc5) - Math.min(...inc5)
  assert.ok(spread5 > 0.005, `at 增量极差=${spread5.toFixed(5)} 疑似线性幕布复活（增量恒定）`)
})

console.log(`\n== 播放器镜像对拍哨兵: ${pass} 通过 / ${fail} 失败 ==`)
if (fail > 0) process.exit(1)
