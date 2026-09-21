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

// ★ Task 13: LaTeX aligned 环境校验规则 (skill 5 + prompt.js §5.1 硬规则)
// 校验 \begin{aligned}...\end{aligned} 闭合 + 行末双反斜杠 \\ 换行
function checkAlignedLatex(content, path) {
  const v = []
  if (!content) return v
  // 1. 闭合校验
  const beginCount = (content.match(/\\begin\{aligned\}/g) || []).length
  const endCount = (content.match(/\\end\{aligned\}/g) || []).length
  if (beginCount !== endCount) {
    v.push({
      path: path,
      from: 'prompt.js §5.1 + field-char-escape-filter §五',
      msg: `aligned 闭合错误: \\begin{aligned} ${beginCount} 个 vs \\end{aligned} ${endCount} 个, 必须配对`
    })
  }
  // 2. 行末双反斜杠校验 (关键: KaTeX 需要 \\ 换行, 单 \ 会失败)
  // 找出所有 aligned 环境内容, 检查每行末尾 (除最后一行) 是否用 \\
  const alignedBlocks = content.match(/\\begin\{aligned\}[^]*?\\end\{aligned\}/g) || []
  alignedBlocks.forEach((block, idx) => {
    // 提取 begin 和 end 之间的内容
    const inner = block.replace(/\\begin\{aligned\}/, '').replace(/\\end\{aligned\}/, '')
    // 按行拆分, 每行末尾 (忽略空白) 必须是 \\ (双反斜杠)
    const lines = inner.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
    if (lines.length > 1) {
      // 检查除最后一行外的每行末尾
      for (let lineIdx = 0; lineIdx < lines.length - 1; lineIdx++) {
        const line = lines[lineIdx]
        // 行末是 \\ 才合法 (允许 & 后空格再 \\)
        if (!/\\\\\s*$/.test(line)) {
          // 进一步检查是不是只有单 \
          if (/\\\s*$/.test(line) && !/\\\\\s*$/.test(line)) {
            v.push({
              path: path,
              from: 'prompt.js §5.1 aligned 硬规则 (Task 13)',
              msg: `aligned 第 ${lineIdx + 1} 行末尾用单反斜杠 \\, 必须用双反斜杠 \\\\ 换行 (KaTeX 解析要求)`
            })
          } else {
            v.push({
              path: path,
              from: 'prompt.js §5.1 aligned 硬规则 (Task 13)',
              msg: `aligned 第 ${lineIdx + 1} 行末尾缺少 \\\\ 换行符, 多行会挤成一行`
            })
          }
          break  // 同一 block 只报一次, 避免噪声
        }
      }
    }
  })
  return v
}

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
const ALLOWED_TOOLS = new Set(['rough-notation', 'rough-line', 'rough-arrow'])
const ALLOWED_NOTATION_ACTIONS = new Set(['underline', 'highlight'])

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
  const boardContent = String(row?.board?.content ?? (typeof row?.board === 'string' ? row.board : ''))
  FORBIDDEN_LITERAL.forEach(rule => {
    if (rule.re.test(boardContent)) v.push({ path: at + '.board.content', from: rule.from, msg: rule.msg })
  })

  // ★ Task 13: LaTeX aligned 环境校验 (闭合 + 行末双反斜杠)
  v.push(...checkAlignedLatex(boardContent, at + '.board.content'))

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
      v.push({ path: sat + '.tool', from: 'hand-action-control §二', msg: `工具 ${tool} 不在白名单 (rough-notation/line/arrow)` })
    }

    if (tool === 'rough-notation' && action.action && !ALLOWED_NOTATION_ACTIONS.has(action.action)) {
      v.push({ path: sat + '.action', from: 'hand-action-control §三', msg: `rough-notation 动作 ${action.action} 不在白名单 (underline/highlight)` })
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

    // skill 1: 坐标越界
    v.push(...checkCoordBounds(action, sat))

    // ★ Task 13: exactText 锚定校验 (rough-notation 必须有 target.exactText, 且必须在 board.content 或 problemText 里出现)
    if (tool === 'rough-notation' && action.action === 'underline') {
      const target = action.target || {}
      const exactText = String(target.exactText || '').trim()
      if (!exactText) {
        v.push({
          path: sat + '.target.exactText',
          from: 'textTargetRegistry.js §锚定 + hand-action-control §三',
          msg: 'rough-notation underline 必须提供 target.exactText (锚定原文)'
        })
      } else {
        // exactText 必须能在本题的板书内容或题目原文里找到 (粗校验, 不算 occurrence)
        // 注意: 这里只能粗校验, 实际锚定由渲染层 textTargetRegistry.findTextMatch 做
        const searchable = boardContent + ' ' + String(row?.problemText || '')
        if (exactText.length > 0 && !searchable.includes(exactText)) {
          v.push({
            path: sat + '.target.exactText',
            from: 'textTargetRegistry.js §锚定 (Task 13)',
            msg: `exactText "${exactText.slice(0, 20)}${exactText.length > 20 ? '...' : ''}" 在 board.content / problemText 里找不到匹配, 渲染层 findTextMatch 会失败, 动作不会执行`
          })
        }
      }
    }
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
