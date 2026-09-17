/**
 * draw — 画图意图工具
 *
 * Agent B 编剧：写清楚 startCoord + intent（半结构化格式）。
 * Agent C 执行：直接解析 intent 的 key:value 段，不做自然语言猜测。
 *
 * startCoord 语义（画布百分比，左上角为0%,0%）：
 *   画图      → 图形的起笔点或左上角参考点
 *   标注      → 文字/符号/顶点编号的落点
 *   连线/辅助线→ 线段起点
 *   圈出/框出 → 包围对象的中心或起始定位点
 *
 * intent 格式规范（分号分隔，key:value，Agent C 可直接解析）：
 *   动作:画图|标注|写条件|画线|圈出
 *   图形:梯形|矩形|三角形|线段|椭圆（画图时必填）
 *   顶点:A左上,B右上,C右下,D左下（有顶点时填，逗号分隔）
 *   上底:6dm; 下底:9dm; 高:4dm（具体尺寸，有几个写几个）
 *   颜色:石墨灰|蓝色|红色|黑色
 *   说明:补充文字，不超过20字
 */

import rough from 'roughjs/bundled/rough.esm.js'
import { BOARD_DESIGN_SIZE } from '../utils/canvasCoords.js'

export const DRAW_INTENT_TOOL_ID = 'draw'

const COLOR_MAP = {
  石墨灰: '#4b5563',
  蓝色: '#2563eb',
  红色: '#dc2626',
  黑色: '#111827',
  绿色: '#16a34a',
  橙色: '#ea580c',
  default: '#2563eb',
}

function resolveDrawOverlay(canvas) {
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
  return overlay
}

function toPixelCoord(pctX, pctY) {
  return [
    Math.round((pctX / 100) * BOARD_DESIGN_SIZE.width),
    Math.round((pctY / 100) * BOARD_DESIGN_SIZE.height),
  ]
}

function animatePathElements(group, durationMs) {
  const paths = [...group.querySelectorAll('path')]
  if (!paths.length) return
  const lengths = paths.map((p) => {
    try {
      return Math.max(1, p.getTotalLength())
    } catch {
      return 50
    }
  })
  const totalLength = lengths.reduce((sum, len) => sum + len, 0)
  let elapsedMs = 0
  paths.forEach((path, idx) => {
    const len = lengths[idx]
    const pathDuration = Math.max(1, Math.round((len / totalLength) * durationMs))
    path.style.strokeDasharray = `${len}`
    path.style.strokeDashoffset = `${len}`
    path.style.transition = 'none'
    requestAnimationFrame(() => {
      path.style.transition = `stroke-dashoffset ${pathDuration}ms cubic-bezier(.42,0,.58,1) ${elapsedMs}ms`
      path.style.strokeDashoffset = '0'
    })
    elapsedMs += pathDuration
  })
}

/**
 * 准备 draw 意图动作的执行计划
 */
export function prepareDrawIntentAction(action, { resolveCanvas } = {}) {
  const check = validateDrawIntentAction(action)
  if (!check.ok) throw new Error(check.error)
  const norm = check.value
  const parsed = parseDrawIntent(norm.intent)

  // 持续时间：优先 intent 中的 '时长:Xs'，否则兜底 1200ms
  let durationMs = 1200
  if (parsed['时长']) {
    const secMatch = String(parsed['时长']).match(/(\d+(?:\.\d+)?)\s*s/i)
    if (secMatch) {
      durationMs = Math.round(parseFloat(secMatch[1]) * 1000)
    }
  }

  const strokeColor = COLOR_MAP[parsed['颜色']] || COLOR_MAP.default
  const vertices = parseVertices(parsed['顶点'] || '')
  const id = `draw:${norm.region}:${norm.order || 1}:${Date.now()}`
  let group = null

  return {
    id,
    order: norm.order || 1,
    durationMs,
    execute() {
      if (typeof resolveCanvas !== 'function') return null
      const canvasEl = resolveCanvas()
      if (!canvasEl) return null
      const overlay = resolveDrawOverlay(canvasEl)
      group?.remove()
      group = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      group.dataset.boardActionId = id

      const rc = rough.svg(overlay)
      const options = {
        stroke: strokeColor,
        strokeWidth: 2,
        roughness: 1.2,
        bowing: 0.8,
        seed: 12345,
      }

      // 如果有解析到的一组顶点（>=3），绘制多边形
      if (vertices.length >= 3) {
        const points = vertices.map((v) => toPixelCoord(v.x, v.y))
        const polygonNode = rc.polygon(points, options)
        group.appendChild(polygonNode)

        // 顶点文字标记
        vertices.forEach((v) => {
          if (v.label) {
            const [px, py] = toPixelCoord(v.x, v.y)
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            textNode.setAttribute('x', `${px}`)
            textNode.setAttribute('y', `${py - 8}`)
            textNode.setAttribute('fill', strokeColor)
            textNode.setAttribute('font-size', '30')
            textNode.setAttribute('font-weight', 'bold')
            textNode.setAttribute('font-family', 'sans-serif')
            textNode.textContent = v.label
            group.appendChild(textNode)
          }
        })
      } else if (vertices.length === 2) {
        // 2 个顶点，画线段
        const p1 = toPixelCoord(vertices[0].x, vertices[0].y)
        const p2 = toPixelCoord(vertices[1].x, vertices[1].y)
        const lineNode = rc.line(p1[0], p1[1], p2[0], p2[1], options)
        group.appendChild(lineNode)
      } else {
        // 根据 startCoord 或图形做兜底绘制
        const start = parseCoordPair(norm.startCoord) || [20, 30]
        const [px, py] = toPixelCoord(start[0], start[1])
        const shapeType = parsed['图形'] || ''

        if (shapeType.includes('梯形')) {
          // 默认梯形
          const pts = [
            [px, py],
            [px + 160, py],
            [px + 220, py + 120],
            [px - 40, py + 120],
          ]
          group.appendChild(rc.polygon(pts, options))
        } else if (shapeType.includes('三角形')) {
          const pts = [
            [px + 80, py],
            [px + 160, py + 130],
            [px, py + 130],
          ]
          group.appendChild(rc.polygon(pts, options))
        } else if (shapeType.includes('矩形')) {
          group.appendChild(rc.rectangle(px, py, 180, 110, options))
        } else if (shapeType.includes('椭圆') || shapeType.includes('圆')) {
          group.appendChild(rc.ellipse(px + 80, py + 50, 160, 100, options))
        } else {
          // 圈出或下划线兜底
          group.appendChild(rc.rectangle(px, py, 140, 60, options))
        }
      }

      overlay.appendChild(group)
      animatePathElements(group, durationMs)
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

/**
 * Agent 工具描述（注入 userPayload.availableBoardTools）
 */
export function getDrawIntentAgentTool() {
  return {
    id: DRAW_INTENT_TOOL_ID,
    purpose: '描述要画的内容 + 起手坐标 + 时长；intent 按固定顺序用分号分隔 key:value，Agent C 可直接解析执行',
    actionSchema: {
      tool: DRAW_INTENT_TOOL_ID,
      region: '"analysis" | "solution" | "summary" — 对应环节（分析/解答/总结）',
      startCoord: '"x%,y%" 画布百分比；画图=左上参考点，标注=落点，连线=起点，圈出=中心',
      intent: '按顺序：动作:画图|板书|标注|划重点|画线|圈出; 时长:Xs; 然后是具体内容（图形/顶点/尺寸/颜色等）',
    },
    example: {
      tool: DRAW_INTENT_TOOL_ID,
      region: 'analysis',
      startCoord: '10%,20%',
      intent: '动作:画图; 时长:3s; 图形:梯形; 顶点:A左上10%20%,B右上30%20%,C右下38%35%,D左下5%35%; 上底AB:6dm; 颜色:石墨灰',
    },
  }
}

/**
 * 校验 draw action 结构
 */
export function validateDrawIntentAction(action) {
  if (action?.tool !== DRAW_INTENT_TOOL_ID) {
    return { ok: false, error: `tool 必须是 "${DRAW_INTENT_TOOL_ID}"` }
  }
  const VALID_REGIONS = new Set(['question', 'analysis', 'solution', 'summary'])
  if (!VALID_REGIONS.has(action?.region)) {
    return { ok: false, error: `region 必须是 question/analysis/solution/summary，当前：${action?.region}` }
  }
  if (typeof action?.intent !== 'string' || !action.intent.trim()) {
    return { ok: false, error: 'intent 不能为空，必须描述要画的内容' }
  }
  return {
    ok: true,
    value: {
      tool: DRAW_INTENT_TOOL_ID,
      region: action.region,
      startCoord: action.startCoord || null,
      intent: action.intent,
      order: Number.isFinite(action.order) ? Math.round(action.order) : 1,
      style: action.style || {},
    },
  }
}

/**
 * 解析 intent 字符串为键值对对象
 * 格式示例：动作:画图; 时长:3s; 图形:梯形; 顶点:A左上10%20%,B右上30%20%,C右下38%35%,D左下5%35%; 上底AB:6dm; 颜色:石墨灰
 */
export function parseDrawIntent(intentStr) {
  if (!intentStr || typeof intentStr !== 'string') return {}
  const segments = intentStr.split(/[;；]/).map((s) => s.trim()).filter(Boolean)
  const result = {}
  for (const seg of segments) {
    const colonIdx = seg.indexOf(':') > -1 ? seg.indexOf(':') : seg.indexOf('：')
    if (colonIdx > -1) {
      const key = seg.slice(0, colonIdx).trim()
      const val = seg.slice(colonIdx + 1).trim()
      result[key] = val
    } else {
      result[seg] = true
    }
  }
  return result
}

/**
 * 解析顶点坐标列表
 * 格式支持：A左上10%20%,B右上30%20% 或 A 10% 20%, B 30% 20%
 * 返回: [{ label: 'A', x: 10, y: 20 }, ...]
 */
export function parseVertices(vertexStr) {
  if (!vertexStr || typeof vertexStr !== 'string') return []
  const items = vertexStr.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  const vertices = []
  for (const item of items) {
    // 匹配如 "A左上10%20%" 或 "A:10%,20%" 或 "10% 20%"
    const match = item.match(/([A-Za-z0-9\u4e00-\u9fa5]*?)(\d+(?:\.\d+)?)\s*%\s*[,，\s]?\s*(\d+(?:\.\d+)?)\s*%/i)
    if (match) {
      vertices.push({
        label: match[1] || '',
        x: parseFloat(match[2]),
        y: parseFloat(match[3]),
      })
    }
  }
  return vertices
}

/**
 * 解析 startCoord 百分比坐标，如 "10%,20%" -> [10, 20]
 */
export function parseCoordPair(coordStr) {
  if (!coordStr || typeof coordStr !== 'string') return null
  const m = coordStr.match(/(\d+(?:\.\d+)?)\s*%\s*[,，\s]\s*(\d+(?:\.\d+)?)\s*%/i)
  if (m) {
    return [parseFloat(m[1]), parseFloat(m[2])]
  }
  return null
}
