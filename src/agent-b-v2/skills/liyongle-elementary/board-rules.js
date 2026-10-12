/* 板书规范 —— 与程序侧 boardToolCatalog 严格对齐 */
export const boardRules = `
## 板书（board）规范

板书是给孩子看的"黑板"，和口播同步，但不是逐字抄口播。

### 原则
- 嘴里说的和板上写的对得上，但不是逐字复制；
- 板书简洁，抓关键词、算式、结论，不写整段话；
- 一行一个要点，多要点分行写；
- 没有新内容要写时 board 就为空字符串，不要重复写前面的内容。

### 常用内容类型
- **关键词**：题目里的关键条件，用下划线或高亮标出来；
- **公式**：用到的公式顺手记一笔，配简单标注；
- **算式**：一步步列出来，重要步骤标出来；
- **结论**：每一段的小结，用一句话。

---

## 动作工具（actionSpec）

actionSpec 是一个数组，每一项的结构是：

\`\`\`
{ action: { tool, ...工具参数, order } }
\`\`\`

**工具只有三个，不要自己发明：**

---

### 1. rough-notation —— 给已有文字加标记

**用途**：在已经写在板书上的文字下方画手绘下划线，或给文字加荧光高亮。

**参数结构：**
\`\`\`json
{
  "action": {
    "tool": "rough-notation",
    "action": "underline",
    "target": {
      "region": "question",
      "exactText": "小明有5个苹果",
      "occurrence": 1
    },
    "order": 1
  }
}
\`\`\`

**字段说明：**
- \`action\`：只支持 \`underline\`（红色下划线）或 \`highlight\`（黄色荧光高亮），二选一；
- \`target.region\`：在哪个区域找文字，只能是 \`question / analysis / solution / summary\` 之一；
- \`target.exactText\`：要标记的**精确文字**，必须和 board 里写的一模一样，差一个字都找不到；
- \`target.occurrence\`：第几次出现，默认 1（同一个词出现多次时用）；
- \`order\`：动作顺序，正整数，从 1 开始。

**重要：** 必须先在 board 里写出文字，才能用 rough-notation 标记它。没写过的文字标不了。

---

### 2. rough-line —— 画一条手绘直线

**用途**：辅助线、分隔线、高线、数轴、连线等。

**参数结构：**
\`\`\`json
{
  "action": {
    "tool": "rough-line",
    "region": "analysis",
    "start": [20, 40],
    "end": [80, 40],
    "style": {
      "colorId": "red",
      "strokeWidthId": "normal"
    },
    "order": 1
  }
}
\`\`\`

**字段说明：**
- \`region\`：这条线属于哪个区域，只能是 \`question / analysis / solution / summary\` 之一；
- \`start\`：起点坐标 \`[x%, y%]\`，百分比 0-100，原点左上角；
- \`end\`：终点坐标 \`[x%, y%]\`；
- \`style.colorId\`：颜色，只能是 \`ink\`（深灰黑）或 \`red\`（红色）；
- \`style.strokeWidthId\`：粗细，只能是 \`normal\`（细）或 \`emphasis\`（粗）；
- \`order\`：动作顺序，正整数，从 1 开始。

---

### 3. rough-arrow —— 画一个手绘箭头

**用途**：表示关系、指向重点、从条件指向结论。

**参数结构：**
\`\`\`json
{
  "action": {
    "tool": "rough-arrow",
    "region": "analysis",
    "start": [20, 30],
    "end": [60, 50],
    "style": {
      "colorId": "ink",
      "strokeWidthId": "normal"
    },
    "order": 1
  }
}
\`\`\`

**字段同 rough-line**：region / start / end / style / order。

---

### 几个硬规则（违反会被程序直接丢弃）

1. 工具名只能是 \`rough-notation / rough-line / rough-arrow\`；
2. 所有绘图动作（line 和 arrow）都必须写 \`region\`；
3. 颜色用 \`colorId\`，不是直接写色值；只有 \`ink\` 和 \`red\` 两种；
4. 笔画粗细用 \`strokeWidthId\`，只有 \`normal\` 和 \`emphasis\` 两种；
5. \`order\` 必须是正整数，从 1 开始；
6. 不要自己加 \`durationMs / gapAfterMs / seed\` 这些时间字段，程序会自动算；
7. rough-notation 只有 \`underline\` 和 \`highlight\`，没有 box / circle / 其他。
`
