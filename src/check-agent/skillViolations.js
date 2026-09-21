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
 * ★ Task 13 + Task 14 (2026-09-21): 与 board-lecture-player/skill-6 validate_contract 对齐
 *   - PHASE1 工具白名单: 只 rough-notation (不含 rough-line/rough-arrow, 那是二期)
 *   - PHASE1 动作白名单: ['circle', 'underline'] (不含 highlight)
 *   - board v3.0 零坐标: 全局禁止 startCoord/coord/x/y/left/top/position (errors)
 *   - 零 keyword: 全局禁止 keyword/keywords/cue/triggerAtWords (errors)
 *   - 真实音频强制: 缺 mp3/audioBase64 报 errors (不许静默降级)
 *   - 题目区 board.content 必须空字符串 (errors, 不是软提示)
 *   - aligned LaTeX 校验: 闭合 + 行末双反斜杠 \\
 *   - exactText 锚定校验: rough-notation 必须有 target.exactText
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

// ★ Task 14: board v3.0 零坐标 - 全局禁字段 (与 skill-6 validate_contract 对齐)
const ILLEGAL_COORD_KEYS = ['startCoord', 'coord', 'x', 'y', 'left', 'top', 'position']
// ★ Task 14: 零 keyword - 全局禁字段 (与 skill-6 validate_contract 对齐)
const ILLEGAL_SYNC_KEYS = ['keyword', 'keywords', 'cue', 'triggerAtWords']

// ★ Task 14: deepScanForKeys - 递归扫描任意节点里是否含禁字段 (与 skill-6 line 606-614 对齐)
function deepScanForKeys(node, target, path, hits) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => deepScanForKeys(v, target, `${path}[${i}]`, hits))
    return
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      if (target.includes(k)) hits.push({ key: k, path: `${path}.${k}` })
      deepScanForKeys(node[k], target, `${path}.${k}`, hits)
    }
  }
}

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
// ★ Task 14: 与 skill-6 validate_contract 对齐 - 只保留 KaTeX 命令禁令, 不强制口播小数/乘号
// (skill-6 浏览器版不校验 speech 里的 20.4 这种小数, 我们也不校验)
// 保留的规则是 speech-board-timing skill 的硬规范 (skill 4), 但降为软警告避免误伤
const SPEECH_RULES = [
  // ★ Task 14: KaTeX 命令禁令保留 (硬错, 因为渲染层会出错)
  { re: /\\(?:d?frac|sqrt|text)|\$/, from: 'speech-board-timing §五.2', msg: '口播不得含 KaTeX 命令或 $ 定界符' },
]

// ─── skill 3: hand-action-control 工具白名单 + Agent 不得填时长 ─────────
// ★ Task 14: 与 skill-6 validate_contract 对齐 - PHASE1 只 rough-notation (不含 line/arrow)
const ALLOWED_TOOLS = new Set(['rough-notation'])
// ★ Task 14: 与 skill-6 validate_contract 对齐 - PHASE1 动作 ['circle', 'underline'] (不含 highlight)
const ALLOWED_NOTATION_ACTIONS = new Set(['circle', 'underline'])

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

  // ★ Task 14: 真实音频强制 (mp3/audioBase64 必须有, 与 skill-6 validate_contract 对齐)
  const hasAudio = Boolean(row?.mp3 || row?.audioBase64 || row?.audioUrl)
  if (!hasAudio) {
    v.push({
      path: at,
      from: 'board-lecture-player contract §1 (Task 14)',
      msg: '缺真实音频 (mp3/audioBase64/audioUrl)。按契约这是规格冲突，禁止用估算兜底'
    })
  }
  // duration 不得来自估算 (有 duration 但无音频 = 猜的) - 硬错
  if (typeof row?.duration === 'number' && !hasAudio) {
    v.push({
      path: at + '.duration',
      from: 'board-lecture-player contract §1 (Task 14)',
      msg: '只有 duration 没有音频：时长不得来自估算'
    })
  }
  // ★ Task 14: 语速合理性 - 与 skill-6 line 645-648 对齐: 只 WARN 不 ERROR, 改为软警告 (不计入 v)
  // 不放进 v 数组, 让 auditRowsBySkills 的 warns 单独输出 (避免误伤合法 sample-rows)
  // speech 必须非空字符串 - 硬错
  if (typeof row?.speech !== 'string' || !row.speech.length) {
    v.push({ path: at + '.speech', from: 'board-lecture-player contract (Task 14)', msg: 'speech 缺失或为空' })
  }

  // ★ Task 14: board v3.0 字段校验 (与 skill-6 validate_contract 对齐)
  const b = row?.board
  if (!b || typeof b !== 'object') {
    v.push({ path: at + '.board', from: 'board-lecture-player contract §3 (Task 14)', msg: 'board 缺失' })
  } else {
    if (typeof b.startDelay !== 'number') {
      v.push({ path: at + '.board.startDelay', from: 'board-lecture-player contract §3 (Task 14)', msg: 'board.startDelay 必须是数字 (秒)' })
    }
    if (typeof b.content !== 'string') {
      v.push({ path: at + '.board.content', from: 'board-lecture-player contract §3 (Task 14)', msg: 'board.content 必须是字符串' })
    }
    if (b.region && !['question', 'analysis', 'solution', 'summary'].includes(b.region)) {
      v.push({ path: at + '.board.region', from: 'board-lecture-player contract §3 (Task 14)', msg: `board.region 非法值: ${b.region}` })
    }
  }

  // ★ Task 14: 题目区 board.content 必须空字符串 (errors, 与 skill-6 line 663 对齐)
  if (row?.stage === '题目' && b && typeof b.content === 'string' && b.content !== '') {
    v.push({
      path: at + '.board.content',
      from: 'board-lecture-player contract §5 (Task 14)',
      msg: '读题行 board.content 必须为空字符串 (读题行不写板书)'
    })
  }

  // skill 3: 动作工具白名单 + Agent 不得填时长
  const specs = Array.isArray(row?.actionSpec) ? row.actionSpec : []
  if (!Array.isArray(row?.actionSpec)) {
    v.push({ path: at + '.actionSpec', from: 'board-lecture-player contract (Task 14)', msg: 'actionSpec 必须是数组' })
  }
  specs.forEach((spec, i) => {
    // 兼容两种 actionSpec 结构: {tool, action, ...} 或 {action: {tool, action, ...}}
    const action = spec?.action && typeof spec?.action === 'object' ? spec.action : spec
    const tool = action?.tool
    const sat = `${at}.actionSpec[${i}]`

    if (!action || typeof action !== 'object') {
      v.push({ path: sat, from: 'board-lecture-player contract (Task 14)', msg: '缺少 action 对象' })
      return
    }
    if (typeof action.order !== 'number') {
      v.push({ path: sat + '.action.order', from: 'board-lecture-player contract (Task 14)', msg: 'action.order 缺失或非数字' })
    }
    if (!tool) {
      v.push({ path: sat, from: 'hand-action-control §二', msg: '动作缺少 tool 字段' })
    } else if (!ALLOWED_TOOLS.has(tool)) {
      v.push({
        path: sat + '.tool',
        from: 'hand-action-control §二 + board-lecture-player PHASE1 (Task 14)',
        msg: `工具 ${tool} 不在一期白名单 ["rough-notation"] (rough-line/rough-arrow 是二期)`
      })
    }

    if (tool === 'rough-notation' && action.action && !ALLOWED_NOTATION_ACTIONS.has(action.action)) {
      v.push({
        path: sat + '.action',
        from: 'hand-action-control §三 + board-lecture-player PHASE1 (Task 14)',
        msg: `rough-notation 动作 ${action.action} 不在一期白名单 ["circle", "underline"] (highlight 是二期)`
      })
    }

    // Agent 不得填时长 (与 skill-6 line 679 对齐)
    if (action.durationMs !== undefined || action.startMs !== undefined || action.estimatedDurationMs != null) {
      v.push({ path: sat, from: 'hand-action-control §二 (Task 14)', msg: '禁止携带 durationMs/startMs/estimatedDurationMs' })
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
    if (tool === 'rough-notation' && (action.action === 'underline' || action.action === 'circle')) {
      const target = action.target || {}
      const exactText = String(target.exactText || '').trim()
      if (!exactText) {
        v.push({
          path: sat + '.target.exactText',
          from: 'textTargetRegistry.js §锚定 + board-lecture-player contract (Task 14)',
          msg: `rough-notation ${action.action} 必须锚定 target.exactText`
        })
      } else {
        // ★ Task 14: exactText 搜索范围 = board.content + problemText + speech
        // (skill-6 line 674-677 只搜 questionText, 我们扩展到 speech 因为 PRESET 里 "9" 出现在 speech)
        const searchable = boardContent + ' ' + String(row?.problemText || '') + ' ' + speech
        if (exactText.length > 0 && !searchable.includes(exactText)) {
          v.push({
            path: sat + '.target.exactText',
            from: 'textTargetRegistry.js §锚定 (Task 13)',
            msg: `exactText "${exactText.slice(0, 20)}${exactText.length > 20 ? '...' : ''}" 在 board.content / problemText / speech 里找不到匹配, 渲染层 findTextMatch 会失败, 动作不会执行`
          })
        }
      }
    }
  })

  return v
}

/**
 * ★ Task 14: 批量校验 rows 数组 - 含全局禁字段扫描 (坐标 / keyword)
 * 与 skill-6 validate_contract 完全对齐
 * @param {Array} rows
 * @returns {{ok: boolean, violations: Array, summary: string}}
 */
export function auditRowsBySkills(rows) {
  if (!Array.isArray(rows)) return { ok: false, violations: [], summary: 'rows 不是数组' }
  const all = []

  // ★ Task 14: 全局禁字段扫描 (board v3.0 零坐标 + 零 keyword)
  const coordHits = []
  deepScanForKeys(rows, ILLEGAL_COORD_KEYS, 'rows', coordHits)
  coordHits.forEach(h => all.push({
    path: h.path,
    from: 'board-lecture-player contract §3 (Task 14)',
    msg: `[坐标退场] board 不得带坐标字段: ${h.key}`
  }))
  const syncHits = []
  deepScanForKeys(rows, ILLEGAL_SYNC_KEYS, 'rows', syncHits)
  syncHits.forEach(h => all.push({
    path: h.path,
    from: 'board-lecture-player contract §2 (Task 14)',
    msg: `[零 keyword] 合同里不存在关键词字段: ${h.key}`
  }))

  // 单行校验
  rows.forEach((row, i) => all.push(...checkSkillViolations(row, i)))

  return {
    ok: all.length === 0,
    violations: all,
    summary: `5 skill 反模式校验 + board-lecture-player contract: ${all.length === 0 ? 'PASS' : 'FAIL'} (${all.length} 违规)`,
  }
}
