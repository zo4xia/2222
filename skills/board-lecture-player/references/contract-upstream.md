# 上游产出端契约（Agent B → 渲染器）

> **更新时间**：2026-09-18 23:55 GMT+8
> **更新人**：小阿星 ✦（代表夏夏）
> **来源**：Agent B v2 系统提示词（LANE=B-V2）+ `G:\vedio\remix-remix-copy-of--googel (1)\row-player.html` 实测 + `truth/territory-C-actions-and-anchors.md`
> **本项目定位**：`board-lecture-player/references/contract-upstream.md` — 产出端（写 JSON 的那一侧）必须遵守的数据契约
> **版本**：v2.0（2026-09-18 修订：坐标退场 + 零 keyword + 真实音频唯一时长真相）

---

## 1. 三个非协商修订（2026-09-18 夏夏拍板）

这三条是本次 v2.0 的核心，优先级高于历史上任何写法：

### 1.1 坐标退场：`board` 不再输出坐标

| | v2.0（旧） | **v3.0（现行）** |
|---|---|---|
| board 形状 | `{startCoord, content, startDelay}` | **`{startDelay, content, region}`** |
| 位置由谁定 | 上游写死 `"[8%, 44%]"` | **下游渲染层自动排版** |
| 依据 | — | `truth` 契约：板书不输出起手坐标，区域仅为大致参考 |

上游只需要说「这段板书属于哪个区」（`region: question|analysis|solution|summary`），**不需要、也不允许给 x/y**。

### 1.2 零 keyword：字典里没有这个词

合同里**不存在 `keyword` 字段**，历史上加过又被改没了。渲染端**不得依赖**任何关键词字段做同步——
依赖不存在的字段 = 运行时拿 `undefined` = 同步静默失效。

> 同步机制见 `render-downstream.md` §2（音频时钟），与关键词无关。

### 1.3 真实音频是唯一时长真相源

**禁止按字数估算时长。** 这不是"不推荐"，是黑名单。

```
❌ 黑名单（反复犯过的错，禁止再写）
   speechSec = speech.length / 160 * 60      // 字数 / 160 字每分钟
   duration  = board.content.length * 0.4    // 按字符数猜
   // 这些是假时钟。嘴型、停顿、换气、情绪、重读全部丢失
   // 后果：音画错位，且错得没规律、无法校准

✅ 真相源
   rowSec = <mp3 真实 duration>（AudioBuffer / HTMLAudioElement 解码后的 seconds）
```

每个 `row` 必须携带真实音频，二选一：
- `mp3`：音频 URL/文件名（首选，可离线预解码）
- `audioBase64`：内联音频数据（单文件离线场景）

**缺音频 = 规格冲突**，必须显式报错并停下问用户，不许静默降级成估算。
（同源于 layout 纪律：容量不足时报为规格冲突，而非静默降级字号。）

---

## 2. row 完整字段表

| 字段                    | 类型     | 必填  | 说明                                        |
| --------------------- | ------ | --- | ----------------------------------------- |
| `stage`               | string | ✅   | `"题目"/"分析"/"解答"/"总结"`，严禁出现开场/读题/收尾等非法值    |
| `mp3` 或 `audioBase64` | string | ✅   | **真实音频**。二者至少其一，缺失即报规格冲突                  |
| `duration`            | number | ⭕   | 仅供预览/占位，**渲染时必须被真实音频 duration 覆盖**，不得参与排期 |
| `speech`              | string | ✅   | 口播稿原文。仅用于展示字幕与人工校对，**不用于算时长**             |
| `board`               | object | ✅   | `{startDelay, content, region}`，见 §3      |
| `actionSpec`          | array  | ✅   | 动作数组，无动作为 `[]`，见 §4                       |

---

## 3. board 对象（v3.0）

```json
{
  "startDelay": 1.8,
  "region": "analysis",
  "content": "沿高 DE 分割\\n→ 三角形ADE + 梯形DEBC"
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `startDelay` | ✅ | 本 row 音频开始后几秒落笔（秒）。**这是唯一允许的时间手势**，不是坐标 |
| `region` | ✅ | 软提示。渲染层据此选起始区，装不下自动外溢（见渲染文档 §3） |
| `content` | ✅ | 板书内容，`\n` 换行；支持 LaTeX 子集 |




**不得出现**：`startCoord` / `coord` / `x` / `y` / `left` / `top`。
（旧数据若带 `startCoord`：渲染层当作**过时软提示**接受，但仍要以实测容量为准重新定位，绝不盲信。）

### content 格式硬规范
- 分数必须用 `\frac{分子}{分母}`，禁止 `7/15`
- 乘号用小写 `x`，除号用 `÷`
- 字母/图形禁止拼音替代：`△ADE`、`S_{△ADE}`、`DE⊥AE`
- 单位写在括号中：`高=8（分米）`
- 多行连续推导：内部 `\n` 换行，或 `\begin{aligned}...\end{aligned}`

---

## 4. actionSpec（一期收口）

结构：`{ "action": { "tool": ..., "order": N, ... } }`，`order` 写在 action **内部**，全表唯一正整数。

一期**只有两个兜底动作**（`truth/territory-C` 契约，波浪线/箭头不在一期）：

| tool | 用途 | 必须锚定 |
|---|---|---|
| `rough-notation` · `circle` | 圈关键词 | `target.exactText` |
| `rough-notation` · `underline` | 划关键词 | `target.exactText` |

```json
{ "action": {
    "tool": "rough-notation", "action": "underline",
    "target": { "region": "question", "exactText": "20.4 厘米", "occurrence": 1 },
    "options": { "multiline": false },
    "order": 2
} }
```

- `rough-notation` **必须锚定 `target.exactText` 文字**，否则会飘（禁止用具数坐标代替命名锚点）
- 一期**不产出** `rough-line` / `rough-arrow`（保留渲染分支，注释标二期）

---

## 5. 产出端自检清单

产出 JSON 后逐条过：

- [ ] 每个 row 都有真实音频（mp3 / audioBase64）
- [ ] 没有任何 board 带坐标字段
- [ ] 没有任何 keyword 字段
- [ ] 没有出现 `字/160` 之类估算产物写进 `duration` 并被当真
- [ ] `stage` 取值合法
- [ ] actionSpec 只有 circle / underline，且 `order` 全表唯一递增
- [ ] exactText 能在对应 region 文本中原样命中
- [ ] content 中分数均为 `\frac{}{}`

然后跑：`node scripts/validate_contract.js <rows.json>`

---

## 更新记录

| 时间 | 版本 | 更新人 | 变更 |
|---|---|---|---|
| 2026-09-18 23:55 | v2.0 | 小阿星 | 首次成文：坐标退场(board v3.0 无坐标)、零 keyword、真实音频唯一时长真相源、一期动作收口为 circle+underline |
