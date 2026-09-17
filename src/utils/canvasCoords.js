/**
 * 画布坐标
 * - 甲方真画布：1726 × 980（落最终画面）
 * - 夏夏表稿参考尺寸：1892 × 1044（表里写的像素坐标按此估算）
 * 换算：实际X = 表中X * 1726/1892；实际Y = 表中Y * 980/1044
 */
// 画布尺寸唯一真源：src/services/stepHandoff.js 的 CANVAS_SIZE
import { CANVAS_SIZE } from '../services/stepHandoff.js'

export const CANVAS_W = CANVAS_SIZE.width
export const CANVAS_H = CANVAS_SIZE.height
export const TABLE_REF_W = 1892
export const TABLE_REF_H = 1044
export const SCALE_X = CANVAS_W / TABLE_REF_W
export const SCALE_Y = CANVAS_H / TABLE_REF_H
export const BOARD_DESIGN_SIZE = Object.freeze({ width: CANVAS_W, height: CANVAS_H })

/** 夏夏表稿分区（参考 1892×1044 像素） */
export const ZONE_REF_PX = {
  topic: { name: '题目区', x1: 120, x2: 900, y1: 160, y2: 240 },
  analysis: { name: '分析区', x1: 120, x2: 900, y1: 300, y2: 760 },
  solution: { name: '解题区', x1: 1030, x2: 1740, y1: 280, y2: 790 },
  summary: { name: '总结区', x1: 120, x2: 1740, y1: 830, y2: 920 },
}

export function tablePxToCanvasPx(x, y) {
  return {
    x: Math.round(Number(x) * SCALE_X),
    y: Math.round(Number(y) * SCALE_Y),
  }
}

export function tablePxToPct(x, y) {
  const p = tablePxToCanvasPx(x, y)
  return {
    x: Number(((p.x / CANVAS_W) * 100).toFixed(2)),
    y: Number(((p.y / CANVAS_H) * 100).toFixed(2)),
  }
}

export function canvasPxToPct(x, y) {
  return {
    x: Number(((Number(x) / CANVAS_W) * 100).toFixed(2)),
    y: Number(((Number(y) / CANVAS_H) * 100).toFixed(2)),
  }
}

export function zoneToPct(zone) {
  const z = ZONE_REF_PX[zone]
  if (!z) return null
  const a = tablePxToPct(z.x1, z.y1)
  const b = tablePxToPct(z.x2, z.y2)
  return {
    name: z.name,
    x: a.x,
    y: a.y,
    w: Number((b.x - a.x).toFixed(2)),
    h: Number((b.y - a.y).toFixed(2)),
    refPx: z,
  }
}

export function buildGridLines() {
  const minor = []
  const major = []
  for (let p = 5; p < 100; p += 5) {
    const item = { p, major: p % 10 === 0 }
    if (item.major) major.push(item)
    else minor.push(item)
  }
  return { minor, major }
}

export function formatTablePx(x, y) {
  const c = tablePxToCanvasPx(x, y)
  const pct = canvasPxToPct(c.x, c.y)
  return `表(${x},${y}) → 画布(${c.x},${c.y})px / (${pct.x},${pct.y})%`
}