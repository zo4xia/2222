---
name: board-zone-layout
description: "画布四区板书布局与坐标控制技巧蒸馏。固定画布 1726×980px，question/analysis/solution/summary 四区百分比坐标 (0—100, 原点左上)，竖版/横版自适应，区域可越界容错（不出画布），风格=老师草算+达芬奇手稿毛料感。用于 Agent B/C 规划板书落点、画布渲染层排版、Check Agent 校验越界。"
version: "1.0.0"
archetype: workflow
trigger: "规划板书落点/计算四区坐标/校验板书越界/竖版横版自适应/画布坐标换算"
---

# 画布四区板书布局与坐标控制

> *"区域坐标是参考区间，不是死板牢笼。老师上课草算，微微越界才有手稿感。"*

## 蒸馏合同

`Distill [四区板书布局与坐标控制] as a [workflow] pack so it can help with [Agent B 规划板书落点 / 画布渲染层排版 / Check Agent 校验越界], using [src/utils/boardLayout.js + src/utils/canvasCoords.js + src/services/boardMathPolicy.js], while respecting [handoff JSON 唯一真相源 / 区域坐标仅为参考 / 内容多时可越界只要不出画布 / 不严重叠字].`

---

## 一、绝对物理基准（不可改）

### 1.1 画布尺寸

| 常量 | 值 | 来源 |
|---|---|---|
| `CANVAS_W` | 1726 px | 甲方真画布宽 |
| `CANVAS_H` | 980 px | 甲方真画布高 |
| `TABLE_REF_W` | 1892 px | 夏夏表稿参考宽（仅在转换旧坐标时用） |
| `TABLE_REF_H` | 1044 px | 夏夏表稿参考高 |
| `SCALE_X` | `1726/1892 ≈ 0.9123` | 表→画布换算 |
| `SCALE_Y` | `980/1044 ≈ 0.9387` | 表→画布换算 |

> **绝对物理基准**：对外批注、视觉避让、坐标换算一律以 1726×980 为基准。比例 = 1726:980。

### 1.2 坐标系

- 原点：**左上** (0, 0)
- X 向右，Y 向下
- 坐标范围：**0—100（百分比）**，由 `coordinateMode` 决定输出 `percentage` 或 `pixel`
- 百分比 ↔ 像素换算：
  ```
  pct.x = px.x / CANVAS_W * 100
  pct.y = px.y / CANVAS_H * 100
  ```

---

## 二、四区参考布局（默认值，非硬约束）

> **重要**：实际坐标以 `handoff.boardPlan` + `handoff.zoneAnchors` 为唯一真相源，下表仅当 handoff 缺失时作 fallback。

| 区域 | x(%) | y(%) | w(%) | h(%) | 参考字号 |
|---|---|---|---|---|---|
| topicLabel | 5.7 | 6.6 | 7.1 | — | — |
| question | 6.0 | 13.2 | 44 | — | 30px 印刷体 |
| analysisLabel | 5.7 | 34.5 | 7.2 | — | — |
| analysis | 6.0 | 41.0 | 44 | 48 | ~38px 手写体（题目 1.2~1.5 倍） |
| solutionLabel | 53.7 | 6.6 | 7.4 | — | — |
| solution | 54.0 | 14.0 | 40 | 44 | ~38px 手写体 |
| summaryLabel | 53.7 | 62.0 | 7.2 | — | — |
| summary | 54.0 | 69.5 | 40 | 22 | ~38px 手写体 |

**安全区常量**：
- `BOARD_SAFE_X_PCT = 6`（左安全边）
- `BOARD_RIGHT_LIMIT_PCT = 94`（右安全边）
- `BOARD_BOTTOM_LIMIT_PCT = 95`（底安全边）
- `BOARD_HORIZONTAL_GAP_PCT = 4`（列间水平间隔）
- `SECTION_GAP_PCT = 2`（区段间垂直间隔）

---

## 三、三种布局模式（自适应题目形态）

### 3.1 纯文字竖版（portrait）

无图：左列题目 + 分析，右列解答 + 总结。

```
┌────────────┬────────────┐
│  题目区     │            │
│            │  解答区     │
│  分析区     │            │
│            │  总结区     │
└────────────┴────────────┘
```

- 左列宽 `PORTRAIT_LEFT_W_PCT = 44%`
- 右列 X `= 6 + 44 + 4 = 54%`，宽 `= 94 - 54 = 40%`
- 题目区底 `topicBottomPct` 自动测量后，分析标签 Y = `max(34.5, topicBottomPct + 2)`，分析区 Y = labelY + label-to-region
- 分析区高 = `remainingHeight(analysisY) = max(0, 95 - analysisY)`

### 3.2 竖图左右版（portrait-left-image）

有竖图（图高 > 宽）：左半原题图，右半三区纵排。

```
┌────────────┬────────────┐
│            │  分析区     │
│  原题图     │            │
│            │  解答区     │
│            │            │
│            │  总结区     │
└────────────┴────────────┘
```

- 右半起始 Y = 6.6%，总高 = 95% - 6.6% = 88.4%
- 每区高 `= 88.4 / 3 ≈ 29.47%`
- 区内有效书写高 `= 29.47% - (label-to-region = ~6%) ≈ 23.47%`

### 3.3 横图上下版（landscape-top-image）

有横图（图宽 > 高）：图片贴左上，三区横排在图片下方。

```
┌──────────────────────────┐
│       原题图（宽: 88%）    │
├────────┬────────┬────────┤
│ 分析区 │ 解答区 │ 总结区 │
└────────┴────────┴────────┘
```

- 图片占整宽 `88%`，高度自适应，底 = `image.y + image.maxH`
- 三区水平并排，每列宽 `STRIP_COLUMN_W_PCT = (94 - 6 - 4×2) / 3 = 26.67%`
- 解答列 X = `6 + 26.67 + 4 = 36.67%`，总结列 X = `36.67 + 26.67 + 4 = 67.34%`

---

## 四、越界容错（达芬奇手稿毛料感）

### 4.1 软约束 vs 硬约束

| 约束类型 | 规则 | 处理 |
|---|---|---|
| 硬约束 | 板书**不得溢出画布**（1726×980） | 必须裁剪/截断 |
| 软约束 | 区域坐标仅为**参考区间** | 内容多时可**按需越界**到邻区 |
| 软约束 | 不得与其他板书**严重叠字** | 自然段落排版，渲染层避免 |

### 4.2 越界判定（Check Agent 校验逻辑）

```
if (文字 bounding box 超出 1726×980 画布)  → 硬失败
if (文字 bounding box 超出本区 boardPlan 范围) → 软警告（允许，记录）
if (文字 bounding box 与其他已存在板书文字相交面积 > 30%) → 软警告（建议改写）
```

### 4.3 风格指南（不可量化，但必须遵守）

- ✅ 像老师上课草算演示：略微歪斜、字间距不齐
- ✅ 微微达芬奇手稿毛料感：笔触有粗细、起笔有顿挫
- ❌ 不要死板对齐网格、不要像 Word 排版
- ❌ 不要严重叠字（一句话压在另一句上）

---

## 五、坐标换算工具函数

```js
// 表稿坐标（1892×1044）→ 画布坐标（1726×980）
tablePxToCanvasPx(x, y) → { x: round(x * 1726/1892), y: round(y * 980/1044) }

// 画布像素 → 百分比
canvasPxToPct(x, y) → { x: +(x/1726*100).toFixed(2), y: +(y/980*100).toFixed(2) }

// 表稿像素 → 百分比（一步到位）
tablePxToPct(x, y) → canvasPxToPct(tablePxToCanvasPx(x, y))
```

**渲染层排版提示**：
- 文字**不输出起手坐标**，由渲染层按当前字体自然段落换行的自然间距排版
- 已提供四区坐标区间，**不再单独计算起手坐标**
- 只有 `actionSpec`（绘图动作）需要 start/end 坐标

---

## 六、与 handoff JSON 的对接

### 6.1 字段读取顺序

```
1. canvasParams → 锁定画布尺寸、字号基准
2. boardPlan → 四区参考坐标
3. zoneAnchors → 四区锚点（用于 actionSpec 落点）
4. screenshotUrl → 图片题必看，做视觉避让
5. coordinateMode（单独传入） → 决定 actionSpec 坐标格式
```

### 6.2 与 Agent A handoff 全要素表的对接

| handoff 字段 | 本 skill 用途 |
|---|---|
| `canvasParams` | 锁定 1726×980 与字号基准 |
| `boardPlan` | 四区参考坐标 |
| `zoneAnchors` | actionSpec 落点区间感知 |
| `screenshotUrl` | 图片题视觉避让（图形/几何配图/表格/示意图） |
| `coordinateSpec` | 0—100 百分比，原点左上 |
| `coordinateMode` | percentage / pixel 输出格式 |
| `stageRatioSuggestion` | rows 行数分配（影响每区行数密度） |

---

## 七、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| 死板对齐 | 板书像 Word 排版 | 加字间距 0—2px 微抖动，行间距 1.55—1.85 微抖动 |
| 跨区硬越界 | 板书超出画布边缘 | 用 `clampBoxBottom` 强制裁剪到底安全边 95% |
| 严重叠字 | 后写板书压在已存在板书上 | 渲染层使用 `textTargetRegistry` 注册目标，新行 y 递增 |
| 编造坐标 | handoff 缺 boardPlan 时硬套默认 | 宁可返回 `[]`，不要编造；告知 Check Agent 缺口 |
| 图文不避让 | 板书画在题目配图上 | 必看 `screenshotUrl`，板书 Y 起点从 `topicBottomPct + SECTION_GAP_PCT` 开始 |

---

## 八、快速参考

```
画布: 1726×980px, 比例 1726:980, 坐标 0—100% 原点左上
四区: question / analysis / solution / summary
安全区: 左 6 / 右 94 / 底 95
列宽: 竖版左列 44% 右列 40%; 横版三列各 26.67%
越界: 不出画布=硬约束; 不严重叠字=软约束
风格: 老师草算 + 达芬奇手稿毛料感, 绝不死板
真相源: handoff.boardPlan + zoneAnchors (默认值仅 fallback)
```
