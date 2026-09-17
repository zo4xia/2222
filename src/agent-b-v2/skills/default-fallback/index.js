/* @qh-core LANE=B-V2 POINT=SKILL_DEFAULT 兜底提示词
 * 直接使用 prompt.js 的 AGENT_B_V2_SYSTEM_PROMPT，不做任何风格包装
 * 这是默认兜底，所有基础合同（输出格式/actionSpec/数学正确/转义规则）都在这里
 */
import { AGENT_B_V2_SYSTEM_PROMPT } from '../../prompt.js'

export const defaultFallback = {
  id: 'default-fallback',
  name: '默认兜底（基础合同）',
  description: '使用 prompt.js 完整系统提示词，包含所有输出格式、actionSpec、数学正确和转义规则',
  buildSystemPrompt() {
    return AGENT_B_V2_SYSTEM_PROMPT
  },
}
