import { normalizeAgentBV2ActionSpec, normalizeBoardsField } from '../agent-b-v2/contract.js'

// 契约定案（2026-09-17）：row 五字段 {stage, mp3, speech, boards, actionSpec}
// changes.field 允许值；diff 只比较 speech / boards / actionSpec 三个可修字段
const ALLOWED_FIELDS = new Set(['speech', 'boards', 'board_timing', 'actionSpec', 'answer_error', 'common_mistake'])
const DIFF_FIELDS = ['speech', 'boards', 'actionSpec']

function parseJsonObject(text) {
  const source = String(text || '').trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || source
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
  }
}

function formatChangeValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

// row 级 boards 归一：新合同 boards 数组优先，旧 board 单对象兼容读取
function resolveBoards(row, fallbackRow) {
  if (row?.boards !== undefined || row?.board !== undefined) {
    return normalizeBoardsField(row.boards, row.board)
  }
  return normalizeBoardsField(fallbackRow?.boards, fallbackRow?.board)
}

export function parseCheckAgentResponse(text, originalRows) {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Check Agent 返回内容不是 JSON 对象' }
  }
  if (!Array.isArray(parsed.rows) || parsed.rows.length !== originalRows.length) {
    return { ok: false, error: 'Check Agent 不得增加、删除或重排五字段步骤' }
  }
  const rows = parsed.rows.map((row, index) => ({
    ...originalRows[index],
    speech: typeof row?.speech === 'string' ? row.speech : originalRows[index].speech,
    boards: resolveBoards(row, originalRows[index]),
    actionSpec: Array.isArray(row?.actionSpec)
      ? normalizeAgentBV2ActionSpec(row.actionSpec)
      : originalRows[index].actionSpec,
  }))
  // 旧 board 字段已被 boards 归一取代，避免同一行残留两份板书
  rows.forEach((row) => { delete row.board })

  const reportedChanges = (Array.isArray(parsed.changes) ? parsed.changes : []).map((change) => ({
    row: Number.isFinite(Number(change?.row)) ? Math.max(1, Math.round(Number(change.row))) : null,
    field: String(change?.field || '').trim(),
    reason: String(change?.reason || '').trim(),
  })).filter((change) => ALLOWED_FIELDS.has(change.field) && change.reason)

  const changes = []
  rows.forEach((row, index) => {
    for (const field of DIFF_FIELDS) {
      const originalValue = field === 'boards'
        ? normalizeBoardsField(originalRows[index].boards, originalRows[index].board)
        : originalRows[index][field]
      const nextValue = row[field]
      if (valuesMatch(nextValue, originalValue)) continue
      // board_timing 归并到 boards 维度做同 row 匹配
      const reported = reportedChanges.find((change) =>
        change.row === index + 1
        && (change.field === field || (field === 'boards' && change.field === 'board_timing')))

      // 防「静默删动作」：动作被改小或清空，Check Agent 必须给出校验失败原因，否则一律回滚原值。
      // 板书动作是画面表现力资产，宁可保留可疑动作让人复核，也不允许模型无理由清空。
      const isActionShrink = field === 'actionSpec'
        && Array.isArray(originalValue)
        && (!Array.isArray(nextValue) || nextValue.length < originalValue.length)
      if (isActionShrink && !reported) {
        rows[index] = { ...rows[index], actionSpec: originalValue }
        changes.push({
          row: index + 1,
          field,
          before: formatChangeValue(originalValue),
          after: formatChangeValue(originalValue),
          reason: '已回滚：Check Agent 删除/清空了板书动作却没有给出校验失败原因（属于无理由静默修改），系统保留原动作待人工复核。',
          unexplained: true,
          rolledBack: true,
        })
        continue
      }

      changes.push({
        row: index + 1,
        field,
        before: formatChangeValue(originalValue),
        after: formatChangeValue(nextValue),
        reason: reported?.reason || '⚠️ Check Agent 已修正但未标注原因（静默修改，请人工复核）',
        unexplained: !reported,
      })
    }
  })

  return { ok: true, value: { rows, changes } }
}
