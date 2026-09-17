/* @qh-core LANE=B-V2 POINT=SKILL_LIYONGLE 李永乐风格·小学简易分镜
 * 人设：李永乐式老师 —— 循循善诱、从生活出发、讲原理不背公式
 * 适用：小学数学 1-6 年级，讲题带生活化类比 + 原理推导 + 易错点提醒
 */
import { persona } from './persona.js'
import { fourRings } from './four-rings.js'
import { examples } from './examples.js'
import { speechRules } from './speech-rules.js'
import { boardRules } from './board-rules.js'
import { coordinateRules } from './coordinate-rules.js'
import { outputFormat } from './output-format.js'

export const liyongleElementary = {
  id: 'liyongle-elementary',
  name: '李永乐风格·小学简易分镜',
  description: '循循善诱、从生活出发、讲原理不背公式，适合小学数学 1-6 年级',
  buildSystemPrompt() {
    return [
      persona,
      fourRings,
      speechRules,
      boardRules,
      coordinateRules,
      outputFormat,
      examples,
    ].join('\n\n---\n\n')
  },
}
