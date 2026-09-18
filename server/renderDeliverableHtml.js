import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
// 车同轨、书同文：对外交付物统一过全局唯一超级过滤器，并带上统一规格批注
import {
  superCleanBoardField,
  cleanTextEscapes,
  renderSpecAnnotationComment,
} from '../src/utils/superFilter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 唯一模板 = 项目根 row-player.html（夏夏定版：单文件、零依赖、离线双击可开）
const playerTemplatePath = resolve(__dirname, '../row-player.html')

/**
 * 交付物 JSON 过超级过滤器：
 * - 口播 speech 只清错误转义与控制字符（不动口语毛料）
 * - 板书 board 走完整车同轨书同文：错误转义 / 多余换行 / 除号 ÷ / 分数 \frac / 乘号 x / 平方 ² 立方 ³
 * - 单个 row 组内板书一行一个，写完一个再写一个（lines 数组保留）
 */
function sanitizeDeliverable(deliverable) {
  if (!deliverable || typeof deliverable !== 'object') return deliverable
  const out = { ...deliverable }
  if (typeof out.problemText === 'string') out.problemText = cleanTextEscapes(out.problemText)

  if (Array.isArray(out.rows)) {
    out.rows = out.rows.map((row) => {
      if (!row || typeof row !== 'object') return row
      const next = { ...row }
      if (typeof next.speech === 'string') next.speech = cleanTextEscapes(next.speech)
      // 契约定案：boards 数组唯一契约（每项 startDelay + content），旧 board 单对象兼容归一
      const rawBoards = Array.isArray(next.boards) && next.boards.length
        ? next.boards
        : [next.board ?? '']
      next.boards = rawBoards.map((board) => {
        const cleaned = superCleanBoardField(board?.content ?? board ?? '')
        return {
          startDelay: typeof board?.startDelay === 'number' && Number.isFinite(board.startDelay)
            ? Math.max(0, board.startDelay)
            : 0,
          content: cleaned.content,
        }
      })
      return next
    })
  }
  return normalizeDeliverableAssetPaths(out)
}

/**
 * 交付物资源路径归一 + 契约字段补齐（决策 #017，2026-09-17）
 * - audioUrl / mp3：`/audio-cache/x.mp3` → `../audio-cache/x.mp3`。
 *   服务端绝对路径在 file:// 双击下会解析到磁盘根 → 404 → onerror 降级 = 全程静音；
 *   改相对上级后，交付页（public/deliverable/）在 http 与 file:// 两种协议下都命中 public/audio-cache/。
 * - mp3：契约字段（下游 required），未生成写空串，避免交付物 schema 校验直接失败。
 * 单一实现：JSON 写盘与 HTML 渲染两条出口共用，禁止另起一套。
 */
export function normalizeDeliverableAssetPaths(deliverable) {
  if (!deliverable || !Array.isArray(deliverable.rows)) return deliverable
  const toRelative = (v) => (
    typeof v === 'string' && /^\/(audio-cache|audio|pic)\//.test(v) ? `..${v}` : (v || '')
  )
  deliverable.rows.forEach((row) => {
    if (!row || typeof row !== 'object') return
    const rel = toRelative(row.mp3 || row.audioUrl || '')
    row.mp3 = rel
    row.audioUrl = rel
  })
  return deliverable
}

/**
 * 题目图内嵌（图片题断链修复，2026-09-17）：交付页禁止相对路径素材，图必须转 base64 打进单文件。
 * 判据 = 导出物 boardPlan.image 有没有图位（自动落座真源，与 row-player 渲染判据同源）：
 *   - 图片题：有图位 → 内嵌为 screenshotDataUrl，离线双击即有图；
 *   - 文本题目：无图位 → 只把 screenshotUrl 带出去（溯源/下游用），不内嵌、不占体积。
 * 图源 = 第一步截图（Step1Entry 截 .board-viewport 存 /pic/），不另找图、不重上传。
 */
function inlineProblemImage(deliverable) {
  const bp = deliverable && deliverable.boardPlan
  if (!bp || !bp.image) return deliverable
  const src = deliverable.screenshotUrl || deliverable.sourceImageUrl
  if (!src || typeof src !== 'string' || /^(https?:|data:|blob:)/i.test(src)) return deliverable
  try {
    const publicDir = resolve(__dirname, '../public')
    const rel = src.replace(/^\/+/, '').split('?')[0].split('#')[0]
    const abs = resolve(publicDir, rel)
    if (!abs.startsWith(publicDir) || !existsSync(abs)) return deliverable
    const buf = readFileSync(abs)
    const mime = /\.png$/i.test(rel) ? 'image/png'
      : /\.webp$/i.test(rel) ? 'image/webp'
      : /\.gif$/i.test(rel) ? 'image/gif' : 'image/jpeg'
    deliverable.screenshotDataUrl = `data:${mime};base64,${buf.toString('base64')}`
    if (buf.length > 900 * 1024) {
      console.warn(`[renderDeliverableHtml] 题目图内嵌 ${Math.round(buf.length / 1024)}KB，交付页可能超 1MB`)
    }
  } catch (err) {
    console.warn('[renderDeliverableHtml] 题目图内嵌失败，保留 url 外链:', err.message)
  }
  return deliverable
}

/**
 * 统一微课与参数交付物单页生成器
 * 读取 row-player.html 模板，注入预置交付物 JSON 数据（window.__INITIAL_DELIVERABLE__）
 * 产物 = 单个自包含可播放 HTML，杜绝多套 HTML 页面分化
 */
export function renderDeliverableHtml(deliverable) {
  const cleaned = inlineProblemImage(sanitizeDeliverable(deliverable))
  // 对外批注：画布尺寸 / 比例 / 题目字号 / 板书字号 / 本题 stage 四区坐标落座区间 / 越界与手稿风格
  const specComment = renderSpecAnnotationComment({
    zoneAnchors: cleaned?.boardPlan || cleaned?.zoneAnchors || null,
  })

  if (existsSync(playerTemplatePath)) {
    try {
      const template = readFileSync(playerTemplatePath, 'utf-8')
      const safeJson = JSON.stringify(cleaned || {}).replace(/</g, '\\u003c')
      const injectedScript = `<script>window.__INITIAL_DELIVERABLE__ = ${safeJson};</script>\n</head>`
      const withSpec = template.includes('</head>')
        ? template.replace('</head>', `${specComment}\n${injectedScript}`)
        : `${specComment}\n${template}`
      return withSpec
    } catch (err) {
      console.error('[renderDeliverableHtml] 读取模板失败，降级重定向:', err)
    }
  }

  // 极简降级兜底：自动重定向到统一播放器（开发期由 vite 直接服务项目根 row-player.html）
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>青花布手绘板书微课演播</title>
  ${specComment}
</head>
<body>
  <script>window.location.href = '/row-player.html';</script>
</body>
</html>`
}
