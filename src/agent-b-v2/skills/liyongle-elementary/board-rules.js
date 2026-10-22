/* 板书规范 —— 与程序侧 boardToolCatalog 严格对齐 */
export const boardRules = `
## 板书（board）规范

板书是给孩子看的"黑板"，和口播同步，但不是逐字抄口播。

### 原则
- 嘴里说的和板上写的对得上，但不是逐字复制；
- 板书简洁，抓关键词、算式、结论，不写整段话；
- 一行一个要点，多要点分行写；
- ★「物理超度」优化打法：有板书书写的句子和没有书写的句子尽量不要挤在同一个 row 里面！纯提问/启发/铺垫句子单独成行（board 为空，actionSpec 为空），真正落笔写字/画线的句子单独成行，避免音频与动作对齐漂移；
- board 是结构化对象 \`{ "startDelay": 起手延时秒数, "content": "板书文字" }\`：startDelay 表示这行口播开始几秒后落笔（读题行为 0，其他行一般 1.0~2.5 秒）；
- 没有新内容要写时 content 就为空字符串，不要重复写前面的内容。

### 常用内容类型
- **关键词**：题目里的关键条件，用下划线或画圈标出来；
- **公式**：用到的公式顺手记一笔，配简单标注；
- **算式**：一步步列出来，重要步骤标出来；
- **结论**：每一段的小结，用一句话。

---

## 动作工具（actionSpec）

actionSpec 是一个数组，每一项的结构是：

\`\`\`
{ triggerKeyword: "口播触发词（可选，entry 级）", action: { tool, ...工具参数, order } }
\`\`\`

> ★ Task 43 动作 1.0：\`triggerKeyword\` 是 **entry 级字段——与 \`action\` 平级，写在 actionSpec 每一项的外层，不写在 action 内部**。填了它，动作会在口播**念到该词的时刻**起笔；不填则按串行顺序排在板书写完之后。必须**逐字存在于本行 speech 原文**（禁止改写拼接），选「念到正需要强调」的词；时间互斥由程序钳制保证，不要填任何时长字段。

**动作只有三个（Task 43 夏夏拍板「动作 1.0」：下划线/画圈/横线），不要自己发明：**

---

### 1. rough-notation —— 给已有文字加标记

**用途**：在已有文字下方画手绘下划线，或圈出关键词（圈关键数字或条件是核心兜底动作）。

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
- \`action\`：支持 \`underline\`（固定红色下划线）、\`circle\`（固定红色画圈）二选一；颜色由程序固定统一红 #dc2626，不要传 color 之类的字段（Task 43 动作 1.0：highlight 已砍）；
- \`target.region\`：在哪个区域找文字，只能是 \`question / analysis / solution / summary\` 之一；
- \`target.exactText\`：要标记的**精确文字**：region 为 question 时必须逐字匹配题目区展示的原文，其他区域必须和 board 里写的一模一样，差一个字都找不到；
- \`target.occurrence\`：第几次出现，默认 1（同一个词出现多次时用）；
- \`order\`：动作顺序，正整数，从 1 开始。

**重要：** 标记的文字必须已经存在——question 区标记题目原文，其他区必须先在 board 里写出来才能标。

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
- \`style.colorId\`：颜色，只能是 \`red\`（红色；Task 43 动作 1.0 颜色统一红，ink 墨黑已砍）；
- \`style.strokeWidthId\`：粗细，只能是 \`normal\`（细）或 \`emphasis\`（粗）；
- \`order\`：动作顺序，正整数，从 1 开始。

---

### 3. rough-arrow —— 已砍（Task 43 动作 1.0）

> 夏夏拍板「其他做我怕做不好」：rough-arrow 箭头与 highlight 高亮一起退出白名单，
> 动作 1.0 只保留下划线/画圈/横线三动作。不要再输出 rough-arrow。

---

### 几个硬规则（违反会被程序直接丢弃）

1. 工具名只能是 \`rough-notation / rough-line\`（动作 1.0 三动作：下划线/画圈/横线）；
2. 绘图动作（rough-line 横线）必须写 \`region\`；
3. 颜色用 \`colorId\`，不是直接写色值；只有 \`red\` 一种（统一红）；
4. 笔画粗细用 \`strokeWidthId\`，只有 \`normal\` 和 \`emphasis\` 两种；
5. \`order\` 必须是正整数，从 1 开始；
6. 不要自己加 \`durationMs / gapAfterMs / seed\` 这些时间字段，程序会自动算；
7. rough-notation 只有 \`underline / circle\`（与程序侧 boardToolCatalog 白名单对齐，Task 43 动作 1.0），没有 box / strike-through / highlight / 其他。
`
