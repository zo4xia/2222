---
name: field-char-escape-filter
description: "板书字段字符转义与规范化技巧蒸馏（车同轨·书同文超级过滤器 v2 字库实测校准版）。模型输出经 JSON/LLM 转义后会留下两类损伤：(a) LaTeX 转义损伤 \frac 被吃成 rac/frac；(b) HTML 实体残留 &amp; &times; &nbsp;。叠加手写字体字库实测结论（5/5 可选字体全缺 → ⇒ ≤ ≥ ≠ ≈ × ÷ − ± · √ ° ∠ ⊥ ∥ π ∞ ∵ ∴ ℃ 及全部全角字母数字变体），过滤器输出必须落在「板书安全白名单」内：白名单外一律凑法降级（ASCII 键盘符或中文，如 -> => <= 约 度 角 根号），绝不静默回退印刷体混排。² ³ 保留由渲染层代画（画布小字号上标 / DOM sup span / 纯文本 ^2）。除号一律转 \\frac{分子}{分母}。用于渲染层安全输出 / Check Agent 白名单校验 / 板书落板前统一清洗 / 跨环境（导出日志检索）纯文本兜底。"
version: "2.0.0"
archetype: workflow
trigger: "渲染板书文字/解析 deliverable JSON 板书字段/校验字段是否清洗过/修复 LaTeX 转义损伤/HTML 实体残留/手写体缺字凑法降级/除号转分数/跨环境纯文本降级"
---

# 字段字符转义与规范化（车同轨·书同文超级过滤器 v2）

> *"所有外部 JSON / 画布 / 单页 HTML 的文本统一过「车同轨书同文」超级过滤器：清洗错误转义与多余换行，除号写分数 \\frac{}{}（不写 ÷）、乘号用 x、符号从简用手写体支持的字符凑（-> 约度角根号）、平方立方 ² ³ 由渲染层代画、因为/因此写中文。"*

## 蒸馏合同

`Distill [板书字段字符转义与规范化] as a [workflow] pack so it can help with [渲染层 textContent/innerHTML 安全输出 / Check Agent 白名单校验 / 板书落板前的统一清洗 / 跨环境纯文本兜底], using [src/utils/superFilter.js v2 (唯一真源) + row-player.html tokenizeLine + renderBoardTextHtml + boardTextToPlain], while respecting [输出落在板书安全白名单内 / 白名单外凑法降级绝不回退印刷体 / &amp; 最后解 / $ 绝不字面落板 / 控制字符绝不字面落板 / 除号一律 \frac / ² ³ 渲染层代画不取字形 / 输出 DOM 前 esc].`

---

## 一、为什么需要 superFilter v2

### 1.1 模型输出的两类损伤

模型生成 `deliverable-*.json` 后，板书字段（`board.content`）会经历：
```
LLM 原文 → JSON.stringify 转义 → 传输 → JSON.parse 还原 → 渲染层
                                    ↑
                            这里会留下两类损伤
```

| 损伤类型 | 现象 | 原因 |
|---|---|---|
| **LaTeX 转义损伤** | `\frac{3}{4}` 被吃成 `rac{3}{4}` 或 `frac{3}{4}` | JSON 转义把 `\f` 当成转义符，或 LLM 输出时丢了反斜杠 |
| **HTML 实体残留** | `5 &times; 3` 落板成字面 `&times;` | 从某处剥 HTML 标签后没解码，`&amp;` 二次解码会变成 `<` |

### 1.2 手写字体的真实约束（v2 核心依据：字库实测）

用 fontTools 解析本地 TTF cmap + ZeoSeven CDN 字体 CSS 的 unicode-range，实测全部 5 款可选板书字体（平方乔木 / 韶华 157 / 栗壳坚坚 490 / 三生 510 / 上上签 511）：

| 类别 | 结论 | 字符 |
|---|---|---|
| ✅ **5/5 全支持** | 输出随便用 | ASCII `U+0020-007E`（含 `-> => <= >= x / - ( ) = < > . , %`）、CJK 常用字（`约 度 角 根号 垂直 因此 因为 圆周率 无穷 摄氏度 三角形` 全绿）、中文标点 `，。、；：？！（）《》〈〉【】…—‘’“”「」` |
| ❌ **5/5 全缺** | 输出必缺字回退印刷体 | `→ ⇒ ↔ ≤ ≥ ≠ ≈ ≡ × ÷ − ± · √ ° ∠ ⊥ ∥ π ∞ ∵ ∴ ∈ ∪ ∩ ℃ ‰` 及**全部全角字母数字运算符变体**（Ａｂ１２＝＋） |
| ⚠️ **例外保留** | 渲染层代画 | `² ³`（画布按小字号把「2」「3」画上标位；DOM 转 sup span；纯文本写 `^2 ^3`——三条路都不取 ² ³ 字形） |

> **v2 的核心策略**：过滤器输出必须落在「板书安全白名单」内。白名单外的字符一律**凑法降级**——数学符号用 ASCII 键盘符凑（手写老师本来也这么写板书），语义符号用中文凑——「看起来是那么回事」，且**绝不静默回退印刷体混排**（缺字混排会让整行板书风格断裂）。

### 1.3 字面落板禁令

```
❌ $ 绝不字面落板      （LaTeX 定界符，手写体写不出）
❌ \t \b \v \f 绝不字面落板  （控制字符损伤，统一退化为空格）
❌ &amp; &lt; &gt; 绝不字面落板（HTML 实体残留）
❌ \left \right 绝不字面落板  （LaTeX 定界修饰符，对单层 {} 无意义）
❌ → × ° ∠ ⊥ ∥ π ∞ ∵ ∴ 等缺字符号绝不直接落板（5/5 字体无字形）
❌ Ａｂ１２＝ 等全角变体绝不落板（5/5 字体无字形）
```

### 1.4 V1.0 旧规约冲突裁决（v2 正式接替）

《手写板书文本预处理完整规约 V1.0》为旧版草案，以下 4 处与 v2 方向相反，**以本规约（v2.0.0）为准**：

| # | V1.0 旧规约 | v2 裁决 | 理由 |
|---|---|---|---|
| 1 | 箭头输出 ASCII `->` | ✅ **维持 ASCII** `->` `=>` `<->` | 与 V1.0 一致；字体实测 Unicode 箭头全缺 |
| 2 | 保留 `÷` 字符 | ❌ **反转**：`÷` → `/` → 纯整数升 `\frac{}` | 5/5 字体无 ÷ 字形；小学分数板书本就该上下写 |
| 3 | 平方立方禁止 Unicode ²，必须 `<span class="sup">` 组件 | ❌ **反转**：输出 `² ³`，渲染层代画「2」「3」 | DOM 组件体系已废弃（无外部 CSS 依赖才能跨环境）；画布 tokenizeLine / DOM sup span 双路代画 |
| 4 | `<span class="frac">` / `pm-sym` / `sup` HTML 组件 + 配套 CSS | ❌ **整体废弃**：`\frac{}` DSL 字面 + 各环境原生渲染 | 组件依赖外部 CSS，换环境即错乱；DSL 字面任何环境都「不是错误」，只是降级为 `a/b`（见 §七） |

其余骨架（控制字符退化、实体解码顺序、删 `$ \left \right`、长正则在前、乘号小写 x、U+2212→`-`）V1.0 与 v2 一致，继续有效。

---

## 二、12 步流水线（normalizeBoardLine 全链，顺序不能倒）

```
原始字符串 s
  ↓ ① 真实 \r\n \r 统一为 \n
  ↓ ①' 字面量 \n 还原（只在后面不跟字母时，防打断 \neq \not \nabla）
  ↓ ② 控制字符 \t \b \v \f 退化为空格
  ↓ ③ HTML 实体解码（&amp; 必须最后解；只解码到标准 Unicode）
  ↓ ④ LaTeX 转义损伤修复（\frac 被吃成 rac/frac/换页符+rac）
  ↓ ④' <br>→\n + 白名单格式标签剥除（b/i/u/em/strong/span/div/p/sub/sup/font/bold）
  ↓ ⑤ LaTeX 环境剥壳（\begin/\end、\\、& 对齐符、\( \) \[ \]）+ 删 $ \left \right
  ↓ ⑥ 全角变体归半角（保留全角标点 ！（），：；？）
  ↓ ⑦ Unicode 缺字凑法降级（UNICODE2SAFE：→ × ° ∠ π ∵ …）
  ↓ ⑧ LaTeX → 板书安全凑法（LATEX2SAFE：\times \angle \circ …）
  ↓ ⑨ ^2 ^3 → ² ³（渲染层小字号上标代画，不取 ² ³ 字形）
  ↓ ⑩ 纯整数 a/b → \frac{a}{b}（含小数点/单位/字母分数不误伤）
  ↓ ⑪ 压行内空白（保护前导空格，绝不碰 \n）
  ↓ ⑫ 连续 3+ 换行压缩为 2 个
  ↓
规范化字符串（板书安全白名单内）
```

> **顺序关键**：
> - ②在③之前：先把 `\f` 控制符消掉，避免③把它当普通字符
> - ③的 `&amp;` **最后解**：否则 `&amp;lt;` 会被二次解成 `<`
> - ③只解码到标准 Unicode（`× ÷ − ± °`），缺字凑法统一交给⑦（单一职责，一张表管所有缺字）
> - ④'用**白名单标签**而非 `<[^>]+>`：防止误吃 `3 < x, 5 > x` 这类不等式文本
> - ⑦在⑧之前：Unicode 缺字先降级，再让 LaTeX 命令转出安全字符
> - ⑩在⑪之前：转 `\frac` 后再压空白；`^\circ` 必须先于裸 `\circ`，否则留孤立 `^`

### 2.1 完整代码（唯一真源 src/utils/superFilter.js，93 用例测试覆盖）

```js
function normalizeBoardLine(s){
  let t = String(s == null ? '' : s);
  // ① 真实换行符统一（\r\n / \r → \n）
  t = t.replace(/\r\n|\r/g, '\n');
  // ①' 字面量 \n 还原（后非字母）
  t = t.replace(/\\r\\n/g, '\n').replace(/\\n(?![a-zA-Z])/g, '\n');
  // ② 控制字符退化为空格
  t = t.replace(/[\t\u0008\u000B\u000C]+/g, ' ');
  // ③ HTML 实体解码（&amp; 最后解）
  t = decodeHtmlEntities(t);
  // ④ LaTeX 转义损伤修复
  t = repairCommonLatexEscapeDamage(t);
  // ④' <br>→\n + 白名单标签剥除
  t = t.replace(/<br\s*\/?>/gi, '\n')
       .replace(/<\/?(?:b|i|u|em|strong|span|div|p|sub|sup|font|bold)\b[^>]*>/gi, '');
  // ⑤ 环境剥壳 + 删 $ \left \right
  t = t.replace(/\\(?:begin|end)\s*\{[^}]*\}/g, '')
       .replace(/\\\\/g, '\n')
       .replace(/\\\(|\\\)/g, '')
       .replace(/\\\[|\\\]/g, '')
       .replace(/(^|\n)\s*&\s*(?==)/gm, '$1')
       .replace(/\s*&\s*(?==)/g, '')
       .replace(/\$+/g, '')
       .replace(/\\left\b|\\right\b/g, '');
  // ⑥ 全角变体归半角（全角标点除外）
  t = toHalfwidthVariants(t);
  // ⑦ Unicode 缺字凑法降级
  for (const [re, r] of UNICODE2SAFE) t = t.replace(re, r);
  // ⑧ LaTeX → 板书安全凑法
  for (const [re, r] of LATEX2SAFE) t = t.replace(re, r);
  // ⑨ ^2 ^3 → ² ³（渲染层小字号上标代画）
  t = t.replace(/(\w|\))\^2\b/g, '$1²').replace(/(\w|\))\^3\b/g, '$1³');
  // ⑩ 纯整数除法才升 frac（严禁误伤 183.6/9 含小数点或 a/b 字母分数）
  t = t.replace(/(^|[^\w.])(?<!\.)(\d+)\s*\/\s*(\d+)(?!\.)(?=$|[^\w.])/g, '$1\\frac{$2}{$3}');
  // ⑪ 压行内空白（保护前导空格，绝不碰 \n）
  const lead = (t.match(/^\s*/) || [''])[0];
  const rest = t.slice(lead.length).replace(/[\t ]+/g, ' ').replace(/\s+$/, '');
  t = lead + rest;
  // ⑫ 3+ 换行压 2
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}
```

---

## 三、五张关键表

### 3.1 UNICODE2SAFE（⑦ Unicode 缺字凑法降级）

```js
const UNICODE2SAFE = [
  // 箭头 → ASCII
  [/[\u2192\u21A0\u27F6\u2199\u2190\u27F5]/g, '->'],
  [/\u21D2/g, '=>'],
  [/\u2194/g, '<->'],
  // 关系符 → ASCII
  [/\u2264/g, '<='],  [/\u2265/g, '>='],  [/\u2260/g, '!='],
  [/\u2248/g, '约'],  [/\u2261/g, '恒等于'],
  // 运算符（乘号类统一小写 x；÷ 转 /，纯整数随后升 frac；数学长减号转键盘减号）
  [/[\u00D7\u2715\u2716\u2717\u00B7\u2022\u2219]/g, 'x'],
  [/[\u00F7\u2215]/g, '/'],
  [/\u2212/g, '-'],  [/\u00B1/g, '+-'],  [/\u221A/g, '根号'],
  // 度/单位
  [/\u00B0/g, '度'],  [/\u2103/g, '摄氏度'],  [/\u2030/g, '千分之'],
  // 几何
  [/\u2220/g, '角'],  [/\u22A5/g, '垂直'],  [/[\u2225\u2016]/g, '//'],
  // 希腊/无穷
  [/\u03C0/g, '圆周率'],  [/\u221E/g, '无穷'],
  // 逻辑
  [/\u2234/g, '因此'],  [/\u2235/g, '因为'],  [/\u2208/g, '属于'],
  [/\u222A/g, '并'],  [/\u2229/g, '交'],
  // 破折号变体归一为全角—；全角波浪/竖线转 ASCII
  [/[\u2013\u2012\u2015]/g, '—'],  [/[\uFF5E\u301C]/g, '~'],  [/\uFF5C/g, '|'],
  // 日式引号转中式（『』缺字，「」5/5 支持）
  [/\u300E/g, '「'],  [/\u300F/g, '」'],
]
```

凑法原则：**数学符号用 ASCII 键盘符凑**（手写老师的板书习惯：`->`、`<=`、`//` 两条竖线即平行），**语义符号用中文凑**（`约`、`度`、`角`、`根号`、`因为`、`因此`——小学语境反而更易读）。

### 3.2 LATEX2SAFE（⑧ LaTeX → 板书安全凑法，长命令在前）

```js
const LATEX2SAFE = [
  [/\\rightarrow\b/g, '->'],  [/\\Rightarrow\b/g, '=>'],  [/\\to\b/g, '->'],
  [/\\times\b/g, 'x'],  [/\\div\b/g, '/'],  [/\\cdot\b/g, 'x'],
  // ⚠ ^\circ 先于裸 \circ，否则留孤立 ^
  [/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '度'],  [/\\circ\b/g, '度'],  [/\\degree\b/g, '度'],
  // 平方立方：转 ² ³（渲染层代画，不取字形）
  [/\^\s*(?:\{\s*2\s*\}|2)/g, '²'],
  [/\^\s*(?:\{\s*3\s*\}|3)/g, '³'],
  [/\\angle\b/g, '角'],  [/\\pm\b/g, '+-'],  [/\\perp\b/g, '垂直'],
  [/\\parallel\b/g, '//'],  [/\\triangle\b/g, '三角形'],
  [/\\therefore\b/g, '因此'],  [/\\because\b/g, '因为'],
  [/\\le(?:q)?\b/g, '<='],  [/\\ge(?:q)?\b/g, '>='],  [/\\ne(?:q)?\b/g, '!='],
  [/\\approx\b/g, '约'],  [/\\pi\b/g, '圆周率'],  [/\\infty\b/g, '无穷'],
  [/\\sqrt\s*\{([^}]*)\}/g, '根号$1'],  [/\\sqrt\b/g, '根号'],
]
```

> **顺序坑**：`\rightarrow` 先于 `\to`（防短正则截断）；`^\circ` 先于 `\circ`；`\sqrt{x}` 先于 `\sqrt`。

### 3.3 FW_KEEP + toHalfwidthVariants（⑥ 全角归半角）

```js
const FW_KEEP = new Set(['\uFF01','\uFF08','\uFF09','\uFF0C','\uFF1A','\uFF1B','\uFF1F'])
function toHalfwidthVariants(t) {
  return t.replace(/[\uFF01-\uFF5E]/g, ch => {
    if (FW_KEEP.has(ch)) return ch
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  })
}
```

> 全角标点 `！（），：；？` 保留（自然中文排版且 5/5 支持）；其余全角变体（含全角等号 ＝ 全角斜杠 ／）一律归半角后再走后续步骤。

### 3.4 BOARD_SAFE_RE + findUnsafeChars（Check Agent 白名单校验）

```js
const BOARD_SAFE_RE = /[\u0020-\u007E\u00B2\u00B3\u2014\u2018-\u201D\u2026\u3001\u3002\u3008-\u3011\u4E00-\u9FFF\uFF01\uFF08\uFF09\uFF0C\uFF1A\uFF1B\uFF1F\\{}^]/

function findUnsafeChars(text) {
  const unsafe = new Set()
  for (const ch of String(text)) {
    if (ch === '\n') continue
    if (!BOARD_SAFE_RE.test(ch)) unsafe.add(ch)
  }
  return [...unsafe]
}
```

> 白名单构成：ASCII + ² ³（渲染层代画豁免）+ `—…‘’“”` + 中文标点 + CJK + `\frac` DSL 字符（`\ { } ^`）。**返回空数组 = 全部手写安全**；非空 = 告警清单（不静默丢，提示即缺口）。

### 3.5 STRUCT_MATH（结构数学检测）

```js
const STRUCT_MATH = /\\(?!frac\b)[a-zA-Z]+                      // 残留 LaTeX 命令（非 \frac）
                  | [A-Za-z0-9)\]}]\s*[\^_]\s*\{[^}]+\}        // ^_{...} 多层上下标
                  | [A-Za-z0-9)\]}]\s*[\^_]\s*[A-Za-z0-9]\s*[\^_]/  // 连续上下标
```

> 命中即说明手写字体写不了，需要公式图。当前实现降级为「原样写 + 告警」（提示即缺口清单，不静默丢）。

### 3.6 decodeHtmlEntities（③ HTML 实体解码）

```js
function decodeHtmlEntities(t){
  return t
    .replace(/&times;/g, '×').replace(/&divide;/g, '÷').replace(/&minus;/g, '−')
    .replace(/&plusmn;/g, '±').replace(/&deg;/g, '°').replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥').replace(/&ne;/g, '≠').replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—').replace(/&hellip;/g, '…')
    .replace(/&sup2;/g, '²').replace(/&sup3;/g, '³')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
}
```

> **致命顺序**：`&amp;` 必须最后解，否则 `&amp;lt;` → `&lt;` → `<` 二次解码。
> **v2 职责收窄**：只解码到标准 Unicode（`× ÷ − ± °`），缺字凑法统一交给⑦ UNICODE2SAFE——一张表管所有降级，不在解码处零散替换。

---

## 四、LaTeX 转义损伤修复（repairCommonLatexEscapeDamage）

```
损伤 A: \f 被吃成换页符 \u000c   修复: \u000c\s*rac → \frac
损伤 B: 反斜杠丢了，剩 rac        修复: (^|[^\w\\])rac(?=\s*\{) → $1\frac
损伤 C: 反斜杠丢了，剩 frac        修复: (^|[^\w\\])frac(?=\s*\{) → $1\frac
```

```js
function repairCommonLatexEscapeDamage(t){
  return t
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac');
}
```

> `(^|[^\w\\])` 避免把已有 `\frac` 的 `frac` 部分再改一次；`(?=\s*\{)` 只修后面跟 `{` 的。

---

## 五、\\frac 视觉字数与排版（visualLen + tokenizeLine + readBrace）

`\frac{3}{4}` 在板书上不是字面 8 个字符，而是真排版（分子上、横线、分母下）。视觉字数 = `3 + 4 + 1`（横线）。

```js
function readBrace(s, idx){
  if (s[idx] !== '{') return { text: '', next: idx };
  let depth = 0, k = idx, out = '';
  for (; k < s.length; k++) {
    if (s[k] === '{') depth++;
    else if (s[k] === '}') { depth--; if (depth === 0) { k++; break; } }
    else out += s[k];
  }
  return { text: out, next: k };
}
function tokenizeLine(s){
  const toks = []; let i = 0;
  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const a = readBrace(s, i + 5), b = readBrace(s, a.next);
      toks.push({ frac: { num: a.text, den: b.text } });
      i = b.next;
    } else { toks.push({ ch: s[i] }); i++; }
  }
  return toks;
}
```

> **上标代画**（row-player 画布同款）：tokenize 后 `²` 按 `2`、`³` 按 `3` 小字号（约 0.62 倍）画在基线上方右上角，量宽也按小字号 `2`/`3` 测——**不取 ² ³ 字形**，任何字体都能画。

---

## 六、除号转 \\frac（硬规范）

```
❌ 禁用 ÷（5/5 字体缺字）
❌ 禁用 a/b 平铺斜杠（小学数学不该这么写）
✅ 一律 \frac{分子}{分母}（上下分数排版）
```

```js
t.replace(/(^|[^\w.])(?<!\.)(\d+)\s*\/\s*(\d+)(?!\.)(?=$|[^\w.])/g, '$1\\frac{$2}{$3}')
```

> **不误伤三护**：`(?<!\.)` + `(?!\.)` 护小数（`183.6 / 9` 不拆）；`[^\w.]` 前缀护字母分数（`a/b` 不动）；后视护单位与连续斜杠。

---

## 七、渲染分派：一个输出、三条路（跨环境不错乱的保证）

**这是 v2 解决「换到其他环境不会错误」的核心设计**：过滤器输出唯一（`\frac{}` DSL 字面 + `² ³`），渲染层按环境分派——任何环境都不会报错，最差也只是降级为朴素形态。

| 环境 | 入口函数 | \frac{a}{b} | ² ³ | 依赖 |
|---|---|---|---|---|
| 画布（row-player / RealBoardPreview） | tokenizeLine + rowImage | 真排版：分子上、rough 横线、分母下 | 小字号「2」「3」画上标位 | canvas 2d |
| DOM（lite-player / RealBoardPreview v-html） | renderBoardTextHtml | inline-flex 上下分数 span | `font-size:.65em; vertical-align:super` span（内画 ASCII 数字） | **零外部 CSS**（全 inline style） |
| 纯文本（导出/日志/检索/兜底） | boardTextToPlain | `a/b` | `^2 ^3` | 零 |

```js
const FRAC_HTML = '<span style="display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;margin:0 2px;line-height:1.05;font-size:.82em"><span style="padding:0 3px">$1</span><span style="padding:0 3px;border-top:1.5px solid currentColor">$2</span></span>'
const SUP_MAP = { '²': '2', '³': '3', '¹': '1' }

function renderBoardSegmentHtml(text) {
  const esc = escapeHtmlText(normalizeBoardLine(text))     // 先转义再构建
  return esc
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, FRAC_HTML)
    .replace(/[²³¹]/g, ch => `<span style="font-size:.65em;vertical-align:super;line-height:0;margin-left:1px">${SUP_MAP[ch]}</span>`)
}
function renderBoardTextHtml(text) {
  return String(text == null ? '' : text).split('\n').map(renderBoardSegmentHtml).join('<br>')
}
function boardTextToPlain(text) {
  return normalizeBoardLine(text)
    .replace(/\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1/$2')
    .replace(/²/g, '^2').replace(/³/g, '^3')
}
```

> **为什么 DSL 字面是跨环境最优解**：`\frac{3}{4}` 是纯 ASCII 字符串——任何渲染器拿到它要么画成上下分数（画布/DOM），要么降级 `3/4`（纯文本），**永远不会是错误**。V1.0 的 HTML 组件方案（`<span class="frac">` + 外部 CSS）换环境 CSS 丢失即错乱，已废弃。

> **esc（DOM 字幕最后闸）**：`esc(s) = s.replace(/[&<>]/g, ...)` 只用于 innerHTML 字幕；canvas 板书不需要。renderBoardSegmentHtml 内部已先 escapeHtmlText 再构建标记，v-html 安全。

---

## 八、toBoardLines（数组 / 字符串 / 对象统一入口）

```js
// 形态 A: 字符串 "第一行\n第二行"  形态 B: 数组 ["第一行","第二行"]
// 形态 C: 对象 { content: "..." } / { text: "..." }
function toBoardLines(v){
  if (Array.isArray(v)) {
    return v.map(x => (x && typeof x === 'object') ? (x.content ?? x.text ?? '') : (x ?? ''))
      .flatMap(x => normalizeBoardLine(x).split('\n'))
      .map(l => l.replace(/\s+$/, ''))
      .filter(l => l.trim().length)
  }
  if (v && typeof v === 'object') return toBoardLines(v.content ?? v.text ?? '')
  return String(v == null ? '' : v).split('\n')
    .flatMap(l => normalizeBoardLine(l).split('\n'))
    .map(l => l.replace(/\s+$/, ''))
    .filter(l => l.trim().length)
}
```

---

## 九、与现有 skill 的协同

```
deliverable-*.json
  ↓
toBoardLines(board.content)              ← 本 skill（统一入口）
  ↓
normalizeBoardLine(每行)                  ← 本 skill（12 步过滤）
  ↓ findUnsafeChars → 空数组 = 手写安全 / 非空 = 告警清单
  ↓
tokenizeLine + visualLen                  ← 本 skill（\frac ²³ 代画）
  ↓
rowImage / renderBoardTextHtml / boardTextToPlain   ← 本 skill（三路分派）
  ↓
scheduler.enqueue / hand-action-control / speech-board-timing（400ms/视觉字）
```

镜像副本（改 superFilter.js 必须四处同步，`scripts/test-superFilter.mjs` 哨兵把关）：
`src/utils/superFilter.js`（唯一真源）→ `row-player.html` / `public/row-player.html` / `lite-player.html`

---

## 十、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| 输出 Unicode 数学符号 | `→ × ° ∠ π` 落板缺字回退印刷体，风格断裂 | ⑦ UNICODE2SAFE 凑法降级（-> x 度 角 圆周率） |
| 全角变体直接落板 | `Ａｂ１２＝` 缺字方块 | ⑥ toHalfwidthVariants 归半角 |
| 静默回退印刷体混排 | 缺字字符用系统字体补，整行风格断裂 | 凑法降级，绝不混排 |
| ² ³ 直接取字形 | 缺字（5/5 字体无 ² ³） | 渲染层代画「2」「3」小字号上标 |
| V1.0 的 HTML 组件 + 外部 CSS | 换环境 CSS 丢失即错乱 | DSL 字面 + inline style（§七） |
| `&amp;` 先解 | `&amp;lt;` 变 `<` 二次解码 | `&amp;` 在 decodeHtmlEntities 最后 |
| `\n` 还原不分情况 | `\neq` 被打断成换行 + `eq` | `\\n(?![a-zA-Z])` 负向预查 |
| `$` 落板 | 字面 `$` 在手写体里写不出 | 安全网 `t.replace(/\$+/g, '')` |
| 剥标签用 `<[^>]+>` | `3 < x, 5 > x` 不等式被吞 | ④' 白名单标签 |
| `^\circ` 顺序错 | 留孤立 `^` | `^\circ` 必须先于裸 `\circ` |
| 除号误伤小数 | `183.6 / 9` 被拆坏 | ⑩ `(?<!\.)` + `(?!\.)` 三护 |
| 字幕不 esc | `<script>` 注入 | innerHTML 前 escapeHtmlText |
| 板书 esc 过度 | `&amp;` 字面落 canvas | canvas 不需要 esc，只有 DOM 字幕需要 |
| 改真源不同步镜像 | 四处副本行为不一致 | scripts/test-superFilter.mjs 哨兵（93 用例） |

---

## 十一、快速参考

```
12 步流水线 (顺序不能倒):
  ① \r\n \r → \n        ①' 字面量 \n 还原(后非字母)   ② \t\b\v\f → 空格
  ③ HTML 实体(&amp; 最后)  ④ LaTeX 损伤修复            ④' <br>→\n+白名单标签剥除
  ⑤ 环境剥壳+删$\left\right  ⑥ 全角归半角(保全角标点)  ⑦ 缺字凑法 UNICODE2SAFE
  ⑧ LaTeX 凑法 LATEX2SAFE  ⑨ ^2^3 → ²³(渲染层代画)    ⑩ 纯整数→\frac
  ⑪ 压行内空白(保前导)    ⑫ 3+换行压2

凑法速记:
  -> => <->   <= >= !=   x  /  +-  根号  约  度  摄氏度  角  垂直  //
  圆周率  无穷  因此  因为  属于  并  交  恒等于  三角形

字体实测 (fontTools / CDN unicode-range, 2026-10-12):
  5/5 支持: ASCII + CJK + 中文标点 ，。、；：？！（）《》…—‘’“”「」
  5/5 全缺: → ⇒ ≤ ≥ ≠ ≈ × ÷ − ± · √ ° ∠ ⊥ ∥ π ∞ ∵ ∴ ℃ 全角变体
  代画豁免: ² ³（画布小字号上标 / DOM sup span / 纯文本 ^2 ^3）

三路渲染分派 (跨环境不错乱):
  画布: tokenizeLine 真排版 + 上标代画
  DOM:  renderBoardTextHtml (inline style, 零外部 CSS)
  纯文本: boardTextToPlain (\frac→a/b, ²→^2)

致命顺序:
  &amp; 最后解 / ^\circ 先于 \circ / \sqrt{x} 先于 \sqrt
  \rightarrow 先于 \to / ⑦ Unicode 凑法先于 ⑧ LaTeX 凑法

字面落板禁令:
  $ \t \b \v \f \left \right &amp; &lt; &gt; 及一切白名单外字符

Check Agent:
  findUnsafeChars(text) 空数组 = 手写安全；非空 = 告警清单(不静默丢)

视觉字数:
  visualLen("\frac{3}{4}") = 3+4+1 = 8

镜像同步 (改 superFilter.js 必须四处同步):
  src/utils/superFilter.js → row-player.html / public/row-player.html / lite-player.html
  哨兵: node scripts/test-superFilter.mjs (93 用例)

V1.0 旧规约: 已废止, 冲突裁决见 §1.4 (÷ 一律 frac / ²³ 渲染层代画 / HTML 组件体系废弃)
```
