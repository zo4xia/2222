/**
 * test-knowledge-contract.mjs — 知识关联链契约回归测试（第八轮 2026-10-13）
 *
 * 背景（第八轮实锤，夏夏令"提示词里面也要修！里面有涉及到关联性内容"）：
 *   relatedKnowledge（关联知识点）四方形状分裂——A 链生产中文字段对象，
 *   校准提示词教"每项是字符串"，消费端（speechMarkdown/detectStageRatio/useBCache）
 *   读英文字段全 miss，speechMarkdown 兜底 JSON.stringify 裸串直接污染导出产物；
 *   commonMistakes 位置分裂——校准链 merge 到顶层幽灵字段，真值滞留 knowledgeAnalysis 内；
 *   liyongle 平行提示词停留在旧契约（type/text/color 旧 schema、board 字符串、×/emoji、
 *   中文数字口播、无 circle）。本测试锁死归一后的契约：
 *   1. knowledgeItemText 唯一真源读取口：中文字段/英文字段/字符串/空对象全覆盖，永不吐 JSON 裸串
 *   2. speechMarkdown 导出：中文字段对象 → 干净文本；无 JSON.stringify 污染
 *   3. detectStageRatio：中文字段对象的知识文本参与配比命中（旧版丢信号）
 *   4. knowledgeRefinePrompt：教"保持每项结构不变"，commonMistakes 归位 knowledgeAnalysis 内
 *   5. knowledgeRefineHandler merge 字段表：commonMistakes 不在顶层、在嵌套
 *   6. liyongle skill：circle/startDelay/exactText 在场；旧 schema（type/color）、×、emoji、
 *      中文数字口播、黑名单词"说白了"全部清零
 *   7. 默认 skill = prompt.js 真源直引（无平行漂移）
 */
import { knowledgeItemText, detectStageRatio } from '../src/services/stepHandoff.js'
import { buildStandardExplainParamsSection } from '../src/lib/speechMarkdown.js'
import { KNOWLEDGE_REFINE_SYSTEM_PROMPT } from '../src/agent-b-v2/knowledgeRefinePrompt.js'
import { getSkillById, DEFAULT_SKILL_ID } from '../src/agent-b-v2/skills/index.js'
import { AGENT_B_V2_SYSTEM_PROMPT } from '../src/agent-b-v2/prompt.js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let pass = 0
let fail = 0
function assert(condition, name, detail = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

console.log('── 1. knowledgeItemText 唯一真源读取口 ──')
assert(knowledgeItemText('路程公式：s=vt') === '路程公式：s=vt', '字符串项原样返回')
assert(knowledgeItemText({ 知识点: '凑十法', 考点: '20以内进位加' }) === '凑十法', '中文字段对象读「知识点」')
assert(knowledgeItemText({ knowledgePoint: 'kp-english' }) === 'kp-english', '英文字段 knowledgePoint 兼容')
assert(knowledgeItemText({ name: 'n', title: 't' }) === 'n', '英文字段 name 优先于 title')
assert(knowledgeItemText({}) === '', '空对象返回空串（不吐 JSON 裸串）')
assert(knowledgeItemText(null) === '', 'null 安全')
assert(knowledgeItemText({ 考点: '只有考点' }) === '', '没有知识点字段时宁可空串，不吐 JSON 裸串')

console.log('── 2. speechMarkdown 导出净化 ──')
const explain = buildStandardExplainParamsSection({
  problemText: '一块平行四边形菜地',
  relatedKnowledge: [
    { 编号: 'kp_1', 知识点: '平行四边形面积', 考点: 'S=ah', 策略方法: '底乘高' },
    { 知识点: '乘法运算应用' },
  ],
}).join('\n')
assert(explain.includes('平行四边形面积、乘法运算应用'), '关联知识点干净文本落导出')
assert(!explain.includes('{"编号"'), '无 JSON.stringify 裸串污染（第八轮旧 bug）')
assert(!explain.includes('kp_1'), '内部编号不外漏到导出产物')

console.log('── 3. detectStageRatio 知识信号命中 ──')
const ratioWithCn = detectStageRatio('计算', [{ 知识点: '小数宝典', 考点: 'x' }], '')
assert(ratioWithCn && ratioWithCn.type === 'a', '中文字段对象参与配比命中 a 类（旧版全 miss）')
const ratioEmpty = detectStageRatio('计算', [{}], '')
assert(ratioEmpty && ratioEmpty.type === 'a', 'problemType 自身仍可命中（不回归）')

console.log('── 4. knowledgeRefinePrompt 契约教学 ──')
assert(KNOWLEDGE_REFINE_SYSTEM_PROMPT.includes('保持输入时的每项结构不变'), '教模型保持 relatedKnowledge 每项结构')
assert(!KNOWLEDGE_REFINE_SYSTEM_PROMPT.includes('每项是字符串'), '旧"每项是字符串"教学已清零')
assert(KNOWLEDGE_REFINE_SYSTEM_PROMPT.includes('knowledgeAnalysis.commonMistakes'), 'commonMistakes 归位 knowledgeAnalysis 内')
assert(!/### 5\. commonMistakes/.test(KNOWLEDGE_REFINE_SYSTEM_PROMPT), '顶层 commonMistakes 章节已清零')
assert(!KNOWLEDGE_REFINE_SYSTEM_PROMPT.includes('×') && !KNOWLEDGE_REFINE_SYSTEM_PROMPT.includes('÷'), '示例公式无 × ÷ 死字形')

console.log('── 5. knowledgeRefineHandler merge 字段表 ──')
const refineSrc = readFileSync(resolve(root, 'server/knowledgeRefineHandler.js'), 'utf-8')
assert(refineSrc.includes("REFINE_TOP_FIELDS = ['relatedKnowledge']"), '顶层 merge 只收 relatedKnowledge')
assert(!refineSrc.includes("['relatedKnowledge', 'commonMistakes']"), 'commonMistakes 不再顶层 merge')
assert(refineSrc.includes("'teachingFocus', 'keyFormulaList', 'formulaHints', 'commonMistakes'"), 'commonMistakes 进嵌套 merge 字段表')

console.log('── 6. liyongle 平行 skill 契约对齐 ──')
const liyongle = getSkillById('liyongle-elementary')
const liyongleTxt = liyongle ? liyongle.buildSystemPrompt() : ''
assert(Boolean(liyongle), 'liyongle skill 注册在案')
assert(liyongleTxt.includes('circle'), 'circle 已入 rough-notation 白名单教学')
assert(liyongleTxt.includes('startDelay'), 'board 结构化对象 + startDelay 教学')
assert(liyongleTxt.includes('exactText'), 'target.exactText 现行 schema 教学')
assert(!/"type"\s*:\s*"underline"/.test(liyongleTxt), '旧 type 字段示例清零')
assert(!/"color"\s*:\s*"#/.test(liyongleTxt), '旧 hex color 字段示例清零')
assert(!liyongleTxt.includes('× 2') && !liyongleTxt.includes('×数量') && !liyongleTxt.includes('4 ×'), '板书示例无 × 乘号')
assert(!liyongleTxt.includes('⚠'), '板书示例无 emoji')
assert(!liyongleTxt.includes('所有数字用中文发音'), '中文数字口播教学清零')
assert(!liyongleTxt.includes('说白了'), '黑名单词示例清零')

console.log('── 7. 默认 skill 真源直引 ──')
const defSkill = getSkillById(DEFAULT_SKILL_ID)
assert(defSkill && defSkill.buildSystemPrompt() === AGENT_B_V2_SYSTEM_PROMPT, 'default-fallback = prompt.js 唯一真源')
assert(AGENT_B_V2_SYSTEM_PROMPT.includes('circle'), '主提示词 circle 在场（第七轮接通不回归）')
assert(AGENT_B_V2_SYSTEM_PROMPT.includes('知识点」字段抓名称'), '主提示词 relatedKnowledge 形状说明在场')

console.log('── 8. 消费端接线复核（源码级） ──')
const speechMdSrc = readFileSync(resolve(root, 'src/lib/speechMarkdown.js'), 'utf-8')
assert(speechMdSrc.includes('knowledgeItemText'), 'speechMarkdown 接真源读取口')
const bCacheSrc = readFileSync(resolve(root, 'src/agent-b-v2/composables/useBCache.js'), 'utf-8')
assert(bCacheSrc.includes('knowledgeItemText'), 'useBCache 接真源读取口')
const agentBDirectSrc = readFileSync(resolve(root, 'src/agent-b-v2/AgentBDirect.vue'), 'utf-8')
assert(!/handoff\?\.commonMistakes/.test(agentBDirectSrc), 'AgentBDirect 顶层 commonMistakes 读取清零')
assert(agentBDirectSrc.includes('handoff?.knowledgeAnalysis?.commonMistakes'), 'AgentBDirect 嵌套读取已接线')

console.log(`\n结果: ${pass}/${pass + fail} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
