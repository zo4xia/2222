/* @qh-core LANE=B-V2 POINT=BOARD_LECTURE 布局决策函数
 *
 * 入参: { capacity, regionHeight(px), hasMultipleSteps }
 * 出参: { action: 'normal'|'compact'|'twocolumn'|'overflow', fontSize, reason }
 *
 * 决策四级优先级（从宽到紧，不可跳级）：
 *   1. normal   — 默认字号放得下
 *   2. twocolumn— 多步算式，分两列放得下
 *   3. compact  — 36px 紧凑字号放得下
 *   4. overflow — 36px 还放不下，需精简内容（返回 overflow 让上游决定截断或缩放）
 *
 * 画布参数唯一真源：src/services/stepHandoff.js
 *   - 正常字号 = BOARD_FONT_SIZE (38px)
 *   - 最低字号 = 36px（低于此值手写体不可读）
 */
import { BOARD_FONT_SIZE } from '../../../../services/stepHandoff.js'

const MIN_FONT_SIZE = 36
const COMPACT_LINE_HEIGHT = 1.5

export function decideLayout({ capacity, regionHeight, hasMultipleSteps = false }) {
  if (!capacity || typeof capacity.totalHeight !== 'number') {
    return { action: 'normal', fontSize: BOARD_FONT_SIZE, reason: '容量数据缺失，用默认排版' }
  }
  // 1. normal: 默认字号放得下
  const fits = capacity.totalHeight <= regionHeight
  if (fits) {
    return { action: 'normal', fontSize: BOARD_FONT_SIZE, reason: `总高 ${capacity.totalHeight}px ≤ 区域高 ${regionHeight}px` }
  }
  // 2. twocolumn: 多步算式，分两列
  if (hasMultipleSteps) {
    const compactLineCount = Math.ceil(capacity.lineCount / 2)
    const compactHeight = Math.round(compactLineCount * MIN_FONT_SIZE * COMPACT_LINE_HEIGHT)
    if (compactHeight <= regionHeight) {
      return { action: 'twocolumn', fontSize: MIN_FONT_SIZE, reason: `两列+${MIN_FONT_SIZE}px 后高 ${compactHeight}px ≤ ${regionHeight}px` }
    }
  }
  // 3. compact: 36px 紧凑
  const compactHeight = Math.round(capacity.lineCount * MIN_FONT_SIZE * COMPACT_LINE_HEIGHT)
  if (compactHeight <= regionHeight) {
    return { action: 'compact', fontSize: MIN_FONT_SIZE, reason: `${MIN_FONT_SIZE}px 后高 ${compactHeight}px ≤ ${regionHeight}px` }
  }
  // 4. overflow: 最低字号仍放不下
  return { action: 'overflow', fontSize: MIN_FONT_SIZE, reason: `${MIN_FONT_SIZE}px 仍放不下(高 ${compactHeight}px > ${regionHeight}px)，需精简` }
}
