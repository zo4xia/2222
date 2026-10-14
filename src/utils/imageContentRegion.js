/**
 * imageContentRegion.js — 原图贴入布局的判定真源
 * ------------------------------------------------------------------
 * ★ 2026-10-14 夏夏定的贴图规则（不要肤浅判断，很容易踩坑）：
 *   判定依据 = 图片里「黑色文本内容区域」的长宽比，不是整张图的长宽比——
 *   照片白边、纸张留白、取景框都会污染整图判断（肤浅判断的坑）。
 *
 *   - 内容区域 长(横向) > 宽(纵向) → 横向贴入：原题图贴顶横排，三区排在图片下方
 *   - 内容区域 长 < 宽（竖向更高）→ 左侧贴图、左右开布局：图占左列，三区右侧纵排
 *
 * 算法（两层）：
 *   1. 纯函数 computeContentRegion：亮度矩阵 → 黑色像素行/列密度过滤 → 内容包围盒
 *      （密度过滤是抗噪关键：JPEG 压缩噪点、纸面斑点、页码外的杂点都不够格成行成列）
 *   2. 浏览器封装 detectContentLandscape：加载 dataUrl → 降采样画布 → 亮度矩阵 →
 *      严格黑字阈值(≤90)优先；捕获率过低时退 Otsu 自适应阈值；仍无内容则整图回退。
 *
 * 纯函数不碰 DOM/canvas，可在 Node 里直接做哨兵测试。
 */

/** 降采样上限：判定只需要形状，不需要细节，480px 长边足够且快 */
const MAX_SAMPLE_SIDE = 480
/** 黑色文本亮度上限：真"黑字"（含深灰），把纸面阴影(中灰 100~180)挡在门外 */
const BLACK_TEXT_LUMA = 90
/** 严格阈值下暗像素占比低于此值 → 认为没抓到黑字，退 Otsu */
const MIN_DARK_RATIO = 0.003

/**
 * 纯函数：由亮度矩阵计算黑色内容区域包围盒。
 * @param {Uint8Array|Uint8ClampedArray} lum 长度 width*height 的逐像素亮度
 * @param {number} width
 * @param {number} height
 * @param {{darkThreshold?: number, minRowRatio?: number, minColRatio?: number}} [opts]
 *   darkThreshold  亮度 ≤ 此值算黑（默认 90 = 真黑字）
 *   minRowRatio    行内黑像素数 ≥ width×ratio 才算内容行（默认 0.8%，抗噪点）
 *   minColRatio    列内黑像素数 ≥ height×ratio 才算内容列
 * @returns {{x:number,y:number,w:number,h:number,darkRatio:number}|null}
 *   找不到内容返回 null（调用方决定回退策略）
 */
export function computeContentRegion(lum, width, height, opts = {}) {
  const {
    darkThreshold = BLACK_TEXT_LUMA,
    minRowRatio = 0.008,
    minColRatio = 0.008,
  } = opts
  if (!lum || width <= 0 || height <= 0 || lum.length < width * height) return null

  const rowCounts = new Uint32Array(height)
  const colCounts = new Uint32Array(width)
  let darkTotal = 0
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width
    for (let x = 0; x < width; x += 1) {
      if (lum[rowOffset + x] <= darkThreshold) {
        rowCounts[y] += 1
        colCounts[x] += 1
        darkTotal += 1
      }
    }
  }
  const darkRatio = darkTotal / (width * height)
  if (darkTotal === 0) return null

  // 行/列密度门槛：抗噪核心。单像素噪点、纸面碎斑不够格撑起内容行/列
  const minRowHits = Math.max(3, Math.ceil(width * minRowRatio))
  const minColHits = Math.max(3, Math.ceil(height * minColRatio))

  let top = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    if (rowCounts[y] >= minRowHits) {
      if (top < 0) top = y
      bottom = y
    }
  }
  let left = -1
  let right = -1
  for (let x = 0; x < width; x += 1) {
    if (colCounts[x] >= minColHits) {
      if (left < 0) left = x
      right = x
    }
  }
  if (top < 0 || left < 0) return null

  const region = {
    x: left,
    y: top,
    w: right - left + 1,
    h: bottom - top + 1,
    darkRatio,
  }
  if (region.w <= 0 || region.h <= 0) return null
  return region
}

/**
 * Otsu 自适应阈值：直方图最大类间方差分割（暗背景低对比照片的兜底）。
 * @param {Uint8Array|Uint8ClampedArray} lum
 * @returns {number} 0~255 的分割阈值（暗类 ≤ 阈值）
 */
export function otsuThreshold(lum) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < lum.length; i += 1) hist[lum[i]] += 1
  const total = lum.length
  if (total === 0) return BLACK_TEXT_LUMA

  let sumAll = 0
  for (let t = 0; t < 256; t += 1) sumAll += t * hist[t]

  let weightBg = 0
  let sumBg = 0
  let bestVar = -1
  let bestThreshold = BLACK_TEXT_LUMA
  for (let t = 0; t < 256; t += 1) {
    weightBg += hist[t]
    if (weightBg === 0) continue
    const weightFg = total - weightBg
    if (weightFg === 0) break
    sumBg += t * hist[t]
    const meanBg = sumBg / weightBg
    const meanFg = (sumAll - sumBg) / weightFg
    const betweenVar = weightBg * weightFg * (meanBg - meanFg) ** 2
    if (betweenVar > bestVar) {
      bestVar = betweenVar
      bestThreshold = t
    }
  }
  return bestThreshold
}

/**
 * 浏览器封装：dataUrl → 内容区域长宽比 → 横向/左侧贴图判定。
 * 失败永不 reject：任何异常都退到可用的最保守信息（对齐旧 detectLandscape 的容错口径）。
 * @param {string} dataUrl
 * @returns {Promise<{landscape:boolean, aspect:number, region:object|null, method:string,
 *                    imageWidth:number, imageHeight:number}>}
 *   landscape=true  → 横向贴入（内容区域长>宽）
 *   landscape=false → 左侧贴图、左右开（内容区域长<宽，或回退/失败保守取竖向）
 *   method ∈ strict-black / otsu-adaptive / whole-image-fallback / load-error
 */
export async function detectContentLandscape(dataUrl) {
  const fallback = (method, imageWidth = 0, imageHeight = 0) => {
    const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 0
    return {
      landscape: false,
      aspect: Number(aspect.toFixed(4)),
      region: null,
      method,
      imageWidth,
      imageHeight,
    }
  }

  const img = await new Promise((resolve) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => resolve(null)
    el.src = dataUrl
  })
  if (!img || !img.naturalWidth || !img.naturalHeight) return fallback('load-error')

  // 降采样：判定形状不需要全分辨率
  const scale = Math.min(1, MAX_SAMPLE_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const sampleW = Math.max(1, Math.round(img.naturalWidth * scale))
  const sampleH = Math.max(1, Math.round(img.naturalHeight * scale))

  let imageData
  try {
    const canvas = document.createElement('canvas')
    canvas.width = sampleW
    canvas.height = sampleH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, sampleW, sampleH)
    imageData = ctx.getImageData(0, 0, sampleW, sampleH)
  } catch {
    return fallback('whole-image-fallback', img.naturalWidth, img.naturalHeight)
  }

  const lum = new Uint8Array(sampleW * sampleH)
  for (let i = 0, p = 0; i < lum.length; i += 1, p += 4) {
    lum[i] = (0.299 * imageData.data[p] + 0.587 * imageData.data[p + 1] + 0.114 * imageData.data[p + 2]) | 0
  }

  // 第一层：严格黑字阈值（夏夏口径：只认黑色文本区域）
  let region = computeContentRegion(lum, sampleW, sampleH)
  let method = 'strict-black'

  // 第二层：抓到的黑太少（低对比照片/彩色扫描）→ Otsu 自适应，阈值夹在安全区间
  if (!region || region.darkRatio < MIN_DARK_RATIO) {
    const otsu = Math.min(180, Math.max(60, otsuThreshold(lum)))
    const relaxed = computeContentRegion(lum, sampleW, sampleH, { darkThreshold: otsu })
    if (relaxed) {
      region = relaxed
      method = 'otsu-adaptive'
    }
  }

  // 第三层：确实没内容（空白图）→ 整图回退
  if (!region) {
    const whole = fallback('whole-image-fallback', img.naturalWidth, img.naturalHeight)
    whole.landscape = whole.aspect > 1
    return whole
  }

  const aspect = region.w / region.h
  return {
    // 长(横向)严格大于宽(纵向)才算横向贴入；近方/等高归左侧贴图（竖向布局更稳）
    landscape: aspect > 1,
    aspect: Number(aspect.toFixed(4)),
    region,
    method,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
  }
}
