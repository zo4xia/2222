/* @qh-core LANE=B-V2 POINT=SKILL_REGISTRY Agent B Skill 注册表
 * 每个 skill 是一个独立模块，导出 { id, name, description, buildSystemPrompt() }
 * 新增 skill：新建目录 + 在下方 import + 加入 SKILLS 数组即可
 */
import { defaultFallback } from './default-fallback/index.js'
import { promptV3Draft } from './prompt-v3-draft/index.js'
import { liyongleElementary } from './liyongle-elementary/index.js'

export const SKILLS = [
  defaultFallback,
  liyongleElementary,
  promptV3Draft,
]

export const DEFAULT_SKILL_ID = 'default-fallback'

export function getSkillById(id) {
  return SKILLS.find((s) => s.id === id) || null
}

export function listSkills() {
  return SKILLS.map(({ id, name, description }) => ({ id, name, description }))
}
