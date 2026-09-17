import KNOWLEDGE_BASE from '../../doc/knowledge-a.compact.json'

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s，。；：、（）()【】《》“”‘’·—_=+x×÷/\\]/g, '')
}

function ngrams(value, size) {
  const text = normalizeText(value)
  const result = new Set()
  for (let index = 0; index <= text.length - size; index += 1) result.add(text.slice(index, index + size))
  return result
}

function overlapCount(left, right) {
  let count = 0
  left.forEach((item) => { if (right.has(item)) count += 1 })
  return count
}

const KNOWLEDGE_ROWS = Array.isArray(KNOWLEDGE_BASE.rows) ? KNOWLEDGE_BASE.rows : []

function scoreKnowledge(row, problemText, problemType) {
  const problemBigrams = ngrams(problemText, 2)
  const problemTrigrams = ngrams(problemText, 3)
  const primary = `${row.k} ${row.q} ${row.e}`
  const supporting = `${(row.p || []).join(' ')} ${row.x} ${(row.m || []).join(' ')}`
  let score = overlapCount(problemTrigrams, ngrams(primary, 3)) * 5
  score += overlapCount(problemBigrams, ngrams(primary, 2)) * 2
  score += overlapCount(problemTrigrams, ngrams(supporting, 3))

  const category = `${row.s} ${row.t}`
  if (problemType === 'geometry' && /图形|面积|周长|体积|角|线/.test(category)) score += 4
  if (problemType === 'calculation' && /计算|口算|竖式|分数|小数|运算/.test(category)) score += 4
  if (problemType === 'word' && /应用|数量关系|解决问题/.test(category)) score += 4
  return score
}

function toAgentKnowledge(row) {
  return {
    编号: row.i || '',
    学段: row.g || '',
    系列: row.s || '',
    类型: row.t || '',
    知识点: row.k || '',
    经典样题: row.q || '',
    考点: row.e || '',
    策略方法: (row.p || []).join('；'),
    讲解要点举例: row.x || '',
    易错点: (row.m || []).join('；'),
    总结归纳: row.n || '',
  }
}

export function selectAgentARelatedKnowledge({ problemText, problemType, limit = 6 } = {}) {
  if (!String(problemText || '').trim()) return []

  const scored = KNOWLEDGE_ROWS
    .map((row, index) => ({ row, index, score: scoreKnowledge(row, problemText, problemType) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)

  const selected = []
  const used = new Set()
  const add = (item) => {
    const id = item?.row?.i
    if (!id || used.has(id) || selected.length >= limit) return
    used.add(id)
    selected.push(item.row)
  }

  scored.slice(0, 4).forEach(add)
  for (const item of scored.slice(0, 3)) {
    for (const offset of [-1, 1]) {
      const neighbor = KNOWLEDGE_ROWS[item.index + offset]
      if (neighbor?.s === item.row.s && neighbor?.t === item.row.t) add({ row: neighbor })
    }
  }
  scored.forEach(add)
  return selected.map(toAgentKnowledge)
}
