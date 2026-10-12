---
name: field-char-escape-filter
description: "板书字段字符转义与规范化技巧蒸馏（车同轨·书同文超级过滤器）。模型输出经 JSON/LLM 转义后会留下两类损伤：(a) LaTeX 转义损伤 \frac 被吃成 rac/frac；(b) HTML 实体残留 &amp; &times; &nbsp;。再叠加手写体缺字降级（× → x、÷ → /、∵ ∴ → 中文）、LaTeX → Unicode 映射（\times → x、\sqrt{x} → √x、\pi → π）、除号一律转 \frac{分子}{分母}、$ 绝不字面落板、控制字符 \t \b \v \f 退化为空格。最终 esc() 函数把 & < > 转义为 HTML 实体安全插入字幕 DOM。用于渲染层 textContent/innerHTML 安全输出 / Check Agent 校验字段是否过过滤器 / 字幕与板书落板前的统一清洗。"
version: "1.0.0"
archetype: workflow
trigger: "渲染板书文字/写字幕/解析 deliverable JSON 板书字段/校验字段是否清洗过/修复 LaTeX 转义损伤/HTML 实体残留/手写体缺字降级/除号转分数"
---

# 字段字符转义与规范化（车同轨·书同文超级过滤器）

> *"所有外部 JSON / 画布 / 单页 HTML 的文本统一过「车同轨书同文」超级过滤器：清洗错误转义与多余换行，除号写分数 \\frac{}{}（不写 ÷）、乘号用 x、平方立方用 ² ³、因为/因此写中文。"*

## 蒸馏合同

`Distill [板书字段字符转义与规范化] as a [workflow] pack so it can help with [渲染层 textContent/innerHTML 安全输出 / Check Agent 校验字段是否过过滤器 / 字幕与板书落板前的统一清洗], using [public/lite-player.html §5c normalizeBoardLine + §6 esc + §2 visualLen + §6 tokenizeLine/readBrace], while respecting [LaTeX 转义损伤先修再规范化 / HTML 实体 &amp; 最后解 / $ 绝不字面落板 / 控制字符绝不字面落板 / 手写体缺字降级优先 / 除号一律 \frac / 输出 DOM 前 esc].`

---

## 一、为什么需要 superFilter

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

### 1.2 手写体的真实约束

平方乔木体（LikeJianJianTi / Qinghuabu Qiaomu）字库覆盖不全：
- ❌ `×` `÷` `∵` `∴` `−` 缺字
- ✅ 需降级为 ASCII 或中文：`×` → `x`、`÷` → `/`（再升为 `\frac`）、`∵` → `因为`、`∴` → `因此`、`−` → `-`

### 1.3 字面落板禁令

```
❌ $ 绝不字面落板      （LaTeX 定界符，手写体写不出）
❌ \t \b \v \f 绝不字面落板  （控制字符损伤，统一退化为空格）
❌ &amp; &lt; &gt; 绝不字面落板（HTML 实体残留）
❌ \left \right 绝不字面落板  （LaTeX 定界修饰符，对单层 {} 无意义）
```

---

## 二、过滤器流水线（normalizeBoardLine 全链）

### 2.1 处理顺序（顺序不能倒）

```
原始字符串 s
  ↓ ① 字面量 \n 还原为换行（只在后面不跟字母时）
  ↓ ② 控制字符 \t \b \v \f 退化为空格
  ↓ ③ HTML 实体解码（&amp; 必须最后解）
  ↓ ④ LaTeX 转义损伤修复（\frac 被吃成 rac/frac）
  ↓ ⑤ 安全网：删除 $ \left \right
  ↓ ⑥ 手写体缺字降级（GLYPH2COMMON）
  ↓ ⑦ LaTeX → Unicode 映射（LATEX2U）
  ↓ ⑧ x^2 / x^3 → x² / x³
  ↓ ⑨ 除号 a/b → \frac{a}{b}
  ↓ ⑩ 压行内空白（绝不碰 \n）
  ↓
规范化字符串
```

> **顺序关键**：
> - ②在③之前：先把 `\f` 控制符消掉，避免③把它当普通字符
> - ③在④之前：HTML 实体可能含 `&`，先解码避免和④的 `\frac` 冲突
> - ③的 `&amp;` **最后解**：否则 `&amp;lt;` 会被二次解成 `<`
> - ④在⑤之前：先修复 `\frac`，再删 `$`（`\frac` 不依赖 `$`）
> - ⑥在⑦之前：缺字降级先把 `×` → `x`，再让 LaTeX 的 `\times` → `x`，避免重复处理
> - ⑨在⑩之前：转 `\frac` 后再压空白

### 2.2 完整代码（已验证）

```js
function normalizeBoardLine(s){
  let t = String(s == null ? '' : s);

  // ① 字面量 \n 还原为换行（只在后面不跟字母时，否则会把 \neq \not \nabla 打断）
  t = t.replace(/\\r\\n/g, '\n')
       .replace(/\\n(?![a-zA-Z])/g, '\n');

  // ② 控制字符退化为空格
  t = t.replace(/[\t\u0008\u000B\u000C]+/g, ' ');

  // ③ HTML 实体解码（&amp; 必须最后解）
  t = decodeHtmlEntities(t);

  // ④ LaTeX 转义损伤修复
  t = repairCommonLatexEscapeDamage(t);

  // ⑤ 安全网：$ \left \right 绝不字面落板
  t = t.replace(/\$+/g, '')
       .replace(/\\left\b|\\right\b/g, '');

  // ⑥ 手写体缺字降级（先跑，把 × ÷ ∵ ∴ 等降级）
  for (let i = 0; i < GLYPH2COMMON.length; i++)
    t = t.replace(GLYPH2COMMON[i][0], GLYPH2COMMON[i][1]);

  // ⑦ LaTeX → Unicode 映射
  for (let i = 0; i < LATEX2U.length; i++)
    t = t.replace(LATEX2U[i][0], LATEX2U[i][1]);

  // ⑧ 平方立方角标
  t = t.replace(/(\w|\))\^2\b/g, '$1²')
       .replace(/(\w|\))\^3\b/g, '$1³');

  // ⑨ 除号一律 \frac{分子}{分母}（禁用 ÷ 与 a/b 平铺斜杠）
  t = t.replace(/(^|[^\w./\\{])([A-Za-z]|\d+)\s*\/\s*([A-Za-z]|\d+)(?=$|[^\w./])/g,
                '$1\\frac{$2}{$3}');

  // ⑩ 压行内空白（绝不碰 \n）
  t = t.replace(/[\t ]+/g, ' ').trim();

  return t;
}
```

---

## 三、四张关键表

### 3.1 GLYPH2COMMON（手写体缺字降级）

| 原字符 | 降级为 | Unicode |
|---|---|---|
| `×` `✕` `✖` `✗` | `x` | `\u00D7 \u2715 \u2716 \u2717` |
| `÷` `∕` | `/` | `\u00F7 \u2215` |
| `−`（U+2212 minus sign） | `-`（半角减号） | `\u2212` |
| `∴` | `因此` | `\u2234` |
| `∵` | `因为` | `\u2235` |

### 3.2 LATEX2U（LaTeX → Unicode 映射）

```js
[/\\times\b/g, 'x'],      [/\\div\b/g, '/'],       [/\\cdot\b/g, '·'],
[/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°'],  // ^\circ 必须先于裸 \circ
[/\\circ\b/g, '°'],       [/\\degree\b/g, '°'],
[/\^\s*(?:\{\s*2\s*\}|2)/g, '²'],
[/\^\s*(?:\{\s*3\s*\}|3)/g, '³'],
[/\\angle\b/g, '∠'],      [/\\pm\b/g, '±'],
[/\\perp\b/g, '⊥'],        [/\\parallel\b/g, '∥'],
[/\\triangle\b/g, '三角形'],
[/\\therefore\b/g, '因此'],[/\\because\b/g, '因为'],
[/\\le(?:q)?\b/g, '≤'],    [/\\ge(?:q)?\b/g, '≥'],
[/\\ne(?:q)?\b/g, '≠'],    [/\\approx\b/g, '≈'],
[/\\pi\b/g, 'π'],          [/\\infty\b/g, '∞'],
[/\\sqrt\s*\{([^}]*)\}/g, '√$1'],  [/\\sqrt\b/g, '√'],
[/\\rightarrow\b/g, '→'],  [/\\Rightarrow\b/g, '⇒'],
[/\\to\b/g, '→']
```

> **顺序坑**：`^\circ` 必须先于裸 `\circ`，否则会留下孤立 `^`。
> **顺序坑**：`\sqrt{x}` 必须先于裸 `\sqrt`，否则会留下孤立 `√`。

### 3.3 STRUCT_MATH（结构数学检测）

```js
const STRUCT_MATH = /\\(?!frac\b)[a-zA-Z]+                      // 残留 LaTeX 命令（非 \frac）
                  | [A-Za-z0-9)\]}]\s*[\^_]\s*\{[^}]+\}        // ^_{...} 多层上下标
                  | [A-Za-z0-9)\]}]\s*[\^_]\s*[A-Za-z0-9]\s*[\^_]/;  // 连续上下标
```

> 命中即说明手写字体写不了，需要公式图。当前实现降级为「原样写 + 告警」（提示即缺口清单，不静默丢）。

### 3.4 decodeHtmlEntities（HTML 实体解码）

```js
function decodeHtmlEntities(t){
  return t
    .replace(/&times;/g, 'x').replace(/&divide;/g, '/')
    .replace(/&minus;/g, '-').replace(/&plusmn;/g, '±')
    .replace(/&deg;/g, '°').replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥').replace(/&ne;/g, '≠')
    .replace(/&middot;/g, '·').replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…').replace(/&sup2;/g, '²')
    .replace(/&sup3;/g, '³').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');   // ⚠ &amp; 必须最后解
}
```

> **致命顺序**：`&amp;` 必须最后解。如果先解 `&amp;` → `&`，那 `&amp;lt;` 就会变成 `&lt;` 再变成 `<`，二次解码错误。

---

## 四、LaTeX 转义损伤修复（repairCommonLatexEscapeDamage）

### 4.1 三种典型损伤

```
损伤 A: \f 被吃成换页符 \u000c
  原文:  \frac{3}{4}
  损伤:  <0x0C>rac{3}{4}          (\f = form feed = U+000C)
  修复:  \u000c\s*rac → \frac

损伤 B: 反斜杠丢了，剩 rac
  原文:  \frac{3}{4}
  损伤:  rac{3}{4}
  修复:  (^|[^\w\\])rac(?=\s*\{) → $1\frac

损伤 C: 反斜杠丢了，剩 frac
  原文:  \frac{3}{4}
  损伤:  frac{3}{4}
  修复:  (^|[^\w\\])frac(?=\s*\{) → $1\frac
```

### 4.2 完整函数

```js
function repairCommonLatexEscapeDamage(t){
  return t
    .replace(/\u000c\s*rac/g, '\\frac')                          // 损伤 A
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')              // 损伤 B
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac');            // 损伤 C
}
```

> **正则解释**：
> - `(^|[^\w\\])` = 字符串开头 或 非字母数字非反斜杠（避免把已有 `\frac` 的 `frac` 部分再改一次）
> - `(?=\s*\{)` = 后面跟 `{`（正向预查，不消费字符）
> - 替换为 `$1\frac`（保留前缀 + 加反斜杠）

---

## 五、\frac 视觉字数与排版（visualLen + tokenizeLine）

### 5.1 为什么需要专门处理

`\frac{3}{4}` 在板书上不是字面写 8 个字符 `\frac{3}{4}`，而是真排版：
```
   3
  ──
   4
```

所以：
- **视觉字数**（用于算书写时长）：`\frac{3}{4}` 只算 `3 + 4 + 1`（横线）= 8 个视觉单位，不是 8 个字面字符
- **tokenize**：把 `\frac{a}{b}` 当作一个 token `{frac:{num,den}}`，不是逐字

### 5.2 visualLen（视觉字数）

```js
function visualLen(line){
  let s = String(line), n = 0, i = 0;
  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const a = readBrace(s, i + 5);          // 读 {分子}
      const b = readBrace(s, a.next);          // 读 {分母}
      n += a.text.length + b.text.length + 1;  // +1 是横线
      i = b.next;
    } else { n++; i++; }
  }
  return n;
}
```

### 5.3 readBrace（花括号解析，支持嵌套）

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
```

> **嵌套支持**：`\frac{\frac{1}{2}}{3}` 也能正确解析（depth 计数）。

### 5.4 tokenizeLine（行内分词）

```js
function tokenizeLine(s){
  const toks = []; let i = 0;
  while (i < s.length) {
    if (s.startsWith('\\frac', i)) {
      const a = readBrace(s, i + 5);
      const b = readBrace(s, a.next);
      toks.push({ frac: { num: a.text, den: b.text } });
      i = b.next;
    } else { toks.push({ ch: s[i] }); i++; }
  }
  return toks;
}
```

---

## 六、除号转 \frac（硬规范）

### 6.1 规则

```
❌ 禁用 ÷（手写体缺字）
❌ 禁用 a/b 平铺斜杠（小学数学不该这么写）
✅ 一律 \frac{分子}{分母}（上下分数排版）
```

### 6.2 正则

```js
t.replace(/(^|[^\w./\\{])([A-Za-z]|\d+)\s*\/\s*([A-Za-z]|\d+)(?=$|[^\w./])/g,
          '$1\\frac{$2}{$3}');
```

> **正则解释**：
> - `(^|[^\w./\\{])` = 开头 或 非字母数字/点/斜杠/反斜杠/花括号（避免把已有 `\frac{}{}` 里的 `/` 再处理）
> - `([A-Za-z]|\d+)` = 分子（单字母或数字）
> - `\s*\/\s*` = 斜杠（允许两侧空白）
> - `([A-Za-z]|\d+)` = 分母
> - `(?=$|[^\w./])` = 后面是结尾或非字母数字/点/斜杠（避免 `1/2/3` 连续分数误转）

---

## 七、ESC（DOM 安全输出）

### 7.1 字幕 / DOM 文字输出前的最后一道闸

```js
function esc(s){
  return String(s).replace(/[&<>]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;'
  }[c]));
}

document.getElementById('sub').innerHTML =
  '<span>' + esc(sub.slice(0, n)) + '</span>' +
  '<span class="rest">' + esc(sub.slice(n)) + '</span>';
```

### 7.2 esc 不在 normalizeBoardLine 内，单独跑

- `normalizeBoardLine` 处理的是**板书字段**（落 canvas 用，不需要 HTML 转义）
- `esc` 处理的是**字幕 / DOM 文字**（落 innerHTML 用，必须 HTML 转义）
- 两者职责不同，不要混用

---

## 八、toBoardLines（数组 / 字符串 / 对象统一入口）

### 8.1 三种输入形态

```js
// 形态 A: 字符串（多行用 \n 分隔）
board: "第一行\n第二行\n第三行"

// 形态 B: 数组（一行一个）
board: ["第一行", "第二行", "第三行"]

// 形态 C: 对象（v2.0 格式）
board: { startCoord: "[8%, 44%]", content: "第一行\n第二行" }
board: { text: "第一行\n第二行" }   // 也兼容 text 字段
```

### 8.2 统一处理

```js
function toBoardLines(v){
  if (Array.isArray(v)) {
    return v.map(x => (x && typeof x === 'object') ? (x.content ?? x.text ?? '') : (x ?? ''))
            .map(normalizeBoardLine)
            .filter(l => l.length);
  }
  if (v && typeof v === 'object') return toBoardLines(v.content ?? v.text ?? '');
  return String(v == null ? '' : v).split('\n')
          .map(normalizeBoardLine)
          .filter(l => l.length);
}
```

> **关键**：filter 掉空行（normalizeBoardLine 后空串说明原文就是空白或控制字符），避免渲染时画空行。

---

## 九、与现有 skill 的协同

### 9.1 在渲染流水线中的位置

```
deliverable-*.json
  ↓
toBoardLines(board.content)              ← 本 skill（统一入口）
  ↓
normalizeBoardLine(每行)                  ← 本 skill（10 步过滤）
  ↓
tokenizeLine + visualLen                  ← 本 skill（\frac 视觉字数）
  ↓
rowImage（逐字 layout + 量宽）           ← board-zone-layout + handwriting-font-policy
  ↓
scheduler.enqueue(动作)                   ← hand-action-control
  ↓
applyAgentBV2Timeline(rows)               ← speech-board-timing
  ↓
render(t) → canvas → 字幕 esc(sub) → DOM   ← 本 skill（esc 最后闸）
```

### 9.2 与 hand-action-control 的衔接

`\frac{3}{4}` 经过本 skill 后保留为 `\frac{3}{4}`（不转 Unicode），由 tokenizeLine + rowImage 真排版为上下分数。**不要**在 actionSpec 里把分数当坐标或动作。

### 9.3 与 speech-board-timing 的衔接

`visualLen(line)` 算出的视觉字数喂给 `calculateBoardWritingDuration`，按 400ms/字算书写时长。字面 `\frac{3}{4}` 是 8 字符，但视觉字数是 8（3+4+1），不是 8×400=3200ms 而是按视觉单位算。

---

## 十、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| `&amp;` 先解 | `&amp;lt;` 变 `<` 二次解码 | `&amp;` 必须在 decodeHtmlEntities 最后 |
| `\f` 不处理 | `\frac` 落板成 `<0x0C>rac` | `repairCommonLatexEscapeDamage` 第一步 |
| `\n` 还原不分情况 | `\neq` 被打断成换行 + `eq` | `\\n(?![a-zA-Z])` 负向预查 |
| `$` 落板 | 字面 `$` 在手写体里写不出 | 安全网 `t.replace(/\$+/g, '')` |
| 控制字符落板 | `\t \b \v \f` 字面在板书 | `[\t\u0008\u000B\u000C]+` 退化为空格 |
| 重复转 `\frac` | 已有 `\frac{}` 里的 `frac` 被再改 | `(^|[^\w\\])` 排除已有反斜杠前缀 |
| `^\circ` 顺序错 | 留孤立 `^` | `^\circ` 必须先于裸 `\circ` |
| `\sqrt{x}` 顺序错 | 留孤立 `√` | `\sqrt{x}` 必须先于裸 `\sqrt` |
| `1/2/3` 误转 | 连续分数被转成 `\frac{1}{2}/3` | `(?=$|[^\w./])` 后向预查 |
| 字幕不 esc | `<script>` 注入 | innerHTML 前 `esc(s)` |
| 板书 esc 过度 | `&amp;` 字面落 canvas | canvas 不需要 esc，只有 DOM 字幕需要 |
| `×` 不降级 | 手写体缺字画方块 | GLYPH2COMMON 先于 LATEX2U 跑 |

---

## 十一、快速参考

```
过滤器流水线 (10 步, 顺序不能倒):
  ① \r\n / \n(后非字母) → 换行
  ② \t \b \v \f → 空格
  ③ HTML 实体解码 (&amp; 最后)
  ④ LaTeX 损伤修复 (\f→\u000c, rac→\frac, frac→\frac)
  ⑤ 删 $ \left \right
  ⑥ GLYPH2COMMON 缺字降级 (×→x ÷→/ ∴→因此 ∵→因为 −→-)
  ⑦ LATEX2U 映射 (\times→x \sqrt{x}→√x \pi→π \to→→)
  ⑧ x^2→x² x^3→x³
  ⑨ a/b → \frac{a}{b}
  ⑩ 压行内空白 (不碰 \n)

致命顺序:
  &amp; 最后解 / ^\circ 先于 \circ / \sqrt{x} 先于 \sqrt
  GLYPH2COMMON 先于 LATEX2U / repairLatex 先于 删$

字面落板禁令:
  $ \t \b \v \f \left \right &amp; &lt; &gt;

视觉字数:
  visualLen("\frac{3}{4}") = 3 + 4 + 1 = 8 (不是字面 8 字符)

ESC (DOM 最后闸):
  esc(s) = s.replace(/[&<>]/g, &→&amp; <→&lt; >→&gt;)
  只用于 innerHTML, canvas 不需要

结构数学 (STRUCT_MATH):
  命中 → 手写体写不了 → 公式图 / 原样写 + 告警 (不静默丢)
```
