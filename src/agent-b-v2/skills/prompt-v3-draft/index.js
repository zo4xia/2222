/* @qh-core LANE=B-V2 POINT=SKILL_V3_DRAFT V3 草稿 Prompt
 * 学霸小姐姐人设 + 四环骨架 + few-shot 示例驱动
 */
import { AGENT_B_V2_SYSTEM_PROMPT } from '../../prompt-v3-draft.js'

export const promptV3Draft = {
  id: 'prompt-v3-draft',
  name: 'V3 草稿（学霸小姐姐·四环）',
  description: '人设：学霸小姐姐；四环：递归拆解→预设问题→费曼讲解→筛网归题',
  buildSystemPrompt() {
    return AGENT_B_V2_SYSTEM_PROMPT
  },
}
