import { AGENT_A_KNOWLEDGE_BASE } from './docReferences.js'
import {
  formatAgentAKnowledge,
  hydrateAgentAKnowledge,
  selectAgentAKnowledge,
} from './agentAKnowledge.js'
import { buildStep1Handoff, hasUsableAgentAKnowledge } from '../src/services/stepHandoff.js'

const AGENT_A_COMPACT_TEXT = JSON.stringify(AGENT_A_KNOWLEDGE_BASE)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const cases = [
  ['计算8+5，用凑十法讲解', 'kp_1'],
  ['56÷7等于多少', 'kp_2'],
  ['一个三角形底8厘米高5厘米，求面积', 'kp_127'],
]

for (const [query, expected] of cases) {
  const selection = selectAgentAKnowledge(AGENT_A_KNOWLEDGE_BASE, query)
  assert(selection.mode === 'top-k', `${query}: 应使用 top-k`)
  assert(selection.rows.some((row) => row.i === expected), `${query}: 未命中 ${expected}`)
  assert(formatAgentAKnowledge(selection).length < AGENT_A_COMPACT_TEXT.length / 5,
    `${query}: prompt 压缩不足 80%`)
}

const catalog = selectAgentAKnowledge(AGENT_A_KNOWLEDGE_BASE, '')
assert(catalog.mode === 'catalog', '图片题应使用紧凑目录')
assert(catalog.rows.length === AGENT_A_KNOWLEDGE_BASE._meta.rows, '目录知识点数量不完整')
assert(formatAgentAKnowledge(catalog).length < AGENT_A_COMPACT_TEXT.length * 0.7,
  '图片题目录压缩不足 30%')

const hydrated = hydrateAgentAKnowledge({
  knowledgeAnalysis: { coreKnowledge: [{ knowledgeId: 'kp_1' }] },
}, AGENT_A_KNOWLEDGE_BASE)
assert(hydrated.knowledgeAnalysis.coreKnowledge[0].knowledgePoint.includes('凑十法'), '知识回填失败')
assert(hydrated.knowledgeAnalysis.coreKnowledge[0].rawKnowledgeRecord.编号 === 'kp_1', '原始字段回填失败')

const unknown = hydrateAgentAKnowledge({
  knowledgeAnalysis: { coreKnowledge: [{ knowledgeId: 'invented-id', knowledgePoint: '模型自行判断' }] },
}, AGENT_A_KNOWLEDGE_BASE)
assert(unknown.knowledgeAnalysis.coreKnowledge[0].knowledgeId === '', '无效 knowledgeId 不应进入 handoff')
assert(hasUsableAgentAKnowledge({ coreKnowledge: [] }) === false, '空知识分析不应阻断本地回退')
assert(buildStep1Handoff({ problemText: '1+1', knowledgeAnalysis: { coreKnowledge: [] } }).knowledgeAnalysis === null,
  'handoff 不应携带空知识分析')
const handoff = buildStep1Handoff({
  problemText: '1+1',
  problemType: 'calculation',
  boardFocus: 'calculation_process',
  suggestedGrade: '一年级',
  uncertainItems: ['题图模糊'],
  suggestedLayout: { layout: 'left_right' },
  agentPageName: 'Agent A',
  agentCapability: 'multimodal',
  knowledgeAnalysis: hydrated.knowledgeAnalysis,
})
assert(handoff.handoffVersion === 1, 'handoff 格式必须显式版本化')
assert(handoff.knowledgeAnalysis.coreKnowledge[0].rawKnowledgeRecord.编号 === 'kp_1', 'handoff 应保留完整回填知识')
assert(handoff.suggestedGrade === '一年级' && handoff.uncertainItems[0] === '题图模糊', 'handoff 应保留 Agent A 判断参数')

const kilometer = hydrateAgentAKnowledge({
  knowledgeAnalysis: { coreKnowledge: [{ knowledgeId: 'kp_78', knowledgePoint: '千米' }] },
}, AGENT_A_KNOWLEDGE_BASE).knowledgeAnalysis.coreKnowledge[0]
assert(kilometer.knowledgePoint === '千米的认识', '知识点名称应使用 Knowledge-A 完整内容')
assert(kilometer.examinationPoint.includes('1000米'), '知识点考点详情回填失败')
assert(kilometer.strategy.includes('乘1000'), '知识点策略详情回填失败')
assert(kilometer.commonMistakes.length >= 2 && kilometer.summary.includes('1千米'), '知识点易错与总结详情回填失败')

console.log(`agent A knowledge self-check ok: ${AGENT_A_KNOWLEDGE_BASE._meta.rows} rows`)
