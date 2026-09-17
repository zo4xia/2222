import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const playerTemplatePath = resolve(__dirname, '../public/deliverable/handdraw-player.html')

/**
 * 统一微课与参数交付物单页生成器
 * 读取 public/deliverable/handdraw-player.html 模板，注入预置交付物 JSON 数据
 * 杜绝多套 HTML 页面分化，统一归拢为单一高保真微课演播交付物
 */
export function renderDeliverableHtml(deliverable) {
  if (existsSync(playerTemplatePath)) {
    try {
      const template = readFileSync(playerTemplatePath, 'utf-8')
      const safeJson = JSON.stringify(deliverable || {}).replace(/</g, '\\u003c')
      const injectedScript = `<script>window.__INITIAL_DELIVERABLE__ = ${safeJson};</script>\n</head>`
      return template.replace('</head>', injectedScript)
    } catch (err) {
      console.error('[renderDeliverableHtml] 读取模板失败，降级重定向:', err)
    }
  }

  // 极简降级兜底：自动重定向到统一播放器
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>青花布手绘板书微课演播</title>
</head>
<body>
  <script>window.location.href = '/deliverable/handdraw-player.html';</script>
</body>
</html>`
}
