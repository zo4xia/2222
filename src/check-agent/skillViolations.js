/**
 * skillViolations.js — 5 个上游 skill 反模式落地为 Check Agent 校验
 *
 * 来源 skills/：
 *   1. board-zone-layout       → 坐标越界 + 严重叠字
 *   2. handwriting-font-policy → L1 题目层手写体越权
 *   3. hand-action-control     → 工具白名单 + Agent 填时长
 *   4. speech-board-timing     → 口播发音硬规范 (分数/符号/小数)
 *   5. field-char-escape-filter → 字面落板禁令 ($ \left \right &amp; 等)
 *
 * 设计原则（按用户接管方法论）：
 *   - 模块化: 独立文件, 不动现有 contract.js
 *   - 模块调用优先: 复用 5 个 skill 的反模式表, 不重写正则
 *   - 禁止代码膨胀: 只做反模式检测, 不做修复 (修复由 Check Agent 模型做)
 *   - 极简但完整: 每条反模式一行, 无冗余
 *
 * @qh-core LANE=CHECK POINT=SKILL_VIOLATIONS 5 skill 反模式校验
 */

// ─── skill 5: field-char-escape-filter 复用 ─────────
// 字面落板禁令: $ \left \right 控制字符 &amp; &lt; &gt;
// 注意: 不用 /g flag, 避免 .test() 的 lastIndex 状态问题
const FORBIDDEN_LITERAL = [
  { re: /\$+/, from: 'field-char-escape-filter §五', msg: '$ 绝不字面落板' },
  { re: /\\left\b|\\right\b/, from: 'field-char-escape-filter §五', msg: '\\left \\right 绝不字面落板' },
  { re: /&amp;|&lt;|&gt;|&nbsp;/, from: 'field-char-escape-filter §三', msg: 'HTML 实体残留未解码' },
  { re: /[\t\u0008\u000B\u000C]/, from: 'field-char-escape-filter §二②', msg: '控制字符 \\t \\b \\v \\f 绝不字面落板' },
]

// ─── skill 4: speech-board-timing 口播发音硬规范 ─────────
const SPEECH_RULES = [
  // 注: skill §五.1 原正则只匹配阿拉伯数字, 实际口播中文数字也常出现 (三/四), 扩展支持
  { re: /[\d零〇一二两三四五六七八九十百千万亿]+\s*[\/⁄]\s*[\d零〇一二两三四五六七八九十百千万亿]+/, from: 'speech-board-timing §五.1', msg: '口播分数不得用斜杠，写"分母分之分子"' },
  { re: /[xX×]/, from: 'speech-board-timing §五.2', msg: '口播不得保留 x/X/×，未知数写"艾克斯"，乘号写"乘以"' },
  { re: /\+/, from: 'speech-board-timing §五.2', msg: '口播中的 + 必须写成"加"' },
  { re: /\d+\.\d+/, from: 'speech-board-timing §五.3', msg: '口播小数不得保留小数点，写"3点一四"逐位汉字' },
  { re: /\\(?:d?frac|sqrt|text)|\$/, from: 'speech-board-timing §五.2', msg: '口播不得含 KaTeX 命令或 $ 定界符' },
]

// ─── skill 3: hand-action-control 工具白名单 + Agent 不得填时长 ─────────
// ★ Task 43 夏夏拍板「动作 1.0」：白名单收紧为三动作（下划线/横线/画圈），
// highlight / rough-arrow / draw 全砍（「其他做我怕做不好」）
const ALLOWED_TOOLS = new Set(['rough-notation', 'rough-line'])
const ALLOWED_NOTATION_ACTIONS = new Set(['underline', 'circle'])

// ─── skill 2: handwriting-font-policy L1 题目层永久印刷体 ─────────
// board.region === 'question' 时, 不应该有手写体标记 (本题代码层不直接判字体, 留软提示)

// ─── skill 1: board-zone-layout 坐标越界 (百分比 0-100) ─────────
function checkCoordBounds(spec, path) {
  const violations = []
  if (Array.isArray(spec?.start) && (spec.start[0] < 0 || spec.start[0] > 100 || spec.start[1] < 0 || spec.start[1] > 100)) {
    violations.push({ path: path + '.start', from: 'board-zone-layout §一', msg: 'start 坐标必须 0—100 百分比' })
  }
  if (Array.isArray(spec?.end) && (spec.end[0] < 0 || spec.end[0] > 100 || spec.end[1] < 0 || spec.end[1] > 100)) {
    violations.push({ path: path + '.end', from: 'board-zone-layout §一', msg: 'end 坐标必须 0—100 百分比' })
  }
  return violations
}

/**
 * 校验单行 row 的五字段是否违反 5 个 skill 的反模式
 * @param {object} row - {stage, speech, board, actionSpec}
 * @param {number} rowIdx - 0-based 行号
 * @returns {Array<{path, from, msg}>} 违规列表, 空数组 = 合规
 */
export function checkSkillViolations(row, rowIdx = 0) {
  const v = []
  const at = `rows[${rowIdx}]`

  // skill 4: 口播发音硬规范
  const speech = String(row?.speech || '')
  SPEECH_RULES.forEach(rule => {
    if (rule.re.test(speech)) v.push({ path: at + '.speech', from: rule.from, msg: rule.msg })
  })

  // skill 5: 板书字段字面落板禁令
  const rawBoards = Array.isArray(row?.boards) ? row.boards : null
  const boardContent = String(
    row?.board?.content ??
    (rawBoards ? rawBoards.map(b => (b && typeof b === 'object' ? b.content ?? b.text ?? '' : String(b ?? ''))).join('\n') : null) ??
    (typeof row?.board === 'string' ? row.board : '')
  )
  FORBIDDEN_LITERAL.forEach(rule => {
    if (rule.re.test(boardContent)) v.push({ path: at + '.board.content', from: rule.from, msg: rule.msg })
  })

  // skill 3: 动作工具白名单 + Agent 不得填时长
  const specs = Array.isArray(row?.actionSpec) ? row.actionSpec : []
  specs.forEach((spec, i) => {
    // 兼容两种 actionSpec 结构: {tool, action, ...} 或 {action: {tool, action, ...}}
    const action = spec?.action && typeof spec?.action === 'object' ? spec.action : spec
    const tool = action?.tool
    const sat = `${at}.actionSpec[${i}]`

    if (!tool) {
      v.push({ path: sat, from: 'hand-action-control §二', msg: '动作缺少 tool 字段' })
    } else if (!ALLOWED_TOOLS.has(tool)) {
      v.push({ path: sat + '.tool', from: 'hand-action-control §二', msg: `工具 ${tool} 不在白名单（Task 43 动作 1.0：rough-notation/rough-line）` })
    }

    if (tool === 'rough-notation' && action.action && !ALLOWED_NOTATION_ACTIONS.has(action.action)) {
      v.push({ path: sat + '.action', from: 'hand-action-control §三', msg: `rough-notation 动作 ${action.action} 不在白名单（Task 43：underline/circle）` })
    }

    // Agent 不得填时长
    if (action.durationMs != null || action.estimatedDurationMs != null) {
      v.push({ path: sat, from: 'hand-action-control §二', msg: '时长由程序算, Agent 不得填 durationMs/estimatedDurationMs' })
    }
    if (action.gapAfterMs != null && action.gapAfterMs < 600) {
      v.push({ path: sat + '.gapAfterMs', from: 'hand-action-control §一', msg: '抬笔间隔硬下限 600ms' })
    }
    if (action.seed != null) {
      v.push({ path: sat + '.seed', from: 'hand-action-control §二', msg: 'roughjs 随机种子由程序生成, Agent 不得填' })
    }

    // ★ Task 43 动作 1.0：triggerKeyword entry 级逐字校验（口播触发词必须逐字存在于本行 speech）
    // 程序兑底与 Check Agent prompt §8 同口径：miss → 违规报告（编译层自行退串行，不丢动作）
    const kw = spec?.triggerKeyword
    if (typeof kw === 'string' && kw.trim()) {
      const speech = String(row?.speech || '')
      if (!speech.includes(kw)) {
        v.push({ path: sat + '.triggerKeyword', from: 'hand-action-control §六', msg: `触发词 "${kw}" 不在本行 speech 原文中（必须逐字存在，miss 退串行）` })
      }
    }
    // 写错层：triggerKeyword 落在 action 内部会被忽略（entry 级才生效）
    if (action.triggerKeyword != null && spec?.triggerKeyword == null) {
      v.push({ path: sat + '.action.triggerKeyword', from: 'hand-action-control §六', msg: 'triggerKeyword 写在 action 内部会被忽略——它是 entry 级字段（与 action 平级）' })
    }

    // skill 1: 坐标越界
    v.push(...checkCoordBounds(action, sat))
  })

  // skill 2: L1 题目层 region 软提示 (题目区不该有手写体 board content)
  if (row?.board?.region === 'question' && boardContent && boardContent.length > 0) {
    // 读题行 board.content 应为空 (与 board-lecture-player contract §5 对齐)
    v.push({ path: at + '.board.content', from: 'board-lecture-player contract §5 + handwriting-font-policy §二', msg: '题目区 board.content 应为空字符串 (读题行不写板书)' })
  }

  return v
}

/**
 * 批量校验 rows 数组
 * @param {Array} rows
 * @returns {{ok: boolean, violations: Array, summary: string}}
 */
export function auditRowsBySkills(rows) {
  if (!Array.isArray(rows)) return { ok: false, violations: [], summary: 'rows 不是数组' }
  const all = []
  rows.forEach((row, i) => all.push(...checkSkillViolations(row, i)))
  return {
    ok: all.length === 0,
    violations: all,
    summary: `5 skill 反模式校验: ${all.length === 0 ? 'PASS' : 'FAIL'} (${all.length} 违规)`,
  }
}
