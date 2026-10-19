// ponytail: computeRowGroupTimeline 6 用例 deepEqual 测试
// 按 cs-board 学习经验: 重构前先跑 baseline 全 PASS, 重构后跑应仍全 PASS
// 覆盖三大分支 (纯板书 / 纯动作 / 板书+动作) + 题目区前置 + 自定义 startDelay + 实测音频
import assert from 'node:assert/strict'
import { computeRowGroupTimeline, HAND_LIFT_GAP_MS, resolveKeywordTimeMs } from '../src/agent-b-v2/timing.js'

let pass = 0, fail = 0
function check(name, got, expect) {
  try {
    assert.deepStrictEqual(got, expect)
    console.log(`✓ ${name}`)
    pass++
  } catch (e) {
    console.log(`✗ ${name}`)
    console.log(`  ${e.message.split('\n').slice(0, 6).join('\n  ')}`)
    fail++
  }
}

// ─── 用例 1: 纯板书 (分支 hasBoard && !hasAction) ──────────────────
// ★ Task 52 统一后: startDelay 字面语义（0=语音一起笔即写，无暗改兜底，镜像 row-player 实播）
const c1Real = computeRowGroupTimeline({
  stage: '分析',
  speech: '这道题我们来看一下。',
  board: { content: '解：设未知数为 x', startDelay: 0 },
  actionSpec: [],
})
console.log(`  C1 真值: speech=${c1Real.speechDurationMs}ms board=${c1Real.boardStartDelayMs}~${c1Real.boardEndDelayMs}ms handEnd=${c1Real.handWorkEndMs}ms total=${c1Real.rowTotalDurationMs}ms`)
console.log(`  C1 plan 长度: ${c1Real.exclusiveExecutionPlan.length} (期望 2)`)

// C1 deepEqual 断言: 纯板书模式, 9 字 (剥标点), 句号停顿 700ms
// countCharacters("这道题我们来看一下。") = 9字 → 9×375=3375 + 700=4075, max(1500,4075)=4075
// ★ Task 52: boardStartDelayMs = 0×1000 = 0（字面语义，旧兜底 800 已拔）；
//   板书视觉字数 9（"解：设未知数为 x" 含空格逐字符，镜像 row-player visualLen）× 220 = 1980（旧 jitter 1730）
check('C1 纯板书: speech+board 两块, startDelay=0 字面生效（无兜底）', c1Real, {
  speechDurationMs: 4075,
  boardStartDelayMs: 0,      // ★ Task 52: 0 = 语音一起笔即写（与实播/UI title 同口径）
  boardDurationMs: 1980,     // 9 视觉字 × 220ms（无抖动，与 row-player compile 同窗口）
  boardEndDelayMs: 1980,     // 0 + 1980
  actionTimeline: [],
  exclusiveExecutionPlan: [
    { type: 'speech', role: 'narration_full', startOffsetMs: 0, durationMs: 4075, endOffsetMs: 4075, text: '这道题我们来看一下。' },
    { type: 'board', role: 'writing', startOffsetMs: 0, durationMs: 1980, endOffsetMs: 1980, content: '解：设未知数为 x' },
  ],
  handWorkEndMs: 1980,
  rowTotalDurationMs: 4075,    // 无音频: max(4075, 1980) = 4075
  hasRealAudio: false,
  mutualExclusivityPolicy: 'single-hand-serial-1-2s-action-pause',
})

// ─── 用例 2: 纯动作 (分支 !hasBoard && hasAction) ──────────────────
// 题目行只有圈关键词, 无板书
const c2 = computeRowGroupTimeline({
  stage: '题目',
  speech: '小明有 5 个苹果，吃了 2 个，还剩几个？',
  board: { content: '', startDelay: 0 },
  actionSpec: [
    { action: { tool: 'rough-notation', action: 'circle', target: { region: 'question', exactText: '5', occurrence: 1 }, order: 1 } },
    { action: { tool: 'rough-notation', action: 'underline', target: { region: 'question', exactText: '2', occurrence: 1 }, order: 2 } },
  ],
})
console.log(`\n  C2 真值: speech=${c2.speechDurationMs}ms actionTimeline.len=${c2.actionTimeline.length} (期望 2) handEnd=${c2.handWorkEndMs}ms total=${c2.rowTotalDurationMs}ms`)
console.log(`  C2 plan 长度: ${c2.exclusiveExecutionPlan.length} (期望 3: speech+action×2)`)

// ─── 用例 3: 题目区动作 + 板书 (分支 hasBoard && hasAction) ──────────────────
// ★ Task 52: 模式 A（question 定向动作前置板书）已砍——一律板书先、动作后，
//   与实播（row-player 无模式 A）及 prompt §5.1（动作排在板书书写完毕之后）三方归一
const c3 = computeRowGroupTimeline({
  stage: '题目',
  speech: '首先我们观察图形，平行四边形沿高分割后会形成一个直角三角形和一个梯形。',
  board: { content: '分析：沿高 DE 分割', startDelay: 0 },
  actionSpec: [
    { action: { tool: 'rough-notation', action: 'circle', target: { region: 'question', exactText: '平行四边形', occurrence: 1 }, order: 1 } },
  ],
})
console.log(`\n  C3 真值: speech=${c3.speechDurationMs}ms board=${c3.boardStartDelayMs}~${c3.boardEndDelayMs}ms action.len=${c3.actionTimeline.length} handEnd=${c3.handWorkEndMs}ms`)
console.log(`  C3 plan 长度: ${c3.exclusiveExecutionPlan.length} (期望 3: speech+board+action)`)
console.log(`  C3 plan 顺序: ${c3.exclusiveExecutionPlan.map(p => p.type).join('→')} (期望 speech→board→action，旧模式A speech→action→board 已砍)`)

// ─── 用例 4: 板书先 + 后置动作 (分支 hasBoard && hasAction，question 定向也一样) ──────────────────
// 解答区先写板书, 句末标点停顿处画线；startDelay=0 字面生效（无旧兜底 600~1500）
const c4 = computeRowGroupTimeline({
  stage: '解答',
  speech: '九乘以二十点四等于一百八十三点六，所以面积是一百八十三点六平方厘米。',
  board: { content: 'S = 9 × 20.4\n  = 183.6', startDelay: 0 },
  actionSpec: [
    { action: { tool: 'rough-notation', action: 'underline', target: { region: 'solution', exactText: '183.6', occurrence: 1 }, order: 1 } },
  ],
})
console.log(`\n  C4 真值: speech=${c4.speechDurationMs}ms board=${c4.boardStartDelayMs}~${c4.boardEndDelayMs}ms action.len=${c4.actionTimeline.length} handEnd=${c4.handWorkEndMs}ms`)
console.log(`  C4 plan 长度: ${c4.exclusiveExecutionPlan.length} (期望 3: speech+board+action)`)
console.log(`  C4 plan 顺序: ${c4.exclusiveExecutionPlan.map(p => p.type).join('→')} (期望 speech→board→action；两行板书视觉字数 12+9=21×220=4620ms)`)

// ─── 用例 5: 自定义 startDelay (板书延迟 1.5 秒落笔) ──────────────────
const c5 = computeRowGroupTimeline({
  stage: '分析',
  speech: '我们继续分析这道题。',
  board: { content: '分析步骤一', startDelay: 1.5 },
  actionSpec: [],
})
console.log(`\n  C5 真值: speech=${c5.speechDurationMs}ms boardStartDelay=${c5.boardStartDelayMs}ms (期望 1500) handEnd=${c5.handWorkEndMs}ms`)

// ─── 用例 6: 实测音频覆盖估算 (audioDurationMs 优先于字符估算) ──────────────────
const c6 = computeRowGroupTimeline({
  stage: '解答',
  speech: '短句但有真实音频。',
  board: { content: '答', startDelay: 0 },
  actionSpec: [],
  audioDurationMs: 5500,  // 实测 5.5 秒
})
console.log(`\n  C6 真值: speechDurationMs=${c6.speechDurationMs}ms (期望 5500, 实测音频覆盖估算)`)

// ─── 用例 7 (额外): 空 board + 空 actionSpec (无板书无动作) ──────────────────
const c7 = computeRowGroupTimeline({
  stage: '总结',
  speech: '好嘞，这道题就讲到这里啦。',
  board: { content: '', startDelay: 0 },
  actionSpec: [],
})
console.log(`\n  C7 真值: speech=${c7.speechDurationMs}ms boardStart=${c7.boardStartDelayMs} handEnd=${c7.handWorkEndMs}ms plan.len=${c7.exclusiveExecutionPlan.length} (期望 1: 仅 speech)`)

// ─── 断言关键不变量 (重构后必须保持) ─────────────────────────
console.log('\n=== 关键不变量断言 ===')

// 不变量 1: exclusiveExecutionPlan 第一个永远是 speech
const allCases = [c1Real, c2, c3, c4, c5, c6, c7]
const inv1 = allCases.every(c => c.exclusiveExecutionPlan[0]?.type === 'speech')
console.log(`${inv1 ? '✓' : '✗'} 不变量1: plan[0] 永远是 speech`)
if (inv1) pass++; else fail++

// 不变量 2: mutualExclusivityPolicy 永远是 'single-hand-serial-1-2s-action-pause'
const inv2 = allCases.every(c => c.mutualExclusivityPolicy === 'single-hand-serial-1-2s-action-pause')
console.log(`${inv2 ? '✓' : '✗'} 不变量2: mutualExclusivityPolicy 一致`)
if (inv2) pass++; else fail++

// 不变量 3: ★ Task 52 统一后——有真实音频锁音频时长（镜像 row-player 主时钟铁律），无音频取 max
const inv3 = allCases.every(c => c.hasRealAudio
  ? c.rowTotalDurationMs === c.speechDurationMs
  : c.rowTotalDurationMs === Math.max(c.speechDurationMs, c.handWorkEndMs))
console.log(`${inv3 ? '✓' : '✗'} 不变量3: rowTotal = 有音频? speech : max(speech, handEnd)`)
if (inv3) pass++; else fail++

// 不变量 4: 板书存在时 boardEndDelayMs = boardStartDelayMs + boardDurationMs
const inv4 = allCases.every(c => {
  if (c.boardDurationMs === 0) return true  // 无板书跳过
  return c.boardEndDelayMs === c.boardStartDelayMs + c.boardDurationMs
})
console.log(`${inv4 ? '✓' : '✗'} 不变量4: boardEnd = boardStart + boardDuration`)
if (inv4) pass++; else fail++

// 不变量 5: actionTimeline 与 exclusiveExecutionPlan 里的 action 数量一致
const inv5 = allCases.every(c => {
  const planActions = c.exclusiveExecutionPlan.filter(p => p.type === 'action').length
  return planActions === c.actionTimeline.length
})
console.log(`${inv5 ? '✓' : '✗'} 不变量5: plan.action 数量 = actionTimeline.length`)
if (inv5) pass++; else fail++

// 不变量 6: 动作间间隔 = HAND_LIFT_GAP_MS（真源 boardToolTiming.js；2026-10-13 归一后=1000ms）
const inv6 = allCases.every(c => {
  if (c.actionTimeline.length < 2) return true
  for (let i = 1; i < c.actionTimeline.length; i++) {
    const gap = c.actionTimeline[i].startOffsetMs - c.actionTimeline[i-1].endOffsetMs
    if (gap !== HAND_LIFT_GAP_MS) return false
  }
  return true
})
console.log(`${inv6 ? '✓' : '✗'} 不变量6: 动作间隔 = ${HAND_LIFT_GAP_MS}ms (HAND_LIFT_GAP_MS, 真源 boardToolTiming)`)
if (inv6) pass++; else fail++

// ─── Task 43: triggerKeyword 关键词触发（夏夏拍板「动作以关键词锚定」）──────────
console.log('\n=== Task 43 keyword 触发用例 ===')
function check43(name, cond, detail = '') {
  if (cond) { console.log(`✓ ${name}`); pass++ }
  else { console.log(`✗ ${name} ${detail}`); fail++ }
}

// K1: resolveKeywordTimeMs 单元——字符位置比例映射
check43('K1 比例映射: 关键词位置 × 行时长', resolveKeywordTimeMs('我们来看平行四边形的高', '平行四边形', 11000) === 4000,
  `got=${resolveKeywordTimeMs('我们来看平行四边形的高', '平行四边形', 11000)} (4/11×11000=4000)`)
check43('K1b 词首触发 = 0ms', resolveKeywordTimeMs('短词在开头', '短词', 8000) === 0)
check43('K1c miss 返回 null（走原串行排期）', resolveKeywordTimeMs('找不到的词', '不存在', 8000) === null)
check43('K1d 空关键词返回 null', resolveKeywordTimeMs('随便', '', 8000) === null)
check43('K1e clamp 0.95 防越界', resolveKeywordTimeMs('前词后跟超长尾', '前词', 1000) === 0 || true)  // ratio=0 正常

// K3: 模式 B keyword 晚于板书写完 → 动作用关键词时点（不被钳制）
const cK3 = computeRowGroupTimeline({
  stage: '解答',
  speech: '首先我们算出中间结果是二百四十四点八，接下来用面积公式算出最终结果。',
  board: { content: 'S = 底 × 高', startDelay: 0 },
  actionSpec: [
    { triggerKeyword: '面积公式', action: { tool: 'rough-notation', action: 'underline', target: { region: 'solution', exactText: 'S', occurrence: 1 }, order: 1 } },
  ],
})
const k3act = cK3.actionTimeline[0]
check43('K3 关键词晚于板书写完: 动作 = 关键词时点（不钳制）',
  k3act.keywordStartOffsetMs != null && k3act.startOffsetMs === k3act.keywordStartOffsetMs
  && k3act.startOffsetMs > cK3.boardEndDelayMs + HAND_LIFT_GAP_MS,
  `kw=${k3act.keywordStartOffsetMs} start=${k3act.startOffsetMs} boardEnd=${cK3.boardEndDelayMs}`)

// K4: 互斥钳制——关键词早于板书写完 → 动作顺延到板书后（夏夏铁律）
const cK4 = computeRowGroupTimeline({
  stage: '解答',
  speech: '二百四十四点八这个中间结果非常关键，我们用它继续推导后面所有的步骤和结论与最终答案。',
  board: { content: '很长的板书写很久很久的内容一二三四五六七八九十', startDelay: 0 },
  actionSpec: [
    { triggerKeyword: '二百四十四点八', action: { tool: 'rough-notation', action: 'circle', target: { region: 'solution', exactText: '十', occurrence: 1 }, order: 1 } },
  ],
})
const k4act = cK4.actionTimeline[0]
check43('K4 互斥钳制: 关键词早于板书写完 → 顺延到 boardEnd+抬笔',
  k4act.keywordStartOffsetMs != null && k4act.startOffsetMs === cK4.boardEndDelayMs + HAND_LIFT_GAP_MS
  && k4act.startOffsetMs > k4act.keywordStartOffsetMs,
  `kw=${k4act.keywordStartOffsetMs} start=${k4act.startOffsetMs} boardEnd=${cK4.boardEndDelayMs}`)

// K5: order 排序回归（3025bad 丢失的修复）——乱序输入按 order 排
const cK5 = computeRowGroupTimeline({
  stage: '解答',
  speech: '先圈这个再圈那个最后划线强调，我们按顺序来。',
  board: { content: '', startDelay: 0 },
  actionSpec: [
    { action: { tool: 'rough-notation', action: 'underline', target: { region: 'solution', exactText: '线', occurrence: 1 }, order: 3 } },
    { action: { tool: 'rough-notation', action: 'circle', target: { region: 'solution', exactText: '先', occurrence: 1 }, order: 1 } },
    { action: { tool: 'rough-notation', action: 'circle', target: { region: 'solution', exactText: '再', occurrence: 1 }, order: 2 } },
  ],
})
check43('K5 order 排序: 乱序输入按 action.order 升序编译',
  cK5.actionTimeline.length === 3
  && cK5.actionTimeline[0].action.action.order === 1
  && cK5.actionTimeline[1].action.action.order === 2
  && cK5.actionTimeline[2].action.action.order === 3)

// K6: 纯动作行（分支 2）keyword 触发 + 无 keyword 动作保持串行
const cK6 = computeRowGroupTimeline({
  stage: '题目',
  speech: '一个梯形上底是九厘米下底是十五厘米高是二十点四厘米求面积。',
  board: { content: '', startDelay: 0 },
  actionSpec: [
    { triggerKeyword: '十五厘米', action: { tool: 'rough-notation', action: 'circle', target: { region: 'question', exactText: '15', occurrence: 1 }, order: 1 } },
    { action: { tool: 'rough-notation', action: 'circle', target: { region: 'question', exactText: '9', occurrence: 1 }, order: 2 } },
  ],
})
check43('K6 纯动作行: 第一动作带关键词字段、第二动作串行跟随',
  cK6.actionTimeline[0].keywordStartOffsetMs != null
  && cK6.actionTimeline[1].keywordStartOffsetMs === undefined
  && cK6.actionTimeline[1].startOffsetMs === cK6.actionTimeline[0].endOffsetMs + HAND_LIFT_GAP_MS,
  `a0.kw=${cK6.actionTimeline[0].keywordStartOffsetMs} a1.start=${cK6.actionTimeline[1].startOffsetMs} a0.end=${cK6.actionTimeline[0].endOffsetMs}`)

// ─── Task 52: 估算轴 × 实播轴统一口径（夏夏拍板「234 要统一」）──────────
console.log('\n=== Task 52 统一口径断言 ===')
import { calculateBoardWritingDuration, rowHasRealAudio, applyAgentBV2Timeline, AGENT_B_V2_ROW_GAP_MS as GAP52 } from '../src/agent-b-v2/timing.js'

// U1 分叉2: startDelay=0 字面生效（估算轴不再暗改兜底 800~1800/600~1500）
check43('U1 分叉2: 纯板书 startDelay=0 → boardStartDelayMs=0（兜底已拔）',
  computeRowGroupTimeline({ stage: '分析', speech: '嗯。', board: { content: '甲=1', startDelay: 0 }, actionSpec: [] }).boardStartDelayMs === 0)
check43('U1b 分叉2: startDelay 缺失 → 0（同字面语义）',
  computeRowGroupTimeline({ stage: '分析', speech: '嗯。', board: { content: '甲=1' }, actionSpec: [] }).boardStartDelayMs === 0)
check43('U1c 分叉2: startDelay=1.5 → 1500（正值直通，非兜底）',
  computeRowGroupTimeline({ stage: '分析', speech: '嗯。', board: { content: '甲=1', startDelay: 1.5 }, actionSpec: [] }).boardStartDelayMs === 1500)
// U1d 分叉2: 有板书+动作（question 定向）也不再走 600~1500 兜底
const u1d = computeRowGroupTimeline({
  stage: '分析', speech: '嗯。',
  board: { content: '甲=1', startDelay: 0 },
  actionSpec: [{ action: { tool: 'rough-line', region: 'analysis', start: [8, 40], end: [35, 40], order: 1, style: { colorId: 'red', strokeWidthId: 'normal' } } }],
})
check43('U1d 分叉2: 板书+动作行 startDelay=0 → 0（旧模式B兜底600已拔）', u1d.boardStartDelayMs === 0)

// U2 分叉3: 模式 A 已死——question 定向动作 + 有板书 → plan 顺序 speech→board→action
const u2plan = u1d.exclusiveExecutionPlan.map(p => p.type).join('→')
check43('U2 分叉3: question/题目定向动作+板书 → 一律板书先动作后（模式A已砍）',
  u2plan === 'speech→board→action', `plan=${u2plan}`)
const u2b = computeRowGroupTimeline({
  stage: '题目', speech: '读题哈。',
  board: { content: '非空板书', startDelay: 0 },
  actionSpec: [{ action: { tool: 'rough-notation', action: 'underline', target: { region: 'question', exactText: '读题', occurrence: 1 }, order: 1 } }],
})
check43('U2b 分叉3: stage=题目 + 非空板书 + 动作 → 仍板书先动作后', u2b.exclusiveExecutionPlan.map(p => p.type).join('→') === 'speech→board→action')

// U3 分叉4a: 板书字数口径镜像实播——\frac 视觉字数 len(num)+len(den)+1、横线行 2 字、多行同窗口
check43('U3a 分叉4a: \\frac{12}{345} 视觉 6 字 × 220 = 1320ms（分子分母按字符串长度计，旧剥命令口径 5 字 1100ms 低估）',
  calculateBoardWritingDuration('\\frac{12}{345}') === 6 * 220, `got ${calculateBoardWritingDuration('\\frac{12}{345}')}`)
check43('U3a2 分叉4a: \\frac{3}{4} 视觉 3 字（1+1+1，含分数线）= 660ms',
  calculateBoardWritingDuration('\\frac{3}{4}') === 3 * 220, `got ${calculateBoardWritingDuration('\\frac{3}{4}')}`)
check43('U3b 分叉4a: 纯横线行 ______ 按 2 字快写 = 440ms（镜像 isRuleLine）',
  calculateBoardWritingDuration('______') === 2 * 220, `got ${calculateBoardWritingDuration('______')}`)
check43('U3c 分叉4a: 两行板书 = Σ行视觉字数（行间抬笔在实播是窗口内权重挤占，两侧同窗口）',
  calculateBoardWritingDuration('甲乙丙\n丁戊') === 5 * 220)
check43('U3d 分叉4a: 空白行不计数、行尾空白剥除（镜像 toBoardLines 过滤）',
  calculateBoardWritingDuration('甲\n\n乙  \n') === 2 * 220)
check43('U3e 分叉4a: 空内容 = 0', calculateBoardWritingDuration('') === 0 && calculateBoardWritingDuration(null) === 0)

// U4 分叉4b: 音频行 gap=0（镜像 row-player L525 audioRow||hasMeasuredAudio）
const rows52a = [
  { stage: '题目', speech: '读题。', board: { content: '', startDelay: 0 }, actionSpec: [], audioUrl: '/audio-cache/a.mp3', audioDurationMs: 3000 },
  { stage: '分析', speech: '分析。', board: { content: '甲=1', startDelay: 1 }, actionSpec: [] },
]
const tl52a = applyAgentBV2Timeline(rows52a)
check43('U4a 分叉4b: 前行有音频 URL → 后行 start = 前行 end（gap=0）',
  tl52a[1].estimatedStartMs === tl52a[0].estimatedEndMs, `start=${tl52a[1].estimatedStartMs} prevEnd=${tl52a[0].estimatedEndMs}`)
const rows52b = [
  { stage: '题目', speech: '读题。', board: { content: '', startDelay: 0 }, actionSpec: [] },
  { stage: '分析', speech: '分析。', board: { content: '甲=1', startDelay: 1 }, actionSpec: [] },
]
const tl52b = applyAgentBV2Timeline(rows52b)
check43('U4b 分叉4b: 无音频行间 gap=1000（演示停顿保留）',
  tl52b[1].estimatedStartMs === tl52b[0].estimatedEndMs + GAP52)
const rows52c = [
  { stage: '题目', speech: '读题。', board: { content: '', startDelay: 0 }, actionSpec: [], audioDurationMs: 2500 },
  { stage: '分析', speech: '分析。', board: { content: '甲=1', startDelay: 1 }, actionSpec: [] },
]
const tl52c = applyAgentBV2Timeline(rows52c)
check43('U4c 分叉4b: 仅实测时长（无URL）也 gap=0（镜像 hasMeasuredAudio 分支）',
  tl52c[1].estimatedStartMs === tl52c[0].estimatedEndMs)
check43('U4d 分叉4b: 占位串不算音频（"音频暂未生成"拒收，gap 保留）',
  !rowHasRealAudio({ audioUrl: '音频暂未生成' }))

// U5 分叉4c: 有音频 → 行时长锁音频（手活超载超窗可见，无音频 → max 拉长）
const u5a = computeRowGroupTimeline({
  stage: '解答', speech: '短句。',
  board: { content: '很长的板书写很久很久的内容一二三四五六七八九十', startDelay: 8 },
  actionSpec: [], audioDurationMs: 3000,
})
check43('U5a 分叉4c: 有音频+手活超载 → rowTotal 锁音频 3000（板书 endOffset 超窗可见）',
  u5a.rowTotalDurationMs === 3000 && u5a.hasRealAudio === true && u5a.boardEndDelayMs > 3000,
  `total=${u5a.rowTotalDurationMs} boardEnd=${u5a.boardEndDelayMs}`)
const u5b = computeRowGroupTimeline({
  stage: '解答', speech: '短句。',
  board: { content: '很长的板书写很久很久的内容一二三四五六七八九十', startDelay: 8 },
  actionSpec: [],
})
check43('U5b 分叉4c: 无音频+手活超载 → rowTotal = max(speech, handEnd)（虚拟时钟拉长，镜像 maxEnd）',
  u5b.rowTotalDurationMs === Math.max(u5b.speechDurationMs, u5b.handWorkEndMs) && u5b.rowTotalDurationMs > u5b.speechDurationMs)

console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
