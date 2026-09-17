/* @qh-core LANE=B-V2 POINT=TIMING 160cpm + 1D single-hand row-group timeline */
// 车同轨、书同文：板书内容统一过全局唯一超级过滤器（清洗错误转义 + 一行一个的行数组）
import { superCleanBoardField } from '../utils/superFilter.js'
export const AGENT_B_V2_SPEECH_RATE = 160
export const AGENT_B_V2_ROW_GAP_MS = 1500
export const BASE_CHAR_WRITE_MS = 400 // 1秒2~3字（基准 2.5 字/秒 = 400ms/字）
export const HAND_LIFT_GAP_MS = 600   // 动作抬笔换手间隔
// 用户拍板 2026-09-17：书写时长超出音频窗口时自适应加速，压进音频时长内。
// 音频是行时长唯一主时钟，绝不因书写慢把行拉长成静默尾；极端场景整行至少保留 300ms。
export const ADAPTIVE_MIN_BOARD_MS = 300

function normalizeSpeech(speech) {
  return String(speech || '').trim()
}

function countCharacters(speech) {
  // 语速按纯文字计算，去掉空白和中英文标点
  return [...normalizeSpeech(speech)
    .replace(/\s+/g, '')
    .replace(/[。，、；：？！""''（）《》【】……—.,!?;:'"()[\]<>~`@#$%^&*_+=|\\/]/g, '')].length
}

// 中文标点停顿时长：句号700ms / 逗号500ms / 省略号1000ms
function countPunctuationPause(speech) {
  const text = String(speech || '')
  const periodCount = (text.match(/。/g) || []).length
  const commaCount = (text.match(/，/g) || []).length
  const ellipsisCount = (text.match(/…+/g) || []).length
  return periodCount * 700 + commaCount * 500 + ellipsisCount * 1000
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
 * 自适应加速（用户拍板 2026-09-17）：书写耗时超出音频窗口可用净时长时，
 * 压缩书写时长压进窗口内；音频是行时长唯一主时钟，绝不因书写慢把行拉长成静默尾。
 */
export function fitBoardDurationIntoWindow(boardDurationMs, availableMs) {
  if (!(availableMs > 0) || boardDurationMs <= availableMs) return boardDurationMs
  return Math.max(ADAPTIVE_MIN_BOARD_MS, Math.min(boardDurationMs, availableMs))
}

/**
 * 单个动作的基准时长定量（严格控制在 1.0 ~ 2.0 秒内，好计算，作为标点停顿）
 */
export function estimateActionDuration(action) {
  const inner = action?.action || action
  const tool = inner?.tool || ''
  const subAction = inner?.action || ''

  if (tool === 'rough-notation') {
    if (subAction === 'circle' || subAction === 'box') return 1500
    if (subAction === 'highlight') return 1400
    if (subAction === 'bracket') return 1300
    if (subAction === 'strike-through' || subAction === 'crossed-off') return 1100
    return 1200 // underline / 默认 1.2s
  }
  if (tool === 'rough-line') return 1000 // 划线 1.0s
  if (tool === 'rough-arrow') return 1200 // 箭头 1.2s
  return 1200 // 其他动作兜底 1.2s，确保在 1-2 秒内
}

/**
 * 计算单个 Row 组内部的一维串行时间线（每个 row 为一组，语音全程，板书和动作二者时间绝对互斥）
 * 动作时间定量 1-2s，看作口播句中的标点停顿
 */
export function computeRowGroupTimeline(row, options = {}) {
  const speech = normalizeSpeech(row.speech)
  const speechCharacters = countCharacters(speech)
  const punctuationPauseMs = countPunctuationPause(speech)

  // 1. 口播时长：语音贯穿全程
  const measuredAudioDurationMs = Number(row.audioDurationMs)
  const speechDurationMs = Number.isFinite(measuredAudioDurationMs) && measuredAudioDurationMs > 0
    ? Math.round(measuredAudioDurationMs)
    : speechCharacters > 0
    ? Math.max(1500, Math.round(speechCharacters * 60000 / AGENT_B_V2_SPEECH_RATE) + punctuationPauseMs)
    : 1500

  // 2. 板书内容与基础耗时（车同轨·书同文：单个 row 组内板书一行一个，写完一个再写一个）
  const boardField = superCleanBoardField(
    row.board?.content ?? (Array.isArray(row.board) ? row.board : (typeof row.board === 'string' ? row.board : '')),
  )
  const boardContent = boardField.content
  const boardLines = boardField.lines
  const hasBoard = boardLines.length > 0
  let boardDurationMs = hasBoard ? calculateBoardWritingDuration(boardContent) : 0

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
    // 纯板书情况：语音起手 0.8s~1.5s 后落笔
    const rawDelay = typeof row.board?.startDelay === 'number' && row.board.startDelay > 0
      ? Math.round(row.board.startDelay * 1000)
      : Math.min(1800, Math.max(800, Math.round(speechDurationMs * 0.15)))
    boardStartDelayMs = rawDelay
    boardDurationMs = fitBoardDurationIntoWindow(boardDurationMs, speechDurationMs - boardStartDelayMs)
    boardEndDelayMs = boardStartDelayMs + boardDurationMs

    exclusiveExecutionPlan.push({
      type: 'board',
      role: 'writing',
      startOffsetMs: boardStartDelayMs,
      durationMs: boardDurationMs,
      endOffsetMs: boardEndDelayMs,
      content: boardContent,
      lines: boardLines,
      ...(typeof row.board?.triggerKeyword === 'string' && row.board.triggerKeyword.trim()
        ? { triggerKeyword: row.board.triggerKeyword.trim() }
        : {}),
    })
  } else if (!hasBoard && hasAction) {
    // 纯动作情况（如题目行圈关键词）：动作按标点停顿排布，每个动作 1-2s
    let cursorMs = Math.min(1200, Math.max(600, Math.round(speechDurationMs * 0.12)))
    for (let idx = 0; idx < actionSpec.length; idx++) {
      const act = actionSpec[idx]
      const dur = estimateActionDuration(act)
      const startMs = cursorMs
      const endMs = startMs + dur
      actionTimeline.push({
        index: idx,
        action: act,
        role: 'punctuation_pause',
        startOffsetMs: startMs,
        durationMs: dur,
        endOffsetMs: endMs,
      })
      exclusiveExecutionPlan.push({
        type: 'action',
        role: 'punctuation_pause',
        index: idx,
        startOffsetMs: startMs,
        durationMs: dur,
        endOffsetMs: endMs,
        action: act,
      })
      cursorMs = endMs + HAND_LIFT_GAP_MS
    }
  } else if (hasBoard && hasAction) {
    // 既有板书又有动作：板书与动作二者绝对互斥！动作作为标点停顿！
    // 判定排期次序：
    // 若动作为引导性（如题目区圈选或第一行动作），动作在前（标点停顿），板书紧跟在动作之后；
    // 否则板书先写，写完后在句末标点停顿处执行动作。
    const firstAct = actionSpec[0]?.action || actionSpec[0]
    const isTargetingQuestion = firstAct?.target?.region === 'question' || row.stage === '题目'

    if (isTargetingQuestion) {
      // 模式 A：前置动作（标点停顿） -> 换手 -> 后置板书
      let actCursor = Math.min(1000, Math.max(500, Math.round(speechDurationMs * 0.1)))
      for (let idx = 0; idx < actionSpec.length; idx++) {
        const act = actionSpec[idx]
        const dur = estimateActionDuration(act)
        const startMs = actCursor
        const endMs = startMs + dur
        actionTimeline.push({
          index: idx,
          action: act,
          role: 'punctuation_pause',
          startOffsetMs: startMs,
          durationMs: dur,
          endOffsetMs: endMs,
        })
        exclusiveExecutionPlan.push({
          type: 'action',
          role: 'punctuation_pause',
          index: idx,
          startOffsetMs: startMs,
          durationMs: dur,
          endOffsetMs: endMs,
          action: act,
        })
        actCursor = endMs + HAND_LIFT_GAP_MS
      }

      // 动作结束并抬手后，板书才开始（绝对互斥）
      boardStartDelayMs = actCursor
      boardDurationMs = fitBoardDurationIntoWindow(boardDurationMs, speechDurationMs - boardStartDelayMs)
      boardEndDelayMs = boardStartDelayMs + boardDurationMs
      exclusiveExecutionPlan.push({
        type: 'board',
        role: 'writing',
        startOffsetMs: boardStartDelayMs,
        durationMs: boardDurationMs,
        endOffsetMs: boardEndDelayMs,
        content: boardContent,
        lines: boardLines,
      })
    } else {
      // 模式 B：前置板书 -> 换手 -> 后置动作（句末/阶段标点停顿）
      const rawDelay = typeof row.board?.startDelay === 'number' && row.board.startDelay > 0
        ? Math.round(row.board.startDelay * 1000)
        : Math.min(1500, Math.max(600, Math.round(speechDurationMs * 0.12)))
      boardStartDelayMs = rawDelay
      // 后置动作占用：行尾抬笔 + 每个动作及其间抬笔
      const trailingMs = HAND_LIFT_GAP_MS + actionSpec.reduce((s, a) => s + estimateActionDuration(a), 0) + HAND_LIFT_GAP_MS * Math.max(0, actionSpec.length - 1)
      boardDurationMs = fitBoardDurationIntoWindow(boardDurationMs, speechDurationMs - boardStartDelayMs - trailingMs)
      boardEndDelayMs = boardStartDelayMs + boardDurationMs

      exclusiveExecutionPlan.push({
        type: 'board',
        role: 'writing',
        startOffsetMs: boardStartDelayMs,
        durationMs: boardDurationMs,
        endOffsetMs: boardEndDelayMs,
        content: boardContent,
        lines: boardLines,
      })

      // 板书完全写完并抬手换笔后，再串行执行动作（绝对互斥）
      let actCursor = boardEndDelayMs + HAND_LIFT_GAP_MS
      for (let idx = 0; idx < actionSpec.length; idx++) {
        const act = actionSpec[idx]
        const dur = estimateActionDuration(act)
        const startMs = actCursor
        const endMs = startMs + dur
        actionTimeline.push({
          index: idx,
          action: act,
          role: 'punctuation_pause',
          startOffsetMs: startMs,
          durationMs: dur,
          endOffsetMs: endMs,
        })
        exclusiveExecutionPlan.push({
          type: 'action',
          role: 'punctuation_pause',
          index: idx,
          startOffsetMs: startMs,
          durationMs: dur,
          endOffsetMs: endMs,
          action: act,
        })
        actCursor = endMs + HAND_LIFT_GAP_MS
      }
    }
  }

  // 计算黑板/肢体物理操作总结束时间
  let handWorkEndMs = boardEndDelayMs
  if (actionTimeline.length > 0) {
    const lastActionEnd = actionTimeline[actionTimeline.length - 1].endOffsetMs
    handWorkEndMs = Math.max(handWorkEndMs, lastActionEnd)
  }

  // Row 组总耗时：自适应加速后板书+动作已压进音频窗口，正常 rowTotalDurationMs=音频时长（唯一主时钟）；
  // 仅在极端下限（整行 300ms 仍放不下）或无音频估算兜底时取 max
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
