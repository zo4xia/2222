// 交付物资源路径归一 + 契约字段补齐（决策 #017 唯一真源，2026-10-16 从 server/renderDeliverableHtml.js
// 提取为前后端共享模块）。四个出口同一实现，禁止另起一套：
//   ① 服务端 JSON 写盘（deliverableStoreHandler.writeDeliverableFile）
//   ② 服务端 HTML 渲染（renderDeliverableHtml.renderDeliverableHtml）
//   ③ 客户端完整规格 JSON 下载（AgentBDirect.downloadDeliverableJson）
//   ④ 客户端流水线 JSON 下载（BoardPreviewApp.pipelineJsonString）
// 纯函数、零依赖：服务端（node ESM import）与浏览器（vite 打包）两侧均可加载。
//
// - 行级 mp3 / audioUrl：`/audio-cache/x.mp3` → `../audio-cache/x.mp3`。
//   服务端绝对路径在 file:// 双击下会解析到磁盘根 → 404 → onerror 静默降级 = 全程静音；
//   改相对上级后，交付页（public/deliverable/）在 http 与 file:// 两种协议下都命中 public/audio-cache/。
// - mp3 契约字段（下游 row-player pick(['mp3',...]) 优先命中）：真 URL 才写、未生成写空串；
//   中文占位串（'音频暂未生成'）不进 mp3（isAudioSrc 会拒收但污染字段语义）。
// - 题目图 screenshotUrl（Task 40-B）：`/pic/shot-x.jpg` → `../pic/shot-x.jpg`（同 #017 口径）。
//   旧版只归一 rows 的音频、漏了顶层题目图 → 导出 HTML file:// 双击时题目图 404 静默丢；
//   题目图落点认三处：顶层 / topicSpec（流水线形状）/ problemInfo（deliverable 形状）。
// - 流水线形状兼容（Task 40-A）：行列表认 rows（协议主形状）或 sequence（BoardPreviewApp
//   预览页流水线 JSON 形状），sequence 行同样归一 mp3/audioUrl——四出口口径不因形状分叉。
// 幂等：重复调用无副作用。
// 史档：该逻辑曾随 36a960c（squash 合并 dependabot PR #7 基于旧 main 快照）被整体回滚
// 断性丢失，2026-10-15 恢复（server 侧双出口），2026-10-16 提共享层并补客户端双出口 + 题目图。

const SITE_ROOT_ASSET_PREFIX = /^\/(audio-cache|audio|pic)\//

export function normalizeDeliverableAssetPaths(deliverable) {
  if (!deliverable || typeof deliverable !== 'object') return deliverable
  const toRelative = (v) => (
    typeof v === 'string' && SITE_ROOT_ASSET_PREFIX.test(v) ? `..${v}` : (v || '')
  )
  const isPlayableSrc = (v) => (
    typeof v === 'string' && v !== '' && /^(\.\.?\/|\/|data:audio\/|blob:|https?:\/\/)/.test(v)
  )
  // 行级归一：rows（协议主形状）与 sequence（流水线形状）同规
  const rowList = Array.isArray(deliverable.rows)
    ? deliverable.rows
    : (Array.isArray(deliverable.sequence) ? deliverable.sequence : null)
  if (rowList) {
    rowList.forEach((row) => {
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
  }
  // 题目图归一：顶层 / topicSpec / problemInfo 三落点同规
  for (const holder of [deliverable, deliverable.topicSpec, deliverable.problemInfo]) {
    if (holder && typeof holder === 'object' && typeof holder.screenshotUrl === 'string') {
      holder.screenshotUrl = toRelative(holder.screenshotUrl)
    }
  }
  return deliverable
}
