# 00-TRUTH-BASE (唯一真相基线)

> **核心法则**：
> 1. **0 置信原则**：任何未经过代码执行、契约比对、实测验证的代码和文档，一律视作「存疑」，必须重新审计。
> 2. **树干主干向外延展**：从系统主输入（Handoff）到主输出（五字段/渲染），单向流转，层层锚定。
> 3. **领地划分**：每个 Agent 只能认领一个独立模块（领地），不得越界修改全局公共约定。
> 4. **物理降噪**：废弃代码、互相冲突的临时代码统一隔离或清理，不污染主干。

---

## 领地地图与树干结构 (Territory Map)

```
[树根 ROOT: 真相输入]
  │  handoff.json (唯一真相源)
  │  ├─ boardPlan (四区 bounds: x, y, w, h)
  │  ├─ canvasParams (字号、行高、canvasSize)
  │  └─ coordinateMode (percentage / pixel)
  ▼
[树干 TRUNK: 核心调度与契约]
  │  领地 A: Agent B 主控与 Prompt
  │  领地 B: Contract 归一化与防御兜底
  │  领地 C: 板书工具注册与调度 (Board Tools Catalog)
  ▼
[树枝 BRANCH: 表现与执行层]
  │  领地 D: TTS 口播与发音保护网
  │  领地 E: 下游画布与物理渲染引擎 (微抖动/达芬奇手稿感)
  ▼
[树叶 LEAF: 质量与验收]
  │  领地 F: Check Agent 校验与交付
```

---

## 领地任务说明卡 (Agent Territories)

### 领地 A：Agent B 核心大脑 (Prompt & Model IO)
- **负责文件**：`src/agent-b-v2/prompt.js`, `server/agentBV2Handler.js`
- **铁律**：
  1. 输出五字段结构 (`rows`: `stage`, `speech`, `board: {content, startDelay}`, `actionSpec`)。**板书不输出起手坐标**（`startCoord` 已废弃：真源 = `src/agent-b-v2/contract.js` 的 `normalizeBoard`，起手位置/换行/行距由领地 E 渲染层排版）。
  2. B 不计算毫秒时长（duration），只输出 `startDelay` 起笔秒数。
  3. 绝对单手串行：动作在板书写完后依次排队（`order` 自增），绝不重叠。
  4. 坐标模式严格按 `coordinateMode` 输出。

### 领地 B：合同守门人 (Contract & Defense)
- **负责文件**：`src/agent-b-v2/contract.js`
- **铁律**：
  1. 负责容错吸附（Stage 别名吸附、JSON 补全）。
  2. `sanitizeRowLayout` 兜底物理间距（垂直防重叠、下界防溢出）。
  3. 绝不让模型崩盘导致的脏数据流向下游。

### 领地 C：板书工具箱 (Board Tools Registry)
- **负责文件**：`src/board-tools/*`
- **铁律**：
  1. 只有已注册的 4 个工具可以活动的区域是整个画布 (`rough-notation`, `rough-line`, `rough-arrow`, `draw`)。
  2. `rough-notation` 必须锚定 `target.exactText`（已有文字）。
  3. `rough-line` / `rough-arrow` 要锚定文字。

### 领地 D：TTS 口播与保护网 (Speech Engine)
- **负责文件**：`src/lib/speechMarkdown.js` 及口播规则
- **铁律**：
  1. 分数转大白话（分母分之分子）。
  2. 保护词注入：`字母x` -> 艾克斯，`行数` -> 航数。
  3. 纯净口语毛料，严禁输出 LaTeX/Markdown 标签给 TTS。

### 领地 E：手稿感与渲染引擎 (Canvas & Aesthetics)
- **负责文件**：前端渲染与画布组件
- **铁律**：
  1. 达芬奇手稿感、微斜（skew/rotate）、行间距/字间距微抖动（±10%）、笔画速度扰动**全部由本层实现**。
  2. **严禁将渲染算法塞给 Agent B 算**，本层读取规范坐标后自行叠加自然有机晃动。

### 领地 F：Check Agent 质检官
- **负责文件**：`src/check-agent/*`, `server/checkAgentHandler.js`
- **铁律**：
  1. 依据真相基线核对，不卡死多样性解法（松门槛）。
  2. 拦截越界坐标、拦截未转写 LaTeX 口播、拦截非法工具。


允许的弹性：
# 动作与标记真实契约（领地 C 深度对齐）

> 依据夏夏的核心诉求与底层代码 `roughNotationTool.js` / `textTargetRegistry.js` 全面澄清

---

## 一、动作工具的“2个核心兜底”：下划线 (underline) 与 画圈 (circle)

代码真实支持情况：
底层 `roughNotationTool.js` 原生支持以下能力，其中夏夏指定的 **下划线** 和 **画圈** 是最核心、最自然的兜底动作：
1. **下划线 (`underline`)**：在关键词或数字下方画手绘下划线。
2. **画圈 (`circle`)**：在关键词或数字外侧画手绘椭圆圈出（重点强调）。

### 为什么必须“锚定文字”（Target exactText）？
- **铁律事实**：`rough-notation` 渲染依赖浏览器的 `TextRange.getBoundingClientRect()` 动态获取文字坐标。
- **如果不锚定真实文字**：它找不到对应 DOM 节点，标记会直接**悬空漂移**或报错丢弃。
- **全画布 4 个区域覆盖**：
  - `target.region` 支持：`question`（题目）、`analysis`（分析）、`solution`（解答）、`summary`（总结）。
  - 在题目区画圈/划线时，`exactText` 必须逐字匹配题目文本；在分析/解答区画圈时，必须匹配已写出的板书文字。

---
更新升级：
## 二、起手时刻与语义锚点（triggerAt vs startDelay 统一事实）

夏夏提出：（二选一待讨论，因为有些时候时间不好掐，比如：写一半，要画，再写，这种情况）
> *"动作 triggerAt 是本 row 开始后多少秒，格式 +00:00:SS，建议可以以口播稿的某个关键词念到为锚点，提高准确性"*

### 代码真实流转逻辑核对：
1. **口播关键词锚点机制**：
   - 核心原则：念到该目标内容词的时候，有人感的起笔开始画（抬手，画圈的节奏：慢——渐渐快；一条横线的节奏：慢—缓快—落慢）。
   - 之前老规范写成 `triggerAt: "+00:00:SS"`；而当前 UI 与时间轴系统（`AgentBDirect.vue` + `timing.js`）全面推行了**秒级数字延时**。
2. **两套表达的兼容契约**：
   - 模型无论是按语义理解词频换算出的秒数（如 `1.5` 秒），还是历史格式 `+00:00:02`，代码层在 `contract.js` / `timing.js` 中一律支持解析转换。
   - **核心精髓**：Agent 在构思动作时，**必须根据口播语境（当念到哪一个核心词时）决定起笔时刻**，而不是机械地盲猜一个数字。

---

## 三、达芬奇手稿风格与弹性区域（防止文字溢出）

夏夏提出：
> *"板书坐标推荐 region 区域内，但是根据题目实际情况，以上课讲题板书，内容很多写不下的时候往旁边写，和达芬奇的手稿感为风格，弹性调整几个区间的空白处，可自己塞，不要让内容溢出画布"*

### 代码实现与边界红线：
1. **软引导（达芬奇随性手稿感）**：
   - 允许板书行像草稿一样错落有致、不拘泥于死板的网格对齐。
   - 内容多写不下时，可以往右侧或下方留白处弹性延展。可以歪着写，原则就是像老师写黑板解题（黑板写满了，开始在题目解答区域旁边找空白的地方塞。。。。很人感）
2. **硬约束（绝不溢出画布）**：
   - `contract.js:sanitizeRowLayout` 已内置下界拦截：
     - 当 Y 坐标接近画布极限或容器底线 `(y + h - 5%)` 时，系统自动柔和限位，绝不让字飞出屏幕外面。
   - 垂直行距必须留足（12%~16%），防止草稿感变成字叠字糊成一团。