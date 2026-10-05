/* @qh-core LANE=B-V2 POINT=BOARD_LECTURE 容量估算函数
 *
 * 入参: { content, regionWidth(px), fontSize(px), lineHeight }  (fontSize/lineHeight 缺省取 stepHandoff.js 真源)
 * 出参: { charCount, charsPerLine, lineCount, totalHeight(px) }
 *
 * 与 boardLayout.js#layoutBoardRows 的关系：
 *   layoutBoardRows 做落点排版（游标累加 + 出发坐标），内部已有换行估算。
 *   本函数做 **独立的容量预估** — 不算落点，只算"给定区域宽度/字号/行高下，内容占多少行多高"，
 *   供 decideLayout 做是否压缩/分栏/溢出的决策。
 *
 * 画布参数唯一真源：src/services/stepHandoff.js
 */
import { BOARD_FONT_SIZE, BOARD_LINE_HEIGHT_MEAN } from '../../../../services/stepHandoff.js'
import { CANVAS_W } from '../../../../utils/canvasCoords.js'

export function estimateCapacity({
  content,
  regionWidth,
  fontSize = BOARD_FONT_SIZE,
  lineHeight = BOARD_LINE_HEIGHT_MEAN,
}) {
  if (!content || typeof content !== 'string') {
    return { charCount: 0, charsPerLine: 0, lineCount: 0, totalHeight: 0 }
  }
  const lines = content.split('\n')
  let totalLineCount = 0
  for (const line of lines) {
    const charCount = line.replace(/\s/g, '').length
    if (charCount === 0) { totalLineCount += 1; continue }
    const charsPerLine = Math.max(1, Math.floor(regionWidth / fontSize))
    const lineCount = Math.ceil(charCount / charsPerLine)
    totalLineCount += lineCount
  }
  const charsPerLine = Math.max(1, Math.floor(regionWidth / fontSize))
  const totalCharCount = content.replace(/\s/g, '').length
  const actualLineHeight = fontSize * lineHeight
  const totalHeight = Math.round(totalLineCount * actualLineHeight)
  return { charCount: totalCharCount, charsPerLine, lineCount: totalLineCount, totalHeight }
}

/**
 * 从 boardLayout.js 的 BOARD_LAYOUT 百分比区域计算实际可写像素宽度。
 * 调用方传入 zone 的 w(百分比) 即可，函数用 CANVAS_W 换算。
 */
export function regionWidthFromPct(zoneWidthPct) {
  return Math.round((zoneWidthPct / 100) * CANVAS_W)
}
