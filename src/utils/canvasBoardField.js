import { normalizeCanvasText } from './canvasText.js'
import { superCleanBoardField as cleanBoardField } from './superFilter.js'

/**
 * Single canvas-board entry point.
 *
 * The canvas transport/escape rules run before the existing mathematical board
 * normalizer. Speech, metadata, and ordinary page text never pass through this
 * module. Keep coordinate prefixes as layout metadata and clean only content.
 */
export function parseCanvasBoardField(board) {
  if (board == null) return { content: '', lines: [] }

  if (typeof board === 'string') {
    const coordinatePrefix = board.match(/^\[(\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%)\]\s*/)
    const source = coordinatePrefix ? board.slice(coordinatePrefix[0].length) : board
    return cleanCanvasBoardContent(source)
  }

  if (Array.isArray(board)) {
    return cleanCanvasBoardContent(board.map((item) => (
      item && typeof item === 'object' ? item.content ?? item.text ?? '' : item
    )))
  }

  if (typeof board === 'object') {
    return cleanCanvasBoardContent(board.content ?? board.text ?? '')
  }

  return cleanCanvasBoardContent(board)
}

function cleanCanvasBoardContent(value) {
  if (Array.isArray(value)) {
    const normalized = value.map((item) => normalizeCanvasText(item))
    return cleanBoardField(normalized)
  }
  return cleanBoardField(normalizeCanvasText(value))
}

// Naming aliases make this module a migration seam for existing board callers.
export const parseBoardField = parseCanvasBoardField
export const superCleanBoardField = cleanCanvasBoardContent
