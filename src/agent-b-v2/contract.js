/* @qh-core LANE=B-V2 POINT=CONTRACT_NORMALIZE model rows into board-readable fields */
import { validateBoardToolAction } from '../board-tools/boardToolCatalog.js'
// 车同轨、书同文：板书内容与错误转义统一过全局唯一超级过滤器
import { superCleanBoardField } from '../utils/superFilter.js'
// 画布参数唯一真源：src/services/stepHandoff.js

/* 2026-09-17 契约定案（对齐下游渲染引擎）：
 *   row = { stage, mp3, speech, boards: [{startDelay, content}], actionSpec }
 *   - boards 为数组（板书触发锚点 = speech 内 **加粗文本** 按序映射，startDelay 数字为兜底）
 *   - mp3 为必填占位 ""，真实音频 URL 由下游回填
 *   - 单手串行：本 row 所有 boards 写完 → 才按 order 执行 actionSpec
 * 旧数据（board 单对象 / triggerKeyword / 字符串板书）在读取侧全部兼容归一为 boards 数组。 */
export const AGENT_B_V2_COLUMNS = Object.freeze([
  'stage',
  'mp3',
  'speech',
  'boards',
  'actionSpec',
])

export const AGENT_B_V2_STAGES = Object.freeze(['题目', '分析', '解答', '总结'])

// 环节别名容错表（温和吸附，防止大模型在长篇生成中因同义词导致整表抛弃）
const STAGE_SYNONYMS = Object.freeze({
  '思路': '分析',
  '讲解': '分析',
  '过程': '解答',
  '步骤': '解答',
  '计算': '解答',
  '答案': '解答',
  '题面': '题目',
  '题干': '题目',
  '小结': '总结',
  '回顾': '总结',
})

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStage(stage, index) {
  const clean = String(stage || '').trim()
  if (AGENT_B_V2_STAGES.includes(clean)) return clean
  if (STAGE_SYNONYMS[clean]) return STAGE_SYNONYMS[clean]

  const fallback = index === 0 ? '题目' : '分析'
  console.warn(`[AgentB contract] 非法 stage 值：${JSON.stringify(stage)}（第${index + 1}行），已温和校正为"${fallback}"。合法值仅限：题目/分析/解答/总结`)
  return fallback
}

// ---------- speech 加粗锚点（板书触发唯一真源） ----------
// 提取 speech 内 **加粗** 片段：返回按出现顺序的锚点（含原文索引，供时序换算触发时刻）
export function extractSpeechAnchors(speech) {
  const text = String(speech || '')
  const anchors = []
  const re = /\*\*([^*\n]+?)\*\*/g
  let match
  while ((match = re.exec(text)) !== null) {
    anchors.push({
      text: match[1],
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return anchors
}

// TTS / 字幕侧使用：剔除 ** 标记（口播稿读出来不含任何符号）
export function stripSpeechAnchors(speech) {
  return String(speech || '').replace(/\*\*([^*\n]+?)\*\*/g, '$1')
}

// ---------- boards 数组归一 ----------
function normalizeBoardDelay(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Number(value.toFixed(2))
  if (typeof value === 'string') {
    const match = value.match(/[\d.]+/)
    const parsed = match ? parseFloat(match[0]) : NaN
    if (Number.isFinite(parsed) && parsed >= 0) return Number(parsed.toFixed(2))
  }
  return null
}

// 单个 BoardItem → { startDelay, content }（content 过超级过滤器，一行一个按序落笔）
function normalizeBoardItem(item, keepTriggerKeyword) {
  if (typeof item === 'string') {
    const trimmed = item.trim()
    const legacyPrefix = trimmed.match(/^\s*[([]\s*[\d.]+(?:%|px)?\s*,\s*[\d.]+(?:%|px)?\s*[)\]]\s*(.*)$/s)
    const cleaned = superCleanBoardField(legacyPrefix ? legacyPrefix[1] || '' : item)
    return { startDelay: null, content: cleaned.content }
  }
  if (isRecord(item)) {
    const cleaned = superCleanBoardField(item.content ?? item.text ?? '')
    const startDelay = normalizeBoardDelay(item.startDelay)
    const out = { startDelay, content: cleaned.content }
    // 旧数据 triggerKeyword 兼容读取：仅作触发兜底，序列化导出时剥离
    if (keepTriggerKeyword && typeof item.triggerKeyword === 'string' && item.triggerKeyword.trim()) {
      out.triggerKeyword = item.triggerKeyword.trim()
    }
    return out
  }
  if (Array.isArray(item)) {
    const cleaned = superCleanBoardField(item)
    return { startDelay: null, content: cleaned.content }
  }
  return { startDelay: null, content: '' }
}

// row 级 boards 归一：新合同 boards 数组优先，旧 board 单对象/字符串/数组全部兼容为 boards 数组
export function normalizeBoardsField(value, legacyBoard) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeBoardItem(item, true))
  }
  if (value != null) {
    return [normalizeBoardItem(value, true)]
  }
  if (legacyBoard != null) {
    return [normalizeBoardItem(legacyBoard, true)]
  }
  return []
}

// 旧 API 兼容：normalizeBoard（checkAgentHandler 等历史调用方）→ 从 boards 数组派生单对象视图
export function normalizeBoard(board) {
  const boards = normalizeBoardsField(board)
  if (!boards.length) return { content: '', lines: [], startDelay: 0 }
  const cleaned = superCleanBoardField(boards.map((b) => b.content).filter(Boolean).join('\n'))
  const first = boards[0]
  return {
    content: cleaned.content,
    lines: cleaned.lines,
    ...(first.triggerKeyword
      ? { triggerKeyword: first.triggerKeyword }
      : { startDelay: first.startDelay ?? 0 }),
  }
}

function tryParseCandidate(str) {
  try {
    return JSON.parse(str)
  } catch {
    // 尝试修补常见的字符串内未转义换行与尾部残缺
    try {
      let patched = str.trim()
      if (patched.startsWith('{') && !patched.endsWith('}')) {
        if (patched.lastIndexOf(']') < patched.lastIndexOf('[')) {
          patched += ']}'
        } else {
          patched += '}'
        }
      }
      return JSON.parse(patched)
    } catch {
      return null
    }
  }
}

function parseJsonObject(text) {
  const source = String(text || '').trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || source

  let res = tryParseCandidate(candidate)
  if (res && isRecord(res)) return res

  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    res = tryParseCandidate(candidate.slice(start, end + 1))
    if (res && isRecord(res)) return res
  }

  // 尝试在最深层的 { "rows" 块处截取
  const rowsIdx = candidate.indexOf('"rows"')
  if (rowsIdx > 0) {
    const subStart = candidate.lastIndexOf('{', rowsIdx)
    if (subStart >= 0) {
      res = tryParseCandidate(candidate.slice(subStart))
      if (res && isRecord(res)) return res
    }
  }

  return null
}

export function normalizeAgentBV2ActionSpec(actionSpec) {
  return (Array.isArray(actionSpec) ? actionSpec : []).flatMap((entry) => {
    if (!isRecord(entry)) return []
    if (entry.capabilityGap) return [{ ...entry }]

    const action = validateBoardToolAction(entry.action)
    if (!action.ok) return []
    return [{ ...entry, action: action.value }]
  })
}

export function normalizeAgentBV2BoardCells(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap((row, index) => {
    if (!isRecord(row)) return []
    return [{
      stage: normalizeStage(row.stage, index),
      mp3: typeof row.mp3 === 'string' ? row.mp3 : '',
      speech: typeof row.speech === 'string' ? row.speech : '',
      boards: normalizeBoardsField(row.boards, row.board),
      // 模型偶尔漏写 actionSpec 或动作不合规，保留该行而不是卡死整表。
      actionSpec: normalizeAgentBV2ActionSpec(row.actionSpec),
      // 音频地址与实测时长由程序在 TTS 合成后回填，模型不产出；此处仅在已有值时透传，
      // 避免 Check Agent 应用路径把下游已绑定的音频信息整段丢掉。
      ...(typeof row.audioUrl === 'string' && row.audioUrl ? { audioUrl: row.audioUrl } : {}),
      ...(Number.isFinite(Number(row.audioDurationMs)) && Number(row.audioDurationMs) > 0
        ? { audioDurationMs: Math.round(Number(row.audioDurationMs)) }
        : {}),
    }]
  })
}

// 板书归一化内容与触发兜底；每行坐标由渲染层根据实际文本布局。
export function sanitizeRowLayout(rows) {
  if (!Array.isArray(rows)) return rows
  return rows.map((row) => {
    if (!isRecord(row)) return row
    return { ...row, boards: normalizeBoardsField(row.boards, row.board) }
  })
}

// 契约自检：speech 锚点数量与 boards 数量对齐（软校验，只打点不拦截，渲染端有 startDelay 兜底）
export function auditRowAnchorAlignment(rows) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const anchors = extractSpeechAnchors(row.speech)
    const boards = normalizeBoardsField(row.boards, row.board)
    const aligned = anchors.length === boards.length
    if (boards.length && !aligned) {
      console.warn(`[AgentB contract] 第${index + 1}行 speech 加粗锚点(${anchors.length}个)与 boards(${boards.length}个)数量不一致，渲染端将按 startDelay 兜底`)
    }
    if (boards.some((b) => /\*\*/.test(b.content))) {
      console.warn(`[AgentB contract] 第${index + 1}行 boards.content 出现 ** 符号，已由超级过滤器清洗`)
    }
    return { index, aligned, anchors: anchors.length, boards: boards.length }
  })
}

export function validateAgentBV2Rows(rows, _options = {}) {
  let normalizedRows = normalizeAgentBV2BoardCells(rows)
  if (!normalizedRows.length) {
    return { ok: false, error: 'Agent B 必须返回至少一行五字段数据' }
  }
  normalizedRows = sanitizeRowLayout(normalizedRows, _options)
  auditRowAnchorAlignment(normalizedRows)
  return { ok: true, value: normalizedRows }
}

export function parseAgentBV2Response(text, _options = {}) {
  const parsed = parseJsonObject(text)
  if (!isRecord(parsed)) return { ok: false, error: 'Agent B 返回内容不是 JSON 对象' }
  if (!Array.isArray(parsed.rows)) return { ok: false, error: 'Agent B 返回内容没有可用的 rows 数组' }

  // 归一化前先检查原始 stage：先清除首尾空格；在兜底模式（allowSynonyms）下允许温和吸附
  const allowSynonyms = Boolean(_options?.allowSynonyms)
  const invalidStageRows = parsed.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      const clean = String(row?.stage || '').trim()
      if (AGENT_B_V2_STAGES.includes(clean)) return false
      if (allowSynonyms && STAGE_SYNONYMS[clean]) return false
      return true
    })
  if (invalidStageRows.length > 0) {
    const details = invalidStageRows
      .map(({ row, index }) => `第${index + 1}行 stage=${JSON.stringify(row?.stage)}`)
      .join('；')
    return {
      ok: false,
      code: 'INVALID_STAGE',
      error: `非法 stage 值（${details}）。stage 仅限四种："题目""分析""解答""总结"。禁止使用"思路""讲解""过程""步骤""方法""计算""答案"等同义词，请重新输出完整五字段表。`,
    }
  }

  return validateAgentBV2Rows(parsed.rows, _options)
}
