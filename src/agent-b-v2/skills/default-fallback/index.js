/* @qh-core LANE=B-V2 POINT=SKILL_DEFAULT 兜底提示词
 * 直接使用 prompt.js 的 AGENT_B_V2_SYSTEM_PROMPT，不做任何风格包装
 * 这是默认兜底，所有基础合同（输出格式/actionSpec/数学正确/转义规则）都在这里
 */
import { AGENT_B_V2_SYSTEM_PROMPT } from '../../prompt.js'
// ★ 2026-10-13 归一化：description 里画布字面值改真源插值，与 stepHandoff 同口径
import { CANVAS_SIZE } from '../../../services/stepHandoff.js'

export const defaultFallback = {
  id: 'default-fallback',
  name: '系统标准（prompt.js 规范 · 四环教学法）',
  description: `温柔随性李永乐风格、高毛料口播、达芬奇手稿式板书，对齐 ${CANVAS_SIZE.width}×${CANVAS_SIZE.height} 物理基准与四环教学法`,
  buildSystemPrompt() {
    return AGENT_B_V2_SYSTEM_PROMPT
  },
}
