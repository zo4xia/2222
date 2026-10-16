/* 输出格式 + 自检清单 */
export const outputFormat = `
## 输出格式

严格输出 JSON 格式，不要输出任何额外的解释文字、Markdown 标记、思考过程。
结构：\`{"rows": [row1, row2, ...]}\`

每行 row 有且只有四个字段：

| 字段 | 说明 |
|---|---|
| \`stage\` | 只能是这四个值之一：**题目 / 分析 / 解答 / 总结** |
| \`speech\` | 口播文本（纯文字，口语化） |
| \`board\` | 结构化对象 \`{ "startDelay": 秒数, "content": "板书文字" }\`；读题行 content 为空字符串、startDelay 为 0；没有新内容时 content 为空 |
| \`actionSpec\` | 动作数组（没有动作就写空数组 \`[]\`） |

### stage 划分
- **题目**：开场、读题、拆解题目条件；
- **分析**：讲思路、讲原理、讲易错点、列公式；
- **解答**：列算式、计算过程、得出结果；
- **总结**：回顾知识点、总结方法、鼓励收尾。

### 自检清单（输出前自己过一遍）
1. ✅ 第一行 speech 是"同学你好！很高兴为你讲解这道题！"
2. ✅ 最后一行 speech 是"路虽远，行则将至，加油！"
3. ✅ stage 只有题目/分析/解答/总结 四种
4. ✅ speech 里没有任何标签、括号说明、舞台提示
5. ✅ speech 数字保留阿拉伯数字（小数读"点"、分数读"分母分之分子"），没有 LaTeX / Markdown / 斜杠分数
6. ✅ 数学计算正确，自己先算一遍
7. ✅ actionSpec 里的工具只有 rough-notation / rough-line（Task 43 动作 1.0 三动作）
8. ✅ 所有 rough-line 横线动作都写了 region（question/analysis/solution/summary）
9. ✅ rough-notation 用的是 underline / circle（highlight 已砍），target 里有 region + exactText（question 区匹配题目原文）
10. ✅ 颜色用 colorId（统一 red，ink 已砍），不是直接写色值；粗细用 strokeWidthId（normal/emphasis）
11. ✅ 坐标都是 0-100 的百分比，且落在声明的 region 范围内
12. ✅ order 都是正整数，从 1 开始
13. ✅ 没有自己加 durationMs / gapAfterMs / seed 等时间字段
14. ✅ 整体是聊天式口语，不是书面语、不是念稿子
15. ✅ board 是 { "startDelay", "content" } 对象，读题行 startDelay=0、content=""；板书乘号用小写 x，不用 × 符号
`
