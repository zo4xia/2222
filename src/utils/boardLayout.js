/** 甲方画布 1726×980 · demo 已验证标签/区域落点（百分比） */
import { CANVAS_W as DESIGN_W, CANVAS_H as DESIGN_H } from './canvasCoords.js'
// 题目字号唯一真源：src/services/stepHandoff.js
import { QUESTION_FONT_SIZE, BOARD_FONT_SIZE } from '../services/stepHandoff.js'
// 车同轨、书同文：画布板书行排版前统一过全局唯一超级过滤器（一行一个 + 错误转义清洗）
import { superCleanBoardField } from './superFilter.js'
export { DESIGN_W, DESIGN_H }

export const BOARD_SAFE_X_PCT = 6
export const BOARD_RIGHT_LIMIT_PCT = 94
export const BOARD_BOTTOM_LIMIT_PCT = 95
export const BOARD_HORIZONTAL_GAP_PCT = 4

const SECTION_GAP_PCT = 2
const LABEL_HEIGHT_PCT = (44 / DESIGN_H) * 100
const LABEL_CONTENT_GAP_PCT = (16 / DESIGN_H) * 100
const LABEL_TO_REGION_PCT = LABEL_HEIGHT_PCT + LABEL_CONTENT_GAP_PCT
const PORTRAIT_LEFT_W_PCT = 44
const PORTRAIT_RIGHT_X_PCT = BOARD_SAFE_X_PCT + PORTRAIT_LEFT_W_PCT + BOARD_HORIZONTAL_GAP_PCT
const PORTRAIT_RIGHT_W_PCT = BOARD_RIGHT_LIMIT_PCT - PORTRAIT_RIGHT_X_PCT
const STRIP_COLUMN_W_PCT = (
  BOARD_RIGHT_LIMIT_PCT
  - BOARD_SAFE_X_PCT
  - BOARD_HORIZONTAL_GAP_PCT * 2
) / 3

export const BOARD_LAYOUT = {
  topicLabel: { x: 5.7, y: 6.6, w: 7.1 },
  question: { x: 6.0, y: 13.2, w: PORTRAIT_LEFT_W_PCT, fontSize: QUESTION_FONT_SIZE },
  analysisLabel: { x: 5.7, y: 34.5, w: 7.2 },
  analysis: { x: BOARD_SAFE_X_PCT, y: 41.0, w: PORTRAIT_LEFT_W_PCT, h: 48 },
  solutionLabel: { x: PORTRAIT_RIGHT_X_PCT - 0.3, y: 6.6, w: 7.4 },
  solution: { x: PORTRAIT_RIGHT_X_PCT, y: 14.0, w: PORTRAIT_RIGHT_W_PCT, h: 44 },
  summaryLabel: { x: PORTRAIT_RIGHT_X_PCT - 0.3, y: 62.0, w: 7.2 },
  summary: { x: PORTRAIT_RIGHT_X_PCT, y: 69.5, w: PORTRAIT_RIGHT_W_PCT, h: 22 },
}

export function pctBox(style = {}) {
  const out = {
    left: `${style.x}%`,
    top: `${style.y}%`,
    width: `${style.w}%`,
  }
  if (style.h != null) out.height = `${style.h}%`
  return out
}

/**
 * 板书行落点排版：区域即起点，纵向按自然行高累加（夏夏 2026-09-15 拍板：取消人为行间距）。
 * 业务规则：
 *   - 起点 = 区域左上角，不额外指定"起手坐标"；
 *   - 允许超出本区（内容多时向下延展），但禁止超出画布底边 BOARD_BOTTOM_LIMIT_PCT；
 *   - 游标单调递增 → 天然不重叠，不需要额外避让算法。
 * @params {Array<{stage: string, board?: {content?: string}}>} rows
 * @params {{fontSizePx?: number}} [options]
 * @returns {Array<{startCoord: string, x: number, y: number, lineCount: number}>} 与 rows 一一对应
 */
export function layoutBoardRows(rows, { fontSizePx = BOARD_FONT_SIZE } = {}) {
  // 中文全角按 1 字宽、ASCII 按 0.55 字宽估算，够用于换行计数（误差 <5%，无需 canvas 度量）
  const charWidthPx = (ch) => (/[\x00-\xff]/.test(ch) ? fontSizePx * 0.55 : fontSizePx)
  const lineHeightPct = ((fontSizePx * 1.2) / DESIGN_H) * 100
  const stageToZone = {
    题目: 'question',
    分析: 'analysis',
    解答: 'solution',
    总结: 'summary',
  }

  const cursor = {}
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const zone = stageToZone[row?.stage] || 'solution'
    const box = BOARD_LAYOUT[zone] || BOARD_LAYOUT.solution
    if (cursor[zone] == null) cursor[zone] = box.y

    // 车同轨·书同文：一行一个（数组 / 换行序列统一），并清掉错误转义与多余换行
    const boardLines = superCleanBoardField(
      row?.board?.content ?? (Array.isArray(row?.board) ? row.board : (typeof row?.board === 'string' ? row.board : '')),
    ).lines
    const zoneWidthPx = (box.w / 100) * DESIGN_W
    // 显式 \n 与超宽自动换行都要占位，否则多行内容会被压成一行
    let lineCount = 0
    for (const rawLine of boardLines) {
      if (!rawLine.trim()) {
        lineCount += 1
        continue
      }
      let used = 0
      let wrapped = 1
      for (const ch of rawLine) {
        used += charWidthPx(ch)
        if (used > zoneWidthPx) {
          wrapped += 1
          used = charWidthPx(ch)
        }
      }
      lineCount += wrapped
    }
    if (lineCount === 0) lineCount = 1

    const heightPct = lineCount * lineHeightPct
    let y = cursor[zone]
    // 触底即停：宁可让渲染层缩放，也不把字写到画布外
    if (y + heightPct > BOARD_BOTTOM_LIMIT_PCT) y = Math.max(box.y, BOARD_BOTTOM_LIMIT_PCT - heightPct)

    cursor[zone] = y + heightPct
    return {
      startCoord: `[${roundPct(box.x)}%, ${roundPct(y)}%]`,
      x: roundPct(box.x),
      y: roundPct(y),
      lineCount,
    }
  })
}

/**
 * 题目图片容器最大高度（%）。
 * 不管 image.maxH 是多少，上限只由画布底边决定：
 *   max-height = BOARD_BOTTOM_LIMIT_PCT - image.y
 * 这样在左右布局里图片高度可以自适应内容，同时不溢出画布。
 */
export function limitTopicImageHeightPct(image = {}) {
  const startY = Number(image.y || 0)
  return roundPct(Math.max(0, BOARD_BOTTOM_LIMIT_PCT - startY))
}

/**
 * 题目锚已定后，规划其余标签/区。
 * isLandscape=true  → 横图上下布局：原题图贴顶（x:6 w:88），高度自适应，三区横排在图片底部以下
 * isLandscape=false → 竖版布局；有图则左图右三区纵排，无图则左列题目+分析、右列解答+总结
 */
export function planLabelsFromTopic(
  topicLayout = {},
  { isLandscape = false, topicBottomPct = null } = {},
) {
  const measuredTopicBottom = resolveTopicBottom(topicLayout, topicBottomPct)
  if (isLandscape) return planLandscapeLayout(topicLayout, measuredTopicBottom)
  return planPortraitLayout(topicLayout, measuredTopicBottom)
}

function planPortraitLayout(topicLayout = {}, topicBottomPct) {
  // 有原题图（w>0）：左半放图，右半三区纵排（图高>宽 左右布局规则）
  if (topicLayout.image?.w > 0) {
    return planPortraitWithImageLayout(topicLayout, topicBottomPct)
  }
  // 纯文字：左列题目+分析，右列解答+总结
  const q = topicLayout.question || BOARD_LAYOUT.question
  const desiredLabelY = Math.max(BOARD_LAYOUT.analysisLabel.y, topicBottomPct + SECTION_GAP_PCT)
  const analysisLabelY = fitLabelY(desiredLabelY)
  const analysisY = roundPct(Math.min(BOARD_BOTTOM_LIMIT_PCT, analysisLabelY + LABEL_TO_REGION_PCT))
  const analysisH = remainingHeight(analysisY)

  return {
    canvas: { w: DESIGN_W, h: DESIGN_H },
    layoutMode: 'portrait',
    topicBottomPct,
    topicLabel: topicLayout.topicLabel || BOARD_LAYOUT.topicLabel,
    question: { x: q.x, y: q.y, w: q.w, fontSize: q.fontSize || QUESTION_FONT_SIZE },
    image: null,
    analysisLabel: { ...BOARD_LAYOUT.analysisLabel, y: analysisLabelY },
    analysis: { ...BOARD_LAYOUT.analysis, y: analysisY, h: analysisH },
    solutionLabel: { ...BOARD_LAYOUT.solutionLabel },
    solution: clampBoxBottom({ ...BOARD_LAYOUT.solution }),
    summaryLabel: { ...BOARD_LAYOUT.summaryLabel },
    summary: clampBoxBottom({ ...BOARD_LAYOUT.summary }),
    plannedAt: new Date().toISOString(),
    method: analysisLabelY > BOARD_LAYOUT.analysisLabel.y ? 'topic-aware-layout-rule' : 'verified-layout-rule',
    overflow: desiredLabelY !== analysisLabelY,
  }
}

function planPortraitWithImageLayout(topicLayout = {}, topicBottomPct) {
  // 竖图（高>宽）有图：左半原题图，右半三区纵排
  const RIGHT_X = PORTRAIT_RIGHT_X_PCT          // 54%
  const RIGHT_W = PORTRAIT_RIGHT_W_PCT          // 40%
  const TOP_Y   = BOARD_LAYOUT.topicLabel.y     // 6.6%
  const TOTAL_H = BOARD_BOTTOM_LIMIT_PCT - TOP_Y // 88.4%
  const sectionH = roundPct(TOTAL_H / 3)        // ~29.47%

  const aLabelY = TOP_Y
  const aY      = roundPct(aLabelY + LABEL_TO_REGION_PCT)
  const sLabelY = roundPct(TOP_Y + sectionH)
  const sY      = roundPct(sLabelY + LABEL_TO_REGION_PCT)
  const uLabelY = roundPct(TOP_Y + sectionH * 2)
  const uY      = roundPct(uLabelY + LABEL_TO_REGION_PCT)
  const zoneH   = roundPct(sectionH - LABEL_TO_REGION_PCT)

  return {
    canvas: { w: DESIGN_W, h: DESIGN_H },
    layoutMode: 'portrait-left-image',
    topicBottomPct: topicBottomPct ?? BOARD_BOTTOM_LIMIT_PCT,
    topicLabel: topicLayout.topicLabel || BOARD_LAYOUT.topicLabel,
    question: {
      x: topicLayout.question?.x ?? BOARD_LAYOUT.question.x,
      y: topicLayout.question?.y ?? BOARD_LAYOUT.question.y,
      w: topicLayout.question?.w ?? BOARD_LAYOUT.question.w,
      fontSize: topicLayout.question?.fontSize ?? QUESTION_FONT_SIZE,
    },
    image: topicLayout.image,
    analysisLabel: { x: RIGHT_X - 0.3, y: aLabelY, w: 7.2 },
    analysis:      { x: RIGHT_X, y: aY, w: RIGHT_W, h: zoneH },
    solutionLabel: { x: RIGHT_X - 0.3, y: sLabelY, w: 7.4 },
    solution:      { x: RIGHT_X, y: sY, w: RIGHT_W, h: zoneH },
    summaryLabel:  { x: RIGHT_X - 0.3, y: uLabelY, w: 7.2 },
    summary:       { x: RIGHT_X, y: uY, w: RIGHT_W, h: zoneH },
    plannedAt: new Date().toISOString(),
    method: 'portrait-left-image-right-3zones',
    overflow: false,
  }
}

function planLandscapeLayout(topicLayout = {}, topicBottomPct) {
  // 横图规则：图片宽>高 → 上下布局。图片贴左上，三区并排在下方
  const labelY    = fitLabelY(roundPct(topicBottomPct + SECTION_GAP_PCT))
  const zoneY     = roundPct(labelY + LABEL_TO_REGION_PCT)
  const zoneH     = remainingHeight(zoneY)
  const solutionX = BOARD_SAFE_X_PCT + STRIP_COLUMN_W_PCT + BOARD_HORIZONTAL_GAP_PCT
  const summaryX  = solutionX + STRIP_COLUMN_W_PCT + BOARD_HORIZONTAL_GAP_PCT

  return {
    canvas: { w: DESIGN_W, h: DESIGN_H },
    layoutMode: 'landscape-top-image',
    topicBottomPct,
    topicLabel: topicLayout.topicLabel || BOARD_LAYOUT.topicLabel,
    question: {
      x: topicLayout.question?.x ?? BOARD_LAYOUT.question.x,
      y: topicLayout.question?.y ?? BOARD_LAYOUT.question.y,
      w: topicLayout.question?.w ?? BOARD_LAYOUT.question.w,
      fontSize: topicLayout.question?.fontSize ?? QUESTION_FONT_SIZE,
    },
    image: topicLayout.image || null,
    analysisLabel: { x: BOARD_SAFE_X_PCT - 0.3,   y: labelY, w: 7.2 },
    analysis:      { x: BOARD_SAFE_X_PCT,          y: zoneY,  w: STRIP_COLUMN_W_PCT, h: zoneH },
    solutionLabel: { x: solutionX - 0.3,           y: labelY, w: 7.4 },
    solution:      { x: solutionX,                 y: zoneY,  w: STRIP_COLUMN_W_PCT, h: zoneH },
    summaryLabel:  { x: summaryX - 0.3,            y: labelY, w: 7.2 },
    summary:       { x: summaryX,                  y: zoneY,  w: STRIP_COLUMN_W_PCT, h: zoneH },
    plannedAt: new Date().toISOString(),
    method: 'landscape-top-image-bottom-3col',
    overflow: false,
  }
}

function resolveTopicBottom(topicLayout, measuredBottomPct) {
  const measured = Number(measuredBottomPct)
  if (Number.isFinite(measured)) return roundPct(clamp(measured, 0, BOARD_BOTTOM_LIMIT_PCT))

  if (topicLayout.image) {
    return roundPct(clamp(
      Number(topicLayout.image.y || BOARD_LAYOUT.question.y) + Number(topicLayout.image.maxH || 0),
      0,
      BOARD_BOTTOM_LIMIT_PCT,
    ))
  }

  const q = topicLayout.question || BOARD_LAYOUT.question
  return roundPct(clamp(
    Number(q.y || BOARD_LAYOUT.question.y) + estimateQuestionBlockHeight(topicLayout),
    0,
    BOARD_BOTTOM_LIMIT_PCT,
  ))
}

function fitLabelY(desiredY) {
  return roundPct(Math.min(desiredY, BOARD_BOTTOM_LIMIT_PCT - LABEL_TO_REGION_PCT))
}

function remainingHeight(y) {
  return roundPct(Math.max(0, BOARD_BOTTOM_LIMIT_PCT - y))
}

function clampBoxBottom(box) {
  return { ...box, h: remainingHeight(box.y) < box.h ? remainingHeight(box.y) : box.h }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function roundPct(value) {
  return Number(value.toFixed(2))
}

function estimateQuestionBlockHeight(topicLayout = {}) {
  if (topicLayout.image?.maxH) return Number(topicLayout.image.maxH) + 8
  const fs = Number(topicLayout.question?.fontSize || QUESTION_FONT_SIZE)
  return fs >= QUESTION_FONT_SIZE ? 16 : 14
}
