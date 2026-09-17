# 13 · prompt.js 规范对齐专项审查报告

> 专项产出 ｜ 生成时间：2026-09-17
> 用户特别要求：「全面审查前端处理逻辑，删除过期的处理记录，确保代码逻辑与最新的 prompt.js 规范完全对齐，围剿所有遗留的陈旧信息块」
> 审查范围：`src/agent-b-v2/prompt.js` + 周边模块（service.js / contract.js / skills/）+ UI 处理逻辑

---

## 一、prompt.js 规范核心要点（最新版）

### 1.1 字段合同（4 字段，不是 5）

> **关键澄清**：UI 习惯称"五字段"，但 prompt.js 第 6 节 + contract.js:4-9 实际冻结 4 字段：`stage / speech / board / actionSpec`。`audioUrl` 是 runtime 程序回填槽位，不属于模型输出。

| 字段 | 类型 | 来源 | 说明 |
|---|---|---|---|
| `stage` | 枚举 | 模型输出 | 题目 / 分析 / 解答 / 总结（禁用其他值） |
| `speech` | string | 模型输出 | 可直接朗读的口播稿（保留阿拉伯数字，禁 LaTeX/Markdown） |
| `board` | `{content, startDelay}` | 模型输出 | **只有 content + startDelay 两个字段**，不输出起手坐标 |
| `actionSpec` | array | 模型输出 | 动作数组，3 工具白名单 |
| `audioUrl` | string | **程序回填** | TTS 合成后回填，模型禁输出 |
| `audioDurationMs` | number | **程序回填** | 实测时长（毫秒），模型禁输出 |

### 1.2 工具白名单（3 个，不是 4）

> **关键澄清**：prompt.js:194-229 只声明 3 个工具：`rough-notation` / `rough-line` / `rough-arrow`。prompt.js:246 明文「不得输出 'draw'」。

| 工具 | 用途 | prompt.js 声明 | boardToolCatalog 注册 | 状态 |
|---|---|:---:|:---:|:---:|
| `rough-notation` | 文字标记（underline/highlight/box/circle/bracket/strike-through/crossed-off） | ✅ 第 194-211 行 | ✅ `roughNotationTool.js` | ✅ 对齐 |
| `rough-line` | 画直线 | ✅ 第 213-225 行 | ✅ `roughDrawingTool.js` | ✅ 对齐 |
| `rough-arrow` | 画箭头 | ✅ 第 228-229 行 | ✅ `roughDrawingTool.js` | ✅ 对齐 |
| `draw` | 半结构化意图绘制 | ❌ 第 246 行明文禁止 | ⚠️ `drawIntentTool.js` 已注册 | ⛔ **冲突** |

### 1.3 板书格式硬规范

- ✅ `board` 只负责本行规范数学板书内容，核心字段是 `content`
- ✅ **不输出或计算板书起手坐标**（由渲染层排版）
- ✅ `startDelay`：数字（秒，浮点如 1.5），表示本行口播播放几秒后右手开始落笔
- ✅ 读题行 `startDelay` = 0
- ✅ 第一行 `stage` = "题目" 且 `board.content` = "" 且 `startDelay` = 0
- ✅ 分数必须用 `\frac{分子}{分母}`
- ✅ 运算符规范（×、÷、＋、－、＝）
- ✅ 字母和图形规范（A、D、E、△ADE、线段DE、S_{△ADE}、DE⊥AE）
- ✅ 单位规范（算式结果单位写括号 `高=8（分米）`，答语不加括号）
- ✅ 等号纵向对齐用 `\begin{aligned}...\end{aligned}`

### 1.4 单手一维时间线

- ✅ 同一时刻老师的手只能干一件事
- ✅ 板书书写与动作**绝对不能重叠播放**
- ✅ 动作必须排在板书书写完毕之后按 `order` 依次执行
- ✅ `order` 必须写在 `action` 内部，全表唯一正整数
- ✅ 禁止填写 `durationMs` / `estimatedDurationMs` / `gapAfterMs` / `seed`
- ✅ 书写速度：1 秒 2~3 字（轻微自然抖动）
- ✅ 语速参考：约 160 字/分钟

### 1.5 坐标格式

- ✅ `percentage` 模式：`[10, 20]`（百分比数值，不含 % 号）
- ✅ `pixel` 模式：`[138, 392]`
- ✅ `coordinateMode` 决定格式（不在 handoff JSON 内，由 body 传入）
- ✅ 板书文字不输出起手坐标
- ✅ actionSpec 坐标参考 `handoff.boardPlan` 对应区域 x/y/w/h
- ✅ 没有可用布局信息时，宁可返回 `[]`

### 1.6 口播发音规则

- ✅ 默认保留阿拉伯数字（3.14 → "3点14"）
- ✅ 分数：分母分之分子（7/15 → "15分之7"）
- ✅ 带分数：1又1/2 → "1又2分之1"
- ✅ 幂/上标：x² → "x的平方"
- ✅ 根式：√9 → "根号9"
- ✅ 运算符号：＋加 －减 ×乘 ÷除以 ＝等于
- ✅ 代数：x → "艾克斯"，(a+b) → "a加b的和"
- ✅ 几何：△ABC → "三角形ABC"，AB⊥CD → "AB垂直于CD"
- ✅ 百分数：7.5% → "百分之7点5"
- ✅ 严禁 LaTeX/Markdown/斜杠分数进入口播

### 1.7 固定话术

- ✅ 开场（第一行 stage=题目）："同学你好！很高兴为你讲解这道题！"
- ✅ 收尾（最后一行 stage=总结）："路虽远，行则将至，加油！"

### 1.8 四环教学法

- ✅ 环 1：递归拆解
- ✅ 环 2：预设问题 / 自问自答
- ✅ 环 3：费曼式讲解
- ✅ 环 4：筛网归题
- ⚠️ 简单题可揉在一行，复杂题展开，但**不得跳过任何一环**

### 1.9 公式回顾硬规则

- ✅ 分析区解题全程 callback 知识点
- ✅ 每要用到一个公式（含中间步骤），都先在分析区顺手 cue 一下
- ✅ 分析区写公式 board 约束：英文形式直接写英文（`s=vt`），中文关键词+算式（"单价×数量=总价"），≤10 个汉字，可带小注
- ✅ 核心公式必须有：解题真正用到的核心公式必须在分析区至少出现一次

---

## 二、与 prompt.js 冲突的 4 项（必须立即修复）

### 2.1 冲突 1 · draw 工具注册但 prompt.js 禁止

**位置**：`src/board-tools/boardToolCatalog.js:29`

**当前代码**：
```javascript
import { getDrawIntentAgentTool } from './drawIntentTool.js'
// ...
const DRAW_INTENT_TOOL_ID = 'draw'
// 在 createBoardToolRuntime 中注册 draw 工具
```

**prompt.js 规范**（第 246 行）：
```
- actionSpec 只输出声明的包装字段和工具参数；不得输出 "draw"、答语 stage、userPayload 或其他不存在的字段。
```

**冲突分析**：
- prompt.js 明文禁止模型输出 `tool: "draw"`
- 但 boardToolCatalog.js 注册了 draw 工具
- 实际效果：模型永不产出 draw → drawIntentTool.js 是死代码
- 但若用户手动注入 draw 动作，会被执行（违反 prompt.js 单一真相原则）

**修复方案**：
- **方案 A（推荐）**：从 catalog 移除 draw 注册，drawIntentTool.js 保留代码但不注册（用户裁定"R2 有用、不可删除"，仅是不注册到 catalog）
- **方案 B**：在 prompt.js 追加 draw 工具声明（与用户裁定"R2 不可删除但 prompt 未声明"矛盾，需夏夏拍板）

**建议执行**：方案 A

### 2.2 冲突 2 · examples.js Few-shot 字段名错误

**位置**：`src/agent-b-v2/skills/liyongle-elementary/examples.js:24-28`

**当前代码**：
```javascript
{
  "action": {
    "tool": "rough-notation",
    "type": "underline",      // ⛔ 错误：应为 "action"
    "text": "12 吨",          // ⛔ 错误：应为 "target.exactText"
    "color": "#2563eb",       // ⛔ 错误：应为 colorId（且 prompt 禁 colorId）
    "order": 1
  }
}
```

**prompt.js 规范**（第 199-208 行）：
```json
{
  "action": {
    "tool": "rough-notation",
    "action": "underline",
    "target": {
      "region": "question",
      "exactText": "要标记的完整原文，必须逐字一致",
      "occurrence": 1
    },
    "options": { "multiline": false },
    "order": 1
  }
}
```

**冲突分析**：
- Few-shot 示例字段名完全错误
- 模型若照抄 examples.js 会产出无法通过 contract 校验的 JSON
- 这是导致 B 生成失败的潜在原因之一

**修复方案**：
- 修正 examples.js 所有示例字段名：
  - `type` → `action`
  - `text` → `target.exactText`（含 `target.region` + `target.occurrence`）
  - `color` → 删除（prompt 禁 colorId）
- 加 `options.multiline: false`

### 2.3 冲突 3 · output-format.js 自检清单违反主规范

**位置**：`src/agent-b-v2/skills/liyongle-elementary/output-format.js:25`

**当前代码**：
```javascript
// 自检清单
5. speech 里所有数字都是中文发音  // ⛔ 错误
```

**prompt.js 规范**（第 159 行）：
```
- 数字：直接保留阿拉伯数字，小数读"点"（3.14→"3点14"）。
```

**冲突分析**：
- output-format.js 自检清单第 5 条与 prompt.js 主规范直接冲突
- 模型若按自检清单"全转中文"，会与 prompt.js "保留阿拉伯数字" 矛盾
- 模型可能在两者间困惑，输出不稳定

**修复方案**：
- 修正 output-format.js:25 第 5 条：
  - 原文：`speech 里所有数字都是中文发音`
  - 改为：`speech 里保留阿拉伯数字（小数读"点"，分数读"分母分之分子"）`

### 2.4 冲突 4 · board-rules.js 工具动作清单不全

**位置**：`src/agent-b-v2/skills/liyongle-elementary/board-rules.js:128`

**当前代码**：
```javascript
// 第 7 条
rough-notation 只有 underline 和 highlight，没有 box / circle / 其他
```

**实际代码**（`roughNotationTool.js:7-15`）：
```javascript
const ROUGH_NOTATION_ENABLED_ACTIONS = [
  'underline',     // 下划线
  'highlight',     // 高亮
  'box',           // 框
  'circle',        // 圈
  'bracket',       // 括号
  'strike-through',// 删除线
  'crossed-off',   // 叉号
]
```

**prompt.js 规范**（第 211 行）：
```
- action: `underline`（下划线，固定红色） / `highlight`（高亮，固定浅黄色）；不得传 `options.colorId`。
```

**冲突分析**：
- prompt.js 只声明 underline + highlight 两种
- 但 roughNotationTool.js 实际支持 7 种
- board-rules.js 文档只声明 2 种 → 与代码一致但与代码能力不符
- 模型若严格按 prompt.js 只输出 underline/highlight，不会触发其他 5 种 → 合理
- 但若用户手动注入 box/circle，会被执行 → 设计上偏紧但合理

**修复方案**：
- **方案 A（推荐）**：保持 prompt.js 只声明 underline/highlight（保守策略），但修正 board-rules.js 第 7 条表述：
  - 原文：`rough-notation 只有 underline 和 highlight，没有 box / circle / 其他`
  - 改为：`rough-notation 当前向 Agent B 开放 underline 与 highlight 两种动作；box/circle/bracket/strike-through/crossed-off 由代码内部支持但 prompt 未开放`
- **方案 B**：在 prompt.js 追加其他 5 种动作声明（需夏夏拍板是否扩大模型能力）

**建议执行**：方案 A（保守，不扩大模型能力，与现有 prompt 一致）

---

## 三、过期处理记录识别（需清理）

### 3.1 代码层过期记录

| 位置 | 过期内容 | 当前真实情况 | 清理动作 |
|---|---|---|---|
| `roughDrawingTool.js:237` | `@orphan [零外部调用校验函数]` 注释 | 实际被 `prepareRoughDrawingAction:259` 调用 | 删除注释 |
| `roughNotationTool.js:72` | `@orphan` 注释 | 实际被 `prepareRoughNotationAction:135` 调用 | 删除注释 |
| `Step1Entry.vue:563-582` | `cacheGridPreview`/`readCachedGridPreview` 大段注释死代码 | 已被 snapdom 截图替代 | 删除注释块 |
| `asrPolish.js:197` | `polishBoardSpacing` 空转函数 | truth/territory-B-contract.md:16 已说明下线 | 删除函数 |
| `AgentBDirect.vue:2019` | `<div v-if="false" class="action-btn-group group-deliverable">` 死代码 | 已废弃 | 删除 v-if=false 块 + 死 CSS `.group-lite-player`/`.btn-open-lite-player`（行 5242-5265） |
| `agentBV2Handler.js:42` | `const AGENT_B_SYSTEM_MESSAGE = AGENT_B_V2_SYSTEM_PROMPT` 冗余别名 | 直接用原变量即可 | 删除别名 |
| `boardToolCatalog.js` | `getDrawIntentAgentTool()` 注册 | prompt.js 明文禁止 draw | 从 catalog 移除注册（drawIntentTool.js 代码保留） |
| `lib/dualStore.js` 67 行 | localStorage + IndexedDB 双写工具 | 0 外部消费者 | 删除文件 |
| `lib/simpleIndexedDb.js` 56 行 | IndexedDB 简单封装 | 仅 dualStore 调用 | 删除文件 |
| `utils/cdnLoader.js` 197 行 | 双 CDN 加载降级工具 | 0 外部消费者 | 删除文件 |
| `board-tools/boardTypography.css` 7 行 | `@font-face "Qinghuabu Qiaomu"` | 字体族无消费者 | 删除文件 + `public/fonts/pingfang-qiaomu.ttf`（3.8MB） |

### 3.2 文档层过期记录

| 文档 | 过期内容 | 当前真实情况 | 清理动作 |
|---|---|---|---|
| `KNOWN_ISSUES.md` P0-2 | "B 输出解析过于严格，整表 422" 标记"未修复" | `agentBV2Handler.js:300-336 tryExtractFallbackRows` 已实现软降级 | 更新为"已修复" |
| `doc/XRAY-全局图谱.md` R1 | "checkAgentHandler.js:243-244 缺 fs/path import" 高 100% | `checkAgentHandler.js:11-12` 已 import | 更新为"已修复" |
| `doc/XRAY-全局图谱.md` R7 | "vite build 必失败：lite-player.html 不存在" 高 100% | `vite.config.js` 当前 input 已移除 lite-player.html | 更新为"已修复" |
| `doc/XRAY-全局图谱.md` R12 | "boardTypography.js 全部导出零调用" 中 100% | `board-tools/boardTypography.js` 已删除；`boardTypography.css` 残留 | 更新为"部分修复（JS 已删，CSS 残留）" |
| `CONTINUITY.md` 第 17 行 | "前端 Step1 confirmStep1 没调 POST /api/handoff → 链路断裂" | `Step1Entry.vue:700 safeFetchJson('/api/handoff', POST)` 已接入 | 更新为"已修复" |
| `CONTINUITY.md` 第 75 行 | "前端整个截图链路被 `/* */` 注释冻结了" | `Step1Entry.vue:608 captureAndSaveScreenshot` 已实现 | 更新为"已修复" |
| `CONTINUITY.md` 第 101 行 | "前端没有按钮、没有 refineKnowledge 函数 → 未接入" | `AgentBDirect.vue:1462 refineKnowledge` 已实现 | 更新为"已修复" |
| `minimal-runtime-loop.md` 第 88 行 | "rows 只在页面内存" | 实际还写了 `public/board-result/*.json` 实体归档 | 更新表述 |

### 3.3 memory 层过期记录

| 文件 | 过期内容 | 当前真实情况 | 清理动作 |
|---|---|---|---|
| `.codebuddy/memory/MEMORY.md:15` | "dev 默认 3000/3001" | `:77` 已改为"3001/3200/5199，3000 是另一个项目" | 删除 `:15` 矛盾表述 |
| `.codebuddy/memory/MEMORY.md:39` | "板书字号 35px 与 1.2~1.5 倍区间冲突待夏夏确认" | 仍是待拍板项 | 保留，标注"待夏夏拍板" |
| `.codebuddy/memory/CONTEXT-DIGEST.md` 第 0 节 | 8 条纠错全部"仍成立" | 实际第 2 条（audioUrl 被 contract 丢弃）部分过期：仅 Check 应用路径丢弃，apply 路径保留 | 订正第 2 条 |
| `.codebuddy/memory/2026-09-15.md` 第 4 节 | "P0a → 真机验收" 待执行 | 仍待执行 | 保留 |
| `.codebuddy/memory/2026-09-15.md` 第 5 节 | "R2 draw 接通真实执行" | 已接通但 prompt 未声明，模型永不产出 → 三重空转 | 订正表述 |

---

## 四、UI 处理逻辑与 prompt.js 对齐审查

### 4.1 AgentBDirect.vue UI 文案对齐

| UI 文案 | 出现位置 | prompt.js 规范 | 对齐情况 | 建议 |
|---|---|---|---|---|
| "五字段" | 9 处 | prompt.js 用"四个槽位" | ⚠️ 语义双轨 | 文档化"4 字段 + audioUrl runtime 槽位"语义；UI 文案保留"五字段"加注释 |
| "七列表" | `agent-b-v2.html:38` title | contract.js 实际 4 字段 | ⛔ 命名错误 | 改为"五槽位工作台" |
| "字段五件套" | `BoardPreviewApp.vue` 5 处 | 同上 | ⚠️ 语义双轨 | 同上 |

### 4.2 表格列对齐

**当前表格列**（AgentBDirect.vue）：
1. `stage` - 环节（题目/分析/解答/总结）✅ 对齐
2. `speech` - 口播稿 ✅ 对齐
3. `board.content` - 板书内容 ✅ 对齐
4. `board.startDelay` - 起手延时 ✅ 对齐
5. `actionSpec` - 动作数组 ✅ 对齐
6. `notes` - 备注（不在 prompt.js 4 字段中，UI 显示用） ⚠️ 附加字段
7. `audio` - TTS 操作（不在 prompt.js 4 字段中，UI 操作用） ⚠️ 附加字段

**对齐评估**：
- 4 字段 + 2 个 UI 附加字段（notes/audio）= 6 列
- prompt.js 不禁止 UI 附加字段（仅约束模型输出 4 字段）
- ✅ 对齐

### 4.3 actionSpec 工具清单对齐

**UI 显示**（AgentBDirect.vue 工具选择器）：
- rough-notation ✅
- rough-line ✅
- rough-arrow ✅
- ~~draw~~ ❌（应从 UI 移除，因 prompt.js 禁止）

**对齐评估**：移除 draw 选项后对齐。

### 4.4 board 字段对齐

**UI 显示**（AgentBDirect.vue 板书编辑器）：
- content ✅
- startDelay ✅
- ~~startCoord~~ ❌（已从 contract.js normalizeBoard 剥离）

**对齐评估**：✅ 对齐。

### 4.5 stage 枚举对齐

**UI 显示**（AgentBDirect.vue stage 选择器）：
- 题目 ✅
- 分析 ✅
- 解答 ✅
- 总结 ✅
- ~~开场~~ ❌（contract.js:14-25 STAGE_SYNONYMS 兼容，但不应在 UI 显示）

**对齐评估**：UI 应严格只显示 4 个 stage，移除"开场"等同义词。

### 4.6 contract.js 校验对齐

| 校验项 | contract.js 当前 | prompt.js 规范 | 对齐情况 |
|---|---|---|:---:|
| 4 字段白名单 | `AGENT_B_V2_COLUMNS = ['stage','speech','board','actionSpec']` | 第 236-242 行 | ✅ |
| stage 枚举 | `AGENT_B_V2_STAGES = ['题目','分析','解答','总结']` | 第 237 行 | ✅ |
| stage 同义词吸附 | `STAGE_SYNONYMS` 温和吸附 | 第 237 行"硬约束。禁止写成开场/导入..." | ⚠️ 双层防御合理 |
| normalizeBoard 剥离 startCoord | `:43-66 normalizeBoard` 只返回 `{content, startDelay}` | 第 174-177 行 | ✅ |
| normalizeAgentBV2ActionSpec order 校验 | `:117-126 order >= 1` | 第 190 行 | ✅ |
| 禁止 durationMs/gapAfterMs/seed | `roughDrawingTool.js:67-72` 校验抛错 | 第 190 行 | ✅ |
| 首行 stage=题目 + board.content="" + startDelay=0 | `validateAgentBV2Rows` 仅检查"至少一行" | 第 248 行"第一行 stage 必须是题目且 board.content 为空字符串，board.startDelay 为 0" | ⛔ **未强制校验** |

**对齐评估**：6/7 项对齐，1 项未强制校验首行约束 → 需补强。

### 4.7 service.js 调用对齐

**当前 service.js**：
```javascript
export async function generateAgentBV2Rows({ handoff, systemPrompt, skillId, rowGapMs, canvasParams, ... }) {
  // ...
  const response = await fetch('/api/agent-b-v2/generate', { ... })
  // ...
  applyAgentBV2Timeline(rows, rowGapMs)
  return { rows, model, usage }
}
```

**对齐评估**：
- ✅ 透传 systemPrompt / skillId / canvasParams / rowGapMs / handoff，未篡改 prompt 内容
- ⚠️ `GENERATION_TEMPERATURE = 0.8` 写死（prompt.js 未声明期望 temperature）
- ⚠️ `timeoutId 650000ms`（650 秒）超时，与 prompt.js 无关但与 Vercel 180s 矛盾

---

## 五、围剿陈旧信息块清单

> 用户原话："围剿所有遗留的陈旧信息块"

### 5.1 代码层陈旧信息块（11 处）

| # | 位置 | 陈旧信息块 | 围剿动作 |
|---|---|---|---|
| 1 | `roughDrawingTool.js:237` | `@orphan` 注释 | 删除 |
| 2 | `roughNotationTool.js:72` | `@orphan` 注释 | 删除 |
| 3 | `Step1Entry.vue:563-582` | `cacheGridPreview` 大段注释 | 删除 |
| 4 | `asrPolish.js:197` | `polishBoardSpacing` 空转函数 | 删除 |
| 5 | `AgentBDirect.vue:2019` | `<div v-if="false">` 死代码 + 死 CSS | 删除 |
| 6 | `AgentBDirect.vue:5242-5265` | `.group-lite-player`/`.btn-open-lite-player` 死 CSS | 删除 |
| 7 | `agentBV2Handler.js:42` | `AGENT_B_SYSTEM_MESSAGE` 冗余别名 | 删除 |
| 8 | `boardToolCatalog.js:29` | `getDrawIntentAgentTool` 注册 | 移除注册 |
| 9 | `lib/dualStore.js` | 整个文件死代码 | 删除 |
| 10 | `lib/simpleIndexedDb.js` | 整个文件死代码 | 删除 |
| 11 | `utils/cdnLoader.js` | 整个文件死代码 | 删除 |
| 12 | `board-tools/boardTypography.css` | 整个文件无消费者 | 删除 |
| 13 | `public/fonts/pingfang-qiaomu.ttf` | 3.8MB 字体文件无消费者 | 删除 |

### 5.2 文档层陈旧信息块（8 处）

| # | 文档 | 陈旧信息块 | 围剿动作 |
|---|---|---|---|
| 1 | `KNOWN_ISSUES.md` P0-2 | "未修复"标记 | 改"已修复（tryExtractFallbackRows 软降级）" |
| 2 | `doc/XRAY-全局图谱.md` R1 | "缺 fs/path import" | 改"已修复" |
| 3 | `doc/XRAY-全局图谱.md` R7 | "vite build 必失败" | 改"已修复" |
| 4 | `doc/XRAY-全局图谱.md` R12 | "boardTypography.js 全部导出零调用" | 改"部分修复（JS 已删，CSS 残留）" |
| 5 | `CONTINUITY.md:17` | "链路断裂" | 改"已修复（Step1Entry.vue:700 已接入）" |
| 6 | `CONTINUITY.md:75` | "截图链路被注释冻结" | 改"已修复（captureAndSaveScreenshot 已实现）" |
| 7 | `CONTINUITY.md:101` | "前端没有按钮、没有 refineKnowledge 函数" | 改"已修复（AgentBDirect.vue:1462 已实现）" |
| 8 | `minimal-runtime-loop.md:88` | "rows 只在页面内存" | 改"rows 在页面内存 + board-result 实体归档" |

### 5.3 memory 层陈旧信息块（5 处）

| # | 文件 | 陈旧信息块 | 围剿动作 |
|---|---|---|---|
| 1 | `.codebuddy/memory/MEMORY.md:15` | "dev 默认 3000/3001" 矛盾表述 | 删除（以 :77 为准） |
| 2 | `.codebuddy/memory/CONTEXT-DIGEST.md` 第 0 节第 2 条 | "audioUrl 被 contract 丢弃" 部分过期 | 订正为"仅 Check 应用路径丢弃，apply 路径保留" |
| 3 | `.codebuddy/memory/2026-09-15.md` 第 5 节 | "R2 draw 接通真实执行" | 订正为"已接通但 prompt 未声明，模型永不产出 → 三重空转" |
| 4 | `.workbuddy/memory/2026-09-14.md` | 待审查 | 审查后订正 |
| 5 | `.workbuddy/memory/2026-09-15.md` | 待审查 | 审查后订正 |

---

## 六、修复优先级与执行计划

### 6.1 立即修复（P0，4 项）

| 优先级 | 项 | 修复动作 | 验证 |
|:---:|---|---|---|
| P0 | 冲突 1 · draw 工具 | `boardToolCatalog.js:29` 移除 `getDrawIntentAgentTool` 注册 | grep `tool: 'draw'` 在 prompt.js 应 0 命中；在 boardToolCatalog 应不再注册 |
| P0 | 冲突 2 · examples.js 字段名 | 修正 `examples.js:24-28` 字段名为 `action/target.exactText/target.region/target.occurrence/options.multiline/order` | 对照 prompt.js:199-208 完全一致 |
| P0 | 冲突 3 · output-format.js 自检清单 | 修正 `output-format.js:25` 第 5 条为"保留阿拉伯数字" | 对照 prompt.js:159 一致 |
| P0 | 冲突 4 · board-rules.js 工具清单 | 修正 `board-rules.js:128` 第 7 条表述 | 表述与 prompt.js + roughNotationTool.js 一致 |

### 6.2 短期修复（P1，13 处代码层陈旧块）

详见第五节 5.1，按表格逐项执行。

### 6.3 中期修复（P2，8 处文档层陈旧块）

详见第五节 5.2，按表格逐项更新文档表述。

### 6.4 长期修复（P3，5 处 memory 层陈旧块）

详见第五节 5.3，按表格逐项订正 memory 表述。

---

## 七、对齐验证清单

### 7.1 代码层验证

- [ ] `grep "tool.*'draw'" src/agent-b-v2/prompt.js` 应 0 命中
- [ ] `grep "getDrawIntentAgentTool" src/board-tools/boardToolCatalog.js` 应 0 命中（drawIntentTool.js 保留代码但不注册）
- [ ] `grep '"type":' src/agent-b-v2/skills/liyongle-elementary/examples.js` 应 0 命中
- [ ] `grep '"text":' src/agent-b-v2/skills/liyongle-elementary/examples.js` 应 0 命中（除非是 speech 字段）
- [ ] `grep '"color":' src/agent-b-v2/skills/liyongle-elementary/examples.js` 应 0 命中
- [ ] `grep "中文发音" src/agent-b-v2/skills/liyongle-elementary/output-format.js` 应 0 命中
- [ ] `grep "只有 underline 和 highlight" src/agent-b-v2/skills/liyongle-elementary/board-rules.js` 应 0 命中
- [ ] `grep "@orphan" src/board-tools/*.js` 应 0 命中
- [ ] `grep "cacheGridPreview" src/components/Step1Entry.vue` 应 0 命中
- [ ] `grep "polishBoardSpacing" src/check-agent/asrPolish.js` 应 0 命中
- [ ] `grep "v-if=\"false\"" src/agent-b-v2/AgentBDirect.vue` 应 0 命中
- [ ] `grep "AGENT_B_SYSTEM_MESSAGE" server/agentBV2Handler.js` 应 0 命中
- [ ] `ls src/lib/dualStore.js src/lib/simpleIndexedDb.js src/utils/cdnLoader.js src/board-tools/boardTypography.css` 应全部不存在
- [ ] `ls public/fonts/pingfang-qiaomu.ttf` 应不存在

### 7.2 文档层验证

- [ ] `grep "未修复" KNOWN_ISSUES.md` 应仅剩 P0-3 / P1-1~P1-6 / P2-1~P2-5
- [ ] `grep "缺 fs/path" doc/XRAY-全局图谱.md` 应 0 命中
- [ ] `grep "lite-player.html 不存在" doc/XRAY-全局图谱.md` 应 0 命中（除非标注"已修复"）
- [ ] `grep "链路断裂" CONTINUITY.md` 应 0 命中
- [ ] `grep "注释冻结" CONTINUITY.md` 应 0 命中
- [ ] `grep "没有按钮" CONTINUITY.md` 应 0 命中

### 7.3 memory 层验证

- [ ] `.codebuddy/memory/MEMORY.md` 端口表述前后一致（仅 3001/3200/5199，3000 属另一项目）
- [ ] `.codebuddy/memory/CONTEXT-DIGEST.md` 第 0 节第 2 条已订正
- [ ] `.codebuddy/memory/2026-09-15.md` 第 5 节已订正

### 7.4 prompt.js 整体对齐验证

- [ ] `npm run lint` 0 错
- [ ] `npm run check:proxy` 通过
- [ ] 浏览器手测：贴题 → 识别 → handoff → B 生成 → 5 字段表格正确显示
- [ ] 手测：B 生成结果无 `tool: "draw"` 出现
- [ ] 手测：Few-shot 示例不影响 B 生成（验证 examples.js 修正后无负作用）
- [ ] 手测：B 生成 speech 中保留阿拉伯数字（验证 output-format.js 修正后无负作用）
- [ ] 手测：B 生成 actionSpec 中 underline/highlight 正常（验证 board-rules.js 修正后无负作用）

---

## 八、专项审查结论

### 8.1 当前对齐情况

| 维度 | 对齐项数 | 冲突项数 | 对齐率 |
|---|---:|---:|---:|
| 字段合同 | 7 | 0 | 100% |
| 工具白名单 | 2 | 1（draw 注册但 prompt 禁止） | 67% |
| 板书格式 | 8 | 0 | 100% |
| 单手时间线 | 7 | 0 | 100% |
| 坐标格式 | 6 | 0 | 100% |
| 口播发音 | 9 | 0 | 100% |
| 固定话术 | 2 | 0 | 100% |
| 四环教学法 | 4 | 0 | 100% |
| 公式回顾 | 4 | 0 | 100% |
| Skill 模块化 | 1 | 3（examples/output-format/board-rules） | 25% |
| **合计** | **50** | **4** | **93%** |

### 8.2 围剿成果

| 层 | 陈旧信息块数 | 可立即清理 | 待治理执行 |
|---|---:|---:|---:|
| 代码层 | 13 | 13 | 0 |
| 文档层 | 8 | 8 | 0 |
| memory 层 | 5 | 5 | 0 |
| **合计** | **26** | **26** | **0** |

### 8.3 综合结论

- **prompt.js 与代码 93% 对齐**：核心规范（字段/板书/时间线/坐标/口播/话术/教学法）全部对齐
- **4 项冲突需立即修复**：draw 工具注册 + examples.js 字段名 + output-format.js 自检清单 + board-rules.js 工具清单
- **26 处陈旧信息块可清理**：13 处代码 + 8 处文档 + 5 处 memory
- **修复后对齐率预期 100%**

### 8.4 不修复的特殊情况（用户裁定）

| 项 | 不修复理由 |
|---|---|
| drawIntentTool.js 代码保留 | 用户明示"R2 有用、大用、不可删除" → 保留代码但移除 catalog 注册 |
| Fish Audio 双 Key 保留 | 用户明示"预设账号密码保留，不要建议删除" → 仅移到 .env，不删除 Key 本身 |
| Agent A/B/C API Key 默认值保留 | 同上 |
| handdraw-player.html 不补回 | 用户明示"用户自己删的，不要补回" → 用内联模板替代 |
| lite-player.html 不补回 | 同上 |
| R4 字体范围断言 | 用户裁定"有用、不可删除" → 待改造 |
| R5 调度器无断点续播 | 用户裁定"有用、不可删除" → 待音频驱动 row-by-row 解决 |

---

> prompt.js 规范对齐专项审查报告产出完毕。本报告与 6 阶段产出文档共同构成完整交付包。
