const FULL_KEYS = Object.freeze({
  i: '编号',
  g: '学段',
  s: '系列',
  t: '类型',
  k: '知识点',
  q: '经典样题',
  e: '考点',
  p: '策略方法',
  x: '讲解要点举例',
  n: '总结归纳',
  m: '易错点',
})

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/等于多少|是多少|怎么做|如何解|请问|计算|求出|求|讲解|一个/g, '')
    .replace(/[\s，。；：、（）()【】《》“”‘’·—_=+x×÷/\\]/g, '')
}

function ngrams(value, size) {
  const text = normalize(value)
  const result = new Set()
  for (let index = 0; index <= text.length - size; index += 1) {
    result.add(text.slice(index, index + size))
  }
  return result
}

function overlap(left, right) {
  let count = 0
  left.forEach((item) => { if (right.has(item)) count += 1 })
  return count
}

function score(row, query) {
  const query2 = ngrams(query, 2)
  const query3 = ngrams(query, 3)
  const primary = `${row.k} ${row.q} ${row.e}`
  const support = `${row.s} ${row.t} ${(row.p || []).join(' ')} ${(row.m || []).join(' ')}`
  const normalizedQuery = normalize(query)
  const normalizedPrimary = normalize(primary)
  const exactBoost = normalizedQuery.length >= 2 && normalizedPrimary.includes(normalizedQuery) ? 50 : 0
  return exactBoost
    + overlap(query3, ngrams(primary, 3)) * 5
    + overlap(query2, ngrams(primary, 2)) * 2
    + overlap(query3, ngrams(support, 3))
}

function expand(row) {
  return Object.fromEntries(Object.entries(FULL_KEYS).map(([key, name]) => [name, row[key] || '']))
}

export function selectAgentAKnowledge(knowledgeBase, problemText, limit = 8) {
  const rows = Array.isArray(knowledgeBase?.rows) ? knowledgeBase.rows : []
  const query = String(problemText || '').trim()
  if (!query) {
    return {
      mode: 'catalog',
      rows: rows.map(({ i, g, s, t, k }) => ({ i, g, s, t, k })),
    }
  }

  return {
    mode: 'top-k',
    rows: rows
      .map((row, index) => ({ row, index, score: score(row, query) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, limit)
      .map(({ row }) => row),
  }
}

export function formatAgentAKnowledge(selection) {
  const rows = Array.isArray(selection?.rows) ? selection.rows : []
  if (selection?.mode === 'catalog') {
    const catalog = rows.map((row) => [row.i, row.g, row.s, row.t, row.k].join('|')).join('\n')
    return `模式：图片题紧凑目录。列为 i|学段|系列|类型|知识点。先识别题目，再从目录选择 与解题相关会用到的知识点，每个知识点用其对应的 i 作为 knowledgeId。\n${catalog}`
  }
  if (!rows.length) return '模式：未命中。请基于题目本身判断知识点，不要编造 knowledgeId。'
  return `模式：服务端 Top-K 精确检索。尽可能把解题可能会用到的知识点选出来，没有公式的把公式补全，但不要瞎编。如果没有找到合适的知识点，就实话实说。\n${JSON.stringify(rows)}`
}

export function hydrateAgentAKnowledge(result, knowledgeBase) {
  const analysis = result?.knowledgeAnalysis
  if (!analysis || !Array.isArray(analysis.coreKnowledge)) return result
  const byId = new Map((knowledgeBase?.rows || []).map((row) => [row.i, row]))
  analysis.coreKnowledge = analysis.coreKnowledge.map((item) => {
    const row = byId.get(String(item?.knowledgeId || ''))
    if (!row) return { ...item, knowledgeId: '' }
    return {
      knowledgeId: row.i,
      knowledgePoint: row.k || item.knowledgePoint || '',
      formula: item.formula || '',
      examinationPoint: row.e || item.examinationPoint || '',
      strategy: (row.p || []).join('；') || item.strategy || '',
      commonMistakes: row.m || item.commonMistakes || [],
      summary: row.n || item.summary || '',
      rawKnowledgeRecord: expand(row),
    }
  })
  return result
}
