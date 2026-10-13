#!/usr/bin/env node
/**
 * test-b-cache.mjs — Task 24 = R8-⑤ B 缓存键盲区修复契约
 * 覆盖：refine 白名单三字段（keyFormulaList/formulaHints/commonMistakes）进键、
 * 模型进键 + bCacheGet 模型比对防御、原有字段行为回归、键稳定性。
 */
import { strict as assert } from 'node:assert'

// mock localStorage（useBCache 唯一环境依赖）
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size },
}

const { useBCache } = await import('../src/agent-b-v2/composables/useBCache.js')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

const baseHandoff = () => ({
  problemText: '一项工程甲单独10天完成，乙单独15天完成，合作几天完成？',
  problemType: '工程问题',
  boardFocus: '逻辑推导',
  relatedKnowledge: ['工作总量=工作效率×工作时间'],
  knowledgeAnalysis: {
    teachingFocus: '掌握工程问题数量关系',
    keyFormulaList: ['工作总量 = 工作效率 × 工作时间'],
    formulaHints: ['合作天数 = 1 ÷ (1/10 + 1/15)'],
    commonMistakes: ['把工作效率相加当作工作总量'],
  },
  stageRatioSuggestion: { type: 'c' },
  boardPlan: { question: { x: 8 } },
})

const mkCache = (handoff, model = 'gemini-2.5-flash-lite') =>
  useBCache({ getHandoff: () => handoff, getSelectedSkillId: () => 'skill-1', getModel: () => model })

console.log('── R8-⑤ B 缓存键盲区 ──')

ok('refine 改 formulaHints → 缓存失效（键变）', () => {
  const c1 = mkCache(baseHandoff())
  c1.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  const h2 = baseHandoff()
  h2.knowledgeAnalysis.formulaHints = ['修缮后：合作天数 = 总量 ÷ 效率和（乙效率 1/15 修正）']
  const c2 = mkCache(h2)
  assert.equal(c2.bCacheGet(), null, '改 formulaHints 后缓存仍命中 = 盲区未修')
})

ok('refine 改 commonMistakes → 缓存失效（键变）', () => {
  const c1 = mkCache(baseHandoff())
  c1.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  const h2 = baseHandoff()
  h2.knowledgeAnalysis.commonMistakes = ['新增易错点：混淆单独效率与合作效率']
  const c2 = mkCache(h2)
  assert.equal(c2.bCacheGet(), null, '改 commonMistakes 后缓存仍命中 = 盲区未修')
})

ok('refine 改 keyFormulaList → 缓存失效（键变）', () => {
  const c1 = mkCache(baseHandoff())
  c1.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  const h2 = baseHandoff()
  h2.knowledgeAnalysis.keyFormulaList = ['合作工作时间 = 工作总量 ÷ (甲效率 + 乙效率)']
  const c2 = mkCache(h2)
  assert.equal(c2.bCacheGet(), null, '改 keyFormulaList 后缓存仍命中 = 盲区未修')
})

ok('模型变化 → 缓存失效（env 预设/用户改配置场景）', () => {
  const c1 = mkCache(baseHandoff(), 'gemini-2.5-flash-lite')
  c1.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  const c2 = mkCache(baseHandoff(), 'gemini-2.5-pro')
  assert.equal(c2.bCacheGet(), null, '换模型后缓存仍命中')
  const c3 = mkCache(baseHandoff(), 'gemini-2.5-flash-lite')
  c3.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  assert.notEqual(c3.bCacheGet(), null, '同模型应命中')
})

ok('防御层：bCacheGet 发现缓存 model 与当前不符 → 主动清除返回 null', () => {
  // 构造键相同但 data.model 不符的缓存（模拟 getModel 未传时写入、之后开始传的场景）
  const c = mkCache(baseHandoff(), 'model-A')
  store.set(c.bCacheKey(), JSON.stringify({ rows: [], model: 'model-OLD', timestamp: Date.now() }))
  assert.equal(c.bCacheGet(), null, '防御层未生效')
  assert.equal(store.has(c.bCacheKey()), false, '过期缓存应被主动清除')
})

ok('回归：原有字段变化仍破缓存（problemText/teachingFocus/relatedKnowledge）', () => {
  const c1 = mkCache(baseHandoff())
  c1.bCacheSet([{ stage: '审题引入' }], 'gemini-2.5-flash-lite')
  for (const mutate of [
    (h) => { h.problemText = '换题：一项工程甲12天乙20天……' },
    (h) => { h.knowledgeAnalysis.teachingFocus = '修缮后教学重心' },
    (h) => { h.relatedKnowledge = ['新增关联知识点'] },
  ]) {
    const h2 = baseHandoff()
    mutate(h2)
    assert.equal(mkCache(h2).bCacheGet(), null, '原有字段变化未破缓存（回归失败）')
  }
})

ok('稳定性：同 handoff + 同 model → 键一致，且命中路径含 TTL 清理', () => {
  store.clear()
  const ka = 42, kb = 42
  const c1 = mkCache(baseHandoff())
  const c2 = mkCache(baseHandoff())
  assert.equal(c1.bCacheKey(), c2.bCacheKey())
  c1.bCacheSet([{ stage: 'a' }], 'gemini-2.5-flash-lite')
  assert.deepEqual(c2.bCacheGet().rows, [{ stage: 'a' }])
  // TTL 过期路径
  store.set(c1.bCacheKey(), JSON.stringify({ rows: [], model: '', timestamp: Date.now() - 25 * 60 * 60 * 1000 }))
  assert.equal(c2.bCacheGet(), null, 'TTL 过期未清理')
})

console.log(`\n结果: ${pass + fail} 用例, ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
