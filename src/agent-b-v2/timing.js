/* @qh-core LANE=B-V2 POINT=TIMING FALLBACK-160cpm + 1D single-hand row-group timeline */
// 2026-10-13 归一：动作抬笔间隔唯一真源 = boardToolTiming.js（调度器硬下限）。
// 此前本文件平行写死 600ms，与执行器强制 ≥1000ms 打架，估算系统性偏快、长板书音画漂移。
import { MIN_HAND_LIFT_GAP_MS } from '../board-tools/boardToolTiming.js'

// 2026-10-15 夏夏定性：160 是兜位不是功能——有音频一律跟音频（音频自带真实语速与自然语句停顿），
// 仅当用户没生成音频（懒得点/随便试用）时拿 160cpm 匀速估算凑数，保证演示能跑。改它只影响兜底演示节奏。
export const AGENT_B_V2_SPEECH_RATE = 160
export const AUDIO_SPEED_POLICY_TEXT = `（有音频 url 的，以音频自然播放时间为准，一组一组自然播放；无音频 url 的，用兜底演示数据占位，按 ${AGENT_B_V2_SPEECH_RATE} 字/分估算凑数演示）`
export const AGENT_B_V2_ROW_GAP_MS = 1000
// 2026-10-15 夏夏拍板提速：写字 1秒4~5字（400ms/字 → 220ms/字），row 间自然停顿 1500→1000ms（口播语句间停顿）
export const BASE_CHAR_WRITE_MS = 220 // 1秒4~5字（基准 4.5 字/秒 = 220ms/字）
export const HAND_LIFT_GAP_MS = MIN_HAND_LIFT_GAP_MS // 动作抬笔换手间隔（真源 boardToolTiming.js）

// ★ Task 52（2026-10-19 夏夏拍板「234 要统一」）：以下三块口径镜像 row-player 实播轴——
//   ★ Task 61 起改为「哨兵对拍」而非「人肉两处同改」：scripts/test-player-mirror-parity.mjs B 组
//   用同一语料双跑本文件与播放器提取代码，分叉即红。行号引用全改函数名锚（旧 L1520/L283 等行号大化石已清）：
//   ① 音频行判定（镜像 row-player isAudioSrc）
//   ② 板书字数口径（镜像 row-player visualLen / isRuleLine / compile 内 estSpeech 兜底公式）
//   ③ startDelay 字面语义 + 板书先动作后 + 音频行锁时长锁 gap（镜像 row-player compile 音频铁律段）
//   估算轴（本文件/VisualTimeline/导出 estimated*）与实播轴（liteplayer）此前三处分叉：
//   startDelay=0 暗改兜底、模式 A 动作前置、音频行 gap/时长——统一后估算轴如实反映实播。
const AUDIO_SRC_RE = /(^data:audio\/|^blob:|^https?:\/\/|^\.{0,2}\/|\.(mp3|wav|m4a|aac|ogg|webm|mpeg)(\?|#|$))/i
export function isAudioSrc(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  return s !== '' && AUDIO_SRC_RE.test(s)
}
/** 行是否挂真实音频（可播 URL 或实测时长）——行 gap 与行时长锁定的统一判据（镜像 row-player audioRow||hasMeasuredAudio，L517/L525） */
export function rowHasRealAudio(row) {
  const url = row?.mp3 || row?.audioUrl || row?.audio
  return isAudioSrc(url) || (Number.isFinite(Number(row?.audioDurationMs)) && Number(row?.audioDurationMs) > 0)
}

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
// 兜位口径：仅无音频时凑数估算，有音频一律用实测时长（见 computeRowGroupTimeline 优先级）
export function estimateSpeechDurationMs(speech, { speed = AGENT_B_V2_SPEECH_RATE } = {}) {
  const chars = countCharacters(speech)
  if (chars <= 0) return 1500
  const pause = countPunctuationPauseMs(speech)
  return Math.max(1500, Math.round(chars * 60000 / speed) + pause)
}

// ★ Task 52：板书字数口径镜像 row-player compile——行切分（剥行尾空白、滤空行）、
//   \frac{a}{b} 视觉字数 = a+b+1（+1 是分数线）、纯横线行按 2 字快写、每字 220ms 无抖动。
//   旧口径剥 \frac 等 LaTeX 命令按字面字符计：分数行/横线行系统性低估，多行板书与实播漂移。
//   行间抬笔在实播是板书窗口内的权重挤占（row-player drawWriting seg），两侧同窗口不加时。
export function readBrace(s, i) {
  let depth = 0, j = i
  for (; j < s.length; j++) {
    if (s[j] === '{') depth++
    else if (s[j] === '}') { depth--; if (depth === 0) return { text: s.slice(i + 1, j), next: j + 1 } }
  }
  return { text: s.slice(i + 1, j), next: j }
}
function splitBoardLines(content) {
  return String(content || '').split('\n')
    .map(l => l.replace(/\s+$/, ''))
    .filter(l => l.trim().length > 0)
}
// 纯横线行（竖式/长除横线）：连续 2+ 个横线类字符，实播 rough 手绘快画，估算按 2 字（镜像 row-player isRuleLine）
export function isRuleLine(s) {
  const t = String(s == null ? '' : s).replace(/\s/g, '')
  return t.length >= 2 && /^[_—\-–―─~～═━=]+$/.test(t)
}
// 视觉字数：\frac{a}{b} 只算 a+b+1 个视觉单位，别把字面 \frac 算进去（镜像 row-player visualLen）
export function visualLen(line) {
  let s = String(line), n = 0, i = 0
  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const a = readBrace(s, i + 5); const b = readBrace(s, a.next)
      n += a.text.length + b.text.length + 1; i = b.next
    } else { n++; i++ }
  }
  return n
}
/**
 * 计算板书书写耗时预估（1秒4~5字，与实播同窗口）
 */
export function calculateBoardWritingDuration(content) {
  const lines = splitBoardLines(content)
  if (!lines.length) return 0
  const charCount = Math.max(1, lines.reduce((a, l) => a + (isRuleLine(l) ? 2 : visualLen(l)), 0))
  return charCount * BASE_CHAR_WRITE_MS
}

/**
 * 单个动作的基准时长定量（严格控制在 1.0 ~ 2.0 秒内，好计算，作为标点停顿）
 */
// ponytail: 嵌套 if/else 改表驱动（shrink -3 行）
// 2026-10-13 砍死条目：box/bracket/strike-through/crossed-off 不在
// roughNotationTool 白名单（underline|circle），估算永远走不到 → 删。
// circle 于同日第七轮回归白名单（1500ms 对齐 row-player L319 播放时序），
// 依据见 roughNotationTool.js 契约拍板注释。
// ★ Task 43 夏夏拍板「动作 1.0」：白名单收紧为三动作（下划线/横线/画圈），颜色统一红。
// 时长分档（严格 1~2 秒内）：画圈固定 1000ms；下划线按 exactText 字数——
// ≤5 字 1000ms / >5 字 1500ms / >10 字 2000ms；横线（rough-line）无 exactText 固定 1000ms。
// highlight / rough-arrow / draw 已砍（「其他做我怕做不好」）。
// 旧表 {highlight:1400, underline:1200, circle:1500} 同步废弃。
// ★ Task 61：六常量改导出——roughNotationTool 手抄副本退役改 import，对拍哨兵锁双侧同值
export const NOTATION_DURATION_MS = { underline: 1000, circle: 1000 }
export const TOOL_DURATION_MS = { 'rough-line': 1000 }
export const UNDERLINE_LONG_MS = 1500        // >5 字
export const UNDERLINE_XLONG_MS = 2000       // >10 字
export const UNDERLINE_MID_CHARS = 5
export const UNDERLINE_XLONG_CHARS = 10

export function estimateActionDuration(action) {
  const inner = action?.action || action
  const tool = inner?.tool || ''
  if (tool === 'rough-notation') {
    if (inner?.action === 'circle') return NOTATION_DURATION_MS.circle
    // underline：按锚定文本字数分档（夏夏拍板「超过5字的1.5秒 超过10字的2秒」）
    const textLen = [...String(inner?.target?.exactText || '')].length
    if (textLen > UNDERLINE_XLONG_CHARS) return UNDERLINE_XLONG_MS
    if (textLen > UNDERLINE_MID_CHARS) return UNDERLINE_LONG_MS
    return NOTATION_DURATION_MS.underline
  }
  return TOOL_DURATION_MS[tool] || 1000 // rough-line 1000；兜底 1s 确保在 1-2 秒内
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

/**
 * ★ Task 43 关键词触发真源（夏夏拍板「动作以关键词锚定」）：
 * actionSpec entry 级 triggerKeyword → 语音内时点（毫秒）。比例映射算法（3025bad anchorMs 复活）：
 * 关键词在口播中的字符位置比例 × 行时长，clamp 0.95 防越界；miss（空/找不到）返回 null 走原串行排期。
 * 与板书起笔共用「字符位置×时长」同一套法则；受互斥钳制（不早于前序结束，夏夏铁律：
 * 「每个 row 内所有板书和动作互斥，不允许一个时间两个地方再动」）。
 */
export function resolveKeywordTimeMs(speech, keyword, speechDurationMs) {
  const kw = String(keyword ?? '').trim()
  if (!kw) return null
  const text = String(speech ?? '')
  const idx = text.indexOf(kw)
  if (idx < 0) return null
  const totalChars = Math.max(1, [...text].length)
  const beforeChars = [...text.slice(0, idx)].length
  const ratio = Math.min(0.95, Math.max(0, beforeChars / totalChars))
  return Math.round(speechDurationMs * ratio)
}

// ponytail: 抽 appendAction + appendActionLoop — 3 处重复的 action for 循环统一到这里
// appendAction 返回 nextCursorMs (推进 HAND_LIFT_GAP_MS)
// ★ Task 43：keywordCtx={speech,speechDurationMs} 可选——动作支持 entry 级 triggerKeyword
// 关键词时点；互斥钳制 startMs=max(kwTime, cursorMs)（不得早于板书写完+抬笔/上一动作结束）
function appendAction(actionSpec, idx, cursorMs, actionTimeline, exclusiveExecutionPlan, keywordCtx) {
  const act = actionSpec[idx]
  const dur = estimateActionDuration(act)
  let startMs = cursorMs
  let keywordStartOffsetMs = null
  if (keywordCtx) {
    const kwTime = resolveKeywordTimeMs(keywordCtx.speech, act?.triggerKeyword, keywordCtx.speechDurationMs)
    if (kwTime != null) {
      keywordStartOffsetMs = kwTime
      startMs = Math.max(kwTime, cursorMs)   // 互斥铁律：关键词不得提前到前序未结束
    }
  }
  const endMs = startMs + dur
  actionTimeline.push({
    index: idx, action: act, role: 'punctuation_pause',
    startOffsetMs: startMs, durationMs: dur, endOffsetMs: endMs,
    ...(keywordStartOffsetMs != null ? { keywordStartOffsetMs, triggerKeyword: act.triggerKeyword } : {}),
  })
  exclusiveExecutionPlan.push({
    type: 'action', role: 'punctuation_pause', index: idx,
    startOffsetMs: startMs, durationMs: dur, endOffsetMs: endMs, action: act,
  })
  return endMs + HAND_LIFT_GAP_MS
}

function appendActionLoop(actionSpec, cursorMs, actionTimeline, exclusiveExecutionPlan, keywordCtx) {
  for (let idx = 0; idx < actionSpec.length; idx++) {
    cursorMs = appendAction(actionSpec, idx, cursorMs, actionTimeline, exclusiveExecutionPlan, keywordCtx)
  }
  return cursorMs
}

export function computeRowGroupTimeline(row, options = {}) {
  const speech = normalizeSpeech(row.speech)
  const speechCharacters = countCharacters(speech)
  const punctuationPauseMs = countPunctuationPauseMs(speech)

  // 1. 口播时长：语音贯穿全程（有实测音频用实测，无音频才按 160cpm 兜底凑数，见文件头定性）
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
  // ★ Task 43：按 action.order 排序（3025bad 有而现行丢失的回归——动作顺序信任输入顺序的隐患）；
  // entry 级 triggerKeyword 经 {...entry} 透传归一（contract.js），此处消费
  const rawActions = Array.isArray(row.actionSpec) ? row.actionSpec : []
  const actionSpec = rawActions.filter(Boolean).slice().sort((a, b) => {
    const oa = Number(a?.action?.order ?? a?.order ?? 0) || 0
    const ob = Number(b?.action?.order ?? b?.order ?? 0) || 0
    return oa - ob
  })
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
    // ★ Task 52（夏夏「234 统一」分叉 2）：startDelay 字面语义——0=语音一起笔即写
    //   （与 row-player 实播 L454 及 AgentBDirect 表格 UI title 同口径）。
    //   旧版 0/缺失时暗改兜底 max(800,min(1800,15%行时长))——App 时间轴显示延迟落笔、
    //   导出实播却 0 秒开写，估算轴与实播轴分叉；生成侧防线 = Check Agent 校准 0 值行
    //   （check prompt §6 时机判定第 5 条 + asrPolish estimateKeywordStartDelay）。
    boardStartDelayMs = Math.round(Math.max(0, Number(row.board?.startDelay) || 0) * 1000)
    boardEndDelayMs = appendBoard(boardStartDelayMs, boardDurationMs, boardContent, exclusiveExecutionPlan)
  } else if (!hasBoard && hasAction) {
    // 分支 2: 纯动作（如题目行圈关键词）— 动作按标点停顿排布，每个动作 1-2s
    // ★ Task 43：支持 entry 级 triggerKeyword 关键词时点（互斥钳制）
    let cursorMs = Math.min(1200, Math.max(600, Math.round(speechDurationMs * 0.12)))
    appendActionLoop(actionSpec, cursorMs, actionTimeline, exclusiveExecutionPlan, { speech, speechDurationMs })
  } else if (hasBoard && hasAction) {
    // 分支 3: 既有板书又有动作 — 板书与动作绝对互斥！动作作为标点停顿！
    // ★ Task 52（夏夏「234 统一」分叉 3）：模式 A（question 定向动作前置板书）已砍。
    //   旧模式 A 触发面 = firstAct.target.region==='question' || row.stage==='题目'：App 时间轴
    //   显示「先画线后写字」，导出实播（row-player 无此分支）却是「先写字后画线」——同一 JSON
    //   两侧动作时序相反。统一为实播 + 生成侧教法（prompt §5.1「动作必须排在板书书写完毕之后
    //   按 order 依次执行」）三方归一：一律板书先、动作后。题目行板书恒空走分支 2 纯动作路径。
    // startDelay 字面语义（0=一起笔即写），同分支 1，无暗改兜底
    boardStartDelayMs = Math.round(Math.max(0, Number(row.board?.startDelay) || 0) * 1000)
    boardEndDelayMs = appendBoard(boardStartDelayMs, boardDurationMs, boardContent, exclusiveExecutionPlan)
    // 板书完全写完并抬手换笔后，再串行执行动作（绝对互斥）
    // ★ Task 43：支持 entry 级 triggerKeyword 关键词时点（互斥钳制：不早于板书写完+抬笔）
    let actCursor = boardEndDelayMs + HAND_LIFT_GAP_MS
    appendActionLoop(actionSpec, actCursor, actionTimeline, exclusiveExecutionPlan, { speech, speechDurationMs })
  }

  // 计算黑板/肢体物理操作总结束时间
  let handWorkEndMs = boardEndDelayMs
  if (actionTimeline.length > 0) {
    const lastActionEnd = actionTimeline[actionTimeline.length - 1].endOffsetMs
    handWorkEndMs = Math.max(handWorkEndMs, lastActionEnd)
  }

  // Row 组总耗时：★ Task 52 分叉 4c——有真实音频 → 锁音频时长（镜像 row-player「音频=行时长
  // 唯一主时钟」L517-519；手活超载时板书/动作 endOffset 超出行窗 = 超载可见，实播域由
  // compactActionsIntoWindow 压窗，「估算上界 vs 播放压缩」分工见 row-player L407 史档）。
  // 无音频 → 虚拟时钟拉长完整呈现（镜像 row-player maxEnd 兜底 L521-522）。
  const hasRealAudio = rowHasRealAudio(row)
  const rowTotalDurationMs = hasRealAudio ? speechDurationMs : Math.max(speechDurationMs, handWorkEndMs)

  return {
    speechDurationMs,
    boardStartDelayMs,
    boardDurationMs,
    boardEndDelayMs,
    actionTimeline,
    exclusiveExecutionPlan,
    handWorkEndMs,
    rowTotalDurationMs,
    hasRealAudio,
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
    // ★ Task 52（夏夏「234 统一」分叉 4b）：gap 口径镜像 row-player L525——
    //   (audioRow||hasMeasuredAudio) 行 gap=0（音频 onended 自然紧接，停顿靠 TTS 尾音），
    //   仅无音频行保留 rowGapMs 演示停顿。旧版一律 +rowGapMs，音频行间估算轴比实播轴每行虚长 1 秒。
    const gapAfterMs = rowHasRealAudio(row) ? 0 : rowGapMs
    globalCursorMs = estimatedEndMs + gapAfterMs

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
