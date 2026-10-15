import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
// ★ Task 40（2026-10-16）：#017 归一提为前后端共享真源 src/lib/deliverableAssetPaths.js——
//   客户端导出出口（AgentBDirect downloadDeliverableJson / BoardPreviewApp pipelineJsonString）
//   此前不归一（服务端双出口已治、客户端 JSON 出口是 #017 同型缺口，file:// 导入必哑），
//   现四出口同一实现。此处 re-export 维持既有 import 路径（deliverableStoreHandler / 哨兵测试）不破坏。
import { normalizeDeliverableAssetPaths } from '../src/lib/deliverableAssetPaths.js'

export { normalizeDeliverableAssetPaths }

const __dirname = dirname(fileURLToPath(import.meta.url))
// 依次查找模板：根目录 row-player.html > public/row-player.html > public/deliverable/row-player.html
const candidateTemplatePaths = [
  resolve(__dirname, '../row-player.html'),
  resolve(__dirname, '../public/row-player.html'),
  resolve(__dirname, '../public/deliverable/row-player.html')
]

// 史档：normalizeDeliverableAssetPaths 本体已于 2026-10-16（Task 40）迁至
// src/lib/deliverableAssetPaths.js（前后端共享真源，客户端 JSON 双出口接线），
// 本文件 re-export 保持 API 不变；决策 #017 的注释与史档随本体走。

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

// ★ Task 40：交付件标题（供测试直测，同 ensureDoctype 先例）——
// problemText 去换行截 18 字 + 固定后缀；导出 HTML 的 <title> 随题目走，
// 模板默认题名是“平行四边形面积”示例残留，不随内容变（夏夏 2026-10-16 指出）。
export function deliverableTitle(deliverable) {
  const text = String(deliverable?.problemText || '').replace(/\s+/g, ' ').trim()
  const snippet = text.slice(0, 18)
  return snippet ? `${snippet} · 仿人板书微课` : '仿人板书微课'
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderDeliverableHtml(deliverable) {
  const templatePath = candidateTemplatePaths.find(p => existsSync(p))

  if (templatePath) {
    try {
      const template = ensureDoctype(readFileSync(templatePath, 'utf-8'))
      // ★ #017 出口二：渲染 HTML 前归一音频/题目图路径（与 writeDeliverableFile JSON 出口
      //   同一实现；幂等，已在 JSON 出口归一过的数据再跑一遍无副作用）
      const normalized = normalizeDeliverableAssetPaths(deliverable)
      const safeJson = JSON.stringify(normalized || {}).replace(/</g, '\\u003c')
      // ★ Task 40：标题随题目注入（转义防注入；模板 <title> 占位被真实题名替换）
      const titled = template.replace(
        /<title>[^<]*<\/title>/,
        `<title>${escapeHtml(deliverableTitle(normalized))}</title>`
      )
      const injectedScript = `<script>window.__INITIAL_DELIVERABLE__ = ${safeJson};</script>\n</head>`
      return titled.replace('</head>', injectedScript)
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
