/* @qh-core LANE=B-V2 POINT=CONTRACT_NORMALIZE model rows into board-readable fields */
import { validateBoardToolAction } from '../board-tools/boardToolCatalog.js'
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

// board 双兼容：读取历史 v1/v2 坐标，但新合同不再输出板书起手坐标。
// startDelay 暂保留为兼容的时间字段；具体排版由渲染层负责。
// 弃用字段检测：board.startCoord / board.coord / board.x / board.y → 推断 region + 弹窗
export function normalizeBoard(board) {
  if (isRecord(board)) {
    let startDelay = 0
    if (typeof board.startDelay === 'number' && Number.isFinite(board.startDelay) && board.startDelay >= 0) {
      startDelay = Number(board.startDelay.toFixed(2))
    } else if (typeof board.startDelay === 'string') {
      const match = board.startDelay.match(/[\d.]+/)
      if (match) {
        const val = parseFloat(match[0])
        if (Number.isFinite(val) && val >= 0) startDelay = Number(val.toFixed(2))
      }
    }
    const result = {
      content: typeof board.content === 'string' ? board.content : '',
      startDelay,
    }
    // 弃用字段检测：v2.0 旧坐标字段 → 弹窗提示用户
    const deprecatedCoord = board.startCoord ?? board.coord ?? board.x ?? board.y ?? board.left ?? board.top
    if (deprecatedCoord !== undefined) {
      result._deprecationWarning = `检测到 v2.0 旧字段 board.${board.startCoord ? 'startCoord' : board.coord ? 'coord' : board.x ? 'x' : board.y ? 'y' : board.left ? 'left' : 'top'}，已自动剥离（板书坐标退场 v3.0，由渲染层 occupancy map 自动排版）`
    }
    return result
  }
  if (typeof board === 'string') {
    const trimmed = board.trim()
    const legacyPrefix = trimmed.match(/^\s*[([]\s*[\d.]+(?:%|px)?\s*,\s*[\d.]+(?:%|px)?\s*[)\]]\s*(.*)$/s)
    return { content: legacyPrefix ? legacyPrefix[1] || '' : board, startDelay: 0 }
  }
  return { content: '', startDelay: 0 }
}

// ponytail: JSON 解析唯一真源已抽到 src/lib/parseLLMJson.js，本地实现全部删除
// 6 处手搓 parser (contract / check-agent / 4 个 server handler) 统一 import parseLLMJson
import { parseLLMJson } from '../lib/parseLLMJson.js'

export function normalizeAgentBV2ActionSpec(actionSpec) {
  return (Array.isArray(actionSpec) ? actionSpec : []).flatMap((entry) => {
    if (!isRecord(entry)) return []
    if (entry.capabilityGap) return [{ ...entry }]

    const action = validateBoardToolAction(entry.action)
    if (!action.ok) return []
    // 弃用字段检测：triggerAt / durationMs / startMs / seed
    const warns = []
    const a = entry.action || {}
    if (a.triggerAt !== undefined) warns.push('检测到旧版 actionSpec.triggerAt，已迁移到 startDelay（秒级偏移）')
    if (a.durationMs !== undefined) warns.push('检测到 Agent 填写的 actionSpec.durationMs，已忽略（时长由程序按汉字宽度/几何长度自动计算）')
    if (a.startMs !== undefined) warns.push('检测到 Agent 填写的 actionSpec.startMs，已忽略')
    if (a.seed !== undefined) warns.push('检测到 Agent 填写的 actionSpec.seed，已忽略（roughjs 随机种子由程序生成）')
    const out = { ...entry, action: action.value }
    if (warns.length) out._deprecationWarnings = warns
    return [out]
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
  const parsed = parseLLMJson(text)
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

// 收集 rows 里的所有弃用警告（供 UI 弹窗提示用户）
export function collectDeprecationWarnings(rows) {
  const warns = []
  if (!Array.isArray(rows)) return warns
  rows.forEach((row, i) => {
    if (row?.board?._deprecationWarning) warns.push(`第${i + 1}行: ${row.board._deprecationWarning}`)
    if (Array.isArray(row?.actionSpec)) {
      row.actionSpec.forEach((spec, j) => {
        if (Array.isArray(spec?._deprecationWarnings)) {
          spec._deprecationWarnings.forEach(w => warns.push(`第${i + 1}行动作${j + 1}: ${w}`))
        }
      })
    }
  })
  return warns
}
