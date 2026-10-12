/**
 * superFilter.js — 车同轨·书同文 12 步过滤流水线（唯一真源）
 *
 * v2 (2026-10-12): 手写字体字库实测校准版
 *   用 fontTools / CDN unicode-range 实测全部 5 款可选手写字体的字符覆盖：
 *   qiaomu(默认本地TTF) / 韶华(157) / 栗壳坚坚(490) / 三生(510) / 上上签(511)
 *   5/5 支持: ASCII U+0020-007E、CJK 常用字、中文标点 ，。、；：？！（）《》〈〉【】…—‘’“”「」
 *   5/5 全缺: → ⇒ ≤ ≥ ≠ ≈ × ÷ − ± · √ ° ∠ ⊥ ∥ π ∞ ∵ ∴ ℃ 及全部全角字母数字变体
 *   结论: 过滤器输出必须落在「字体安全白名单」内，白名单外一律凑法降级
 *   (ASCII 拼凑或中文)，绝不静默回退印刷体混排。
 *   例外: ² ³ 保留输出 —— 画布层按小字号上标画「2」「3」(不取 ² 字形)，
 *         DOM 层由 renderBoardSegmentHtml 转为上标 span，同样不取 ² 字形。
 *
 * 12 步流水线（顺序不能倒）:
 *   ① 真实 \r\n \r 统一为 \n          ①' 字面量 \n 还原（后非字母）
 *   ② 控制字符退化为空格              ③ HTML 实体解码（&amp; 最后）
 *   ④ LaTeX 损伤修复                  ④' <br>→\n + 白名单标签剥除
 *   ⑤ aligned 环境剥壳 + 删 $ \left \right
 *   ⑥ 全角变体归半角（保留全角标点）
 *   ⑦ Unicode 缺字凑法降级            ⑧ LaTeX → 板书安全凑法
 *   ⑨ ^2 ^3 → ² ³（渲染层小字号上标画）
 *   ⑩ 纯整数 a/b → \frac{a}{b}        ⑪ 压行内空白（保前导）
 *   ⑫ 连续 3+ 换行压成 2 个
 *
 * 接入点: RealBoardPreview.vue (B 页画布预览) + AgentBDirect.vue (表格板书列, KaTeX)
 * 镜像副本（改这里必须同步）: row-player.html / public/row-player.html / lite-player.html
 * 一致性哨兵: scripts/test-superFilter.mjs 内含镜像同步检查
 *
 * @qh-core LANE=SHARED POINT=SUPER_FILTER
 */

// ===== ⑦ Unicode 缺字凑法降级表（实测 5/5 字体无字形 → 用支持的字符凑）=====
// 原则: 数学符号用 ASCII 键盘符凑（-> => <= >=），语义符号用中文凑（约/度/角/根号）
const UNICODE2SAFE = [
  // 箭头 → ASCII（几何/流程板书惯例，键盘字符手写体必支持）
  [/[\u2192\u21A0\u27F6\u2199\u2190\u27F5]/g, '->'],
  [/\u21D2/g, '=>'],
  [/\u2194/g, '<->'],
  // 关系符 → ASCII
  [/\u2264/g, '<='],
  [/\u2265/g, '>='],
  [/\u2260/g, '!='],
  [/\u2248/g, '约'],
  [/\u2261/g, '恒等于'],
  // 运算符（乘号类统一小写 x；÷ 转 /，纯整数随后升 \frac；数学长减号转键盘减号）
  [/[\u00D7\u2715\u2716\u2717\u00B7\u2022\u2219]/g, 'x'],
  [/[\u00F7\u2215]/g, '/'],
  [/\u2212/g, '-'],
  [/\u00B1/g, '+-'],
  [/\u221A/g, '根号'],
  // 度/单位
  [/\u00B0/g, '度'],
  [/\u2103/g, '摄氏度'],
  [/\u2030/g, '千分之'],
  // 几何
  [/\u2220/g, '角'],
  [/\u22A5/g, '垂直'],
  [/[\u2225\u2016]/g, '//'],
  // 希腊/无穷
  [/\u03C0/g, '圆周率'],
  [/\u221E/g, '无穷'],
  // 逻辑
  [/\u2234/g, '因此'],
  [/\u2235/g, '因为'],
  [/\u2208/g, '属于'],
  [/\u222A/g, '并'],
  [/\u2229/g, '交'],
  // 破折号变体归一为全角—（5/5 支持）；全角波浪/竖线转 ASCII
  [/[\u2013\u2012\u2015]/g, '—'],
  [/[\uFF5E\u301C]/g, '~'],
  [/\uFF5C/g, '|'],
  // 日式引号转中式（『』全字体缺字，「」5/5 支持）
  [/\u300E/g, '「'],
  [/\u300F/g, '」'],
]

// ===== ⑧ LaTeX → 板书安全凑法（长命令在前，防短正则截断）=====
const LATEX2SAFE = [
  [/\\rightarrow\b/g, '->'],
  [/\\Rightarrow\b/g, '=>'],
  [/\\to\b/g, '->'],
  [/\\times\b/g, 'x'],
  [/\\div\b/g, '/'],
  [/\\cdot\b/g, 'x'],
  // ⚠ ^\circ 先于裸 \circ，否则留孤立 ^
  [/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '度'], [/\\circ\b/g, '度'], [/\\degree\b/g, '度'],
  // 平方立方：转 ² ³（画布层按小字号「2」「3」上标画，不取 ²³ 字形）
  [/\^\s*(?:\{\s*2\s*\}|2)/g, '²'],
  [/\^\s*(?:\{\s*3\s*\}|3)/g, '³'],
  [/\\angle\b/g, '角'],
  [/\\pm\b/g, '+-'],
  [/\\perp\b/g, '垂直'],
  [/\\parallel\b/g, '//'],
  [/\\triangle\b/g, '三角形'],
  [/\\therefore\b/g, '因此'],
  [/\\because\b/g, '因为'],
  [/\\le(?:q)?\b/g, '<='],
  [/\\ge(?:q)?\b/g, '>='],
  [/\\ne(?:q)?\b/g, '!='],
  [/\\approx\b/g, '约'],
  [/\\pi\b/g, '圆周率'],
  [/\\infty\b/g, '无穷'],
  [/\\sqrt\s*\{([^}]*)\}/g, '根号$1'],
  [/\\sqrt\b/g, '根号'],
]

// ===== ⑥ 全角变体归半角（全角字母数字运算符 5/5 字体全缺）=====
// 保留全角标点：！（），：；？（自然中文排版且 5/5 支持）
const FW_KEEP = new Set(['\uFF01', '\uFF08', '\uFF09', '\uFF0C', '\uFF1A', '\uFF1B', '\uFF1F'])
function toHalfwidthVariants(t) {
  return t.replace(/[\uFF01-\uFF5E]/g, ch => {
    if (FW_KEEP.has(ch)) return ch
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  })
}

// ===== 板书安全白名单（findUnsafeChars 校验用）=====
// ASCII + ²³(渲染层小字号画) + —…‘’“” + 中文标点 + CJK + \frac DSL 字符
const BOARD_SAFE_RE = /[\u0020-\u007E\u00B2\u00B3\u2014\u2018-\u201D\u2026\u3001\u3002\u3008-\u3011\u4E00-\u9FFF\uFF01\uFF08\uFF09\uFF0C\uFF1A\uFF1B\uFF1F\\{}^]/

// 结构数学检测：手写字体写不了的 LaTeX 命令（\frac 除外，走画布 frac 排版）
const STRUCT_MATH = /\\(?!frac\b)[a-zA-Z]+|[A-Za-z0-9)\]}]\s*[\^_]\s*\{[^}]+\}|[A-Za-z0-9)\]}]\s*[\^_]\s*[A-Za-z0-9]\s*[\^_]/

// ① LaTeX 转义损伤修复：\frac 被吃成 rac / frac / \u000c+rac
function repairCommonLatexEscapeDamage(t) {
  return t
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac')
}

// ③ HTML 实体解码（⚠ &amp; 必须最后解，否则 &amp;lt; 会被二次解成 <）
// 解码到标准 Unicode，随后的 ⑦ UNICODE2SAFE 统一做缺字凑法（单一职责）
function decodeHtmlEntities(t) {
  return t
    .replace(/&times;/g, '×').replace(/&divide;/g, '÷').replace(/&minus;/g, '−')
    .replace(/&plusmn;/g, '±').replace(/&deg;/g, '°').replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥').replace(/&ne;/g, '≠').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&hellip;/g, '…')
    .replace(/&sup2;/g, '²').replace(/&sup3;/g, '³')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * normalizeBoardLine — 12 步过滤流水线，单行板书清洗（v2 字库实测校准版）
 * @param {string} s 原始板书行
 * @returns {string} 规范化后的板书行（手写字体安全白名单内）
 */
export function normalizeBoardLine(s) {
  let t = String(s == null ? '' : s)

  // ① 真实换行符统一（\r\n / \r → \n）
  t = t.replace(/\r\n|\r/g, '\n')
  // ①' 字面量 \n 还原（只在后面不跟字母时，否则打断 \neq \not \nabla）
  t = t.replace(/\\r\\n/g, '\n').replace(/\\n(?![a-zA-Z])/g, '\n')
  // ② 控制字符 \t \b \v \f 退化为空格
  t = t.replace(/[\t\u0008\u000B\u000C]+/g, ' ')
  // ③ HTML 实体解码（&amp; 最后解）
  t = decodeHtmlEntities(t)
  // ④ LaTeX 损伤修复
  t = repairCommonLatexEscapeDamage(t)
  // ④' HTML 标签剥除：<br> 还原为换行；其余只剥已知格式标签
  //     ⚠ 用白名单标签而非 <[^>]+>：防止误吃 "3 < x, 5 > x" 这类不等式文本
  t = t
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:b|i|u|em|strong|span|div|p|sub|sup|font|bold)\b[^>]*>/gi, '')
  // ⑤ LaTeX 环境与定界符剥壳：\begin/\end、\\ 换行、& 对齐符、\(\) \[\]
  t = t
    .replace(/\\(?:begin|end)\s*\{[^}]*\}/g, '')
    .replace(/\\\\/g, '\n')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    .replace(/(^|\n)\s*&\s*(?==)/gm, '$1')
    .replace(/\s*&\s*(?==)/g, '')
  // ⑤' 删 $ \left \right（绝不字面落板）
  t = t.replace(/\$+/g, '').replace(/\\left\b|\\right\b/g, '')
  // ⑥ 全角变体归半角（全角标点除外）
  t = toHalfwidthVariants(t)
  // ⑦ Unicode 缺字凑法降级（5/5 字体无字形的字符 → ASCII/中文凑法）
  for (const [re, r] of UNICODE2SAFE) t = t.replace(re, r)
  // ⑧ LaTeX → 板书安全凑法
  for (const [re, r] of LATEX2SAFE) t = t.replace(re, r)
  // ⑨ ^2 ^3 → ² ³（画布层按小字号「2」「3」上标画；DOM 层转 sup span）
  t = t.replace(/(\w|\))\^2\b/g, '$1²').replace(/(\w|\))\^3\b/g, '$1³')
  // ⑩ 纯整数除法才转换为上下分数，严禁误伤含小数点的数字（183.6 / 9）或单位
  t = t.replace(/(^|[^\w.])(?<!\.)(\d+)\s*\/\s*(\d+)(?!\.)(?=$|[^\w.])/g, '$1\\frac{$2}{$3}')
  // ⑪ 压行内空白（保护前导空格供竖式与横线对齐，绝不碰 \n）
  const lead = (t.match(/^\s*/) || [''])[0]
  const rest = t.slice(lead.length).replace(/[\t ]+/g, ' ').replace(/\s+$/, '')
  t = lead + rest
  // ⑫ 连续 3 个及以上换行压缩为 2 个（空行泛滥治理）
  t = t.replace(/\n{3,}/g, '\n\n')
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
      .map(l => l.replace(/\s+$/, ''))
      .filter(l => l.trim().length)
  }
  if (v && typeof v === 'object') return toBoardLines(v.content ?? v.text ?? '')
  return String(v == null ? '' : v)
    .split('\n')
    .flatMap(l => normalizeBoardLine(l).split('\n'))
    .map(l => l.replace(/\s+$/, ''))
    .filter(l => l.trim().length)
}

/**
 * isStructMath — 检测一行是否含结构数学（手写体写不了，需要公式图）
 */
export function isStructMath(line) {
  return STRUCT_MATH.test(line)
}

/**
 * findUnsafeChars — 找出白名单外的字符（Check Agent / 渲染层校验用）
 * 白名单 = 5/5 手写字体实测支持 + 渲染层代画的 ² ³ + \frac DSL 字符
 * @returns {string[]} 去重后的不安全字符列表（空数组 = 全部手写安全）
 */
export function findUnsafeChars(text) {
  const unsafe = new Set()
  for (const ch of String(text)) {
    if (ch === '\n') continue
    if (!BOARD_SAFE_RE.test(ch)) unsafe.add(ch)
  }
  return [...unsafe]
}

/**
 * boardTextToPlain — 板书文本降级为最朴素的纯文本（跨环境兜底）
 * \frac{a}{b} → a/b；² ³ → ^2 ^3。用于无渲染器的环境（导出、日志、检索等），
 * 保证任何环境下都「不错误」，只是不再是上下分数排版。
 */
export function boardTextToPlain(text) {
  return normalizeBoardLine(text)
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2')
    .replace(/²/g, '^2').replace(/³/g, '^3')
}

// ===== DOM 渲染段（RealBoardPreview / lite-player 镜像共用逻辑）=====
// 全部 inline style，不依赖任何外部 CSS —— 换环境不会错。
// ² ³ 转为小字号上标 span（内画 ASCII 数字，不取 ² ³ 字形）。
const FRAC_HTML = '<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 2px;line-height:1.05;font-size:.82em"><span style="padding:0 3px">$1</span><span style="padding:0 3px;border-top:1.5px solid currentColor">$2</span></span>'
const SUP_MAP = { '²': '2', '³': '3', '¹': '1' }

/**
 * renderBoardSegmentHtml — 单行板书 → 安全 HTML 片段（v-html 用）
 * 先转义再构建标记；\frac → 上下分数 inline-flex；² ³ → 上标 span。
 */
export function renderBoardSegmentHtml(text) {
  const esc = escapeHtmlText(normalizeBoardLine(text))
  return esc
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, FRAC_HTML)
    .replace(/[²³¹]/g, ch => (
      `<span style="font-size:.65em;vertical-align:super;line-height:0;margin-left:1px">${SUP_MAP[ch]}</span>`
    ))
}

/**
 * renderBoardTextHtml — 多行板书 → 安全 HTML（换行转 <br>）
 */
export function renderBoardTextHtml(text) {
  return String(text == null ? '' : text)
    .split('\n')
    .map(l => renderBoardSegmentHtml(l))
    .join('<br>')
}

// ponytail: 唯一真源 — row-player.html / public/row-player.html / lite-player.html 镜像此文件，
// scripts/test-superFilter.mjs 里有镜像一致性哨兵，改这里必须跑测试同步三处副本。
