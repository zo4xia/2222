import { normalizeAgentBV2ActionSpec } from '../agent-b-v2/contract.js'

const ALLOWED_FIELDS = new Set(['speech', 'board', 'actionSpec'])

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
      const originalValue = originalRows[index][field]
      const nextValue = row[field]
      if (valuesMatch(nextValue, originalValue)) continue
      const reported = reportedChanges.find((change) => change.row === index + 1 && change.field === field)

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
