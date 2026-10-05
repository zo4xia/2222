/* @qh-core LANE=B-V2 POINT=SKILL_BOARD_LECTURE 板书排版标准化规范 skill
 *
 * 双重定位：
 *   1. Prompt skill — buildSystemPrompt() 返回规则全文，注入 Agent B system prompt
 *   2. 程序函数库 — lib/ 下 3 个纯函数供渲染层/Check Agent 调用
 *      - normalizeBoardSymbols: 符号规范化策略（运行时真源为 superFilter.js）
 *      - estimateCapacity: 容量估算（给定区域宽度/字号/行高 → 占行数/总高度）
 *      - decideLayout: 布局决策（normal/compact/twocolumn/overflow 四级优先级）
 *
 * 与现有模块的关系：
 *   不修改 boardLayout.js / superFilter.js / contract.js；
 *   lib 函数 import stepHandoff.js 画布参数（唯一真源），
 *   调用方从 boardLayout.js BOARD_LAYOUT 传入实际区域宽高。
 */
let RULES_MD = ''
try { RULES_MD = (await import('./rules.md?raw')).default } catch {
  try {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const { dirname, resolve } = await import('node:path')
    const __dirname = dirname(fileURLToPath(import.meta.url))
    RULES_MD = readFileSync(resolve(__dirname, 'rules.md'), 'utf8')
  } catch { RULES_MD = '' }
}

const INLINE_RULES = `# 板书排版标准化规范（内联兜底）
## 6 步流程
1. 符号规范化（20 条替换，长匹配优先）
2. 容量估算（floor/ceil 公式）
3. 布局决策（4 级优先级 normal→twocolumn→compact→overflow）
4. 落点排版（boardLayout.js 游标累加）
5. 渲染清洗（superFilter.js 10 步流水线）
6. 重叠检测（游标单调递增）
## 画布参数（stepHandoff.js 唯一真源）
- 画布 1726×980
- 题目 30px / 板书 38px（最低 36px）
- 行高 1.7（板书均值）/ 1.65（题目）
## 五条铁律
1. 一次只写一处 2. 板书字不能小 3. 分析区红色 4. 排版紧凑 5. 只画题目要求的内容`

export const boardLecture = {
  id: 'board-lecture',
  name: '板书排版标准化规范（6 步流程 + 容量估算 + 布局决策）',
  description: '标准化板书排版规范，不依赖题型。含 6 步流程（每步入参出参清晰）+ 3 个纯函数 + 20 条符号规则',
  buildSystemPrompt() {
    return [
      '# 板书排版标准化规范 skill',
      '',
      '> 标准化板书排版规范，不依赖具体题型。',
      '> 含 6 步流程（每步入参出参清晰）+ 3 个纯函数 + 20 条符号规则。',
      '> 程序函数可在渲染前自动校验和修正布局，不依赖人工。',
      '',
      '---',
      '',
      RULES_MD || INLINE_RULES,
    ].join('\n')
  },
}
