/* ASR 口播稿优化与板书规范化引擎
   严格遵循规范：
   1. 口播稿为纯文字，可直接导入 TTS 自然朗读；绝不包含任何控制标签或占位符
   2. 阿拉伯数字保留阿拉伯数字，不改写为中文数字（如 15分之7 不写成 十五分之七）
   3. 小数：整数部分保留阿拉伯数字，小数点读"点"，小数部分逐位读汉字（如 3.14 -> 3点一四，0.05 -> 0点零五）
   4. 分数：先读分母再读分子，保留阿拉伯数字（\frac{7}{15} -> 15分之7，1\frac{1}{2} -> 1又2分之1）
   5. 根号/幂次：√9 -> 根号9，a² -> a的平方，a³ -> a的立方，a^4 -> a的4次方
   6. 运算符：+ 读作"加"，- 读作"减"，×/x 读作"乘以"，÷ 读作"除以"，= 读作"等于"
   7. 区分未知数 x（读作"艾克斯"）与乘法 x（读作"乘以"）
   8. 括号必须读出"括号里"
   9. 板书：乘法统一使用小写字母 x，禁止乘号 ×；除法可用 ÷；分数统一使用 \frac{分子}{分母}
*/

import { formatMathSpeechToChinese } from '../lib/mathAsrConverter.js'
// 车同轨、书同文：板书统一过全局唯一超级过滤器
import { superCleanText } from '../utils/superFilter.js'
// 契约定案（2026-09-17）：row 五字段 {stage, mp3, speech, boards, actionSpec}，
// speech **加粗锚点** 按序触发 boards[i]，startDelay 仅为无锚点时的超时兜底
import { normalizeBoardsField, extractSpeechAnchors } from '../agent-b-v2/contract.js'

/**
 * 优化单行 speech 口播稿文本（结合数学算式口播转换库）
 */
export function polishSpeechText(rawSpeech) {
  if (!rawSpeech || typeof rawSpeech !== 'string') return ''
  return formatMathSpeechToChinese(rawSpeech)
}

/**
 * 规范化板书 board 文本
 * - 乘法统一使用小写字母 x，禁止乘号 ×
 * - 除法可以用 ÷
 * - 分数使用 KaTeX 上下结构 \frac{分子}{分母}
 */
export function normalizeBoardContent(content) {
  if (!content || typeof content !== 'string') return ''

  let text = superCleanText(content)

  // 1. 乘号替换为小写字母 x
  text = text.replace(/×|✕|\\times/g, 'x')
  text = text.replace(/\\cdot/g, 'x')

  // 2. 斜杠分数转为 KaTeX 上下结构 \frac{a}{b}
  text = text.replace(/(?<!\d\/)(?<!\\frac\{)(\b\d+)\/(\d+\b)/g, '\\frac{$1}{$2}')

  return text
}

/**
 * 语义板书时机估算器：
 * 结合口播与板书内容，寻找最自然的落笔关键词，换算为本行语音播放后的秒数（基准 160 字/分，约 0.375s/字）
 */
export function estimateKeywordStartDelay(speech, boardContent, stage) {
  if (stage === '题目' || !boardContent || !boardContent.trim()) return 0
  const cleanSpeech = String(speech || '').trim()
  if (!cleanSpeech) return 0

  // 1. 寻找明确引导落笔的触发词/短语
  const triggerPatterns = [
    /写下/, /列出/, /列式/, /写成/, /记作/, /公式是/, /关系是/, /算式是/,
    /等于/, /算出来/, /算得/, /得出/, /得到/, /也就是/, /计算得到/,
    /代入/, /先算/, /再算/, /可以写成/, /设/
  ]

  let bestIndex = -1

  for (const pattern of triggerPatterns) {
    const match = pattern.exec(cleanSpeech)
    if (match && match.index > 0) {
      if (bestIndex === -1 || match.index < bestIndex) {
        bestIndex = match.index
      }
    }
  }

  // 2. 若未匹配到引导词，尝试寻找板书中的核心数字或未知数在口播中的第一次出现位置
  if (bestIndex === -1) {
    const numbers = boardContent.match(/\b\d+(?:\.\d+)?\b/g)
    if (numbers && numbers.length) {
      for (const num of numbers) {
        const idx = cleanSpeech.indexOf(num)
        if (idx > 2 && (bestIndex === -1 || idx < bestIndex)) {
          bestIndex = idx
        }
      }
    }
  }

  // 若找到动笔关键词且不是第0字，按 0.375 秒/字计算
  if (bestIndex > 2) {
    const calculatedSec = Number((bestIndex * 0.375).toFixed(1))
    return Math.min(20.0, Math.max(0.5, calculatedSec))
  }

  // 口播开门见山直接讲板书内容，给一个起笔自然的 1.0s
  return 1.0
}

/**
 * 对整套 rows 进行完整的 ASR 与板书规范化处理
 * 返回 { rows, changes }
 */
export function polishRowsASR(originalRows) {
  if (!Array.isArray(originalRows)) return { rows: [], changes: [] }

  const changes = []
  const polishedRows = originalRows.map((origRow, index) => {
    const rowNum = index + 1
    const stage = origRow?.stage || ''
    const origSpeech = String(origRow?.speech || '')
    const polishedSpeech = polishSpeechText(origSpeech)

    if (origSpeech !== polishedSpeech) {
      changes.push({
        row: rowNum,
        field: 'speech',
        before: origSpeech,
        after: polishedSpeech,
        reason: 'ASR 口播纯文字优化：转换数学符号为自然中文读法、规范小数与分数读音',
      })
    }

    // 契约定案（2026-09-17）：boards 数组优先，旧 board 单对象/字符串兼容归一
    const origBoards = normalizeBoardsField(origRow?.boards, origRow?.board)
    const anchorCount = extractSpeechAnchors(polishedSpeech).length

    const boards = origBoards.map((origBoard, boardIndex) => {
      const origContent = String(origBoard?.content || '')
      const normalizedContent = normalizeBoardContent(origContent)
      if (origContent !== normalizedContent) {
        changes.push({
          row: rowNum,
          field: 'boards',
          before: origContent,
          after: normalizedContent,
          reason: '板书符号规范化：乘法统一为小写 x，规范分数与公式',
        })
      }

      // 有 speech 加粗锚点时锚点是触发真源，startDelay 仅超时兜底，不估算
      if (anchorCount > boardIndex) {
        return { ...origBoard, content: normalizedContent }
      }

      let currentDelay = origBoard?.startDelay
      if (typeof currentDelay === 'number' && currentDelay > 0) {
        // 模型或人工已显式设定兜底时机，保留
      } else if (normalizedContent && stage !== '题目') {
        const estDelay = estimateKeywordStartDelay(polishedSpeech, normalizedContent, stage)
        if (estDelay > 0) {
          changes.push({
            row: rowNum,
            field: 'board_timing',
            before: '+0.0s (开播即显)',
            after: `+${estDelay.toFixed(1)}s`,
            reason: `语义校准板书时机：本块无加粗锚点，结合口播关键词换算 startDelay 兜底约 +${estDelay.toFixed(1)}s 落笔，避免提前剧透并保证音画同步`,
          })
          currentDelay = estDelay
        }
      }

      return {
        ...origBoard,
        content: normalizedContent,
        startDelay: typeof currentDelay === 'number' ? currentDelay : 0,
      }
    })

    // 旧 board 字段已被 boards 数组取代，避免同一行残留两份板书
    const polishedRow = {
      ...origRow,
      stage,
      speech: polishedSpeech,
      boards,
      actionSpec: Array.isArray(origRow?.actionSpec) ? origRow.actionSpec : [],
    }
    delete polishedRow.board
    return polishedRow
  })

  return { rows: polishedRows, changes }
}

/**
 * 兼容旧调用方；实际布局由真实渲染层负责。
 */
export function polishBoardSpacing(rows, changes = []) {
  return { rows: Array.isArray(rows) ? rows : [], changes }
}
