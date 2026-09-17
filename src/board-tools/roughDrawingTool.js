import rough from 'roughjs/bundled/rough.esm.js'
import { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'
import { BOARD_DESIGN_SIZE } from '../utils/canvasCoords.js'

export const ROUGH_DRAWING_TOOL_IDS = Object.freeze([
  'rough-line',
  'rough-arrow',
])

export const ROUGH_DRAWING_REGIONS = Object.freeze(['question', 'analysis', 'solution', 'summary'])
export const DRAWING_SPEED_DESIGN_PX_PER_SECOND = 180
export const MIN_DRAWING_DURATION_MS = 600

export const ROUGH_DRAWING_COLORS = Object.freeze({
  ink: '#263238',
  red: '#d64545',
})

export const ROUGH_DRAWING_STROKE_WIDTHS = Object.freeze({
  normal: 2,
  emphasis: 3,
})

const TOOL_DESCRIPTIONS = Object.freeze({
  'rough-line': '画一条辅助线、边线或高线',
  'rough-arrow': '画一条带箭头的关系连线',
})

function requireFiniteNumber(value, name) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`${name} 必须是有限数字`)
  return number
}

function normalizePercentPoint(point, name) {
  if (!Array.isArray(point) || point.length !== 2) throw new Error(`${name} 必须是 [x,y]`)
  const normalized = [
    requireFiniteNumber(point[0], `${name}.x`),
    requireFiniteNumber(point[1], `${name}.y`),
  ]
  if (
    normalized[0] < 0 || normalized[0] > 100
    || normalized[1] < 0 || normalized[1] > 100
  ) {
    throw new Error(`${name} 必须是 0—100 的百分比坐标`)
  }
  return normalized
}

function normalizeStyle(style = {}) {
  const colorId = style.colorId || 'ink'
  const strokeWidthId = style.strokeWidthId || 'normal'
  if (!ROUGH_DRAWING_COLORS[colorId]) throw new Error(`未知画笔颜色 ID: ${colorId}`)
  if (!ROUGH_DRAWING_STROKE_WIDTHS[strokeWidthId]) throw new Error(`未知笔画宽度 ID: ${strokeWidthId}`)
  return { colorId, strokeWidthId }
}

function normalizeCommonAction(action) {
  if (!action || !ROUGH_DRAWING_TOOL_IDS.includes(action.tool)) {
    throw new Error(`tool 必须是 ${ROUGH_DRAWING_TOOL_IDS.join('|')}`)
  }
  if (!ROUGH_DRAWING_REGIONS.includes(action.region)) {
    throw new Error(`rough 图形只能画在 ${ROUGH_DRAWING_REGIONS.join('|')} 区域`)
  }
  const order = Math.round(action.order ?? 1)
  if (!Number.isFinite(order) || order < 1) throw new Error('order 必须是正整数')
  if (
    action.durationMs != null || action.estimatedDurationMs != null
    || action.gapAfterMs != null || action.seed != null
  ) {
    throw new Error('绘制时长、抬笔间隔与随机种子由程序计算，Agent 不得覆盖')
  }
  return {
    tool: action.tool,
    region: action.region,
    order,
    style: normalizeStyle(action.style),
  }
}

function distance(left, right) {
  return Math.hypot(right[0] - left[0], right[1] - left[1])
}

function arrowHeadPoints(start, end) {
  const shaftLength = distance(start, end)
  const headLength = Math.min(42, Math.max(18, shaftLength * 0.12))
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0])
  const spread = Math.PI / 7
  return [
    [end[0] - headLength * Math.cos(angle - spread), end[1] - headLength * Math.sin(angle - spread)],
    [end[0] - headLength * Math.cos(angle + spread), end[1] - headLength * Math.sin(angle + spread)],
  ]
}

function geometryLength(action) {
  if (action.tool === 'rough-line') return distance(action.start, action.end)
  const heads = arrowHeadPoints(action.start, action.end)
  return distance(action.start, action.end) + distance(action.end, heads[0]) + distance(action.end, heads[1])
}

function actionPoints(action) {
  return [action.start, action.end]
}

function normalizeRegionBounds(bounds) {
  if (!bounds) throw new Error('缺少当前用户确认的区域边界')
  const x = requireFiniteNumber(bounds.x, 'region.x')
  const y = requireFiniteNumber(bounds.y, 'region.y')
  const width = requireFiniteNumber(bounds.w ?? bounds.width, 'region.w')
  const height = requireFiniteNumber(bounds.h ?? bounds.height, 'region.h')
  if (width <= 0 || height <= 0) throw new Error('区域宽高必须大于 0')
  if (x < 0 || y < 0 || x + width > 100 || y + height > 100) {
    throw new Error('区域必须使用 0—100 的百分比坐标')
  }
  return { x, y, width, height }
}

function toDesignPixels(action) {
  const toPoint = ([x, y]) => [
    (x / 100) * BOARD_DESIGN_SIZE.width,
    (y / 100) * BOARD_DESIGN_SIZE.height,
  ]
  return { ...action, start: toPoint(action.start), end: toPoint(action.end) }
}

function stableSeed(action) {
  const source = JSON.stringify(action)
  let hash = 2166136261
  for (const char of source) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 2147483646) + 1
}

function requireSvgElement(element, message) {
  if (typeof SVGElement === 'undefined' || !(element instanceof SVGElement)) throw new Error(message)
  return element
}

function resolveDrawingOverlay(canvas) {
  if (typeof HTMLElement === 'undefined' || !(canvas instanceof HTMLElement)) {
    throw new Error('rough.js 需要已渲染的真画布 HTMLElement')
  }
  let overlay = canvas.querySelector('[data-board-overlay="rough-drawings"]')
  if (!overlay) {
    overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    overlay.dataset.boardLayer = 'L3'
    overlay.dataset.boardOverlay = 'rough-drawings'
    overlay.setAttribute('viewBox', `0 0 ${BOARD_DESIGN_SIZE.width} ${BOARD_DESIGN_SIZE.height}`)
    overlay.setAttribute('preserveAspectRatio', 'none')
    overlay.setAttribute('aria-hidden', 'true')
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '4',
      pointerEvents: 'none',
      overflow: 'visible',
    })
    canvas.appendChild(overlay)
  }
  return requireSvgElement(overlay, 'rough.js L3 绘图层无效')
}

function roughOptions(action) {
  return {
    stroke: ROUGH_DRAWING_COLORS[action.style.colorId],
    strokeWidth: ROUGH_DRAWING_STROKE_WIDTHS[action.style.strokeWidthId],
    fill: 'none',
    roughness: 1.15,
    bowing: 0.8,
    disableMultiStroke: false,
    seed: stableSeed(action),
  }
}

function appendRoughShape(svg, action) {
  const renderer = rough.svg(svg)
  const options = roughOptions(action)
  if (action.tool === 'rough-line') {
    return renderer.line(...action.start, ...action.end, options)
  }
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  const heads = arrowHeadPoints(action.start, action.end)
  group.append(
    renderer.line(...action.start, ...action.end, options),
    renderer.line(...action.end, ...heads[0], options),
    renderer.line(...action.end, ...heads[1], options),
  )
  return group
}

function animatePaths(group, durationMs) {
  const paths = [...group.querySelectorAll('path')]
  const lengths = paths.map((path) => Math.max(1, path.getTotalLength()))
  const totalLength = lengths.reduce((sum, length) => sum + length, 0)
  let elapsedMs = 0
  paths.forEach((path, index) => {
    const length = lengths[index]
    const pathDurationMs = Math.max(1, Math.round((length / totalLength) * durationMs))
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    path.style.transition = 'none'
    requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset ${pathDurationMs}ms cubic-bezier(.42,0,.58,1) ${elapsedMs}ms`
      path.style.strokeDashoffset = '0'
    })
    elapsedMs += pathDurationMs
  })
}

export function estimateRoughDrawingDurationMs(action) {
  const result = validateRoughDrawingAction(action)
  if (!result.ok) throw new Error(result.error)
  const drawingAction = toDesignPixels(result.value)
  return Math.max(
    MIN_DRAWING_DURATION_MS,
    Math.round((geometryLength(drawingAction) / DRAWING_SPEED_DESIGN_PX_PER_SECOND) * 1000),
  )
}

export function validateRoughDrawingAction(action) {
  try {
    const normalized = normalizeCommonAction(action)
    normalized.start = normalizePercentPoint(action.start, 'start')
    normalized.end = normalizePercentPoint(action.end, 'end')
    if (distance(normalized.start, normalized.end) < 2) throw new Error('起点与终点距离过短')
    return { ok: true, value: normalized }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function validateRoughDrawingRegion(action, bounds) {
  const result = validateRoughDrawingAction(action)
  if (!result.ok) return result
  try {
    const region = normalizeRegionBounds(bounds)
    const epsilon = 0.001
    const outside = actionPoints(result.value).some(([x, y]) => (
      x < region.x - epsilon || x > region.x + region.width + epsilon
      || y < region.y - epsilon || y > region.y + region.height + epsilon
    ))
    if (outside) throw new Error(`${result.value.tool} 坐标超出已确认的 ${result.value.region} 区域`)
    return { ok: true, value: result.value }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function prepareRoughDrawingAction(action, { resolveCanvas, resolveRegionBounds } = {}) {
  if (typeof resolveCanvas !== 'function') throw new Error('rough.js 需要受控的真画布解析器')
  if (typeof resolveRegionBounds !== 'function') throw new Error('rough.js 需要当前用户确认的区域边界解析器')
  const bounds = resolveRegionBounds(action?.region)
  const result = validateRoughDrawingRegion(action, bounds)
  if (!result.ok) throw new Error(result.error)

  const normalized = result.value
  const durationMs = estimateRoughDrawingDurationMs(normalized)
  const drawingAction = toDesignPixels(normalized)
  const overlay = resolveDrawingOverlay(resolveCanvas())
  const id = `${normalized.tool}:${normalized.region}:${normalized.order}:${stableSeed(normalized)}`
  let group = null

  return {
    id,
    order: normalized.order,
    durationMs,
    execute() {
      group?.remove()
      group = appendRoughShape(overlay, drawingAction)
      group.dataset.boardActionId = id
      overlay.appendChild(group)
      animatePaths(group, durationMs)
      return group
    },
    cancel() {
      group?.remove()
      group = null
    },
    remove() {
      group?.remove()
      group = null
    },
  }
}

function schemaFor(tool) {
  const common = {
    tool,
    region: ROUGH_DRAWING_REGIONS.join('|'),
    order: '老师单手队列中的正整数顺序',
    style: {
      colorId: Object.keys(ROUGH_DRAWING_COLORS).join('|'),
      strokeWidthId: Object.keys(ROUGH_DRAWING_STROKE_WIDTHS).join('|'),
    },
  }
  return { ...common, start: '[xPercent,yPercent]', end: '[xPercent,yPercent]' }
}

function exampleFor(tool) {
  return { tool, region: 'analysis', start: [20, 52], end: [50, 52], order: 1, style: { colorId: 'red', strokeWidthId: 'normal' } }
}

export function getRoughDrawingAgentTools() {
  return ROUGH_DRAWING_TOOL_IDS.map((tool) => ({
    id: tool,
    purpose: TOOL_DESCRIPTIONS[tool],
    owner: 'Agent C 执行；Agent B 只输出结构化动作参数，不生成 rough.js 代码',
    layer: 'L3',
    coordinateSystem: {
      unit: 'percent',
      range: '0-100',
      origin: '左上角',
      rule: '所有点必须落在该动作声明的、用户已确认的区域内',
    },
    concurrency: {
      mode: 'teacher-hand-exclusive',
      minimumGapAfterMs: MIN_HAND_LIFT_GAP_MS,
      rule: '与自动写字、标记和其他图形共用一只老师手，禁止同步绘制',
    },
    timing: {
      owner: 'program',
      rule: `按实际几何路径长度计算，最短 ${MIN_DRAWING_DURATION_MS}ms；Agent 不填时长`,
      minimumDurationMs: MIN_DRAWING_DURATION_MS,
    },
    actionSchema: schemaFor(tool),
    example: exampleFor(tool),
  }))
}
