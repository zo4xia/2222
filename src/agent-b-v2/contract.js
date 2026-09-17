/* @qh-core LANE=B-V2 POINT=CONTRACT_NORMALIZE model rows into board-readable fields */
import { validateBoardToolAction } from '../board-tools/boardToolCatalog.js'
// 车同轨、书同文：板书内容与错误转义统一过全局唯一超级过滤器
import { superCleanBoardField } from '../utils/superFilter.js'
// 画布参数唯一真源：src/services/stepHandoff.js
export const AGENT_B_V2_COLUMNS = Object.freeze([
  'stage',
  'speech',
  'board',
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

// board 双兼容：读取历史坐标，但新合同只输出内容和一种触发方式。
// startDelay 与 triggerKeyword 二选一；坐标、固定行高和行距不属于 Agent B 合同。
export function normalizeBoard(board) {
  const normalizeTriggerKeyword = (value) => {
    const keyword = typeof value === 'string' ? value.trim() : ''
    return keyword || ''
  }
  const normalizeDelay = (value) => {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Number(value.toFixed(2))
    if (typeof value === 'string') {
      const match = value.match(/[\d.]+/)
      const parsed = match ? parseFloat(match[0]) : NaN
      if (Number.isFinite(parsed) && parsed >= 0) return Number(parsed.toFixed(2))
    }
    return null
  }
  // 车同轨·书同文：board.content 允许字符串 / 一行一个的数组 / 对象，统一过超级过滤器
  if (isRecord(board)) {
    const cleaned = superCleanBoardField(board.content ?? board.text ?? '')
    const triggerKeyword = normalizeTriggerKeyword(board.triggerKeyword ?? board.keyword)
    const startDelay = triggerKeyword ? null : normalizeDelay(board.startDelay)
    return {
      content: cleaned.content,
      lines: cleaned.lines,
      ...(triggerKeyword ? { triggerKeyword } : { startDelay: startDelay ?? 0 }),
    }
  }
  if (Array.isArray(board)) {
    const cleaned = superCleanBoardField(board)
    return { content: cleaned.content, lines: cleaned.lines, startDelay: 0 }
  }
  if (typeof board === 'string') {
    const trimmed = board.trim()
    const legacyPrefix = trimmed.match(/^\s*[([]\s*[\d.]+(?:%|px)?\s*,\s*[\d.]+(?:%|px)?\s*[)\]]\s*(.*)$/s)
    const cleaned = superCleanBoardField(legacyPrefix ? legacyPrefix[1] || '' : board)
    return { content: cleaned.content, lines: cleaned.lines, startDelay: 0 }
  }
  return { content: '', lines: [], startDelay: 0 }
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
      speech: typeof row.speech === 'string' ? row.speech : '',
      board: normalizeBoard(row.board),
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

// 板书只归一化内容和兼容时间字段；每行坐标由渲染层根据实际文本布局。
export function sanitizeRowLayout(rows) {
  if (!Array.isArray(rows)) return rows
  return rows.map((row) => {
    if (!isRecord(row)) return row
    return { ...row, board: normalizeBoard(row.board) }
  })
}

export function validateAgentBV2Rows(rows, _options = {}) {
  let normalizedRows = normalizeAgentBV2BoardCells(rows)
  if (!normalizedRows.length) {
    return { ok: false, error: 'Agent B 必须返回至少一行五字段数据' }
  }
  normalizedRows = sanitizeRowLayout(normalizedRows, _options)
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
