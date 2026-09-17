/* @qh-core LANE=B-V2 POINT=TIMING 160cpm + 1D single-hand row-group timeline */
// 车同轨、书同文：板书内容统一过全局唯一超级过滤器（清洗错误转义 + 一行一个的行数组）
import { superCleanBoardField } from '../utils/superFilter.js'
import { normalizeBoardsField, extractSpeechAnchors } from './contract.js'

export const AGENT_B_V2_SPEECH_RATE = 160
export const AGENT_B_V2_ROW_GAP_MS = 1500
export const BASE_CHAR_WRITE_MS = 400 // 1秒2~3字（基准 2.5 字/秒 = 400ms/字）
export const HAND_LIFT_GAP_MS = 600   // 动作抬笔换手间隔
// 用户拍板 2026-09-17：书写时长超出音频窗口时自适应加速，压进音频时长内。
// 音频是行时长唯一主时钟，绝不因书写慢把行拉长成静默尾；极端场景整行至少保留 300ms。
export const ADAPTIVE_MIN_BOARD_MS = 300

/* 2026-09-17 契约定案：单手一维串行（铁律）
 *   mp3 开播 → speech **加粗锚点**（或 startDelay 兜底）依次串行写完 boards 全部板书
 *   → 抬笔换手 → 按 action.order 串行执行 actionSpec → 等待 mp3 结束进入下一 row。
 * 动作绝不允许插在板书前或板书之间。 */

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

// 锚点 → 触发时刻：按锚点在 speech 中的字符占比换算为音频时间（TTS 语速近似均匀）
function anchorTimeMs(speechRaw, anchor, speechDurationMs) {
  const total = Math.max(1, [...String(speechRaw || '')].length)
  const before = [...String(speechRaw || '').slice(0, anchor.start)].length
  const ratio = Math.min(0.95, Math.max(0, before / total))
  return Math.round(speechDurationMs * ratio)
}

/**
 * 计算单个 Row 组内部的一维串行时间线（每个 row 为一组，语音全程）
 * 契约顺序（铁律）：speech 锚点/startDelay 依次串行写完所有 boards → 抬笔 → 按 order 串行执行 actionSpec
 */
export function computeRowGroupTimeline(row, _options = {}) {
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

  // 2. 板书数组（新契约 boards 数组；旧 board 单对象兼容读取）+ speech 加粗锚点
  const boards = normalizeBoardsField(row.boards, row.board)
    .filter((b) => String(b.content || '').trim())
  const anchors = extractSpeechAnchors(speech)
  const actionSpec = (Array.isArray(row.actionSpec) ? row.actionSpec : []).filter(Boolean)
  // 动作按 order 从小到大串行
  actionSpec.sort((a, b) => {
    const oa = Number(a?.action?.order ?? a?.order ?? 0)
    const ob = Number(b?.action?.order ?? b?.order ?? 0)
    return oa - ob
  })

  const trailingActionsMs = actionSpec.reduce((sum, act) => sum + estimateActionDuration(act), 0)
    + HAND_LIFT_GAP_MS * Math.max(0, actionSpec.length)

  const exclusiveExecutionPlan = [{
    type: 'speech',
    role: 'narration_full',
    startOffsetMs: 0,
    durationMs: speechDurationMs,
    endOffsetMs: speechDurationMs,
    text: speech,
  }]

  // 3. 板书串行排期：锚点优先 → startDelay 兜底 → 默认起手节奏；后一块绝不与前一块重叠
  const boardsTimeline = []
  let prevEndMs = 0
  boards.forEach((board, index) => {
    const cleaned = superCleanBoardField(board.content)
    const writeDurRaw = calculateBoardWritingDuration(cleaned.content)
    let triggerSource = 'default'
    let rawStartMs = null

    if (anchors[index]) {
      rawStartMs = anchorTimeMs(speech, anchors[index], speechDurationMs)
      triggerSource = 'anchor'
    } else if (board.triggerKeyword) {
      const kwIdx = String(speech || '').indexOf(board.triggerKeyword)
      if (kwIdx >= 0) {
        rawStartMs = anchorTimeMs(speech, { start: kwIdx }, speechDurationMs)
        triggerSource = 'keyword'
      }
    }
    if (rawStartMs == null && typeof board.startDelay === 'number' && board.startDelay > 0) {
      rawStartMs = Math.round(board.startDelay * 1000)
      triggerSource = 'startDelay'
    }
    if (rawStartMs == null) {
      rawStartMs = Math.min(1800, Math.max(800, Math.round(speechDurationMs * 0.15)))
    }

    // 串行铁律：本块起手 = max(触发时刻, 上一块写完 + 抬笔)
    const startMs = Math.max(rawStartMs, prevEndMs + (prevEndMs > 0 ? HAND_LIFT_GAP_MS : 0))
    const availableMs = speechDurationMs - startMs - trailingActionsMs
    const durationMs = fitBoardDurationIntoWindow(writeDurRaw, availableMs)
    const endMs = startMs + durationMs

    boardsTimeline.push({
      index,
      trigger: triggerSource,
      startOffsetMs: startMs,
      durationMs,
      endOffsetMs: endMs,
      content: cleaned.content,
      lines: cleaned.lines,
    })
    exclusiveExecutionPlan.push({
      type: 'board',
      role: 'writing',
      index,
      trigger: triggerSource,
      startOffsetMs: startMs,
      durationMs,
      endOffsetMs: endMs,
      content: cleaned.content,
      lines: cleaned.lines,
    })
    prevEndMs = endMs
  })

  const boardStartDelayMs = boardsTimeline.length ? boardsTimeline[0].startOffsetMs : 0
  const boardDurationMs = boardsTimeline.reduce((sum, b) => sum + b.durationMs, 0)
  const boardEndDelayMs = boardsTimeline.length ? boardsTimeline[boardsTimeline.length - 1].endOffsetMs : 0

  // 4. 动作串行排期：必须等本 row 所有 boards 写完并抬笔后，才按 order 依次执行
  const actionTimeline = []
  if (actionSpec.length) {
    let cursorMs = boardEndDelayMs > 0
      ? boardEndDelayMs + HAND_LIFT_GAP_MS
      : Math.min(1200, Math.max(600, Math.round(speechDurationMs * 0.12)))
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
    boardsTimeline,
    actionTimeline,
    exclusiveExecutionPlan,
    handWorkEndMs,
    rowTotalDurationMs,
    // 明确声明互斥策略，给下游画布与课件 Agent 权威依据
    mutualExclusivityPolicy: 'boards-all-written-then-actions-serial',
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
