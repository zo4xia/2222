# 工程日志 (ENGINEERING_LOG.md)

## 2026-09-17 阶段一 · 勘探准备完成与资产盘点
- **背景**：根据项目重构标准协议，对 clean-package 开展系统级重构工作，全面遵循五阶段工作法。
- **思路**：严格执行 refactor-discovery 标准，先看清森林再动第一棵树；自顶向下执行 4 层 X-RAY 深度扫描与文档六维研读，输出资源清单、风险矩阵与初始快照。
- **执行步骤**：
  1. 扫描项目目录树与文件清单，统计代码量与模块规模（299个文件，JS/Vue 95个，Vue核心单文件11个）。
  2. 绘制模块依赖图与依赖拓扑，定位高扇入关键节点（userApiConfig, stepHandoff, roughDrawingTool, mathAsrConverter）。
  3. 识别并定位 6 大核心业务中枢（识别检索、教学编排、质检润色、板书绘图、独立播放器、TTS配音）。
  4. 研读关键函数实现与调用链，确认 ASR 中文转换规则、基线时间线排布算法与持久化机制。
  5. 研读六维文档，标明缺失项与现有依据（AGENTS.md、知识库快照）。
  6. 实施止血三板斧，产出风险矩阵（重点标记 5200+ 行组件、自检断言偏差与配置冗余）。
- **代码变更**：
  - 新建 project_initial_state.md（初始状态快照与 Mermaid 依赖图）
  - 新建 resource_list.md（可复用资源清单）
  - 新建 risk_matrix.md（风险矩阵与止血三板斧）
  - 同步更新 PROJECT_STATE.md、DECISIONS.md、项目实时架构模块图.md
- **发现和确认**：
  - src/agent-b-v2/AgentBDirect.vue 单文件高达 5292 行，是核心维护瓶颈，需在阶段三进行安全模块拆分。
  - server/agentAKnowledgeSelfCheck.js 运行 100% 成功（247 行知识点）。
  - server/proxySelfCheck.js 第 225 行在 Check Agent changes 预期上存在断言偏差，需在管线阶段修复。
- **验证结果**：
  - 四层深度扫描全部完成（校验点达成）。
  - node server/agentAKnowledgeSelfCheck.js 执行通过。
  - 所有交付物文件均落盘验证。
- **接力棒**：启动阶段二 · 深度诊断 (refactor-diagnosis)，进行目录职责标注、三层业务扫描与六维度 1-5 分评估。

## 2026-09-17 阶段二 · 深度诊断与六维评估完成
- **背景**：在勘探准备基础上，对项目各目录职责、三层架构（表现层/业务逻辑层/数据层）及质量六维度进行客观度量与归因。
- **思路**：严格执行 refactor-diagnosis 规范，以目录职责标注与三层业务扫描为工具，把代码质量转化为可排序的量化短板与优先级。
- **执行步骤**：
  1. 扫描全部 Vue 组件的 fetch 调用分布，定位跨层穿透点（AgentBDirect.vue 存在 10+ 处直连 fetch）。
  2. 对比配置模块，发现 userApiConfig / agentBApiConfig / checkAgentApiConfig 存在同构冗余。
  3. 按照六维度（可读性 3、可维护性 2、性能 4、安全性 4、可测试性 2、可扩展性 3）完成 1-5 分客观定级。
  4. 产出 diagnostic_report.md 与 calibrated_prd.md，校准重构优先级为 P0-P2。
- **代码变更**：
  - 新建 diagnostic_report.md
  - 新建 calibrated_prd.md
  - 同步更新 PROJECT_STATE.md、DECISIONS.md、项目实时架构模块图.md
- **验证结果**：六维度打分与需求校准 100% 达成（校验点达成）。
- **接力棒**：进入阶段三 · 骨架施工 (refactor-skeleton)，落实页面四分类与服务层解耦设计。

## 2026-09-17 阶段三 · 骨架施工与解耦设计完成
- **背景**：针对深度诊断中发现的表现层裸 fetch 跨层穿透与 API Config 三份冗余问题，实施骨架解耦与模块收口。
- **思路**：严格执行 refactor-skeleton 规范，落实页面四分类、单向依赖链确立与耦合点显式标记，通过工厂模式与服务层统一收口。
- **执行步骤**：
  1. 产出 module_dependency_graph.md，明确页面四分类（公共布局/业务页面/功能组件/UI组件）与单向依赖方向。
  2. 显式标记三大耦合点（CP-01 表现层裸 fetch、CP-02 配置同构冗余、CP-03 独立播放器逻辑漂移）并产出 decoupling_strategy.md。
  3. 实现 src/lib/apiConfigStoreFactory.js 通用工厂，重构 userApiConfig, agentBApiConfig, checkAgentApiConfig，对外保持 100% 接口兼容。
  4. 建立统一服务层（ttsService, deliverableService, cleanupService, knowledgeRefineService）。
  5. 运行 npm run build 验证构建，3217 个模块全部无报错打包通过。
- **代码变更**：
  - 新建 src/lib/apiConfigStoreFactory.js
  - 重构 src/lib/userApiConfig.js, src/lib/agentBApiConfig.js, src/lib/checkAgentApiConfig.js
  - 新建 src/services/ttsService.js, deliverableService.js, cleanupService.js, knowledgeRefineService.js
  - 新建 module_dependency_graph.md, decoupling_strategy.md
  - 同步更新 PROJECT_STATE.md、DECISIONS.md、项目实时架构模块图.md
- **验证结果**：新旧结构对比图已生成，耦合点已标记，npm run build 构建成功（校验点达成）。
- **接力棒**：进入阶段四 · 管线铺设 (refactor-pipeline)，打通黄金三角 API 并修复自检断言。

## 2026-09-17 阶段四 · 管线铺设与数据流治理完成
- **背景**：骨架立好后，需打通黄金三角 API，治理数据交互规则并修复单测自检断言偏差。
- **思路**：严格执行 refactor-pipeline 规范，黄金三角 API 优先接入，非核心 API 分批接入，校验数据流解耦，确保 API 严格通过 Service 层通信并统一错误处理。
- **执行步骤**：
  1. 梳理黄金三角 API（识别、生成、交付物）并绘制 Mermaid 时序图，产出 dataflow_diagram.md。
  2. 定义 OpenAPI 3.0 标准接口规范 api_spec.yaml，固化出入参和 { ok, data, code, error } 交互封套。
  3. 修复 server/checkAgentHandler.js 中 changes 逐行比对时的 board 归一化逻辑，彻底解决 server/proxySelfCheck.js 的断言偏差 (4 !== 1)。
  4. 运行 node server/proxySelfCheck.js 与 node server/agentAKnowledgeSelfCheck.js，验证全链路自检 100% 绿灯。
- **代码变更**：
  - 修改 server/checkAgentHandler.js（board 对比归一化）
  - 修改 src/services/stepHandoff.js（新增 fetchCurrentHandoff）
  - 新建 dataflow_diagram.md, api_spec.yaml
  - 同步更新 PROJECT_STATE.md、DECISIONS.md、项目实时架构模块图.md
- **验证结果**：
  - proxy self-check ok 验证通过
  - agent A knowledge self-check ok (247 rows) 验证通过
  - npm run build 构建验证通过（校验点达成）
- **接力棒**：进入阶段五 · 精装验收 (refactor-acceptance)，执行全链路冒烟测试、P0-P4评级与规范固化。

---

## 2026-09-17 运行时止血 · 首屏修复与首屏性能（补记，提交 8b107c5 / 6e070a5）
- **背景**：进首页即崩、首屏重组件同步加载拖慢首屏。
- **执行步骤**：
  1. `src/components/Step1Entry.vue:9` 补 `QUESTION_FONT_SIZE` 导入，修 `Uncaught ReferenceError`（computed 内使用未导入）。
  2. 删除 `src/utils/mathText.js` 中无消费者的 `normalizeLatexControlChars`（真源已迁至 `superFilter.cleanTextEscapes`）。
  3. `src/utils/superFilter.js` 控制字符正则加 `eslint-disable-next-line` 并注明理由（语义必要，非误报）。
  4. `src/agent-b-v2/DirectFlow.vue` 将 `AgentBDirect.vue`、`src/components/Step1Entry.vue` 将 `RealBoardPreview.vue` 改为 `defineAsyncComponent`，重依赖延后加载。
- **代码变更**：`src/components/Step1Entry.vue`、`src/utils/mathText.js`、`src/utils/superFilter.js`、`src/agent-b-v2/DirectFlow.vue`。
- **验证结果**：`npm run build` 通过，产出独立 `RealBoardPreview-*.js` / `AgentBDirect-*.js` chunk。
- **重要教训**：IDE `read_lints` 对 .vue 报 0 诊断不可信，验证一律以命令行 `npx eslint src --ext .js,.vue` 为准（当时真实 1050 条：56 error / 994 warning）。
- **接力棒**：首页白屏排查与交付物序列化收拢。

## 2026-09-17 首页白屏修复 · 交付物序列化模块收拢（补记，提交 92e809b）
- **现象**：首页白屏，`Uncaught TypeError: Cannot read properties of null (reading 'getBoundingClientRect')`。
- **根因**：异步组件与题目初始挂载时，`BoardContentLayer.vue` 的 `ResizeObserver` 回调与 `measureTopic` 未防 DOM 为 null。
- **代码变更**：
  - `src/components/BoardContentLayer.vue` 增加安全前置检查与可选链防护。
  - 新增 `src/agent-b-v2/serializeDeliverableState.js` 纯函数模块，`AgentBDirect.vue` 改为参数对接，输出契约（`$schema` / `exclusiveExecutionPlan` / 统计 / Check 状态）与原实现完全一致。
- **验证结果**：首页恢复正常，`npm run build` 通过。
- **接力棒**：首次真实跑通交付 + UI 收口。

## 2026-09-17 首次真实交付产物落地（补记，提交 4f1f2db 内）
- **事实更正**：此前记录的"`public/deliverable/` 0 文件、整条链从未产出"**已作废**。
- **已落盘**：`public/deliverable/current.html`（5.15 MB，内嵌板书字体）、`current.json`（23.8 KB）、`deliverable-deliverable-1789584993949.html/json`、`deliverable.schema.json`、`DELIVERABLE_API_SPEC.md`。
- **代码变更**：`server/deliverableStoreHandler.js`、`server/smokeTest.js`、`server/checkAgentHandler.js`（board 归一化，修断言 4!==1）、四个 `src/services/*`、三个 `src/lib/*ApiConfig.js` + 工厂。
- **验证结果**：`node server/proxySelfCheck.js` 与 `node server/agentAKnowledgeSelfCheck.js`（247 行）全绿；`npm run build` 通过。
- **意义**：首次出现可人工点检的真实样本，打破"无产物 → 无法验收"的死循环。

## 2026-09-17 UI 收口 · 首页去冗余与视觉统一（补记）
- **约束（用户拍板，已升级红线）**：画布不动、自动落座算法不动、loading 不改。
- **执行步骤**：
  1. 全屏预览 3 个入口（页头 / 卡片 extra / 工具栏）→ 只留卡片 extra，删 `FullscreenOutlined` 导入。
  2. 「识别并贴上画布」提升 `type="primary"`，新增 `recognizeBlockedHint` + tooltip 解释禁用原因。
  3. 删装饰性常驻 `a-alert`，语义并入副说明；三个卡片重复定义 border-radius/阴影 → 统一走 `style.css` 的 `.qh-surface-card`。
  4. 删除 `.board-viewport{min-height:420px}` 与 `.preview-card{min-height:560px}`，高度改由画布 `aspect-ratio:1726/980` 自然撑开（修"视口越窄留白越大"）。
  5. 题干 textarea rows 6→4、新增 `.board-empty-hint` 空态、知识卡按钮上提至 `#extra`、删 `a-divider`。
  6. 组件内写死色值统一替换为 `--qh-*` token 与品牌蓝 `rgba(29,78,216,*)`。
- **代码变更**：`src/components/Step1Entry.vue`、`src/style.css`（仅复用现有 token，未新增）。
- **验证结果**：eslint 无新增 error（4 个 `no-empty` 为既有）；`npm run build` 通过，main CSS 8.36→8.25 kB。
- **教训**：删类名前必须全局搜该类的所有 CSS 声明（本次 `.knowledge-chips` 有 3 份重复定义，差点误删 deep 覆盖）。

## 2026-09-17 去冗余 · Agent B 工作室折叠入口收口（未提交）
- **冗余点**：折叠某列有 3 个入口 —— 工具条 3 个 `col-toggle-chip`（含 `chip-dot`）、表头 `col-fold-trigger`、折叠态单元格胶囊。前两者 100% 同功能（同调 `toggleColumn`）。
- **处理**：删工具条副本（模板 30 行 + CSS 43 行：`.col-toggle-chip`/`:hover`/`.collapsed`/`.chip-dot`/`.off`/`.col-layout-right`/`.col-layout-sublabel`），保留表头（就近）与单元格入口；表头文案 `展开 ◀▶` → `展开`。
- **未动**：`setLayoutPreset` / `toggleColumn` 逻辑与三个预设本身；画布与 loading 未碰。
- **验证结果**：全仓无残留类名；eslint 仅 1 个既有 error（`navigator is not defined`，改动前既有）；`npm run build` 通过（7.90s）。
- **规则沉淀**：同一状态切换若有"工具条 + 表头/行内"两套入口，保留离作用对象最近的，删工具条副本。

## 2026-09-17 挂起未决（尚未动手，待拍板）
- ~~**字体真源不一致**~~ → **2026-09-17 晚已拍板并执行（见决策 #008）**：字体必须走 CDN，素材必须内嵌（下方新增条目）。"单文件离线 = 依赖必须内嵌"这条旧约束作废。
- **row-player 排版与落笔规则全页统一**：用户要求所有页面统一采用 `row-player.html` 的排版与落笔规则（含规格真相源/死规定），**尚未执行**。
- **P0 未闭环**：图片题断链（`screenshotUrl` 下游零消费）、`server/fishAudioHandler.js` 明文密钥、Vercel api 覆盖不全。

## 2026-09-17 交付产物脱环境改造 · 字体 CDN 化（已执行）
- **起因（用户拍板）**：交付页由客户自己的 Agent 生成，产物要给**外部 API 和 Agent 做 skills** → 必须"脱环境、拿出去双击就能用"；因此**字体必须走 CDN**（内嵌 3.68 MB 不可接受），素材必须内嵌。
- **做法（唯一官方接入方式，fonts.zeoseven.com 取证）**：一行 `<link rel="stylesheet" href="https://fontsapi.zeoseven.com/507/main/result.css">`（平方乔木体），CSS 自带分片 `@font-face` + `local()` 优先 + `unicode-range` + `font-display:swap`；不自己写指向 ttf 的 `@font-face`。
- **改动清单**：
  1. `row-player.html`：删内嵌 `@font-face`（base64 段 5,149,880 字符）→ 引 CDN 507；`HAND_FONT` 改为 `"平方乔木体","PingFangHand",KaiTi,STKaiti,"PingFang SC",serif`；`document.fonts.load('42px "平方乔木体"')` 同步。
  2. `设计灵感卡片-row-player.html`（上层根目录）：删 `@font-face{...pingfang-qiaomu.ttf}` 本地相对路径（脱环境后必然 404）→ CDN 507。
  3. `public/deliverable/current.html`、`deliverable-deliverable-1789584993949.html`：同法去内嵌。
- **验证结果**：`row-player.html` 5.01 MB → **0.11 MB**；产物 5.03 MB → **0.12 MB**；`data:font/ttf;base64` 残留 0；外链仅 CDN 一条；底图/贴纸素材（`ASSET` data:image/webp）保持内嵌。
- **链路事实**：产物 = `AgentBDirect.vue:1366`「row-player 模板 + 注入 JSON」→ 改模板即改产物；历史产物需单独回溯（本次已回溯处理）。
- **排除项**：未做字形子集化（CDN 已分片按需，无需）；`productionServer.js` 流式改造仍待排期（决策 #007）。
- **接力棒**：① 应用内 490（栗壳坚坚体）与交付页 507（平方乔木体）字族未统一，待一并改 507；② 符号降级规则（决策 #009）未实现。

## 2026-09-17 stage 标签定位改为「装载即读导出物」（已执行）
- **起因（用户）**：交付页的标签位置与题目标签必须一开始就读取导出物给的坐标——**四区 stage 定位就是标签定位**；不这样取，书写区域就是错的。
- **取证（两处独立证据）**：
  1. 真源 `src/utils/boardLayout.js:27-35` 与 `public/deliverable/current.json` 的 `boardPlan` **确实带四个标签字段** `topicLabel / analysisLabel / solutionLabel / summaryLabel`，且随 `layoutMode` 变化（横图模式实测：分析 (5.7,44.39)、解答 (36.37,44.39)、总结 (67.03,44.39)，与竖图默认值完全不同）。
  2. 改动前 `row-player.html` 的 `drawStageTag` **根本没读这些字段**：题目标签写死 `(2.5, 5)`；其余 stage 优先用「该 stage 首个 board 的 startCoord 内容锚」反推，兜底才读区域左上角 `boardPlan[key]`（不是 Label）→ 横图/左图模式下必然与落座错位。
- **改动（只动 `row-player.html` 唯一播放器母版）**：
  1. 新增 `resolveTagAnchor(bp)`：优先级 **Label 定位 > 该区左上角 > 模板常量**，`compile()` 装载期一次性解析进 `C.tagAnchor`（render(0) 起就在导出物给的位置，seek 幂等）。
  2. `drawStageTag` 删除内容锚反推分支，只保留弹出动画（只改尺寸、不改落点）；题目仍 t=0 常驻。
  3. 模板内嵌 DEMO `boardPlan` 补齐四个 Label 字段（与 `boardLayout.js` 默认值一致）；头部规格批注同步写明 Label 是真源。
- **排除项**：未动画布/落座算法；未对板书 `startCoord` 做越界重排（规格 4 允许自由越界）；未改 `ZoneAnchors` 兼容（`server/renderDeliverableHtml.js` 与 `normData` 本就以 `boardPlan` 为入口）。
- **验证结果**：抽取脚本 `node --check` 通过、lint 0；用真实产物 `current.json` 解析 → 四标签与导出物完全一致；空 `boardPlan` 回退常量不崩。

## 2026-09-17 Agent B 合同失败改为「软提示模型自行修缮」（已执行）
- **起因（用户）**：Agent B 返回内容格式不对时，不要马上报错结束，而是把错误软提示给模型，让它修缮后重出。
- **取证（先确认没被改坏）**：`git diff` 显示未提交改动只涉及 `row-player.html` / 三个入口 html / `main.js` / `superFilter.js`，**昨天的容错链全在** —— `server/agentBV2Handler.js` 重试循环、`src/agent-b-v2/service.js:58` 标 `retryable`、`AgentBDirect.vue:1128-1139` warning 软提示并保留原 rows。
- **真正的缺陷**：重试时回灌给模型的话术**写死只有 stage 同义词那一句**（`agentBV2Handler.js:289`）。JSON 截断 / 非 JSON / Markdown fence 包裹这类「格式不对」拿到的是不对症的指令 → 模型改不好 → 第二次仍失败 → 422 报错结束。
- **改动（只动 `server/agentBV2Handler.js`）**：
  1. 新增 `buildRepairHint()` 按错误类型分诊：`INVALID_STAGE` → 合法四值清单；`finish_reason=length` 或括号未闭合 → 判定截断，要求压缩口播/减行；其余 → 要求输出纯 JSON（禁 fence 与解释文字）、顶层 `{"rows":[...]}`。
  2. 回灌时附上一次坏输出**尾部 600 字符**，让模型能定位接续点；并要求重出完整表而非只改错行。
  3. 截断判定改用 `looksTruncated()` 括号闭合计数（带引号转义）—— 初版按「结尾字符」判定会把 Markdown fence 结尾误判为截断，已修正。
  4. 重试前 `console.warn` 留痕；422 `diagnostic` 补 `finishReason`、`retried` 不再只认 `INVALID_STAGE`。
- **排除项**：`MAX_RETRIES` 仍为 1（不擅自增加上游开销）；不改前端（软提示与保留 rows 已就位）；不改 `contract.js` 解析规则。
- **验证结果**：lint 0；四类场景分诊实测全部命中预期（stage 非法 / 真截断 / fence 包裹 / 嵌套截断）。**未做真实上游联调**——需带坏输出跑一次 `/api/agent-b-v2/generate` 才能确认模型确能修好。
- **sub 复核（ayuan-aide，只读）**：本轮改动与四份留痕 **20/20 全部对得上**，无第二套真相；另报 7 处冲突。已修其一：`diagnostic.retried` 原为常量 `MAX_RETRIES > 0`（恒 true），改为 `attemptsUsed > 1` 并补 `attempts` 计数。**未修**：板书字号三处不一致（见下条风险登记，待拍板）。

## 2026-09-17 输出物合格标准（盲测清单）落真源 + 发现 startCoord 未被消费（已执行·文档层）
- **起因（用户）**：要定义输出物合格标准——**一个没有上下文的 Agent 只凭这份 JSON + `row-player.html`，就能完整生成任意一道题的板书**；字体 jianjian/乔木都可；范围直接照搬输出物里的"本题目参数信息"（四区范围 + stage 参数）。
- **取证（逐条读代码，非记忆）**：`row-player.html` 的 `normData/normRow`（975-973 行）是真实消费契约——顶层只消费 `projectCode / problemText / boardPlan / rows`；row 消费 `stage / mp3|audio|audioUrl|voice / audioDurationMs / duration / speech / board{content,startDelay|triggerKeyword} / actionSpec`；`resolveTagAnchor`（276-286 行）以四个 Label 为标签落点真源；`boardLayout.js:152/187/219` 三种 `layoutMode` 各自产出四区 + 四 Label + canvas + image。
- **新发现（P0，此前未登记）**：`compile()` 组 board 计划项（310-311 行）**没有传 `coord`**，而 `drawWriting` 读 `task.coord`（616 行）→ `parseCoord(undefined)` → 退化硬编码默认 `{x:8,y:44}`。**带不带 `board.startCoord`，板书都叠在同一点**，不同题目无法各自排布 → 盲测必挂。
- **改动（只动唯一真源，不建第二套）**：
  1. `public/deliverable/deliverable.schema.json`：顶层 required 升为 `apiSpecVersion / projectCode / problemText / boardPlan / rows`；新增 `$defs.boardPlan`（canvas 1726×980 常量 + layoutMode 三值 + 四区 + 四 Label + image）与 `zoneBox`/`labelBox`；row 的 `stage` 收成四值 enum；新增 `mp3` 字段；`board.startCoord` 补 `[x%, y%]` 正则与必填说明。
  2. `public/deliverable/DELIVERABLE_API_SPEC.md`：新增第七节「盲测合格标准」——三层必带清单（题目层 / row 层 / 验收六问）+ 阻断项表 + 最小可播 JSON 骨架。
- **排除项**：**未改 `row-player.html` 代码**（渲染落点属画布观感，且修复方案需拍板）；未改 `dist/`（构建产物，下次构建同步）；未统一步板书字号（待拍板）。
- **验证结果**：`node` 解析 schema 通过（required 5 项、boardPlan required 10 项、stage 四值 enum、startCoord 已登记）。**未做运行时点检**（渲染链路未改，点检无意义）。
- **接力棒**：待用户拍板后修 `compile()` 传 `coord`（优先级 `board.startCoord` > `boardPlan[stage 区]` 左上角 > 模板常量，与 `resolveTagAnchor` 三层回退对齐），改完再用不同 `layoutMode` 产物人工点检验收六问。

## 2026-09-17 修「板书落点 startCoord 未被消费」（已执行·代码层）
- **起因**：上条发现的 P0——`compile()` 组 board 计划项未传 `coord`，板书恒落默认 `{x:8,y:44}`，盲测合格标准第 4 问必挂。用户拍板："必须的！快！"
- **改动（只动 `row-player.html` 唯一播放器母版，4 处）**：
  1. 新增 `resolveBoardCoord(row, bp, stage)`：三层回退 `board.startCoord` > `boardPlan[TAG_ZONE_KEY[stage]]` 左上角 **+2% / +4%**（让出标签与首行基线）> 模板常量 `{x:8,y:44}`；复用已有 `TAG_ZONE_KEY`，与 `resolveTagAnchor` 同源同构。
  2. `compile()` 组 board 计划项时带上 `coord: resolveBoardCoord(r,bp,r.stage)`。
  3. `normRow()` 补 `rawCoord`（别名 `startCoord|coord`），归一后**保留** `board.startCoord`（原来被丢掉，注入 JSON 根本传不进来）。
  4. `drawWriting()` 兼容字符串 `"[x%, y%]"` 与已解析对象两种 coord（原来只认字符串）。
- **排除项**：未动画布/落座算法/字号；未改 `boardLayout.js`；未修图片题断链与字号三处不一致（仍挂账）。
- **验证结果**：
  1. 抽取 `<script>` 块 `node --check` **语法通过**。
  2. `resolveBoardCoord` 四场景实测：带 startCoord → `(56,16)`；无 startCoord 竖图解答 → `(56,18)`；无 startCoord 横图解答 → `(38.4,55)`（**落点随 layoutMode 变化，符合预期**）；空 boardPlan → `(8,44)` 不崩。
  3. `normRow` 实测：`board` 归一后 `startCoord` 保留、`startDelay` 保留；无 startCoord 时不写空字段；`audioUrl` → `mp3` 归一正确（`/audio/a.mp3`），`duration` 由 `audioDurationMs` 得 14.6。
- **未验证**：`row-player.html` 不进 vite build，**未做浏览器人工点检**——渲染观感（+2%/+4% 偏移是否贴合）需打开两份不同 `layoutMode` 的产物目视确认。
- **接力棒**：① 用 `portrait` 与 `landscape-top-image` 两份真实产物各点检一次验收六问；② 图片题断链；③ 板书字号三处不一致拍板。

## 2026-09-17 图片题断链修复 + 板书字号统一 38 + 补 startCoord 上游丢失（已执行）
- **起因（用户拍板三条）**：① 图片题断链 → **复用第一步的截图发出去**；② **文本题目只要发图 url**；③ 板书字号三处不一致 → **"38 号折中吧"**。
- **改动 1｜图片题断链（P0 → 已修）**：
  1. `server/renderDeliverableHtml.js` 新增 `inlineProblemImage()`：判据 = `boardPlan.image` 是否有图位（自动落座真源，与渲染判据同源）；有 → 把 `screenshotUrl`（第一步截图 `/pic/*.jpg`）读成 base64 注入 `screenshotDataUrl`；无（文本题目）→ 只带 url、不内嵌、不占体积。外链/`data:`/越界/读失败一律跳过并 warn，绝不抛错。>900KB 打印体积告警。
  2. `row-player.html`：`normData` 新增 `problemImage`（`screenshotDataUrl` > `screenshotUrl` > `sourceImageUrl`）；新增 `setProblemImage()`（异步加载，onload 重绘，onerror 当没图）；新增 `resolveImageRect()` / `drawProblemImage()`，落座唯一真源 `boardPlan.image`（限高 `maxH`、保原始比例）；`render()` 在底图之后、贴纸与板书之前调用。**没有 image 区就一定不画** —— 这是"文本题目只要发图 url"的落点；注入装载与 JSON 导入两处均接上 `setProblemImage`。
- **改动 2｜板书字号统一 38**：真源 `src/services/stepHandoff.js` `BOARD_FONT_SIZE = 38`、`BOARD_FONT_RATIO_TEXT` 同步（注释 30/38/1.65）；`superFilter.js` import 真源，规范批注自动跟着变；`row-player.html` 的 `size` / `document.fonts.load` / `measureText` 共 4 处 42 → 38，并写明"与真源同步点"。
- **改动 3｜顺手补 startCoord 上游丢失（新发现）**：`serializeDeliverableState.js` 的 board 只写 `content`/`startDelay`，`AgentBDirect.vue` 的 `parseBoard` 也不透传 → **导出物里根本没有 startCoord**，昨晚修的下游三层回退只能退化到区左上角。现 `parseBoard` 透传 `startCoord` / `triggerKeyword`，序列化写入 board（有值才写，不写空字段）。
- **排除项**：未动画布/落座算法/字体族；未做流式改造；未补 Vercel 与密钥；未改 `dist/`（构建产物）。
- **验证结果**：
  1. `npm run build` **通过**（29s）。
  2. `row-player.html` 抽取 script `node --check` 通过；lint 0。
  3. 服务端实测：图片题产页 139KB 且含 `data:image/jpeg;base64`；文本题 105KB、**不含**内嵌图、保留 url → 差 33KB 即截图内嵌体积，判据生效。
  4. `normData` 实测：图片题 `problemImage='/pic/a.jpg'`、文本题 `boardPlan.image=undefined`；`board.startCoord` 归一后仍在。
  5. schema 解析通过（`screenshotDataUrl` 已登记）。
- **未验证**：图片在真实产物上的**观感**（落座是否压字、限高是否合适）——需拿一份真实图片题产物目视；`boardPlan.image` 的真实字段形状（`x/y/w/h/maxH`）建议用一张真实图片题导出物再核一次。
- **接力棒**：① 真实图片题产物目视点检；② Vercel 配置补全 + 密钥移出；③ 阶段五精装验收仍未执行。

## 2026-09-17 下载物唯一真相源贯通 + 页面时长口径去误导（已执行）

- **起因（用户要求）**：导出物严格以 handoff 动态读取的参数为唯一真相源；要素表/分镜表 MD 都要有完整规范说明段落；交付物根节点注入 canvasParams/boardPlan/uiSettings/problemInfo；同步 SPEC；Node 脚本实测 MD 与 JSON。另：B 页面还有"旧的时间"误导（已确定有音频按自然时间、无音频才按 160 字/分估算）。

- **改动 1｜规范说明段落唯一生成函数**：`src/lib/speechMarkdown.js` 新增 `buildStandardExplainParamsSection(meta)`（四节：handoff 画布参数 / 四区布局+动态锚点 / UI 可调参数+音频策略 / 题目全量信息与环节配比）；**删除要素表与分镜表各自旧的参数段**，两处统一调用它（禁止第二套真相）。MD 入参由 `AgentBDirect.buildExplainParamsMeta()` 提供（handoffCanvasParams/BoardPlan/ZoneAnchors/problemInfo）。

- **改动 2｜真相源对齐**：新增 `stepHandoff.alignHandoffCanvasParams()`（决策 #014）。依据：handoff 是历史快照，画布固定规格（尺寸/坐标/字号/行高/速度）本就"不随题目变化"，旧文件停留在 35px → 固定规格一律以真源为准（38px），handoff 扩展字段保留；题目相关真相（boardPlan/zoneAnchors/problemInfo）仍严格动态读 handoff。

- **改动 3｜交付物根节点注入**：`serializeDeliverableState.js` 新增 handoffCanvasParams/uiSettings/problemInfo 入参并写入根节点；`AgentBDirect.serializeCurrentDeliverableState()` 实时注入；`server/deliverableStoreHandler.js` 透传写盘（缺失显式置 null 保证结构稳定），current.json 指针内 deliverable 与实体 JSON 同一份，单页 HTML 仍由模板注入驱动。

- **改动 4｜SPEC**：`public/deliverable/DELIVERABLE_API_SPEC.md` 顶层字段补 canvasParams/uiSettings/problemInfo，新增「二之二、下载物唯一真相源块」（含 MD 说明段落生成函数约定）。

- **改动 5｜页面时长口径（去误导）**：① `AgentBDirect` 新增 `getRowRuntimeMs`（有音频=真实 ms，无音频=160 字/分）+ `totalRuntimeStats`/`runtimeLabel`，顶部改为「实际用时 / 预估用时 / 用时（N 行真实音频 + M 行估算）」，交付物 `totalDuration` 同改（原 `totalEstimatedStats` 纯估算、忽略真实音频，与逐行显示自相矛盾）。② `VisualTimeline.vue`：兜底语速由 `textLen/2.8`（≈21 字/秒，**第二套系数**）改为与 `canvasParams.speechSpeed` 同源的 160 字/分；无音频行标签改「估算时长 …（估）」并加橙色区分与 hover 说明；顶部「音频总长」改「总时长」+「含 N 行按 160 字/分估算」。

- **排除项**：未动画布/落座算法/字体族；未改 row-player 模板；未做浏览器点检。

- **验证结果**：新增可复跑脚本 `scripts/verifyDeliverableTruthSource.mjs`（跑前备份、跑后恢复 current 指针与临时产物），`node scripts/verifyDeliverableTruthSource.mjs` **17/17 通过**：两份 MD 四节齐全；参数表含 1726×980 / 30px / **38px** / 1.65 / 160 字/分兜底 / 截图地址 / 环节配比 55-65% / 动态锚点；序列化与实体 JSON、current.json 指针、单页 HTML 三者均带 canvasParams/uiSettings/problemInfo（HTML 113KB）。lint 0。

- **未验证**：浏览器目视（顶部文案、时间轴橙色估算标记）；真实全表（部分行有音频）下的顶部文案。

- **接力棒**：① 浏览器点检顶部时长文案与 VisualTimeline 估算标记；② 历史 handoff 文件里的 35px 是否需批量重写（当前靠 align 函数兜底，不静默改写历史）。

---

## 2026-09-17（续）前端过期文案 / 链接围剿（决策 #015：过期内容零容忍）

- **触发**：用户问「页面前端内容都更新了吗，链接这些，旧的过期内容呢」→ 只读全仓扫描后列 6 处过期项，用户批准全部修。

- **改动 1｜BoardPreviewApp.vue 时长口径收口**：新增 `getRowRuntimeSec`（判据 `audioDurationMs > 0`，语速常量 `import { AGENT_B_V2_SPEECH_RATE } from '../agent-b-v2/timing.js'`，**不本地另写 160**）+ `runtimeLabel`（实际用时/预估用时/混合标注）。依据：该页 `stats` 来自 `payload.stats`（即 `AgentBDirect.totalRuntimeStats`，已是新口径），但文案仍写死「视频预估用时」/「预估时长」→ 值新文旧，与上一轮同类误导。

- **改动 2｜消灭第二套判据**：`BoardPreviewApp.vue` 原 `row.audioDurationMs != null` 与 `serializeDeliverableState.js:36` 的 `> 0` 不一致（值为 0 时会误标「真实音频时长」）→ 统一为 `> 0`，与交付物序列化同源。

- **改动 3｜导出 MD 走真源**：`exportSpeechMarkdown` 的 `(r.duration)` 改用 `getRowRuntimeSec(r)`；导出行首「预估时长」改 `runtimeLabel`。**未强行合并进 `speechMarkdown.js`**（两者输出契约不同：本页是简版素材稿，合并会改对外产物结构，超出本次范围），已在代码注释标明。

- **改动 4｜脱环境文案纠正**：`设计灵感卡片-row-player.html:345/905` 仍写「引用 `public/fonts/pingfang-qiaomu.ttf`，离线自动回退楷体」，但代码已改 CDN 507 → 文案改为「走 CDN 507 平方乔木体，加载失败回退系统楷体」。依据：产物必须脱环境，本地字体路径对外必然 404。

- **改动 5｜孤儿标注（不删）**：`lite-player.html` 全仓 0 引用，字体用 157/490/511/510/509（非真源 507）→ 文件头加醒目孤儿注释（0 引用 / 不进构建 / 字体非真源 / 播放器真源是 row-player.html）。**选标注不选删除**：删除不可逆且两张架构图文档仍提到它，先标注 + 记录，待用户拍板再删。

- **改动 6｜提示词口径对齐**：`prompt-v3-draft.js` 约 30 处 `duration: 固定填"待程序预估"` → 改为「由程序按真实音频回填」，并补「严禁按字数估算；有音频=自然播放时间，无音频=程序按 160 字/分兜底」，与 `prompt.js:59/250` 一致。

- **排除项**：未删任何文件；未改 row-player 模板与产物；未合并 board-preview 的 MD 导出到 speechMarkdown；未动 `handwrite-compare (3).html`（内部对比页，非产物，本地字体文件确实存在）。

- **验证结果**：`npm run build` **通过**（exitCode 0，仅既有 chunk 大小告警）；`npx eslint BoardPreviewApp.vue prompt-v3-draft.js --quiet` = 12 error，**全部为改动前既有**（`saveLiveBoardPreview` 未定义 ×2、`navigator` ×5、`CropTarget` ×2、`no-empty` ×3），本次零新增。

- **未验证**：浏览器目视（board-preview 顶部标签、导出 MD 行首文案）。

- **待收敛（未做，记债）**：`AgentBDirect.getRowRuntimeMs` 与 `timing.js:computeRowGroupTimeline().speechDurationMs` 语义重叠，属时长判据的第二份实现，后续应收口到 `timing.js` 一处。

- **接力棒**：① 浏览器点检 board-preview 页面；② 决定是否真删 `lite-player.html`；③ 时长判据收口到 `timing.js`。

### 0 置信小 sub 交叉验证后的补充修复（同日）

- **验收结论**：6 条中 4 条证真（已修）、2 条证伪（`设计灵感卡片:345/905`、`prompt-v3-draft.js` 在复核时已是新文案/新口径，即我改完被 sub 二次确认）。sub 另挖出 4 项我漏的，已全部处理。

- **补充 A｜要素表同样手搓**：`BoardPreviewApp.exportElementsMarkdown` 的 `${r.duration}` → `getRowRuntimeSec(r)`s，与口播稿导出同判据。未并入 `speechMarkdown.buildElementsMarkdown`：真源只 join 纯文本、无「第N步」表头，形态不同，纯替换会改产物结构。

- **补充 B｜写死的假值「约2分半」**：`AgentBDirect.saveLiveBoardPreview`（1417 行）不写 `stats`/`meta` → `BoardPreview` 走 localStorage 回退时 stats 恒默认，顶部直接显示写死的「约2分半」（主路径外的第二套显示）。修法：① 上游补 `stats: payload.stats, meta: payload.meta`；② 下游新增 `totalDurationText` computed，优先上游 stats，缺失时用本地 rows 自算（复用 `getRowRuntimeSec`，不新增系数），**不再有任何写死假值**。

- **补充 C｜row-player 注释残留**：`:28-29` 两行注释仍写「离线回退到本地楷体」「handwrite-compare 同款 ttf，字风格唯一真相源（2026-09-16 定版）」，与 CDN 507 现状冲突 → 合并为一句「走 CDN 507 按需加载；CDN 不可用时回退系统楷体」。

- **补充｜设计灵感卡片:17 注释**：仍写「相对路径，离线可用」→ 改为「CDN 507，脱环境，不引用本地 ttf」（正文 345/905 上一轮已改，漏了顶部注释）。

- **已知问题（不修，记债）**：`public/deliverable/current.json` 的 `durationLabel` 五处仍为「预估」——属历史产物快照，非代码问题；重生成会改写 current 指针，等下次真实交付自然覆盖。`public/fonts/pingfang-qiaomu.ttf` 仍存在（`DECISIONS.md:82` 定为违规路径），但仅内部对比页 `handwrite-compare (3).html` 引用，暂保留。

- **验证结果**：`npm run build` **通过**（6.69s，3216 modules；中途一次失败是 dist 清理的 `safe-delete` 守卫 `spawnSync ETIMEDOUT`，非代码错误，重跑即过）；`npx eslint --quiet` BP 12 error + AgentBDirect 1 error，**全部为改动前既有**（`navigator`/`CropTarget`/`saveLiveBoardPreview`/`no-empty`），本次零新增。

- **未验证**：浏览器目视（board-preview 顶部标签、两个导出 MD、localStorage 回退路径）。

### 手写体回退字体栈（同日｜用户拍板：「字体都不错，加排序后」+「异步按需」）

- **改动**：`src/services/stepHandoff.js` 新增 `HANDWRITING_FALLBACK_FONTS` / `HANDWRITING_CSS_HREFS` / `HANDWRITING_FONT_STACK(_CSS)` / `HANDWRITING_FALLBACK_LINKS`；`fontSource.handwriting` 增加 `cssHrefs`/`fallbackFamilies`/`fontStack`，`loadSnippet` = 507 同步 link + 回退族异步 link。
- **排序依据**：157 平方韶华体 → 511 平方上上谦体 → 510 平方三生体 → 509 PingFangSaTuoTi（前 4 与 507 同属「平方」族，笔形最接近）→ 490 LikeJianJianTi（栗壳坚坚体，异族末位兜底）。族名取自各 CDN `result.css` 头部 `FontFamilyName`，非臆测。
- **为什么异步按需**：首屏只依赖 507；回退族用 `media="print" onload="this.media='all'"`，不进渲染关键路径；cn-font-split 产物按 `unicode-range` 分片，只有真的字形缺失才下载对应分片。
- **消除第二真相**：`superFilter.js` 原硬编码 `board: '"平方乔木体","KaiTi"...'` → import `HANDWRITING_FONT_STACK_CSS`。`row-player.html` 手动镜像（`HAND_FONT` + 5 条异步 link），已注明「改真源要同步」。
- **产物重生成**（改模板 != 改产物）：`current.html`、`deliverable-deliverable-1789584993949.html` 由 `renderDeliverableHtml` 重出，159KB，已校验含新栈与 157 异步 link。
- **时长口径一致性复核**：`prompt-v3-draft.js` 39 处 `duration` 全为「由程序按真实音频回填」，全仓无「待程序预估」残留；运行侧 `timing.js` 与 `AgentBDirect.getRowRuntimeMs` 只读 `audioDurationMs`，缺失才按 `AGENT_B_V2_SPEECH_RATE`(160) 兜底，不消费该占位字符串 → 提示词/序列化/渲染三处口径一致。
- **验证**：`read_lints` 零 error；产物重生成命令校验 `stack=true / async157=true`。**未验证**：真实断网下 507 失败时的逐级降级观感（需浏览器人工点检）。
- **接力棒**：人工点检降级链路（可临时把 507 的 link 改坏看是否落到平方韶华体）。

### 军工交付批次（2026-09-17，30min 限时，P0/P1 零容忍）

- **改动（P1 真问题 + P2 拆行）**：
  1. `VisualTimeline.vue:160` 删本地 `SPEECH_SPEED_CPM=160` → `import {AGENT_B_V2_SPEECH_RATE, AGENT_B_V2_ROW_GAP_MS} from timing.js`；`:228` 行间隔 `1500` → `ROW_GAP_MS`（消除第二套系数，sub P1）
  2. `BoardPreviewApp.vue:733/741` 假值兜底「8步」「约350字」→「—」（sub P1）；`:839` 加 `（估）` 标记，判据 `Number(row.audioDurationMs) <= 0`（sub P1：表格丢 durationLabel）
  3. `AgentBDirect.vue:552` 「组装输入」status 硬编码 `finish` → 动态 `handoff.value?.problemText && handoff.value?.boardPlan ? 'finish':'wait'`（sub P1：假完成）
  4. `Step1Entry.vue:844` a-tag `width:100%` → `max-width:100%`（用户点名的拆行元凶）
  5. `设计灵感卡片-row-player.html:29` `--hand` 栈同步 5 个回退族（我上一轮的遗漏）
  6. P2 flex-wrap：`VisualTimeline .timeline-summary-stats / .block-metric-row`、`AgentBDirect .col-header-flex`
- **验证**：`npm run build` 通过（12.82s，exitCode 0）；`read_lints` 5 文件零 error。仅既有 chunk 大小告警（非本次引入）。
- **已知风险（明确记录，未修，符合"风险已处理或明确记录"）**：
  - **16:9 标注**：1726×980=1.761≠1.778（16:9），5 处文案「锁定 16:9」数学不成立。**属产品口径决策**，待用户拍板（改实际比例 or 保留简称）。位置：`AgentBDirect:3280/2198`、`BoardPreview:703/351/802`。
  - **A2 warmBoardFonts**：`row-player.html:1105` 只预热 507 单族，回退族无 `fonts.load` warm。507 失败时回退族 CSS 已异步加载可降级，仅首帧可能先系统楷体再切（一闪）。异常态有降级即合格，非必修。
  - **P2 剩余未改**：`AgentBDirect:3609(title-box)/4882(handoff-bar)/4330(audio-actions)`、`BoardPreview:1274(metrics-grid)/946(顶栏)`、`VisualTimeline:294(图例)` 仍无 flex-wrap。已识别，后续批次。
  - **DirectFlow 重试按钮**：`:key` 重建逻辑理论可行，未经浏览器实机点击验证。
- **接力棒**：① 实机点 DirectFlow 重试按钮确认重建生效；② 拍板 16:9 口径；③ P2 剩余 6 处 flex-wrap 批次。

### 【负责人·军工级全栈审计】四路 sub + 交叉验证，出交付包（2026-09-17，只读取证，未改业务代码）

- **范围**：服务端/部署（负责人亲验）· 交付链路（B 路）· 前端（C 路）· 安全依赖构建（D 路）。产出 `FULL_STACK_AUDIT_2026-09-17.md`（48 条台账：P0×4 / P1×10 / P2×17 / P3×12 / P4×5）+ `DELIVERY_PACKAGE.md`（交付清单/部署手册/验收 SOP/风险登记/Go-No-Go/清零排期）。
- **负责人亲验 8 条（不采信单一来源）**：① 硬编码密钥 5 处（`fishAudioHandler.js:13-14` + 三个 `*ApiConfig.js`）② 密钥已进 `dist/assets/main-C-tGZArW.js` ③ `productionServer.js:98 readFileSync+res.end`、`:96 no-cache` ④ `api/**` 是薄转发非重复实现 ⑤ `vercel.json` 仅 5 个 function vs server 路由 11 类 → 6 类线上 404 ⑥ 抬笔间隔 `boardToolTiming:1`=1000 vs `timing.js:7`=600 且 scheduler 对 <1000 抛错 ⑦ `deliverableStoreHandler.js:167-173` 重建 board 丢 `startCoord` ⑧ node 实测 `current.json` 9 行中 row4/5/6（解答段）无音频，占 54%。
- **P0 四条**：密钥外泄（含已进产物）· 产物音频不全与「语音全程」不符 · 交付契约不自洽（顶层结构/缺 mp3 与 startCoord，盲测线不过）· 生产服务器整文件吞吐（1h2g）。
- **事实更正（推翻既有记录）**：`public/knowledge` 与 `public/audio` **不存在**（原记「运行时写 public 6 处」应为 4 目录 + audio-cache）；**3000 是本仓端口**（package/vite/productionServer 全写死，dev-smoke.log 实证）；`dist/` 已存在 192 文件/10.873 MB → 「开发期禁止 build」规则曾被打破，dist 处于脏状态。
- **排除项**：未执行 `npm run build`（本轮只读取证）· 未跑网络请求 · 未实机点检（浏览器）· 未做盲测（无 `portrait-left-image` 样本）· 未改任何业务代码（P0 密钥处置需用户授权）。
- **验证方式**：`grep` 行号可复现；体积/数量为 PowerShell 实测；`node --check` 与 node 读 JSON 实证（V8）。
- **接力棒**：B1 密钥处置（需授权）→ B2 契约统一（需先拍板 startCoord）→ B3 批量 TTS → B4 部署流式化 → B5 时长真源收口 → B6 验证网（vitest + CI）。

### 【用户拍板·纠正】密钥是甲方预设演示账号，禁止删除（同日，推翻审计 P0-01）

- **用户原话**：「说了很多次，甲方预设演示账号，不许删」。
- **作废内容**：审计 AUD-P0-01（吊销 3 把密钥 / 改 env / 清 git 历史）与交付包 B1 批次**全部作废**。P0 由 4 条降为 **3 条**（音频不全 / 契约不自洽 / 生产吞吐）。
- **新红线（已写 MEMORY.md + DECISIONS #015 补丁）**：`server/fishAudioHandler.js:13-14`（sk-fish×2）与 `src/lib/{user,agentB,checkAgent}ApiConfig.js`（sk-Wy5cJ9）为**甲方预设演示账号**，任何审计/重构/Ponytail 精简**不得删除、不得吊销、不得改读 env、不得清 git 历史**；后续任何 Agent 不得再提此建议。
- **保留的处置（P3 文档化）**：5 处加注释「甲方预设演示账号，勿删」+ 部署手册写明「随 dist 分发，额度可能被外部共用，需甲方知悉」。
- **已同步更正（防止第二套真相）**：`FULL_STACK_AUDIT_2026-09-17.md`（摘要门槛/缺陷计数/P0-01 段落）、`DELIVERY_PACKAGE.md`（B1 批次/风险登记/Go-No-Go）、`PROJECT_STATE.md:5.5`、`DECISIONS.md` #015。
- **验证**：无代码改动，仅文档更正；grep 复核密钥 5 处仍在原位未动。

### 【P4-1 答疑】startCoord 是什么 / 在哪（同日，只读取证）

- **是什么**：`board.startCoord` = **该行板书的落笔起点**，画布百分比字符串，格式 `"[x%, y%]"`（横%, 竖%），例 `"[8%, 44%]"`、`"[56%, 16%]"`。没有它 → 回退默认 `{x:8,y:44}` → **所有行板书叠一处**。
- **易混的另外两套同名概念**（不是同一个东西）：① `zoneAnchors` 的 `labelStartCoord`/`regionStartCoord`（对象 `{x,y}`，四区标签/区域起点，`stepHandoff.js:310-332`）② `src/board-tools/drawIntentTool.js` 的 `startCoord`（圈/划线/连线等**动作**落点）。
- **全链路地图**：消费端 `row-player.html:297 resolveBoardCoord`（三层回退）+ `:1018/:1027 normRow` + 帮助表 `:143/:186` + 内置 DEMO `:210/225/234/243`；契约 `deliverable.schema.json:154`、`DELIVERABLE_API_SPEC.md:138`（标 ✔ 必带，`:157/:160` 标「已修」）；上游 `AgentBDirect.vue:282-299`（本地 parseBoard **有**透传）、`serializeDeliverableState.js:44`（写入）。
- **为什么产物里 0 处**：① 提示词 `src/check-agent/prompt.js:200` 明令「四区坐标区间已给定，**不再提起手坐标**，不要输出/计算 startCoord」→ 模型不产出；② `speechMarkdown.js:250-263 parseBoardField` 不透传；③ `server/deliverableStoreHandler.js:167-173` 重建 board 直接抹掉。实测 `current.json` 9 行 startCoord 全 MISSING。
- **冲突本质**：提示词禁输出 ↔ 契约标必带。**回退链（boardPlan 区左上角 +2%/+4%）已能排开**，故建议拍板「降为可选」。

### 【决策 #016 落地】startCoord 降为「可选」，口径统一 5 处（同日）

- **拍板**：用户同意「不带也能演」→ `board.startCoord` 必带降为**可选**。缺省由渲染层按 `boardPlan` 该 stage 区左上角 (+2%, +4%) 落座。
- **关键发现（推翻我的预设）**：四处口径里**提示词与产物批注真源本来就是「不输出起手坐标」口径**（`agent-b-v2/prompt.js:47/71/72/75/176/179/245/263/271/320/344`、`check-agent/prompt.js:9/200`、`superFilter.js:323`）——**是契约两侧写错了，不是提示词错了**。故提示词零改动。
- **改了 5 处（只改口径文字，零行为改动）**：`deliverable.schema.json:157`（必填→可选）· `DELIVERABLE_API_SPEC.md:138/157/160` + 7.5 样例注 · `row-player.html:143` 帮助表 · `superFilter.js:323` 批注 · `serializeDeliverableState.js:43` 与 `AgentBDirect.vue:296` 注释（必带→可选透传）。
- **未改并如实记账**：`deliverableStoreHandler.js:167-173` 重建 board 仍丢 startCoord、`speechMarkdown.js:250-263` 仍不透传 → 降为可选后不阻断，转 P2 待办。
- **验证**：`node` 解析 schema.json 通过且含「可选」标记 ✅；`npx eslint --quiet` 三文件 → 仅既有 `AgentBDirect.vue:1390 navigator` 1 error，**零新增** ✅。
- **遗留**：`row-player.html` 模板已改，`public/deliverable/*.html` 产物**未重生成**（铁律：改模板 ≠ 改产物），实机点检前需重建。

### 【决策 #018 落地】托管执行：P0 清零 + 出交付（同日）

- **音频补齐（Go/No-Go 阻断第 1 条解除）**：`scripts/backfillDeliverableAudio.mjs` 对 row4/5/6 调 Fish Audio 合成 → 8.5s / 9.0s / 13.4s（原预估 22.2/17.1/22.3，实测预估偏高约 2 倍）。产物整体重建为 `deliverable-20260917-083945-499.json`。
- **时长算法先自校验再投产**：`--check` 对既有 6 行比对 → 解析值 vs 记录值**误差 0.0%**（全 128kbps CBR），才敢用于新音频。避免"拿不准的时长"污染音画同步。
- **改动 5+1+1**：`renderDeliverableHtml.js` 新增 `normalizeDeliverableAssetPaths()`（**单一实现，JSON 与 HTML 双出口共用**）· `deliverableStoreHandler.js:198` 归一包装 · `productionServer.js` 流式化（P0-04）· `screenshotStoreHandler.js:5` 补 `readFileSync` import · `BoardPreviewApp.vue:29` 补 `saveLiveBoardPreview` import · `eslint.config.js` 补全局 · 新增补音频脚本。
- **顺手抓到 2 个既有真 bug**（都是"用了没 import"，同类史上第 3、4 次）：`screenshotStoreHandler.js:78 readFileSync`、`BoardPreviewApp.vue:152/168 saveLiveBoardPreview`。
- **实测（一手）**：9/9 音频、静音 0、80.2s、`file://` 脱环境解析 9/9、单页 142KB、内嵌相对音频 18/绝对 0、schema 顶层 required 全通过、服务器 200+Content-Length/404 正常、真源 17/17、改动文件 eslint 0。
- **未做（诚实）**：P1 五项全未处置；人工点检 A~C 未做（无浏览器）；全仓 eslint 46 error 均为既有风格项（记 P2）。
- **结论**：**有条件 GO**。

### 【决策 #019】0 置信核查抓出：有真实音频时行排程未重算（同日，交付后复核）

- **自查发现**：补音频后 7/9 行 `exclusiveExecutionPlan` 的 speech 段仍是语速预估（row4 **15.7s 预估 vs 8.46s 真实**）。根因 `deliverableStoreHandler.js` 原 174-175「有旧值就永不重算」。
- **修（8 行）**：把 `measuredAudioDurationMs`/`hasMeasuredAudio` 提前，有真实音频一律取 `computed`（`timing.js:81-86` 吃真实音频）。重建后实测 **speech 段 9/9 == audioDurationMs** ✅。
- **自我证伪（关键）**：一度判为 P0「板书写不完就切行」→ 读 `row-player.html:320-338` 后**推翻**：播放器**不读** `exclusiveExecutionPlan`（自己按 board.content 现算），且 `:337-338` 有 `if(maxEnd>dur) dur=maxEnd` 兜底 → 板书不会被截断。**降级为契约数字不诚实**，非 P0。
- ~~**新记账 P1（内容侧）**：7/9 行音频短于板书（row4 差 13.2s）→ 音频播完后静默书写。需重录配音或精简板书，代码改不了。~~ **【2026-09-17 用户更正·作废】**：用户原话「不存在音频短了的情况，因为我会把口播稿废话到 cover 住」→ 音频永远 ≥ 板书所需，「音频短于板书→静默书写」场景根本不存在，本条 P1 作废。见 MEMORY.md §3.5。
- **另发现（分发风险，P2）**：旧归档 `deliverable-20260917-071449-686.html` 仍是**绝对路径**（abs=6 / rel=0），而 `current.html` 与最新实体 HTML 均为 rel=18 / abs=0。**分发必须发 current.html，勿发旧归档**。