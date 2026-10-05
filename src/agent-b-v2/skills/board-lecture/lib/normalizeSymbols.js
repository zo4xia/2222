/* @qh-core LANE=B-V2 POINT=BOARD_LECTURE 符号规范化策略函数
 *
 * 策略定位：
 *   - 本函数是 board-lecture skill 的 **策略规格**（spec）：定义 17 条符号替换规则，
 *     供 prompt rules.md 引用，供 Check Agent 预审板书内容。
 *   - 运行时实际清洗由 src/utils/superFilter.js#normalizeBoardLine 执行（10 步流水线，
 *     覆盖 HTML 实体解码、LaTeX 损伤修复、aligned 剥壳等），比本函数更完整。
 *   - 二者行为保持一致（同一条 LaTeX 命令在同一侧替换为同一结果），有冲突时以
 *     superFilter.js 为准（它是渲染层唯一真源）。
 *
 * 入参: content: string
 * 出参: { result: string, changes: Array<{from, to, count}> }
 */
export function normalizeBoardSymbols(content) {
  if (!content || typeof content !== 'string') return { result: '', changes: [] }
  let s = content
  const changes = []
  function apply(pattern, replacement, label) {
    const before = s
    s = s.replace(pattern, replacement)
    const count = (before.match(pattern) || []).length
    if (count > 0) changes.push({ from: label, to: replacement, count })
  }
  // 长匹配优先，顺序不可调换
  apply(/\\rightarrow\b|→/g, '->', '\\rightarrow|→')          // 1
  apply(/\\Rightarrow\b|⇒/g, '=>', '\\Rightarrow|⇒')          // 2
  apply(/\\to\b/g, '->', '\\to')                               // 3 (必须在 1 之后)
  apply(/−/g, '-', 'U+2212')                                   // 4
  apply(/\\times\b|×|✕/g, 'x', '\\times|×')                    // 5
  apply(/\\div\b/g, '/', '\\div')                              // 6 (与 superFilter 一致: → /)
  apply(/\\cdot\b|·/g, '·', '\\cdot|·')                        // 7
  apply(/\\approx\b|≈/g, '≈', '\\approx|≈')                    // 8
  apply(/\\ne(?:q)?\b|≠/g, '≠', '\\neq|≠')                     // 9
  apply(/\\le(?:q)?\b|≤/g, '≤', '\\leq|≤')                     // 10
  apply(/\\ge(?:q)?\b|≥/g, '≥', '\\geq|≥')                     // 11
  apply(/\\circ\b/g, '°', '\\circ')                            // 12
  apply(/\^\s*°|\^\s*\{\s*°\s*\}/g, '°', '^°')                 // 12b
  apply(/\\pi\b/g, 'π', '\\pi')                                // 13
  apply(/\\infty\b/g, '∞', '\\infty')                          // 14
  apply(/\\angle\b/g, '∠', '\\angle')                          // 15
  apply(/\\perp\b/g, '⊥', '\\perp')                            // 16
  apply(/\\parallel\b/g, '∥', '\\parallel')                    // 17
  // 以下与 superFilter.js 对齐（prompt 要求中文几何词）
  apply(/\\triangle\b|△/g, '三角形', '\\triangle|△')            // 18
  apply(/\\therefore\b|∴/g, '因此', '\\therefore|∴')            // 19
  apply(/\\because\b|∵/g, '因为', '\\because|∵')               // 20
  return { result: s, changes }
}
