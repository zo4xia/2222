/**
 * useBCache.js — B 生成 localStorage 缓存（24h TTL + 超限清理 + Shift 强制刷新）
 *
 * ponytail: 从 AgentBDirect.vue 956-1031 行抽出，纯逻辑无模板依赖。
 * 调用方传 handoff / selectedSkillId / customSystemPrompt 的 getter，避免双向耦合。
 *
 * @qh-core LANE=COMPOSABLE POINT=USE_B_CACHE
 */
export function useBCache({ getHandoff, getSelectedSkillId, getCustomSystemPrompt }) {
  const B_CACHE_PREFIX = 'b-gen:'
  const B_CACHE_TTL = 24 * 60 * 60 * 1000

  const bCacheKey = () => {
    const h = getHandoff() || {}
    const knowledgeDigest = Array.isArray(h.relatedKnowledge)
      ? h.relatedKnowledge.slice(0, 3).map(k => typeof k === 'string' ? k : (k.knowledgePoint || k.name || '')).join(',')
      : ''
    const analysisDigest = h.knowledgeAnalysis?.teachingFocus
      ? String(h.knowledgeAnalysis.teachingFocus).slice(0, 80)
      : ''
    return B_CACHE_PREFIX + [
      h.problemText?.slice(0, 80) || '',
      h.problemType || '',
      h.boardFocus || '',
      knowledgeDigest,
      analysisDigest,
      h.stageRatioSuggestion?.type || '',
      h.boardPlan?.question?.x || '',
      getSelectedSkillId() || '',
      getCustomSystemPrompt() ? 'custom' : 'default',
    ].join('|')
  }

  const bCacheGet = () => {
    try {
      const raw = localStorage.getItem(bCacheKey())
      if (!raw) return null
      const data = JSON.parse(raw)
      if (Date.now() - data.timestamp > B_CACHE_TTL) {
        localStorage.removeItem(bCacheKey())
        return null
      }
      return data
    } catch { return null }
  }

  const bCacheSet = (rows, model) => {
    try {
      localStorage.setItem(bCacheKey(), JSON.stringify({ rows, model, timestamp: Date.now() }))
    } catch {
      // 存储超限防御：主动清理旧的 b-gen 缓存条目后再写入
      try {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k && k.startsWith(B_CACHE_PREFIX)) keysToRemove.push(k)
        }
        keysToRemove.forEach(k => localStorage.removeItem(k))
        localStorage.setItem(bCacheKey(), JSON.stringify({ rows, model, timestamp: Date.now() }))
      } catch {
        /* 依然无法写入则静默降级，不中断主流程 */
      }
    }
  }

  return { bCacheKey, bCacheGet, bCacheSet }
}
