#!/usr/bin/env node
/**
 * test-step1-content-region.mjs — 贴图布局规则哨兵
 * 规则（夏夏 2026-10-14 定）：判定依据 = 图片内「黑色文本内容区域」长宽比，非整图长宽比。
 *   内容区域 长(横向) > 宽(纵向) → 横向贴入（landscape-top-image）
 *   长 < 宽 → 左侧贴图、左右开（portrait-left-image）
 * 测纯函数核心（Node 可跑）+ 接线哨兵（Step1Entry 用新判定）+ 布局方向契约（boardLayout 两分支）。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeContentRegion, otsuThreshold } from '../src/utils/imageContentRegion.js'
import { planLabelsFromTopic } from '../src/utils/boardLayout.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

// ── 造图工具：亮度矩阵 ──────────────────────────────────────────────
function makeGrid(w, h, fill = 255) {
  return new Uint8Array(w * h).fill(fill)
}
function paintRect(grid, w, x, y, rw, rh, val = 30) {
  for (let yy = y; yy < y + rh; yy++) {
    for (let xx = x; xx < x + rw; xx++) grid[yy * w + xx] = val
  }
}
// 画空心框（模拟黑色线条图形，如几何示意图）
function paintOutline(grid, w, x, y, rw, rh, val = 40, thickness = 3) {
  paintRect(grid, w, x, y, rw, thickness, val)
  paintRect(grid, w, x, y + rh - thickness, rw, thickness, val)
  paintRect(grid, w, x, y, thickness, rh, val)
  paintRect(grid, w, x + rw - thickness, y, thickness, rh, val)
}

console.log('A. 纯函数：黑色内容区域判定')

// A1 ★核心坑案例：竖图里放横向宽文本块 → 内容区域长>宽 → 横向贴入
//    （整图 480x640=0.75 会肤浅判成"竖图→左侧贴图"，正是夏夏警告的坑）
{
  const W = 480, H = 640
  const g = makeGrid(W, H)
  paintRect(g, W, 40, 80, 400, 200) // 宽文本块 400x200（aspect 2.0）
  const region = computeContentRegion(g, W, H)
  check('A1 竖图+宽文本块：区域命中 400x200', region && region.w === 400 && region.h === 200, JSON.stringify(region))
  check('A1 区域 aspect=2 > 1 → 横向贴入方向', region ? region.w / region.h > 1 : false)
}

// A2 反向坑：横图里放纵向高文本列 → 内容区域长<宽 → 左侧贴图左右开
//    （整图 640x480=1.33 会肤浅判成"横图→横向贴入"）
{
  const W = 640, H = 480
  const g = makeGrid(W, H)
  paintRect(g, W, 60, 40, 200, 400) // 高文本列 200x400（aspect 0.5）
  const region = computeContentRegion(g, W, H)
  check('A2 横图+高文本列：区域命中 200x400', region && region.w === 200 && region.h === 400, JSON.stringify(region))
  check('A2 区域 aspect=0.5 < 1 → 左侧贴图方向', region ? region.w / region.h < 1 : false)
}

// A3 真实复合：题文(宽块) + 黑线几何图(下方) → 包围盒=整体内容 → 长<宽 → 左侧贴图
{
  const W = 480, H = 640
  const g = makeGrid(W, H)
  paintRect(g, W, 40, 60, 400, 150)          // 题文
  paintOutline(g, W, 40, 250, 300, 240)      // 几何图形（黑线框）
  const region = computeContentRegion(g, W, H)
  // 内容整体 40..440 x 60..490 → 400x430 → aspect≈0.93 → 左侧贴图
  check('A3 题文+图形复合：包围盒覆盖到图形底', region && region.y === 60 && region.y + region.h === 490, JSON.stringify(region))
  check('A3 复合内容 aspect<1 → 左侧贴图方向', region ? region.w / region.h < 1 : false)
}

// A4 抗噪：文本块 + 四角孤立噪点 → 包围盒不被噪点撑大
{
  const W = 400, H = 300
  const g = makeGrid(W, H)
  paintRect(g, W, 60, 80, 280, 140)
  g[0] = 10; g[W - 1] = 10; g[(H - 1) * W] = 10; g[H * W - 1] = 10  // 四角单像素噪点
  const region = computeContentRegion(g, W, H)
  check('A4 孤立噪点不进包围盒', region && region.x === 60 && region.y === 80 && region.w === 280 && region.h === 140, JSON.stringify(region))
}

// A5 全白空图 → null（调用方走整图回退）
{
  const g = makeGrid(300, 200)
  check('A5 空白图返回 null', computeContentRegion(g, 300, 200) === null)
}

// A6 边界：aspect 恰好 =1 → 不是横向（长"大于"宽才横向，等号归左侧）
{
  const W = 400, H = 400
  const g = makeGrid(W, H)
  paintRect(g, W, 20, 20, 360, 360)
  const region = computeContentRegion(g, W, H)
  check('A6 正方形内容 aspect=1 → 非横向（归左侧贴图）', region && region.w === 360 && region.h === 360 && !(region.w / region.h > 1))
}

// A7 中灰阴影不算黑字：阴影亮度 150 > 阈值 90 → 不污染区域
{
  const W = 400, H = 300
  const g = makeGrid(W, H)
  paintRect(g, W, 0, 0, 400, 60, 150)        // 顶部大片灰阴影（拍照投影）
  paintRect(g, W, 60, 100, 280, 140, 30)     // 真黑文本块
  const region = computeContentRegion(g, W, H)
  check('A7 灰阴影(亮度150)不进区域，黑字区域为准', region && region.y === 100, JSON.stringify(region))
}

// A8 Otsu：暗字(40)+亮纸(240) 双峰 → 阈值落在两类之间
{
  const g = new Uint8Array(1000).fill(240)
  for (let i = 0; i < 100; i++) g[i] = 40
  const t = otsuThreshold(g)
  check('A8 Otsu 阈值把黑字(40)与纸面(240)分开', t >= 40 && t < 240, `t=${t}`)
}

// A9 Otsu 全同图（无方差）→ 任意值不炸
{
  const g = new Uint8Array(500).fill(200)
  const t = otsuThreshold(g)
  check('A9 Otsu 全同图不抛错', Number.isFinite(t))
}

// A10 参数防御：坏输入返回 null 不抛
{
  let threw = false
  try {
    computeContentRegion(null, 0, 0)
    computeContentRegion(new Uint8Array(10), 100, 100)
  } catch { threw = true }
  check('A10 坏输入不抛错', !threw)
}

console.log('B. 布局引擎方向契约（横向贴入 vs 左侧贴图·左右开）')

// B1 isLandscape=true → landscape-top-image（图贴顶，三区横排在下）
{
  const plan = planLabelsFromTopic(
    { topicLabel: { x: 5.7, y: 6.6, w: 7.1 }, question: { x: 6, y: 13.2, w: 44, fontSize: 28 }, image: { x: 6, y: 13.2, w: 88 } },
    { isLandscape: true, topicBottomPct: 60 },
  )
  check('B1 横向贴入分支 = landscape-top-image', plan.layoutMode === 'landscape-top-image', plan.layoutMode)
  check('B1 三区横排（分析/解答/总结 x 递增）', plan.analysis.x < plan.solution.x && plan.solution.x < plan.summary.x)
}

// B2 isLandscape=false 且有图 → portrait-left-image（左图右三区纵排 = 左右开）
{
  const plan = planLabelsFromTopic(
    { topicLabel: { x: 5.7, y: 6.6, w: 7.1 }, question: { x: 6, y: 13.2, w: 44, fontSize: 28 }, image: { x: 6, y: 13.2, w: 38 } },
    { isLandscape: false, topicBottomPct: 60 },
  )
  check('B2 左侧贴图分支 = portrait-left-image', plan.layoutMode === 'portrait-left-image', plan.layoutMode)
  check('B2 三区在图右侧纵排（x 同列、y 递增）', plan.analysis.x >= 50 && plan.analysis.y < plan.solution.y && plan.solution.y < plan.summary.y)
}

console.log('C. 接线哨兵（Step1Entry 使用内容区域判定）')

// C1 Step1Entry 引入 detectContentLandscape；旧的整图 >1.4 肤浅判断已拔除
{
  const src = readFileSync(resolve(root, 'src/components/Step1Entry.vue'), 'utf8')
  check('C1 Step1Entry 引入 detectContentLandscape', src.includes("from '../utils/imageContentRegion.js'"))
  check('C1 旧肤浅判断(>1.4)已拔除', !src.includes('naturalWidth / (img.naturalHeight || 1) > 1.4'))
  check('C1 判定走 detectContentLandscape', /isLandscape\.value = await detectLandscape\(/.test(src) && /detectContentLandscape\(dataUrl\)/.test(src))
}

// C2 判定结果只在贴原图时生效（纯文字题图不贴原图，布局规则不越权）
{
  const src = readFileSync(resolve(root, 'src/components/Step1Entry.vue'), 'utf8')
  check('C2 isLandscape 消费口带 keepOriginal 门（纯文字图不贴）', /isLandscape: isLandscape\.value && Boolean\(sourceImageUrl\.value\) && keepOriginal\.value/.test(src))
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
