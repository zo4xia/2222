/* 输出格式 + 自检清单 —— 2026-09-17 契约定案：row 五字段 */
export const outputFormat = `
## 输出格式

严格输出 JSON 格式，不要输出任何额外的解释文字、Markdown 标记、思考过程。
结构：\`{"rows": [row1, row2, ...]}\`

每行 row 有且只有五个字段：

| 字段 | 说明 |
|---|---|
| \`stage\` | 只能是这四个值之一：**题目 / 分析 / 解答 / 总结** |
| \`mp3\` | 固定填空字符串 \`""\`（真实音频 URL 由下游程序回填） |
| \`speech\` | 口播文本（口语化）。要落笔的关键词用 \`**加粗**\` 包住：第 1 个加粗触发 \`boards[0]\`，第 2 个触发 \`boards[1]\`……按出现顺序一一对应 |
| \`boards\` | 板书数组 \`[{"startDelay": 秒数, "content": "板书"}]\`；没板书写空数组 \`[]\`。多块按 speech 加粗顺序依次串行写完 |
| \`actionSpec\` | 动作数组（没有动作就写空数组 \`[]\`；必须等本行所有 boards 写完才执行） |

### 触发机制铁律
- \`speech\` 内 \`**加粗**\` 就是老师动笔的时机，必须落在自然讲到该板书的地方，不许全堆在句末；
- \`boards[i].startDelay\` 是匹配不到加粗锚点时的超时兜底（数字，秒）；
- 除 \`speech\` 外，其它字段（\`boards.content\` / \`actionSpec\` / \`stage\` / \`mp3\`）绝对禁止出现 \`**\` 符号；
- 严禁输出 \`duration\`、\`triggerKeyword\`、\`startCoord\` 字段！

### stage 划分
- **题目**：开场、读题、拆解题目条件（boards 必须为 \`[]\`）；
- **分析**：讲思路、讲原理、讲易错点、列公式；
- **解答**：列算式、计算过程、得出结果；
- **总结**：回顾知识点、总结方法、鼓励收尾。

### 自检清单（输出前自己过一遍）
1. ✅ 第一行 speech 是"同学你好！很高兴为你讲解这道题！"
2. ✅ 最后一行 speech 是"路虽远，行则将至，加油！"
3. ✅ stage 只有题目/分析/解答/总结 四种
4. ✅ 每行都有 \`mp3: ""\`，没有 \`duration\` 字段
5. ✅ 每行 speech 的 \`**加粗**\` 数量与 boards 数组长度完全一致，加粗位置就是自然落笔时机
6. ✅ speech 里除 \`**\` 锚点外没有任何标签、括号说明、舞台提示
7. ✅ speech 里所有数字都是中文发音
8. ✅ 数学计算正确，自己先算一遍
9. ✅ actionSpec 里的工具只有 rough-notation / rough-line / rough-arrow
10. ✅ 所有 line / arrow 动作都写了 region（question/analysis/solution/summary）
11. ✅ rough-notation 用的是 underline 或 highlight，target 里有 region + exactText
12. ✅ 颜色用 colorId（ink/red），不是直接写色值；粗细用 strokeWidthId（normal/emphasis）
13. ✅ actionSpec 坐标格式遵守 coordinateMode，且落在声明的 region 范围内
14. ✅ order 都是正整数，从 1 开始
15. ✅ 没有自己加 durationMs / gapAfterMs / seed 等时间字段
16. ✅ 整体是聊天式口语，不是书面语、不是念稿子
`
