import { normalizeAgentBV2ActionSpec } from '../agent-b-v2/contract.js'
// ponytail: JSON 解析唯一真源（替换本地 parseJsonObject）
import { parseLLMJson } from '../lib/parseLLMJson.js'

const ALLOWED_FIELDS = new Set(['speech', 'board', 'actionSpec'])

function formatChangeValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function parseCheckAgentResponse(text, originalRows) {
  const parsed = parseLLMJson(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Check Agent 返回内容不是 JSON 对象' }
  }
  if (!Array.isArray(parsed.rows) || parsed.rows.length !== originalRows.length) {
    return { ok: false, error: 'Check Agent 不得增加、删除或重排五字段步骤' }
  }
  const rows = parsed.rows.map((row, index) => ({
    ...originalRows[index],
    speech: typeof row?.speech === 'string' ? row.speech : originalRows[index].speech,
    board: typeof row?.board === 'string' ? row.board : originalRows[index].board,
    actionSpec: Array.isArray(row?.actionSpec)
      ? normalizeAgentBV2ActionSpec(row.actionSpec)
      : originalRows[index].actionSpec,
  }))

  const reportedChanges = (Array.isArray(parsed.changes) ? parsed.changes : []).map((change) => ({
    row: Number.isFinite(Number(change?.row)) ? Math.max(1, Math.round(Number(change.row))) : null,
    field: String(change?.field || '').trim(),
    reason: String(change?.reason || '').trim(),
  })).filter((change) => ALLOWED_FIELDS.has(change.field) && change.reason)

  const changes = []
  rows.forEach((row, index) => {
    for (const field of ALLOWED_FIELDS) {
      if (valuesMatch(row[field], originalRows[index][field])) continue
      const reported = reportedChanges.find((change) => change.row === index + 1 && change.field === field)
      changes.push({
        row: index + 1,
        field,
        before: formatChangeValue(originalRows[index][field]),
        after: formatChangeValue(row[field]),
        reason: reported?.reason || 'Check Agent 已修正',
      })
    }
  })

  return { ok: true, value: { rows, changes } }
}
