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
 * 交付物资源路径归一 + 契约字段补齐（决策 #017，2026-09-17 定案，2026-10-15 恢复）
 * - audioUrl / mp3：`/audio-cache/x.mp3` → `../audio-cache/x.mp3`。
 *   服务端绝对路径在 file:// 双击下会解析到磁盘根 → 404 → onerror 静默降级 = 全程静音；
 *   改相对上级后，交付页（public/deliverable/）在 http 与 file:// 两种协议下都命中 public/audio-cache/。
 * - mp3：契约字段（下游 row-player pick(['mp3',...]) 优先命中），未生成写空串；
 *   中文占位串（'音频暂未生成'）不进 mp3（isAudioSrc 会拒收但污染字段语义）。
 * 单一实现：JSON 写盘（writeDeliverableFile）与 HTML 渲染（renderDeliverableHtml）
 * 两条出口共用，禁止另起一套。幂等：重复调用无副作用。
 * 史档：该逻辑曾随 36a960c（squash 合并 dependabot PR #7 基于旧 main 快照）
 * 被整体回滚删除断性丢失，导出件从那以后 file:// 必哑——本次依 branch2 (3025bad)
 * 原实现恢复并小幅净化（mp3 只写真 URL）。
 */
export function normalizeDeliverableAssetPaths(deliverable) {
  if (!deliverable || !Array.isArray(deliverable.rows)) return deliverable
  const toRelative = (v) => (
    typeof v === 'string' && /^\/(audio-cache|audio|pic)\//.test(v) ? `..${v}` : (v || '')
  )
  const isPlayableSrc = (v) => (
    typeof v === 'string' && v !== '' && /^(\.\.?\/|\/|data:audio\/|blob:|https?:\/\/)/.test(v)
  )
  deliverable.rows.forEach((row) => {
    if (!row || typeof row !== 'object') return
    const rel = toRelative(row.mp3 || row.audioUrl || '')
    if (isPlayableSrc(rel)) {
      row.mp3 = rel
      row.audioUrl = rel
    } else {
      // 未生成/占位串：mp3 契约字段写空串，audioUrl 保留原值（下游展示层判断用）
      row.mp3 = ''
    }
  })
  return deliverable
}

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
      // ★ #017 出口二：渲染 HTML 前归一音频路径（与 writeDeliverableFile JSON 出口
      //   同一实现；幂等，已在 JSON 出口归一过的数据再跑一遍无副作用）
      const normalized = normalizeDeliverableAssetPaths(deliverable)
      const safeJson = JSON.stringify(normalized || {}).replace(/</g, '\\u003c')
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
