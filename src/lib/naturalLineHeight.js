/* 字体宪法 v2.2（2026-10-16 夏夏拍板）：自然行高 + 2px 分数余量 —— DOM 端运行时度量工具。
 *
 * 为什么需要这个文件：CSS 的 line-height: normal 是字体度量值，calc() 不支持对 normal 做加法，
 * 「自然行高 + 2px」在 DOM 端无法用纯 CSS 表达。与画布（row-player naturalLhRatio：
 * fontBoundingBoxAscent+Descent 度量 + NATURAL_LH_EXTRA_PX）保持同源的唯一做法：
 * 用 canvas measureText 度量出字体栈的自然行高比数，再叠加分数余量折算成无单位 line-height。
 *
 * 为什么返回无单位比数（不是 px）：DOM 预览字号走 cqw 容器查询单位（BoardContentLayer 题目层）
 * 或固定 px + 整体缩放（RealBoardPreview 板书层），无单位 line-height 自动跟随字号缩放，两种体系都成立。
 *
 * 降级哲学：度量失败（无 document / 旧浏览器无 fontBoundingBox / 脏度量）返回 null，
 * 调用方回落 line-height: normal（组件基础样式）——与 row-player 桩环境退估算比数 1.2 同一哲学：
 * 宁可回落规范值，不硬造第二口径。 */
import { NATURAL_LINE_HEIGHT_EXTRA_PX, BOARD_LINE_HEIGHT_EXTRA_PX, BOARD_FONT_SIZE } from '../services/stepHandoff.js'

let mctx = null

function measureCtx() {
  if (typeof document === 'undefined') return null
  if (!mctx) mctx = document.createElement('canvas').getContext('2d')
  return mctx
}

/** 字体栈自然行高比数（= CSS line-height: normal 同源度量 fontBoundingBoxAscent+Descent / 字号）。
 *  与 row-player naturalLhRatio 同一算法与护栏区间（0.8~3 防脏度量）；不可用返回 null（回落 normal）。 */
export function naturalLhRatioFor(fontStack, sizePx = BOARD_FONT_SIZE) {
  const ctx = measureCtx()
  if (!ctx) return null
  try {
    ctx.font = `${sizePx}px ${fontStack}`
    const m = ctx.measureText('国')
    if (m && Number.isFinite(m.fontBoundingBoxAscent) && Number.isFinite(m.fontBoundingBoxDescent)) {
      const r = (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) / sizePx
      if (r > 0.8 && r < 3) return r
    }
  } catch (e) {
    /* 度量失败回落 normal */
  }
  return null
}

/** 自然行高 + 分数余量 → 无单位 line-height CSS 字符串；ratio 为 null（或字号非法）返回 null。
 *  extraPx 默认 = 题目层分数余量 2px；板书层（分析/解答/总结）传 BOARD_LINE_HEIGHT_EXTRA_PX=4px
 *  （v2.3 2026-10-22 夏夏拍板：2px 分数余量 + 2px 行距呼吸，自动换行的行高再加 2px，题目层不变）。 */
export function naturalLhWithFractionMargin(ratio, sizePx, extraPx = NATURAL_LINE_HEIGHT_EXTRA_PX) {
  if (ratio == null || !(sizePx > 0)) return null
  return String(ratio + extraPx / sizePx)
}
