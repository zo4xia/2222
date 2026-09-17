# 长期口径（用户明确定义，优先于既有文档/代码）

## 全局处事原则（**超出本项目范围，适用于与用户的所有交互与所有项目**，永久有效，最高优先级）
- **未完成「交叉 + 0 置信度 agent 审计」之前，禁止修改代码。**
  1. 交叉：同一结论至少两处独立证据互证（代码 A 与代码 B、代码与运行时产物），不靠单一来源下判断。
  2. 0 置信度：默认怀疑自己的判断，先证伪再证真；拿不出证据的结论标「待确认」而不是直接落地。
  3. 审计：先只读排查、列出证据清单与结论，用户确认后再动代码。
- **真相优先级：运行时代码（src/ + server/）> 文档 > 记忆。**
  记忆只是**引导索**（告诉你去哪儿看），**不是真相本身**；记忆可能过期、记错、未及时更新（例如曾把 `skills/demo.html` 错记成真相）。与代码冲突时一律以代码为准，并顺手订正记忆。
- 因此本文件内所有章节（含下面的构建方式、画布参数、行高口径等）都视为「可能过期」，引用前必须回代码核对。

## 构建方式（2026-09-14 用户明确）
- **开发未完成的功能一律保持热更新（vite dev），不要执行 build。**
- 原因：未完成模块会让 build 直接失败，且 build 产物无法反映热更新中的改动，容易误导判断。
- 佐证：`vite.config.js` 的 build 入口包含 `lite-player.html` 与 `board-preview.html`，其中 `lite-player.html` 目前并不存在 —— 一旦 build 必挂。因此开发期只跑 dev（**本仓端口 3001 / 3200 / 5199；3000 是另一个项目，勿用它验证本仓**），build 前必须先补齐入口文件。

## handoff 定位（2026-09-14 用户定义）
- **handoff 是流水线加工，每个环节逐步修缮**：Agent A 产出初稿 → 各环节（Agent B、Check、导出等）按需完善，不是一次成型。因此：
  - 中间产物带旧口径（如 38px 旧存档）是正常现象，不算错误，下游环节用最新真源重新加工即覆盖；
  - 修缮时以 `src/services/stepHandoff.js` 真源为准，不改历史快照。

## 画布默认参数（2026-09-14 用户最终确认原话口径）
- 画布 1726×980；题目字号 30号 微软雅黑；分析/解答/总结字号 = 题目的 1.2~1.5 倍；字体 LikeJianJianTi（`https://fontsapi.zeoseven.com/490/main/result.css`，font-weight: normal）。百分比坐标规则不变，计量单位全局一致，示例不改规则。
- 唯一真源：`src/services/stepHandoff.js` 顶部常量 + `buildCanvasParams()`。任何文件需要这些值必须 import，出现字面值 = bug。
- 板书三区行高不写死数值：自然换行 + 渲染层轻微微抖动（用户确认原话「手写的感觉，一般不会固定，所以使用轻微的抖动」）；题目区印刷体固定 1.65。

## 真相源分级（2026-09-14 用户纠正：**demo/html 测试页不是真相**）
- **不算真相源**（用户原话「demo 页面和现在的 html 页面是测试，错误很多 不是真相」）：`skills/demo.html` 及 skills 下所有 html 测试页。其数值体系与正式代码**不同**（demo 用 `html{font-size:10px}` + rem：题目 1.2rem、板书 row 1.4~1.6rem、行高 1.6/1.8/伪随机 1.65~1.95），**不得引用它反推或校验正式口径**。此前记忆里「渲染层实现真相 = demo.html:733-742」是错误记载，已作废。
- **不算真相源**：`public/handoff/*.json` 是历史产物快照（含旧 32px/38px 口径），不改，重新生成即覆盖。
- **正式真相源（src/ + server/ 运行时代码）**：`src/services/stepHandoff.js` 生成 → `server/handoffStoreHandler.js` 兜底（两处必须字面一致）。
- **文档层**（跟随代码，非独立真相）：`CONTINUITY.md`、`skills/board-speech-rules/SKILL.md`。
- 排查/对齐口径时**只看 src/ 与 server/ 代码**，demo 页与快照一律排除。

## 板书行高（2026-09-14 用户对齐，覆盖旧 32px/38px 公式）
- **真相**：行高 = **自然换行** + 渲染层**微小随机抖动**（营造人手写感）。不预置固定行高数值，不用「字号 × 行高 / 980」公式算 y 增量。
- B 侧口径：按当前字号自然换行估算起手坐标，不自己叠加抖动，不写死行高数值。
- 题目区 `lineHeight.question = 1.65` 保留（印刷体，非手写感区）。
- 声明位置（两处字面一致）：`src/services/stepHandoff.js:169-172/180` 与 `server/handoffStoreHandler.js:73-76/83` 的 `canvasParams.lineHeight.others` 与 `lineHeightFormula`。
- ⚠️ 已知乱源：行高/字号**同时被多处写死**，见下节清单，尚未收敛为常量。

## 画布默认参数（2026-09-14 用户对齐）
- 画布：**1726×980**（固定）。
- 题目区：字号 **30px**，**微软雅黑**（印刷体，印刷体不走手写字体）。
- 板书区（分析/解答/总结）：字号 = **题目字号的 1.2~1.5 倍，推荐约 35px**；字体 LikeJianJianTi。旧写死的 32px / 38px 均已作废。
- 用户偏好：百分比坐标规则保持不变，示例只是举例，不为举例改动规则；保持真相唯一性。
- ✅ **裁定（2026-09-14）**：不写死单一值，**字号由当下 agent（Agent B）在题目字号 1.2~1.5 倍区间内决定；同一 row 行内字号必须一致**。35px 仅作兜底默认。
  - ⚠️ 与现行 board 契约冲突（board 只有 `content` + `startDelay`，agent 无从输出字号）——是否给 board 加行级可选 `fontSize` 待夏夏确认，确认前不改代码。

## 已完成：画布参数归一（2026-09-14，乱源清零）
- **唯一真源**：`src/services/stepHandoff.js` 顶部导出 `CANVAS_SIZE / QUESTION_FONT_SIZE(30) / QUESTION_LINE_HEIGHT(1.65) / BOARD_FONT_SIZE(35) / BOARD_FONT_RATIO_TEXT / LINE_HEIGHT_RULE / LINE_HEIGHT_FORMULA / buildCanvasParams()`。该文件纯 ESM 无浏览器 API，node/server 均可 import。
- 全部消费点已改 import：`server/handoffStoreHandler.js`（兜底 = `buildCanvasParams()`，删除 37 行同构副本）、`server/agentBV2Handler.js`（两处 prompt 文案插值）、`src/utils/canvasCoords.js`（CANVAS_W/H ← CANVAS_SIZE）、`src/utils/boardLayout.js`（fontSize 兜底 5 处）、`src/lib/speechMarkdown.js`（UI 表 2 处）、`src/agent-b-v2/prompt.js`（模板串插值 2 处）、`src/agent-b-v2/contract.js`（minXGap ← BOARD_FONT_SIZE+3）、`src/agent-b-v2/AgentBDirect.vue`（ref 初值 + canvasSize）、`src/components/BoardContentLayer.vue`（fontSize 兜底 2 处 + layerW/H 兜底）。
- 表现层保留字面值（合理，CSS 不能 import JS）：各 Vue 的 `aspect-ratio: 1726/980`、`.topic-text{line-height:1.65}`（已加注释指向真源）、BoardPreviewApp 管理界面展示文字。
- 用户需求口径：**除题目区（印刷体 30px/1.65 固定）外，板书三区走真人手写自然感** = 自然换行 + 渲染层微抖动，不预置行高数值 —— 与 LINE_HEIGHT_RULE 一致。
- 验证：lint 0 错；node import 链全通（prompt 文案含 1726×980/30px/推荐35px）；vite 编译 BoardContentLayer/AgentBDirect 均 200。
- 规则：今后任何文件需要这些值，一律 `import from '../services/stepHandoff.js'`；再出现字面值 = bug。

## 协作偏好（2026-09-14）
- **用户给的口径自相矛盾时必须当场挡回，先确认再改代码**；不要默默自选一个值执行，也不要把提醒藏在回复末尾。
- 用户会主动承认笔误（「我写错了」），发现矛盾直接指出即可，不必迁就。

## 板书契约（2026-09-14 收口，覆盖旧 startCoord 契约）
- **board 只有 `content` + `startDelay` 两个字段**，不输出 `startCoord` 起手坐标、固定行高/行距/横向错位规则；排版（起手位置、换行、行距、防重叠）归渲染层（领地 E）。`coordinateMode` 只约束 `actionSpec` 的 start/end。
- 真源：`src/agent-b-v2/contract.js` 的 `normalizeBoard()`（剥离历史 `[x%, y%]` 前缀与 startCoord）；`server/agentBV2Handler.js`（payload/字段注释口径）；`src/agent-b-v2/prompt.js`（默认 skill `default-fallback` 直接返回它，改它即改默认链路）。
- 已下线：坐标垂直防粘连/下界限位算法、`checkAgentHandler` 的 `board_coord` 字段、`asrPolish.polishBoardSpacing`（空转保留兼容）。
- 禁止事项：再出现让模型算板书坐标、或在 prompt 里写死区域起手 Y% 的规则 = bug。

## 网络资源（2026-09-14 用户要求）
- **禁止境外资源**（Google Fonts / jsdelivr / unpkg 等国内不可达）。UI 字体用本地系统栈；JS 库本地化到 `public/`（已有 `public/rough.js`、`public/snapdom.js`）。
- 例外：`fontsapi.zeoseven.com` 板书字体（用户指定，157/490/511/510 供字体下拉切换，失败回退 `Noto Sans SC`）。

## 风险处置口径（2026-09-14 用户裁决）
- **R2/R4/R5 一律"有用、大用、不可删除"**，不得用"删除/移除"方式清理：R2 draw 意图工具要接真实执行（复用 roughDrawingTool）；R4 统一 region 语义单一事实源；R5 调度器补断点续播/单步隔离。
- **`handdraw-player.html` / `lite-player.html` 是用户自己删的**，不是缺陷，不要"补回"。但引用点仍在：`vite.config.js:46` lite-player 入口（build 必挂）、`AgentBDirect.vue:1374` window.open（演播 404）、`renderDeliverableHtml.js:6` 模板缺失→降级页本身也是死链、`public/deliverable/*.html:9` 跳转死链。是否清引用待夏夏决定。
- **板书坐标终局（用户答"对"）**：板书可超出本区，但不得与其他板书重叠、不得溢出画布；硬约束只留给 `actionSpec`。

## 环境
- 本工作区 dev 端口：3001 / 3200 / 5199（多实例）。**端口 3000 是另一个项目**，勿用它验证本仓。
