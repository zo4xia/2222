---
name: hand-action-control
description: "板书手部动作互斥调度与一维单手时间线技巧蒸馏。teacher-hand-exclusive 互斥模式（任意时刻只允许一笔），generation-based cancelAll 防越界残留，3 个已注册工具（rough-notation/rough-line/rough-arrow）白名单，Agent 不得自造调用，时长由程序按汉字宽度自动计算（Agent 不得填秒数），order 正整数顺序入队，抬笔间隔 MIN_HAND_LIFT_GAP_MS。用于 Agent B 写 actionSpec / 渲染层动作调度 / Check Agent 校验工具合法性。"
version: "1.0.0"
archetype: workflow
trigger: "写 actionSpec/调度手部动作/校验工具合法性/手部互斥控制/抬笔间隔/动作时长估算"
---

# 板书手部动作互斥调度与一维单手时间线

> *"老师只有一只手。任意时刻只允许一笔，写字、画图、标记不能并发。"*

## 蒸馏合同

`Distill [手部动作互斥调度与一维单手时间线] as a [workflow] pack so it can help with [Agent B 写 actionSpec / 渲染层动作调度 / Check Agent 校验工具合法性], using [src/board-tools/handActionScheduler.js + src/board-tools/boardToolCatalog.js + src/board-tools/roughNotationTool.js + src/board-tools/roughDrawingTool.js], while respecting [teacher-hand-exclusive 互斥 / 只用注册工具白名单 / 时长由程序算 Agent 不得填秒数 / 抬笔间隔硬下限].`

---

## 一、互斥模型（teacher-hand-exclusive）

### 1.1 核心规则

```
任意时刻只允许一笔。
写字、画图、标记、连线 → 全部进同一队列，串行执行。
L4 用户透明层不进入此队列。
```

### 1.2 互斥实现（createHandActionScheduler）

```js
const scheduler = createHandActionScheduler({ minimumGapMs })

// 入队一个动作 plan（必须含 id, durationMs, execute, 可选 gapAfterMs, order, cancel）
scheduler.enqueue(plan)

// 批量入队（按 order 升序排列后逐个 enqueue）
scheduler.enqueueAll(plans)

// 取消全部（generation + 1 让所有在途任务抛 "已取消"）
scheduler.cancelAll()

// 订阅状态变化
scheduler.subscribe((state) => { /* { activeActionId, nextAllowedAt, minimumGapMs } */ })
```

### 1.3 关键约束

| 约束 | 值 | 说明 |
|---|---|---|
| `minimumGapMs` | `MIN_HAND_LIFT_GAP_MS`（600ms） | 抬笔换手间隔硬下限，<600ms 直接抛错 |
| `plan.id` | 必填 | 唯一标识，用于 cancel / 互斥冲突报错 |
| `plan.durationMs` | 必填正数 | 由程序算（见 §四），Agent 不得填 |
| `plan.execute` | 必填函数 | 真正执行动作（DOM 写入 / canvas 绘制） |
| `plan.gapAfterMs` | 可选 | 默认 = minimumGapMs，不得 < minimumGapMs |
| `plan.order` | 可选正整数 | enqueueAll 时按 order 升序 |

### 1.4 generation-based cancel（防越界残留）

```js
let generation = 0

function enqueue(plan) {
  const queuedGeneration = generation
  const task = tail.then(async () => {
    if (queuedGeneration !== generation) throw new Error(`动作 ${plan.id} 已取消`)
    // ... waitBefore, execute, await durationMs ...
    if (queuedGeneration === generation) {
      nextAllowedAt = Date.now() + Math.max(plan.gapAfterMs ?? minimumGapMs, minimumGapMs)
    }
  })
}

function cancelAll() {
  generation += 1            // ← 让所有在途任务的 generation 检查失败
  activePlan?.cancel?.()
  nextAllowedAt = 0
}
```

> **设计意图**：用户中途切题/重生成时，老的 in-flight 动作不能继续写画布，否则会污染新题。`generation += 1` 让所有 `queuedGeneration !== generation` 的任务在下一个 await 点抛错退出，干净的回收。

---

## 二、工具白名单（只有 3 个，不得自造）

### 2.1 工具清单（boardToolCatalog v1.3.0）

| tool id | 用途 | actions |
|---|---|---|
| `rough-notation` | 只用于给已存在文字划重点，不画几何图形 | `underline` / `highlight` |
| `rough-line` | 画辅助线、边线、高线 | — |
| `rough-arrow` | 画带箭头的关系连线 | — |

### 2.2 注册与校验

```js
// 注册表
getAgentBoardToolCatalog()
// → { version, rule, tools: [roughNotation, roughLine, roughArrow] }

// 校验单个 action
validateBoardToolAction(action)
// → { ok: true, value: { ...normalized } } 或 { ok: false, error }

// 运行时
createBoardToolRuntime({ resolveTarget, resolveRegion, resolveCanvas, resolveRegionBounds, boardPlan })
// → { enqueue(action), enqueueAll(actions), clear(), subscribe, getState, listTargets }
```

### 2.3 Agent 不得做的事

| 禁止 | 原因 |
|---|---|
| 自造工具名（如 `circle`, `box`, `text`） | 不在白名单 → `validateBoardToolAction` 报 `未支持的板书工具` |
| 填 `durationMs` / `estimatedDurationMs` | 时长由程序算，Agent 填了报 `Agent 不得覆盖` |
| 填 `gapAfterMs` < 600ms | 抬笔间隔硬下限，<600 抛错 |
| 填 `seed` | roughjs 随机种子由程序生成，避免 Agent 控制笔触 |
| 跨区画图 | rough 图形只能画在 question/analysis/solution/summary 区域内 |
| 坐标超 0—100 | rough-line/rough-arrow 的 start/end 必须是百分比 0—100 |

---

## 三、rough-notation 工具（划重点）

### 3.1 动作与颜色锁定

| action | 颜色 | 用途 |
|---|---|---|
| `underline` | **红色** `#d64545`（固定，不可改） | 在关键词/数字下方画手绘下划线 |
| `highlight` | **黄色** `#f8e58c`（固定，不可改） | 在关键词/数字上画荧光高亮 |

> Agent 传 `options.colorId` 与锁定值不符 → 抛 `颜色固定为 xxx`。

### 3.2 目标定位（两种方式）

```js
// 方式 A: 已有稳定 targetId（C 创建过）
{ tool: 'rough-notation', action: 'underline', targetId: 'q-key-1', order: 1 }

// 方式 B: 区域 + 原文 + 出现次（推荐 Agent B 用）
{
  tool: 'rough-notation',
  action: 'highlight',
  target: { region: 'question', exactText: '题目中要标记的原文', occurrence: 1 },
  order: 2,
  options: { multiline: false, rtl: false }
}
```

> **`exactText` 必须是完整原文，禁止改写**。`occurrence` 默认 1，同文重复时指定第几个。

### 3.3 时长自动计算（按汉字宽度）

```js
MARK_DURATION_PER_HAN_WIDTH_MS = 400  // 1 个汉字宽度 = 400ms

function estimateMarkDurationMs(element, { multiline }) {
  const totalWidth = element 总渲染宽度（multiline 时累加各 rect）
  const hanWidth = max(computedFontSize, fallbackFontSize)
  const equivalentHanWidth = totalWidth / hanWidth
  return max(1, round(equivalentHanWidth * 400))  // ms
}
```

> 例：3 个汉字宽度 ≈ 1200ms。Agent 不填，程序按目标实际渲染宽度折算。

---

## 四、rough-line / rough-arrow 工具（画几何）

### 4.1 坐标格式（百分比 0—100）

```js
{
  tool: 'rough-line',
  region: 'analysis',
  order: 3,
  start: [10, 45],   // 百分比 [x, y]，0—100
  end:   [50, 45],
  style: { colorId: 'ink', strokeWidthId: 'normal' }
}
```

### 4.2 颜色与笔宽

| colorId | 值 |
|---|---|
| `ink` | `#263238`（墨色，默认） |
| `red` | `#d64545`（强调红） |

| strokeWidthId | 值 |
|---|---|
| `normal` | 2（默认） |
| `emphasis` | 3（粗，用于高线/关键线） |

### 4.3 时长自动计算（按几何长度）

```js
DRAWING_SPEED_DESIGN_PX_PER_SECOND = 180  // 设计像素/秒
MIN_DRAWING_DURATION_MS = 600             // 最短 600ms

function estimateDrawingDurationMs(action) {
  const lengthDesignPx = geometryLength(action)  // 直线=distance(start,end)
                                                   // 箭头=shaft + 2 * head
  const durationMs = lengthDesignPx / 180 * 1000
  return max(600, round(durationMs))
}
```

> 例：300px 直线 ≈ 1667ms。箭头额外算两个 head 边长。

### 4.4 箭头自动生成

箭头头部由程序按 shaft 长度自动算：
- `headLength = clamp(18, shaftLength * 0.12, 42)`
- `spread = π/7`（约 25.7°）
- 两条 head 边从 end 反向延伸

> Agent 只给 `start` 和 `end`，箭头形状由程序决定。

---

## 五、一维单手时间线（computeRowGroupTimeline）

### 5.1 单 Row 内的时间线（绝对串行）

```
Row 开始 (t=0)
    ↓
[口播] speechDurationMs ──────────────────────────────────┐
    ↓                                                       │
[板书] boardStartDelayMs → boardDurationMs                  │ 两者取最大
    ↓                                                       │
[动作1] startOffsetMs → durationMs → + HAND_LIFT_GAP_MS    │
    ↓                                                       │
[动作2] startOffsetMs → durationMs → + HAND_LIFT_GAP_MS    │
    ↓                                                       │
handWorkEndMs                                              │
    ↓                                                       │
rowTotalDurationMs = max(speechDurationMs, handWorkEndMs) ──┘
```

### 5.2 关键参数

| 参数 | 值 | 说明 |
|---|---|---|
| `boardStartDelayMs` | `min(2000, max(1000, speechDurationMs * 0.2))` | 板书起手延迟（口播念到关键词再落笔），可被 `row.board.startDelay`（秒）覆盖 |
| `handCursorMs` | 累加 | 动作串行游标，每个动作 end + HAND_LIFT_GAP_MS |
| `HAND_LIFT_GAP_MS` | 600ms | 动作间抬笔间隔 |
| `rowTotalDurationMs` | `max(speech, hand)` | Row 总耗时 |

### 5.3 跨 Row 全局时间线

```
Row 1: estimatedStartMs = 0, estimatedEndMs = T1
       globalCursorMs = T1 + ROW_GAP_MS
Row 2: estimatedStartMs = T1 + ROW_GAP_MS, estimatedEndMs = ...
       globalCursorMs = ...
...
```

`AGENT_B_V2_ROW_GAP_MS = 1500ms`（Row 间停顿）。

---

## 六、actionSpec 输出规范（Agent B 必读）

### 6.1 字段

```js
{
  tool: 'rough-notation' | 'rough-line' | 'rough-arrow',
  action: 'underline' | 'highlight',  // 仅 rough-notation 需要
  region: 'question' | 'analysis' | 'solution' | 'summary',
  order: 正整数,                       // 单手队列顺序
  target: { region, exactText, occurrence },  // rough-notation 方式 B
  targetId: 'string',                 // rough-notation 方式 A
  start: [x, y], end: [x, y],         // rough-line / rough-arrow，百分比 0—100
  style: { colorId, strokeWidthId },  // rough-line / rough-arrow
  options: { multiline, rtl },        // rough-notation
  triggerAt: '+00:00:SS'              // 本 Row 开始后多少秒触发（B 输出参考）
}
```

### 6.2 B 不得填的字段

| 字段 | 原因 |
|---|---|
| `durationMs` / `estimatedDurationMs` | 程序按汉字宽度/几何长度算 |
| `gapAfterMs` | 默认 = MIN_HAND_LIFT_GAP_MS |
| `seed` | roughjs 随机种子 |
| 任意未注册字段 | 白名单外的字段直接被 validate 拒 |

### 6.3 B 必须填的字段

| 字段 | 要求 |
|---|---|
| `tool` | 白名单三选一 |
| `order` | 正整数，单手队列顺序 |
| `target` 或 `targetId` | rough-notation 二选一 |
| `region` | rough-line/rough-arrow 必填，限定绘图不跨区 |
| `start` / `end` | rough-line/rough-arrow 必填，百分比 0—100 |

---

## 七、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| 自造工具 | `tool: 'circle'` | 白名单只有 3 个，返回缺口给 Check Agent |
| 改下划线颜色 | `options.colorId: 'blue'` | 颜色锁定，抛 `颜色固定为 red` |
| 填 durationMs | `action.durationMs: 2000` | 抛 `Agent 不得覆盖` |
| 抬笔间隔过短 | `gapAfterMs: 300` | 抛 `抬笔间隔不得小于 600ms` |
| 跨区画线 | region=analysis 但 end 落在 solution 区 | region 校验 + bounds clamp |
| 坐标越界 | `start: [150, 50]` | 抛 `必须是 0—100 的百分比坐标` |
| 未取消残留 | 用户切题后老动作继续写画布 | `cancelAll()` 立即 `generation += 1` |
| 并发动作 | 同时 underline + draw-line | teacher-hand-exclusive 互斥，队列串行 |

---

## 八、快速参考

```
互斥: teacher-hand-exclusive, 任意时刻只一笔
工具白名单: rough-notation(underline/highlight) / rough-line / rough-arrow
颜色锁定: underline=red #d64545 / highlight=yellow #f8e58c
笔宽: normal=2 / emphasis=3
坐标: 百分比 0—100, 原点左上
抬笔间隔: MIN_HAND_LIFT_GAP_MS = 600ms (硬下限)
时长: 程序按汉字宽度 400ms/字 / 几何长度 180px/s 自动算, Agent 不得填
箭头: 程序自动生成, Agent 只给 start/end
取消: cancelAll() → generation += 1, 在途任务抛 "已取消"
时间线: 单 Row 内口播+板书+动作取最大, 跨 Row 加 ROW_GAP_MS=1500ms
```
