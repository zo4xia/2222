import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// 依次查找模板：根目录 row-player.html > public/row-player.html > public/deliverable/row-player.html
const candidateTemplatePaths = [
  resolve(__dirname, '../row-player.html'),
  resolve(__dirname, '../public/row-player.html'),
  resolve(__dirname, '../public/deliverable/row-player.html')
]

/**
 * 统一微课与参数交付物单页生成器
 * 读取 row-player.html 模板，注入预置交付物 JSON 数据
 * 杜绝多套 HTML 页面分化，统一归拢为单一高保真微课演播交付物
 */

// ★ 防御层：模板头规范矫正（export 供测试直测）
// 史上模板首行曾漏尖角括号（!DOCTYPE html>），浏览器无 DOCTYPE 声明
// 会掉怪异模式（盒模型/行高/字号继承全按 1998 老标准，板书排版对不齐的
// 隐形根源），且本函数会把病头继承进每个固化导出件。生成时自动补正 + 留痕。
export function ensureDoctype(html) {
  if (/^\s*<!doctype\s+html\s*>/i.test(html)) return html
  // 常见手滑：`!DOCTYPE html>`（漏左尖角括号）→ 原位补上
  const patched = html.replace(/^(\s*)!DOCTYPE(\s+html\s*>)/i, '$1<!DOCTYPE$2')
  if (patched !== html) {
    console.warn('[renderDeliverableHtml] 模板缺 DOCTYPE 左尖角括号，已自动补正；请修模板源头')
    return patched
  }
  // 兜底：完全没头 → 前置标准声明
  console.warn('[renderDeliverableHtml] 模板缺 DOCTYPE 声明，已前置补正；请修模板源头')
  return `<!DOCTYPE html>\n${html}`
}

export function renderDeliverableHtml(deliverable) {
  const templatePath = candidateTemplatePaths.find(p => existsSync(p))

  if (templatePath) {
    try {
      const template = ensureDoctype(readFileSync(templatePath, 'utf-8'))
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
  <script>window.location.href = '/row-player.html';</script>
</body>
</html>`
}
