/* @qh-core LANE=B-V2 POINT=TIMING 160cpm + 1D single-hand row-group timeline */
export const AGENT_B_V2_SPEECH_RATE = 160
export const AGENT_B_V2_ROW_GAP_MS = 1500
export const BASE_CHAR_WRITE_MS = 400 // 1秒2~3字（基准 2.5 字/秒 = 400ms/字）
export const HAND_LIFT_GAP_MS = 600   // 动作抬笔换手间隔

function normalizeSpeech(speech) {
  return String(speech || '').trim()
}

// ponytail: 唯一字数算法真源 — UI 显示与 timing 计算都 import 这个，消除"剥/不剥标点"分叉
export function countCharacters(speech) {
  // 语速按纯文字计算，去掉空白和中英文标点
  return [...normalizeSpeech(speech)
    .replace(/\s+/g, '')
    .replace(/[。，、；：？！""''（）《》【】……—.,!?;:'"()[\]<>~`@#$%^&*_+=|\\/]/g, '')].length
}

// 中文标点停顿时长：句号700ms / 逗号500ms / 省略号1000ms
export function countPunctuationPauseMs(speech) {
  const text = String(speech || '')
  const periodCount = (text.match(/。/g) || []).length
  const commaCount = (text.match(/，/g) || []).length
  const ellipsisCount = (text.match(/…+/g) || []).length
  return periodCount * 700 + commaCount * 500 + ellipsisCount * 1000
}

// ponytail: 唯一口播时长估算 — UI 与 timing 共用，统一含 1500ms 下限 + 标点停顿
export function estimateSpeechDurationMs(speech, { speed = AGENT_B_V2_SPEECH_RATE } = {}) {
  const chars = countCharacters(speech)
  if (chars <= 0) return 1500
  const pause = countPunctuationPauseMs(speech)
  return Math.max(1500, Math.round(chars * 60000 / speed) + pause)
}

/**
 * 计算板书书写耗时预估（1秒2~3字，带微弱抖动区间）
 */
export function calculateBoardWritingDuration(content) {
  const text = String(content || '').trim()
  if (!text) return 0
  // 去除 LaTeX 结构控制符后统计实际有效笔墨字符量
  const clean = text
    .replace(/\\(begin|end)\{[^}]+\}/g, '')
    .replace(/\\(frac|times|div|aligned)/g, ' ')
    .replace(/\s+/g, '')
  const charCount = Math.max(1, [...clean].length)

  let durationMs = 0
  for (let i = 0; i < charCount; i++) {
    // 微弱抖动感：在 360ms ~ 440ms 之间轻微浮动，呈现真人书写节奏
    const jitter = ((i * 17) % 7 - 3) * 10
    durationMs += Math.max(320, BASE_CHAR_WRITE_MS + jitter)
  }
  return durationMs
}

/**
 * 单个动作的基准时长定量（严格控制在 1.0 ~ 2.0 秒内，好计算，作为标点停顿）
 */
// ponytail: 嵌套 if/else 改表驱动（shrink -3 行）
const NOTATION_DURATION_MS = {
  circle: 1500, box: 1500, highlight: 1400, bracket: 1300,
  'strike-through': 1100, 'crossed-off': 1100, underline: 1200,
}
const TOOL_DURATION_MS = { 'rough-line': 1000, 'rough-arrow': 1200 }

export function estimateActionDuration(action) {
  const inner = action?.action || action
  const tool = inner?.tool || ''
  if (tool === 'rough-notation') {
    return NOTATION_DURATION_MS[inner?.action] || 1200
  }
  return TOOL_DURATION_MS[tool] || 1200 // 兜底 1.2s，确保在 1-2 秒内
}

/**
 * 计算单个 Row 组内部的一维串行时间线（每个 row 为一组，语音全程，板书和动作二者时间绝对互斥）
 * 动作时间定量 1-2s，看作口播句中的标点停顿
 */
// ponytail: 抽 appendBoard helper — 3 处重复的 board push 统一到这里
// 返回 endOffsetMs，调用方用它推进 cursor
function appendBoard(startOffsetMs, boardDurationMs, boardContent, exclusiveExecutionPlan) {
  const endOffsetMs = startOffsetMs + boardDurationMs
  exclusiveExecutionPlan.push({
    type: 'board', role: 'writing',
    startOffsetMs, durationMs: boardDurationMs, endOffsetMs, content: boardContent,
  })
  return endOffsetMs
}

// ponytail: 抽 appendAction + appendActionLoop — 3 处重复的 action for 循环统一到这里
// appendAction 返回 nextCursorMs (推进 HAND_LIFT_GAP_MS)
function appendAction(actionSpec, idx, cursorMs, actionTimeline, exclusiveExecutionPlan) {
  const act = actionSpec[idx]
  const dur = estimateActionDuration(act)
  const startMs = cursorMs
  const endMs = startMs + dur
  actionTimeline.push({
    index: idx, action: act, role: 'punctuation_pause',
    startOffsetMs: startMs, durationMs: dur, endOffsetMs: endMs,
  })
  exclusiveExecutionPlan.push({
    type: 'action', role: 'punctuation_pause', index: idx,
    startOffsetMs: startMs, durationMs: dur, endOffsetMs: endMs, action: act,
  })
  return endMs + HAND_LIFT_GAP_MS
}

function appendActionLoop(actionSpec, cursorMs, actionTimeline, exclusiveExecutionPlan) {
  for (let idx = 0; idx < actionSpec.length; idx++) {
    cursorMs = appendAction(actionSpec, idx, cursorMs, actionTimeline, exclusiveExecutionPlan)
  }
  return cursorMs
}

export function computeRowGroupTimeline(row, options = {}) {
  const speech = normalizeSpeech(row.speech)
  const speechCharacters = countCharacters(speech)
  const punctuationPauseMs = countPunctuationPauseMs(speech)

  // 1. 口播时长：语音贯穿全程
  const measuredAudioDurationMs = Number(row.audioDurationMs)
  const speechDurationMs = Number.isFinite(measuredAudioDurationMs) && measuredAudioDurationMs > 0
    ? Math.round(measuredAudioDurationMs)
    : speechCharacters > 0
    ? Math.max(1500, Math.round(speechCharacters * 60000 / AGENT_B_V2_SPEECH_RATE) + punctuationPauseMs)
    : 1500

  // 2. 板书内容与基础耗时
  const boardContent = String(row.board?.content ?? (typeof row.board === 'string' ? row.board : '')).trim()
  const hasBoard = Boolean(boardContent)
  const boardDurationMs = hasBoard ? calculateBoardWritingDuration(boardContent) : 0

  // 3. 动作提取与严格 1-2 秒时长计算
  const rawActions = Array.isArray(row.actionSpec) ? row.actionSpec : []
  const actionSpec = rawActions.filter(Boolean)
  const hasAction = actionSpec.length > 0

  let boardStartDelayMs = 0
  let boardEndDelayMs = 0
  const actionTimeline = []
  const exclusiveExecutionPlan = []

  // 加入全程口播计划
  exclusiveExecutionPlan.push({
    type: 'speech',
    role: 'narration_full',
    startOffsetMs: 0,
    durationMs: speechDurationMs,
    endOffsetMs: speechDurationMs,
    text: speech,
  })

  if (hasBoard && !hasAction) {
    // 分支 1: 纯板书 — 语音起手 0.8~1.5s 后落笔
    const rawDelay = typeof row.board?.startDelay === 'number' && row.board.startDelay > 0
      ? Math.round(row.board.startDelay * 1000)
      : Math.min(1800, Math.max(800, Math.round(speechDurationMs * 0.15)))
    boardStartDelayMs = rawDelay
    boardEndDelayMs = appendBoard(boardStartDelayMs, boardDurationMs, boardContent, exclusiveExecutionPlan)
  } else if (!hasBoard && hasAction) {
    // 分支 2: 纯动作（如题目行圈关键词）— 动作按标点停顿排布，每个动作 1-2s
    let cursorMs = Math.min(1200, Math.max(600, Math.round(speechDurationMs * 0.12)))
    appendActionLoop(actionSpec, cursorMs, actionTimeline, exclusiveExecutionPlan)
  } else if (hasBoard && hasAction) {
    // 分支 3: 既有板书又有动作 — 板书与动作绝对互斥！动作作为标点停顿！
    const firstAct = actionSpec[0]?.action || actionSpec[0]
    const isTargetingQuestion = firstAct?.target?.region === 'question' || row.stage === '题目'

    if (isTargetingQuestion) {
      // 模式 A: 前置动作（标点停顿） → 换手 → 后置板书
      let actCursor = Math.min(1000, Math.max(500, Math.round(speechDurationMs * 0.1)))
      actCursor = appendActionLoop(actionSpec, actCursor, actionTimeline, exclusiveExecutionPlan)
      // 动作结束并抬手后，板书才开始（绝对互斥）
      boardStartDelayMs = actCursor
      boardEndDelayMs = appendBoard(boardStartDelayMs, boardDurationMs, boardContent, exclusiveExecutionPlan)
    } else {
      // 模式 B: 前置板书 → 换手 → 后置动作（句末/阶段标点停顿）
      const rawDelay = typeof row.board?.startDelay === 'number' && row.board.startDelay > 0
        ? Math.round(row.board.startDelay * 1000)
        : Math.min(1500, Math.max(600, Math.round(speechDurationMs * 0.12)))
      boardStartDelayMs = rawDelay
      boardEndDelayMs = appendBoard(boardStartDelayMs, boardDurationMs, boardContent, exclusiveExecutionPlan)
      // 板书完全写完并抬手换笔后，再串行执行动作（绝对互斥）
      let actCursor = boardEndDelayMs + HAND_LIFT_GAP_MS
      appendActionLoop(actionSpec, actCursor, actionTimeline, exclusiveExecutionPlan)
    }
  }

  // 计算黑板/肢体物理操作总结束时间
  let handWorkEndMs = boardEndDelayMs
  if (actionTimeline.length > 0) {
    const lastActionEnd = actionTimeline[actionTimeline.length - 1].endOffsetMs
    handWorkEndMs = Math.max(handWorkEndMs, lastActionEnd)
  }

  // Row 组总耗时：语音全程与黑板单手动作两者取最大值，留足时间
  const rowTotalDurationMs = Math.max(speechDurationMs, handWorkEndMs)

  return {
    speechDurationMs,
    boardStartDelayMs,
    boardDurationMs,
    boardEndDelayMs,
    actionTimeline,
    exclusiveExecutionPlan,
    handWorkEndMs,
    rowTotalDurationMs,
    // 明确声明互斥策略，给下游画布与课件 Agent 权威依据
    mutualExclusivityPolicy: 'single-hand-serial-1-2s-action-pause',
  }
}

/**
 * 对 rows 进行 Row 组全局一维时间线并列串联
 */
export function applyAgentBV2Timeline(rows, options = {}) {
  const rowGapMs = Number.isFinite(options.rowGapMs) && options.rowGapMs > 0
    ? options.rowGapMs
    : AGENT_B_V2_ROW_GAP_MS
  let globalCursorMs = 0 // 全局累计

  return rows.map((row) => {
    const speech = normalizeSpeech(row.speech)
    const speechCharacters = countCharacters(speech)
    const timeline = computeRowGroupTimeline(row, options)

    const estimatedDurationMs = timeline.rowTotalDurationMs
    const estimatedStartMs = globalCursorMs
    const estimatedEndMs = estimatedStartMs + estimatedDurationMs
    globalCursorMs = estimatedEndMs + rowGapMs

    return {
      ...row,
      speech,
      timingStatus: Number.isFinite(Number(row.audioDurationMs)) && Number(row.audioDurationMs) > 0 ? 'measured' : 'estimated',
      timingSource: Number.isFinite(Number(row.audioDurationMs)) && Number(row.audioDurationMs) > 0
        ? 'audio-duration'
        : 'agent-b-v2-1d-row-group',
      speechCharacters,
      estimatedDurationMs,
      estimatedStartMs,
      estimatedEndMs,
      rowTimeline: {
        ...timeline,
        globalStartMs: estimatedStartMs,
        globalEndMs: estimatedEndMs,
      },
    }
  })
}
