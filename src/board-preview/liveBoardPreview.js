const STORAGE_KEY = 'qinghuabu.live-board-preview'

/* ★ Task 58 布局修订闭环（夏夏拍板 2026-10-22）：
 * 布局调整前移生成环——预览页（board-preview）拖四区/标签后保存「布局修订」，
 * 工作台（AgentBDirect）重新生成时按题目全文（problemText）匹配吃进、覆写 handoff.boardPlan，
 * 让 LLM 按新四区坐标重新出 rows/actionSpec。
 * 匹配键说明：handoff 活档内容不含 projectCode（只在文件名），problemText 是两端都必有的稳定键——
 * 同题改布局重出 = 正确匹配；换新题 = 自然失配，旧修订不会被误吃到新题上。
 * 修订标记生命周期：常驻直到题目变化（无感失效）；想回原布局可拖回原位再保存一次覆盖。 */
const LAYOUT_REVISION_KEY = 'qinghuabu.layout-revision'

export function saveLayoutRevision({ problemText, projectCode, boardPlan, savedAt }) {
  localStorage.setItem(LAYOUT_REVISION_KEY, JSON.stringify({ problemText, projectCode, boardPlan, savedAt }))
}

export function readLayoutRevision() {
  try {
    return JSON.parse(localStorage.getItem(LAYOUT_REVISION_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearLayoutRevision() {
  localStorage.removeItem(LAYOUT_REVISION_KEY)
}

export function loadLiveBoardPreview() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveLiveBoardPreview(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function isLiveBoardPreviewUpdate(event) {
  return event.key === STORAGE_KEY && event.storageArea === localStorage
}
