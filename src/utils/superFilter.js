/**
 * superFilter.js — 车同轨·书同文 10 步过滤流水线（唯一真源）
 *
 * ponytail: 从 row-player.html L648-716 抽出，Vue 项目 src/ 与 row-player.html 共用。
 * 当前接入点: RealBoardPreview.vue (B 页画布预览) + AgentBDirect.vue (表格板书列渲染)
 * 未接入: BoardContentLayer.vue (Step1 题目文本, 不需要过滤) / mathText.js (未用)
 *
 * 10 步流水线（顺序不能倒）:
 *   ① \n 还原（后非字母）   ② 控制字符退化为空格
 *   ③ HTML 实体解码         ④ LaTeX 损伤修复
 *   ⑤ 删 $ \left \right     ⑥ 手写体缺字降级 (×→x ÷→/ ∴→因此)
 *   ⑦ LaTeX → Unicode       ⑧ 角标 x²→x² x³→x³
 *   ⑨ 除号 → \frac{a}{b}    ⑩ 压行内空白
 *
 * @qh-core LANE=SHARED POINT=SUPER_FILTER
 */

// 手写体缺字降级表：× → x；÷ → /；∴ → 因此；∵ → 因为；− → -
const GLYPH2COMMON = [
  [/[\u00D7\u2715\u2716\u2717]/g, 'x'],
  [/[\u00F7\u2215]/g, '/'],
  [/\u2212/g, '-'],
  [/\u2234/g, '因此'],
  [/\u2235/g, '因为'],
]

// LaTeX → Unicode 映射（⚠ 顺序敏感：^\circ 先于 \circ，\sqrt{x} 先于 \sqrt）
const LATEX2U = [
  // ★ Task 23 修正: \times/\div 后面紧跟数字时 \b 不匹配 (如 \times20.4), 改用 (?=\d|\s|$|[^a-zA-Z]) 前瞻
  [/\\times(?=\d|\s|$|[^a-zA-Z])/g, 'x'], [/\\div(?=\d|\s|$|[^a-zA-Z])/g, '/'], [/\\cdot\b/g, '·'],
  [/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°'], [/\\circ\b/g, '°'], [/\\degree\b/g, '°'],
  [/\^\s*(?:\{\s*2\s*\}|2)/g, '²'], [/\^\s*(?:\{\s*3\s*\}|3)/g, '³'],
  [/\\angle\b/g, '∠'], [/\\pm\b/g, '±'], [/\\perp\b/g, '⊥'], [/\\parallel\b/g, '∥'],
  [/\\triangle\b/g, '三角形'], [/\\therefore\b/g, '因此'], [/\\because\b/g, '因为'],
  [/\\le(?:q)?\b/g, '≤'], [/\\ge(?:q)?\b/g, '≥'], [/\\ne(?:q)?\b/g, '≠'], [/\\approx\b/g, '≈'],
  [/\\pi\b/g, 'π'], [/\\infty\b/g, '∞'], [/\\sqrt\s*\{([^}]*)\}/g, '√$1'], [/\\sqrt\b/g, '√'],
  [/\\rightarrow\b/g, '→'], [/\\Rightarrow\b/g, '⇒'], [/\\to\b/g, '→'],
  // ★ Task 20: 兜底处理 Agent B LLM 输出里不该出现的 LaTeX 命令
  //   \text{xxx} → xxx (Agent B 应该直接写中文, 不该用 \text 包装)
  //   \quad / \, / \; / \!  → 空格 (LaTeX 间距命令, 手写体直接用空格)
  //   \, → 空格, \; → 空格, \! → 空, \: → 空格
  [/\\text\s*\{([^}]*)\}/g, '$1'],
  [/\\quad\b/g, ' '], [/\\qquad\b/g, '  '],
  [/\\,/g, ' '], [/\\;/g, ' '], [/\\:/g, ' '], [/\\!/g, ''],
  // \displaystyle / \dfrac / \tfrac → \frac (统一分数命令)
  [/\\displaystyle\s+/g, ''], [/\\dfrac\s*\{/g, '\\frac{'], [/\\tfrac\s*\{/g, '\\frac{'],
]

// 结构数学检测：手写字体写不了的 LaTeX 命令
const STRUCT_MATH = /\\(?!frac\b)[a-zA-Z]+|[A-Za-z0-9)\]}]\s*[\^_]\s*\{[^}]+\}|[A-Za-z0-9)\]}]\s*[\^_]\s*[A-Za-z0-9]\s*[\^_]/

// ① LaTeX 转义损伤修复：\frac 被吃成 rac / frac / \u000c+rac
function repairCommonLatexEscapeDamage(t) {
  return t
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac')
}

// ② HTML 实体解码（⚠ &amp; 必须最后解，否则 &amp;lt; 会被二次解成 <）
function decodeHtmlEntities(t) {
  return t
    .replace(/&times;/g, 'x').replace(/&divide;/g, '/').replace(/&minus;/g, '-')
    .replace(/&plusmn;/g, '±').replace(/&deg;/g, '°').replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥').replace(/&ne;/g, '≠').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&hellip;/g, '…')
    .replace(/&sup2;/g, '²').replace(/&sup3;/g, '³')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

/**
 * normalizeBoardLine — 10 步过滤流水线，单行板书清洗
 * @param {string} s 原始板书行
 * @returns {string} 规范化后的板书行
 */
export function normalizeBoardLine(s) {
  let t = String(s == null ? '' : s)

  // ① 字面量 \n 还原（只在后面不跟字母时，否则打断 \neq \not \nabla）
  t = t.replace(/\\r\\n/g, '\n').replace(/\\n(?![a-zA-Z])/g, '\n')
  // ② 控制字符 \t \b \v \f 退化为空格
  t = t.replace(/[\t\u0008\u000B\u000C]+/g, ' ')
  // ③ HTML 实体解码（&amp; 最后解）
  t = decodeHtmlEntities(t)
  // ④ LaTeX 损伤修复
  t = repairCommonLatexEscapeDamage(t)
  // ⑤ LaTeX 环境与定界符剥壳：\begin{aligned}/\end{aligned}、\\ 换行、& 对齐符、\(\) \[\]
  //    （渲染层没有 KaTeX，prompt 让模型用 aligned 排版 → 统一剥壳成普通板书行，绝不字面落板）
  //    ⚠ & 对齐符只在 aligned 环境内出现, 但 step③ 已把 &amp; 解码成 &
  //    所以先删 aligned 的 &（紧跟在字母/数字/表达式后面的 &，用于对齐）
  //    再删剩余的 \begin/\end/\\/\(/\)/\[/\] 定界符
  t = t
    .replace(/\\(?:begin|end)\s*\{[^}]*\}/g, '')
    .replace(/\\\\/g, '\n')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    // 只删 LaTeX aligned 对齐符: 行首 & 或 & 后跟 = (如 S &= ...), 不删普通文字里的 &
    .replace(/(^|\n)\s*&\s*(?==)/gm, '$1')
    .replace(/\s*&\s*(?==)/g, '')
  // ⑥ 删 $ \left \right（绝不字面落板）
  t = t.replace(/\$+/g, '').replace(/\\left\b|\\right\b/g, '')
  // ⑥ 手写体缺字降级（先跑）
  for (const [re, s2] of GLYPH2COMMON) t = t.replace(re, s2)
  // ⑦ LaTeX → Unicode
  for (const [re, s2] of LATEX2U) t = t.replace(re, s2)
  // ⑧ 角标 x^2 → x², x^3 → x³
  t = t.replace(/(\w|\))\^2\b/g, '$1²').replace(/(\w|\))\^3\b/g, '$1³')
  // ⑨ 除号 a/b → \frac{a}{b}
  t = t.replace(/(^|[^\w./\\{])([A-Za-z]|\d+)\s*\/\s*([A-Za-z]|\d+)(?=$|[^\w./])/g, '$1\\frac{$2}{$3}')
  // ⑩ 压行内空白（绝不碰 \n）
  t = t.replace(/[\t ]+/g, ' ').trim()
  return t
}

/**
 * toBoardLines — 板书字段（字符串/数组/对象）统一过滤 → 一行一个的行数组
 */
export function toBoardLines(v) {
  if (Array.isArray(v)) {
    return v
      .map(x => (x && typeof x === 'object') ? (x.content ?? x.text ?? '') : (x ?? ''))
      .flatMap(x => normalizeBoardLine(x).split('\n'))
      .map(l => l.trim())
      .filter(l => l.length)
  }
  if (v && typeof v === 'object') return toBoardLines(v.content ?? v.text ?? '')
  return String(v == null ? '' : v)
    .split('\n')
    .flatMap(l => normalizeBoardLine(l).split('\n'))
    .map(l => l.trim())
    .filter(l => l.length)
}

/**
 * isStructMath — 检测一行是否含结构数学（手写体写不了，需要公式图）
 */
export function isStructMath(line) {
  return STRUCT_MATH.test(line)
}

// ponytail: 唯一真源 — row-player.html + BoardContentLayer + RealBoardPreview + mathText 都 import 这个
