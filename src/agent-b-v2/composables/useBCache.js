/**
 * useBCache.js — B 生成 localStorage 缓存（2h TTL 夏夏拍板 Task 43 + 惰性全扫清理 + 超限清理 + Shift 强制刷新）
 *
 * ponytail: 从 AgentBDirect.vue 956-1031 行抽出，纯逻辑无模板依赖。
 * 调用方传 handoff / selectedSkillId 的 getter，避免双向耦合。
 *
 * ★ Task 24 = R8-⑤ 缓存键盲区修复：
 *   refine（知识修缮环，R8-① 确认后原地覆写活档）白名单六字段中
 *   keyFormulaList / formulaHints / commonMistakes 原先不进缓存键——
 *   修缮这三项后 B 缓存照旧命中旧 rows，静默吐修缮前内容。
 *   现在三字段摘要 + 生成模型全部纳入键；bCacheGet 另加模型比对防御层。
 *
 * @qh-core LANE=COMPOSABLE POINT=USE_B_CACHE
 */
import { knowledgeItemText } from '../../services/stepHandoff.js'

/** 稳定摘要：数组按元素逗号连接，字符串直取，统一截断防键超长 */
function fieldDigest(value, max = 120) {
  if (value == null) return ''
  const s = Array.isArray(value)
    ? value.map((x) => String(x ?? '')).filter(Boolean).join(',')
    : String(value)
  return s.slice(0, max)
}

export function useBCache({ getHandoff, getSelectedSkillId, getModel }) {
  const B_CACHE_PREFIX = 'b-gen:'
  // ★ Task 43 夏夏拍板：TTL 24h→2h（“我就是2小时，否则服务器要垃圾了”）——
  // 超过 2h 点“生成”（非 Shift）不再命中缓存，真调 LLM 重新生成
  const B_CACHE_TTL = 2 * 60 * 60 * 1000

  const bCacheKey = () => {
    const h = getHandoff() || {}
    const knowledgeDigest = Array.isArray(h.relatedKnowledge)
      // ★ 第八轮契约归一：读取口唯一真源 knowledgeItemText（中文字段对象优先，旧 miss 丢摘要）
      ? h.relatedKnowledge.slice(0, 3).map(knowledgeItemText).filter(Boolean).join(',')
      : ''
    const analysisDigest = h.knowledgeAnalysis?.teachingFocus
      ? String(h.knowledgeAnalysis.teachingFocus).slice(0, 80)
      : ''
    // ★ R8-⑤：refine 白名单三个嵌套字段进键——修缮任一项缓存即失效
    const ka = h.knowledgeAnalysis || {}
    const refinedDigest = [
      fieldDigest(ka.keyFormulaList),
      fieldDigest(ka.formulaHints),
      fieldDigest(ka.commonMistakes),
    ].join('/')
    // ★ R8-⑤（env 化补丁）：生成模型进键——换 key/换模型/换预设后旧缓存不再命中
    const modelDigest = fieldDigest(getModel ? getModel() : '', 60)
    return B_CACHE_PREFIX + [
      h.problemText?.slice(0, 80) || '',
      h.problemType || '',
      h.boardFocus || '',
      knowledgeDigest,
      analysisDigest,
      refinedDigest,
      modelDigest,
      h.stageRatioSuggestion?.type || '',
      h.boardPlan?.question?.x || '',
      getSelectedSkillId() || '',
    ].join('|')
  }

  const bCacheGet = () => {
    try {
      // ★ Task 43 惰性全扫（夏夏“垃圾堆积”诉求）：读缓存时顺带清掉其它键的
      // 过期/损坏条目——旧版只删当前键，多题目的陈年条目永久堆积撑爆 5MB 限额。
      // 删除统一收集后执行，不干扰遍历索引；当前键由下方逻辑白行处理。
      const now = Date.now()
      const expiredKeys = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k || !k.startsWith(B_CACHE_PREFIX)) continue
        if (k === bCacheKey()) continue
        try {
          const d = JSON.parse(localStorage.getItem(k) || 'null')
          if (!d || typeof d.timestamp !== 'number' || now - d.timestamp > B_CACHE_TTL) expiredKeys.push(k)
        } catch { expiredKeys.push(k) }
      }
      expiredKeys.forEach((k) => localStorage.removeItem(k))
      const raw = localStorage.getItem(bCacheKey())
      if (!raw) return null
      const data = JSON.parse(raw)
      if (Date.now() - data.timestamp > B_CACHE_TTL) {
        localStorage.removeItem(bCacheKey())
        return null
      }
      // ★ R8-⑤ 防御层：缓存里的生成模型与当前模型不符 → 视为过期（键已含模型，
      // 此层兜底 getModel 未传/模型中途切换等边缘场景）
      if (getModel && data.model && getModel() && data.model !== getModel()) {
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
