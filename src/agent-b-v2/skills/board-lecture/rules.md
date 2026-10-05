# 板书排版标准化规范

> **适用范围**：所有小学数学题目的板书生成与渲染，不依赖具体题型。
> **设计原则**：每步入参出参清晰，程序可调用，无上下文直接接入。
> **画布参数唯一真源**：`src/services/stepHandoff.js`（CANVAS_SIZE / BOARD_FONT_SIZE / BOARD_LINE_HEIGHT_MEAN）。
> **区域坐标唯一真源**：`src/utils/boardLayout.js`（BOARD_LAYOUT 结构 + planLabelsFromTopic 动态布局）。

---

## 步骤流程总览

```
LLM 输出 board.content
    ↓
步骤1 符号规范化（程序执行）— normalizeBoardSymbols()
    ↓
步骤2 容量估算（程序执行）— estimateCapacity()
    ↓
步骤3 布局决策（程序执行）— decideLayout()
    ↓
步骤4 落点排版（渲染层执行）— boardLayout.js#layoutBoardRows()
    ↓
步骤5 渲染清洗（渲染层执行）— superFilter.js#normalizeBoardLine()
    ↓
步骤6 重叠检测（渲染层执行）— boardLayout.js#layoutBoardRows 游标单调递增
```

---

## 步骤 1：符号规范化

| 维度 | 值 |
|---|---|
| **入参** | `content: string` |
| **出参** | `{ result: string, changes: Array<{from, to, count}> }` |
| **程序函数** | `normalizeBoardSymbols(content)` |
| **运行时真源** | `src/utils/superFilter.js#normalizeBoardLine`（10 步流水线，更完整） |

**替换规则（长匹配优先，顺序不可调换）**：

| 序号 | 正则 | 替换为 | 约束 |
|---|---|---|---|
| 1 | `\\rightarrow\|→` | `->` | 必须在序号3之前 |
| 2 | `\\Rightarrow\|⇒` | `=>` | — |
| 3 | `\\to` | `->` | 必须在序号1之后 |
| 4 | `−`（U+2212） | `-`（U+002D） | — |
| 5 | `\\times\|×\|✕` | `x` | 乘号用小写字母 x |
| 6 | `\\div` | `/` | 与 superFilter 一致；手写体不支持 ÷ |
| 7 | `\\cdot\|·` | `·` | — |
| 8 | `\\approx\|≈` | `≈` | — |
| 9 | `\\neq\|\\ne\|≠` | `≠` | — |
| 10 | `\\leq\|\\le\|≤` | `≤` | — |
| 11 | `\\geq\|\\ge\|≥` | `≥` | — |
| 12 | `\\circ` | `°` | 再清理 `^°`→`°` |
| 13 | `\\pi` | `π` | — |
| 14 | `\\infty` | `∞` | — |
| 15 | `\\angle` | `∠` | — |
| 16 | `\\perp` | `⊥` | — |
| 17 | `\\parallel` | `∥` | — |
| 18 | `\\triangle\|△` | `三角形` | 中文优先，手写体亲和 |
| 19 | `\\therefore\|∴` | `因此` | 同上 |
| 20 | `\\because\|∵` | `因为` | 同上 |

---

## 步骤 2：容量估算

| 维度 | 值 |
|---|---|
| **入参** | `{ content, regionWidth(px), fontSize(px), lineHeight }` |
| **出参** | `{ charCount, charsPerLine, lineCount, totalHeight(px) }` |
| **程序函数** | `estimateCapacity(input)` |

**默认值（来自 stepHandoff.js 唯一真源）**：

| 参数 | 默认值 | 来源 |
|---|---|---|
| fontSize | 38px | `BOARD_FONT_SIZE` |
| lineHeight | 1.7 | `BOARD_LINE_HEIGHT_MEAN` |

**四区可写宽度**（由 boardLayout.js `BOARD_LAYOUT` 百分比 × `CANVAS_W` 计算）：

| 区域 | 百分比宽 | 可写宽(px) | 区域高(px) |
|---|---|---|---|
| 题目（通栏左列） | 44% | 759 | — (自适应) |
| 分析（左栏） | 44% | 759 | 470 |
| 解答（右栏） | 40% | 690 | 431 |
| 总结（右栏） | 40% | 690 | 216 |

> 注：以上为默认竖版布局值；`planLabelsFromTopic()` 可根据题目图片形态切换为横版上下布局，此时各区域宽高由动态布局函数产出。调用方应传递实际区域宽高。

---

## 步骤 3：布局决策

| 维度 | 值 |
|---|---|
| **入参** | `{ capacity, regionHeight(px), hasMultipleSteps }` |
| **出参** | `{ action: 'normal'|'compact'|'twocolumn'|'overflow', fontSize, reason }` |
| **程序函数** | `decideLayout(input)` |

**决策顺序（从宽到紧，不可跳级）**：

| 优先级 | action | 条件 | 字号 | 说明 |
|---|---|---|---|---|
| 1 | `normal` | 总高 ≤ 区域高 | 38px | 默认字号放得下 |
| 2 | `twocolumn` | 多步 + 两列36px放得下 | 36px | 多步算式分两列 |
| 3 | `compact` | 36px放得下 | 36px | 紧凑模式 |
| 4 | `overflow` | 36px仍放不下 | 36px | 需精简内容或缩放 |

铁律：正文最低 36px，低于此值手写体不可读。

---

## 步骤 4：落点排版

| 维度 | 值 |
|---|---|
| **入参** | `rows: Array<{stage, board?: {content}}>, {fontSizePx}` |
| **出参** | `Array<{startCoord, x, y, lineCount}>` |
| **程序函数** | `boardLayout.js#layoutBoardRows(rows)` |

规则：起点 = 区域左上角，纵向按自然行高累加，游标单调递增 → 天然不重叠。

---

## 步骤 5：渲染清洗

| 维度 | 值 |
|---|---|
| **入参** | `boardLine: string` |
| **出参** | `string` (清洗后) |
| **程序函数** | `superFilter.js#normalizeBoardLine(s)` |

10 步流水线（顺序不可倒）：`\n`还原 → 控制字符退化 → HTML实体解码 → LaTeX损伤修复 → aligned剥壳 → 删$ \left \right → 手写体降级 → LaTeX→Unicode → 角标x²x³ → 压空白。

---

## 步骤 6：重叠检测

游标单调递增保证同区域内不重叠；跨区域由渲染层 occupancy map 避让。
矩形相交公式：`A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom`

---

## 五条铁律

1. **一次只写一处** — 单手一维时间线，板书与动作绝对互斥
2. **板书字不能小** — 正常 38px，最低 36px（1.2 倍题目字号）
3. **分析区红色** — 分析板书红色，解答/总结黑色
4. **排版紧凑** — 不留空洞，溢出时优先压缩字号，最后才精简内容
5. **只画题目要求的内容** — 不添加答案、不画示意以外的图形
