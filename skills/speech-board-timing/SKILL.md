---
name: speech-board-timing
description: "口播语速与板书书写时间节奏技巧蒸馏。语速 160 cpm（60000/160≈375ms/字），中文标点停顿（。700ms / ，500ms / ……1000ms），板书书写 1秒2~3字（基准 400ms/字 + ±80ms 抖动模拟真人手感），抬笔换手 600ms，Row 间停顿 1500ms，板书起手自适应延迟（口播念到关键词后再落笔，约 1.2—2.0s）。口播分数念'分母分之分子'，未知数念'艾克斯'，乘号念'乘以'，加号念'加'，小数逐位汉字。用于 Agent B 写口播+板书节奏 / 渲染层估算总时长 / Check Agent 校验口播发音合规。"
version: "1.0.0"
archetype: workflow
trigger: "写口播稿/估算口播时长/校验口播发音合规/板书书写节奏/Row间停顿/标点停顿"
---

# 口播语速与板书书写时间节奏

> *"语速是骨，节奏是肉。160 字/分钟不是快的，是听得清的。写字比说话慢，所以板书要等口播念到关键词再落笔。"*

## 蒸馏合同

`Distill [口播语速与板书书写时间节奏] as a [workflow] pack so it can help with [Agent B 写口播+板书节奏 / 渲染层估算总时长 / Check Agent 校验口播发音合规], using [src/agent-b-v2/timing.js + src/services/speechTiming.js], while respecting [B 不输出时间字段 / 时间由下游动态算 / 口播发音硬规范].`

---

## 一、口播语速

### 1.1 基准常量

| 常量 | 值 | 说明 |
|---|---|---|
| `AGENT_B_V2_SPEECH_RATE` | **160 cpm** | 每分钟 160 字 |
| `SPEECH_MS_PER_CHARACTER` | `60000/160 ≈ 375ms` | 每字 375ms（含正常停顿摊销） |
| `SPEECH_TIMING_SOURCE` | `speech-estimate-170-cpm` | 旧版 170 cpm 标识，B-v2 用 160 |
| `SPEECH_ROW_GAP_MS` | 300ms | 旧版 Row 间停顿（B-v2 用 1500ms） |

### 1.2 字数计算（去标点）

```js
function countCharacters(speech) {
  return [...normalizeSpeech(speech)
    .replace(/\s+/g, '')
    .replace(/[。，、；：？！""''（）《》【】……—.,!?;:'"()[\]<>~`@#$%^&*_+=|\\/]/g, '')].length
}
```

> **去掉空白和中英文标点**，只数有效发音字符。LaTeX 控制符（`\frac` `\times` `\text`）已在更上层处理。

### 1.3 中文标点停顿（额外加在语速之上）

| 标点 | 停顿 | 出现位置 |
|---|---|---|
| `。` | **700ms** | 句末 |
| `，` | **500ms** | 句中分句 |
| `…+`（省略号） | **1000ms** | 思考、犹豫、过渡 |

```js
function countPunctuationPause(speech) {
  const periodCount   = (text.match(/。/g) || []).length
  const commaCount    = (text.match(/，/g) || []).length
  const ellipsisCount = (text.match(/…+/g) || []).length
  return periodCount * 700 + commaCount * 500 + ellipsisCount * 1000
}
```

### 1.4 口播时长公式

```
speechDurationMs = max(1200, round(字数 * 375) + 标点停顿)
                  = max(1200, round(字数 * 60000 / 160) + 标点停顿)
```

> **下限 1200ms**：极短口播（如"嗯…"）也要至少 1.2s，避免动作来不及。
> **空口播 fallback**：`speechDurationMs = 1500ms`（无字时固定 1.5s 停顿）。

---

## 二、板书书写节奏（1 秒 2~3 字）

### 2.1 基准常量

| 常量 | 值 | 说明 |
|---|---|---|
| `BASE_CHAR_WRITE_MS` | **400ms** | 1 个汉字书写基准（1秒2.5字） |
| 抖动区间 | **360—440ms** | 模拟真人手感，避免机械感 |
| `HAND_LIFT_GAP_MS` | **600ms** | 抬笔换手间隔（与动作调度共用） |
| `AGENT_B_V2_ROW_GAP_MS` | **1500ms** | Row 间停顿 |

### 2.2 书写时长计算（带抖动）

```js
function calculateBoardWritingDuration(content) {
  // 1. 去 LaTeX 结构控制符
  const clean = text
    .replace(/\\(begin|end)\{[^}]+\}/g, '')
    .replace(/\\(frac|times|div|aligned)/g, ' ')
    .replace(/\s+/g, '')
  const charCount = max(1, [...clean].length)

  // 2. 逐字累加，每字 360—440ms 微抖动
  let durationMs = 0
  for (let i = 0; i < charCount; i++) {
    const jitter = ((i * 17) % 7 - 3) * 10   // -30, -20, -10, 0, 10, 20, 30
    durationMs += max(320, 400 + jitter)
  }
  return durationMs
}
```

> **抖动算法**：`((i * 17) % 7 - 3) * 10` → 周期性 7 步循环（-30, -20, -10, 0, 10, 20, 30），不是真随机，保证估算可复现。下限 320ms 不让任何字写得太快。

### 2.3 板书起手延迟（自适应）

```
boardStartDelayMs = row.board.startDelay ? round(startDelay * 1000) 
                  : min(2000, max(1000, round(speechDurationMs * 0.2)))
```

- **默认**：口播开始 20% 时长后落笔（约 1.2—2.0s）
- **可覆盖**：`row.board.startDelay`（秒数）显式指定
- **意图**：等口播念到关键词再落笔，避免手先于嘴

### 2.4 板书结束点

```
boardEndDelayMs = boardStartDelayMs + boardDurationMs
```

---

## 三、单动作时长（参考值）

> 真实时长由 `hand-action-control` skill 的程序算，这里只给 Agent B 估算总时长参考。

| 工具 | 估算时长 | 算法 |
|---|---|---|
| `rough-notation` | 1200ms | 按目标宽度 1 汉字 400ms 折算 |
| `rough-line` | 800ms | 按几何长度 180px/s |
| `rough-arrow` | 900ms | 按几何长度（含 2 个 head） |
| 其他/兜底 | 1000ms | — |

```js
function estimateActionDuration(action) {
  const tool = action?.tool || ''
  if (tool === 'rough-notation') return 1200
  if (tool === 'rough-line')     return 800
  if (tool === 'rough-arrow')    return 900
  return 1000
}
```

---

## 四、Row 组时间线（1D 单手串行）

### 4.1 单 Row 内

```
speechDurationMs = max(1200, 字数 * 375 + 标点停顿)  或 1500 (空)

handCursorMs = hasBoard ? boardEndDelayMs + 600 : 500
for each action:
  startOffsetMs = handCursorMs
  durationMs = estimateActionDuration(action)
  endOffsetMs = startOffsetMs + durationMs
  handCursorMs = endOffsetMs + 600  // 抬笔

handWorkEndMs = (actionCount > 0) ? handCursorMs - 600 : boardEndDelayMs

rowTotalDurationMs = max(speechDurationMs, handWorkEndMs)
```

> **核心**：口播与手部动作是并行轨道，但手部内部（板书+动作）是绝对串行。Row 总耗时 = max(口播, 手部)。

### 4.2 跨 Row 全局时间线

```
Row 1: estimatedStartMs = 0
       estimatedEndMs = T1
       globalCursorMs = T1 + 1500  // ROW_GAP

Row 2: estimatedStartMs = globalCursorMs
       estimatedEndMs = estimatedStartMs + rowTotalDurationMs
       globalCursorMs = estimatedEndMs + 1500
...
```

### 4.3 估算状态标记

```js
{
  ...row,
  timingStatus: 'estimated',
  timingSource: 'agent-b-v2-1d-row-group',
  speechCharacters,
  estimatedDurationMs,
  estimatedStartMs,
  estimatedEndMs,
  rowTimeline: { ...timeline, globalStartMs, globalEndMs }
}
```

> **重要**：B 输出 `timingStatus: 'estimated'` 表示这只是估算，真实时长待 TTS 跑完回填。

---

## 五、口播发音硬规范（Check Agent 校验）

### 5.1 分数（不得用斜杠）

```
❌ "3/4"           → 念成 "三分之四"（错！分子分母搞反）
❌ "三分之四"       → 中文数字念分子分母（错！必须阿拉伯数字）
✅ "4分之3"         → 正确（阿拉伯数字 + "分母分之分子"）
```

```js
validateSpeechFractionReading(speech)
// 检测 /\d+\s*[\/⁄]\s*\d+/ → "口播中的分数不得使用斜杠"
// 检测 /(?:[零〇一二两三四五六七八九十百千万亿]+分之|分之[零〇...]+)/ → "分子分母必须使用阿拉伯数字"
```

### 5.2 数学符号（不得保留原文）

```
❌ "x + 3 = 5"     → 保留 x / +
✅ "艾克斯加三等于五"
```

```js
validateSpeechMathReading(speech)
// 检测 /[xX×]/    → "口播不得保留 x、X、×；未知数写'艾克斯'，乘号写'乘以'"
// 检测 \\.+       → "口播中的 + 必须写成'加'"
// 检测 KaTeX 命令  → "口播不得包含 KaTeX 命令或 $ 定界符"
```

### 5.3 小数（逐位汉字）

```
❌ "3.14"          → 保留小数点
❌ "3点14"        → "14" 当数念
❌ "3点十四"      → 合并成数位
✅ "3点一四"      → 逐位汉字
```

```js
validateSpeechDecimalReading(speech)
// 检测 /\d+\.\d+/          → "口播小数不得保留小数点符号"
// 检测 /\d+点\d+/          → "小数点后每位必须使用汉字数字单独书写"
// 检测 /\d+点[零〇...十百千万亿]/ → "小数部分不得合并成十、百等数位"
```

---

## 六、与 handoff JSON 的对接

### 6.1 字段读取

| handoff 字段 | 本 skill 用途 |
|---|---|
| `stageRatioSuggestion` | Row 行数分配（决定总时长与每区密度） |
| `suggestedGrade` | 1—3 年级短问题链（节奏慢）；4—6 年级逻辑探究（节奏可稍快） |
| `essence` | 解答绝对主体时大部分时间在口播+板书同步；分析≈解答试错链时停顿多 |

### 6.2 B 不输出时间字段

| B 不填 | 原因 |
|---|---|
| `duration` / `durationMs` | 由下游按 160cpm + 400ms/字 + 标点停顿算 |
| `startAt` / `endAt` | 由 Row 时间线全局累加 |
| `triggerAt` 可填参考 | 但下游会重算 |

---

## 七、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| 写太快 | 1 秒 5 字 | 基准 400ms/字 + 360—440 抖动，下限 320 |
| 写太慢 | 1 秒 1 字 | 上限 440ms，超出视为卡顿 |
| 机械等长 | 每字都 400ms | 抖动 7 步循环避免机械感 |
| 板书先于口播 | 手在嘴前 | `boardStartDelayMs = speechDurationMs * 0.2`，等口播念到关键词 |
| 念斜杠 | "3/4" | 改"4分之3"（分母分之分子） |
| 念字母 | "x" | 改"艾克斯" |
| 念符号 | "+" | 改"加" |
| 小数点 | "3.14" | 改"3点一四"（逐位汉字） |
| 标点不停顿 | "你好。你好。" 无 700ms | 程序按句号 700ms / 逗号 500ms 加 |
| 极短口播 | "嗯。" < 1200ms | `max(1200, ...)` 下限保护 |

---

## 八、快速参考

```
语速: 160 cpm (375ms/字)
标点停顿: 。700ms / ，500ms / ……1000ms
口播时长: max(1200, 字数*375 + 标点停顿)  空口播=1500ms
板书: 400ms/字 + 360—440 抖动 (1秒2.5字)
板书起手: max(1000, min(2000, speech*0.2))，可被 startDelay 覆盖
动作估算: notation 1200 / line 800 / arrow 900 / 其他 1000 ms
抬笔: 600ms（与动作调度共用 MIN_HAND_LIFT_GAP_MS）
Row 间: 1500ms (AGENT_B_V2_ROW_GAP_MS)
Row 总: max(speechDurationMs, handWorkEndMs)
B 不填: duration / startAt / endAt / durationMs / estimatedDurationMs
口播硬规范: 分数=分母分之分子 / x=艾克斯 / ×=乘以 / +=加 / 小数逐位汉字
```
