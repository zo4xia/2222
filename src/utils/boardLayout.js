/** 甲方画布 1726×980 · demo 已验证标签/区域落点（百分比） */
import { CANVAS_W as DESIGN_W, CANVAS_H as DESIGN_H } from './canvasCoords.js'
// 题目字号唯一真源：src/services/stepHandoff.js
import { QUESTION_FONT_SIZE } from '../services/stepHandoff.js'
export { DESIGN_W, DESIGN_H }

const BOARD_SAFE_X_PCT = 6
const BOARD_RIGHT_LIMIT_PCT = 94
const BOARD_BOTTOM_LIMIT_PCT = 95
const BOARD_HORIZONTAL_GAP_PCT = 4

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

/* 【已拔除 2026-10-15】layoutBoardRows 服务端行落点估算器（1.2 比数纵向累加 + startCoord 注入）。
 * 字体宪法 v2（夏夏拍板）：布局唯一权威 = 播放器渲染层编译期度量排版（row-player layoutBoardLines，
 * 自然行高 + 度量换列 + stageFlow 顺序续排），与 B 契约「板书不输出起手坐标，由渲染层按区域自然排版」对齐；
 * 服务端预判坐标与渲染层度量排版双权威互相打架（估算 1.2 比数 vs 实际字体度量）是旧暗病，本层不再注入 startCoord。
 * 若将来需要服务端预览估算，用 stepHandoff.LINE_HEIGHT_ESTIMATE_RATIO + NATURAL_LINE_HEIGHT_EXTRA_PX
 * 重建（v2.2：自然行高估算 = 比数 1.2 + 2px 分数余量），不要手写比数。 */

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
  const measured = (measuredBottomPct != null && measuredBottomPct !== '') ? Number(measuredBottomPct) : NaN
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
