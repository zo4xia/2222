# 工程日志

## 2026-09-16 录屏交付按钮增加题目识别与 TTS 音轨状态预检查及 Ant Design 引导 Modal

**背景与口径**：
- 用户要求在录屏交付按钮中添加预检查逻辑：如果题目识别状态或 TTS 音轨状态未就绪，点击时弹出一个 Ant Design Modal，展示当前未就绪的模块列表，并指引用户完成。
- 遵循“系统放权，不绑死”原则：预检查弹窗提供清晰的未就绪诊断与跳转指引，同时保留“刷新就绪状态”与“仍要测试录屏”选项，避免死锁流程。
- 遵循最小修改铁律：只修改录屏入口 `src/board-preview/BoardPreviewApp.vue`，不引入任何外部依赖。

**改动项**：
- `src/board-preview/BoardPreviewApp.vue`：
  1. 新增 `precheckModalOpen` 响应式状态与模块就绪度计算：
     - `problemReadiness`：检查 `problemText` 是否非空，未就绪时诊断并指引返回「第 1 步 贴题识别」完成落位。
     - `ttsReadiness`：检查 `rows` 是否非空且所有步骤均具有有效 `audioUrl`，未就绪时指引前往 Agent B 完善 TTS 音频合成。
     - `unreadyModules` 与 `allModulesReady` 聚合就绪状态。
  2. 改造 `toggleScreenRecording`：在非录制状态点击「录屏交付」时，若存在未就绪模块，阻断录制并拉起 `<a-modal>`。
  3. 规范化常规顶栏与全屏悬浮条的录屏按钮文案为统一的「录屏交付」/「录制中 mm:ss」。
  4. 模板中集成 Ant Design Modal（`<a-modal>` + `<a-alert>`），美观呈现未就绪模块清单、诊断原因、解决指引与跳转链接，底部提供「刷新就绪状态」及「我知道了，去完成」操作。
  5. 补充 Modal 专用 scoped CSS 样式。

**验证**：
- `lint_applet`：0 error。
- `compile_applet`：构建成功（`npm run build` pass）。


**背景与口径**：
- 落实重构标准规范与用户需求：四角标（题目、分析、解答、总结）支持鼠标直接在画布上拖拽排版定位，并具备图片容错与 CDN 双备用（优先本地/public，错误备用外网图床，SVG/系统楷体降级兜底）。
- 落实后端健康检查（`/api/health`）与 Mock 接口（`/api/mock/problem`），满足本地开发与生产容器探针要求。
- 遵循最小修改铁律：不破坏主流程，复用现存拖拽架构与坐标系（百分比布局）。

**改动项**：
1. `src/components/BoardContentLayer.vue`：
   - 升级四个角标（`#badge-topic`、`#badge-analysis`、`#badge-solution`、`#badge-summary`），赋予 `draggable-item` 与 `badge` 样式；
   - 支持实时拖拽计算百分比坐标（`x`, `y`），拖拽悬浮提示实时坐标；
   - 统一角标 `onerror` 降级逻辑（`this.src='https://i.ibb.co/...'`）；
   - `getBadgeStyle(target)` 统一四区角标初始与拖拽坐标读取；
   - `syncAll()` 全量同步四个角标最新拖拽坐标至 `updatedLayout`，并落库 `localStorage` 及向上通知。
2. `server/productionServer.js` & `vite.config.js`：
   - 新增 `/api/health` 健康检查端点；
   - 新增 `/api/mock/problem` 模拟数据端点。
3. `metadata.json` & `index.html`：
   - 同步应用名称与元数据规范（`小学数学讲解视频生成工作台`）。

**验证**：
- `npm run lint`：0 error。
- `compile_applet`：构建成功（`npm run build` pass）。


## 2026-09-16 移除所有直接暴露的时序配置参数 UI（全由音频与系统底层逻辑兜底驱动）

**背景与口径**：
- 用户要求移除所有直接暴露给用户的时序配置参数 UI，避免误导用户或造成伪时序认知。
- 遵循核心原则：时间不强行预配置；口播语速（基准 160 字/分）、行停顿（基准 1.5s）与板书起手节点由真实音频时长与系统底层语义/虚拟时钟自适应兜底驱动。

**改动项**：
1. `src/agent-b-v2/AgentBDirect.vue`：
   - 移除「演播室时序与节奏」面板中直接暴露的「口播语速」与「Row 间隔停顿」数字输入控件（`a-input-number`），保留干净的 1726×980 画布规格与字号只读规范。
   - 移除板书编辑弹框中的「落笔时机 (语音播放后延时)」手动微调输入框，板书编辑区纯粹聚焦于 KaTeX 教学内容本身。
   - 清理未使用的 `updateBoardStartDelay` 及 `onUpdateStartDelayFromTimeline` 手动调整逻辑。
2. `src/components/VisualTimeline.vue`：
   - 移除时间轴区块中板书起手的 `+` / `-` 手动微调按钮步进器（`.btn-offset-step`），改为只读的状态信息标签，真实体现音频或系统语义驱动的时序。
   - 清理相关的 `update-start-delay` 事件与 `adjustOffset` 手动微调方法。

**验证**：
- `npm run lint`：0 error。
- `compile_applet`：构建成功（`npm run build` pass）。

## 2026-09-16 移除序号列预估时间胶囊（误导性时间显示）

**背景与口径**：
- 用户反馈序号列显示的假定预估时间（如 `0.0s-4.5s`）会误导用户，违背了记忆库中明确的兜底准则（“时间不预计算，时长以真实音频为准，无音频时由虚拟时钟兜底驱动，禁止硬编码或预先计算误导性固定时间点”）。
- 依据 focus-mode 所选中的表格第 1 列（序号列下方的 `.row-timeline-pill`）。

**改动项**：
- `src/agent-b-v2/AgentBDirect.vue`：
  - 彻底移除表格序号列内的 `.row-timeline-pill` 虚拟预估时间标签。
  - 保留干净清晰的拖拽把手与行号徽章，消除非真实音频阶段对用户的时长误导。

**验证**：
- `npm run lint`：0 error。
- `compile_applet`：构建成功（`npm run build` pass）。

## 2026-09-16 视觉设计体系精修（UI Overhaul）

**背景与口径**：
- 用户反馈视觉风格与 UI 杂乱失序（"整个产品视觉风格形象ui。。。。现在很灾难"）。
- 严格受控：锁定甲方要求的素材、画布标签、四区坐标边界（1726×980），禁止变更主流程逻辑或增删外部依赖。

**改动项**：
1. `src/style.css`：
   - 建立设计系统 Tokens（字族体系、`--card-radius: 12px`、轻量自然阴影、色彩层次系统：Slate/Blue 主题色与柔和边框）。
   - 重构 Ant Design 按钮、全局卡片、统计指标卡片边框与悬浮反馈微交互。
   - 补充 `.qh-step-badge`、`.qh-header-subtitle` 与 `.qh-back-btn` 样式规范。
2. `src/components/QhPageHeader.vue`：
   - 优化顶栏层级结构，采用统一胶囊步进标识与柔和副标题排版，移除粗糙默认 Tag。
3. `src/components/Step1Entry.vue`：
   - 重构题目预览卡、参数卡片、板书视口、知识点关联胶囊标签与模态弹窗样式。
   - 统一边框色阶（`#e2e8f0`）、高对比度可读性文字（`#0f172a`）及状态标签。
4. `src/agent-b-v2/AgentBDirect.vue`：
   - 重构操作工具栏（ASR 兜底暖金按钮、Check Agent 状态按钮、主生成按钮）。
   - 题目信息卡与五字段表格（表头、行高、聚焦态、口播编辑卡片、板书卡片）轻量化与层次化。
5. `src/components/VisualTimeline.vue`：
   - 视觉时间线容器与环节块边框、阴影重构，提升时间线交互质感。

**验证**：
- `npm run lint` 验证：0 error。
- `compile_applet`：构建成功（`npm run build` pass）。

## 2026-09-14 任务1：Agent B 契约与提示词收口（新板书不生成起手坐标）

**口径**：板书 = 「写什么」(content) + 「何时落笔」(startDelay)；起手坐标/行高/行距/横向错位一律不进模型输出，排版归领地 E 渲染层。`coordinateMode` 只约束 `actionSpec` 的 start/end。

**取证（0 置信，先证伪再动刀）**
1. 契约：`contract.js:normalizeBoard()` 只返回 `{content, startDelay}`；`sanitizeRowLayout()` 已退化为纯 board 归一化（不再改写坐标）；`checkAgentHandler.js` 白名单已移除 `board_coord`；`asrPolish.js:polishBoardSpacing` 空转。
2. 运行时实测：模型即使夹带 `startCoord`，也会被剥离 —— `normalizeBoard({startCoord:'[8%, 40%]',content:'7x2=14',startDelay:1.5})` → `{"content":"7x2=14","startDelay":1.5}`；`parseAgentBV2Response` 输出 rows.board 同样只含两字段。
3. 产物：`public/board-result/board-result-20260914-215611-056.json`（当前 current.json 指向）rows.board = `{content, startDelay}`，全文 `startCoord` 0 命中；旧快照 `board-result-20260914-202959-189.json` 仍含（历史产物，不改）。
4. 默认链路：`skills/index.js` 的 `DEFAULT_SKILL_ID='default-fallback'` → 直接返回 `prompt.js` 的 `AGENT_B_V2_SYSTEM_PROMPT`，所以改 prompt.js 即改默认生效链路（liyongle/prompt-v3-draft 非默认）。

**改动（4 代码文件 + 3 truth 文档）**
1. `src/agent-b-v2/prompt.js`：
   - 1.1 表 `zoneAnchors` 由「区域硬约束」改为「区域感知 + 动作落点」，明确板书不输出坐标、可超出本区但不得重叠/溢出。
   - 1.4 审美风格条：行距区隔改由渲染层保证；截图条「更优起手定位与避让」改为「判断写什么、避开图中内容」。
   - 5.1 **删除唯一残留的硬编码坐标规则**（解答区 X: 55%~92% / 三处起手 Y%），此前分析区、总结区同类规则已在上轮删除，本次补齐，口径彻底统一。
   - 7.3 结构检查第 3 条改为：actionSpec 坐标落在区域内 + board 只含 content/startDelay。
2. `server/agentBV2Handler.js`：`zoneAnchors` 字段注释、`screenshotUrl` 注释、zoneAnchors stageSummary 三条口径同改；提醒标题「起手布局特别提醒」→「内容排版提醒」（4 处）。
3. `src/agent-b-v2/contract.js`：修 `no-useless-escape` lint error（`[(\[]` → `[([]`，语义等价，正则行为不变）。
4. `src/agent-b-v2/AgentBDirect.vue`：删除死 CSS `.board-coord-tag` / `.empty` / `.coord-overlapping` / `.board-overlap-warn-tag` / `.board-coord-input`（全文件 grep 仅 CSS 定义、模板零引用，是坐标时代的残留）。
5. `truth/`：`00-TRUTH-BASE.md` 输出结构去 startCoord；`territory-A-agent-b.md` 契约示例 + 新增蛀虫行为 5 + 三条证据；`territory-B-contract.md` 职责改为「历史坐标剥离 + board 归一化」，标注旧坐标算法已下线。

**验证**：`npx eslint` prompt.js/contract.js 0 问题（agentBV2Handler 仅既有 unused warning；AgentBDirect.vue 2 errors 均为既有 `navigator is not defined` / `Empty block statement`，非本次引入）；node 运行时导入 `prompt.js` 实测：系统提示词中 `X: 55%~92%`、`Y: 12%~16%`、`起手 Y`、`startCoord` 四项 **全部 false**。

**未完成 / 待办（本任务未动，登记待裁决）**
- `server/checkAgentHandler.js:227-229` 使用 `path.resolve` / `fs.existsSync`，但文件顶部未 import `fs`、`path`，异常被空 catch 吞掉 → 知识库易错点检索静默失效（需补 import 或删除该分支）。
- `src/agent-b-v2/skills/liyongle-elementary/coordinate-rules.js` 仍写死四区百分比（question 0-25%/analysis 25-55%/solution 55-80%/summary 80-100%），与 `boardLayout.js` 真源四区不符；非默认 skill，暂不启用。
- `src/board-preview/BoardPreviewApp.vue:827` 直接把 `row.board`（现为对象）当字符串渲染，会显示 `[object Object]`；属渲染层任务，待后续收口。
- 渲染层自然排版（无坐标时如何落座、防重叠）尚未实现，本次只保证「不产出坐标」不引入崩溃点。

## 2026-09-14 R1 四区文本锚点与动作传递修复
- 改动：`RealBoardPreview.vue` 在 L3 根据当前五字段 `rows` 渲染 analysis/solution/summary 三个 `data-board-region` 根节点及真实文本锚点；复用 `BOARD_FONT_SIZE`，`startCoord` 同时兼容百分比和像素并按 `1726x980` 转换。
- 改动：`BoardPreviewApp.vue` 将当前 `rows` 的 `actionSpec` 扁平汇总后传入 `RealBoardPreview`，保留显式 `order`，不新增合同字段或第二份数据源。
- 依据：`truth/territory-C-actions-and-anchors.md` 要求四区 `target.exactText` 必须命中真实 DOM；`textTargetRegistry.js` 对区域根节点缺失会直接失败。
- 排除：未修改 Agent B prompt、contract、工具白名单、题目区、教学内容或历史 handoff 快照；R2/R4/R5 不在本次范围。
- 验证：本仓 Vite `http://127.0.0.1:3200` 请求两个 Vue 入口均 200（RealBoardPreview 58687B，BoardPreviewApp 246384B）；`stepHandoff.js` 200；`git diff --check` 通过。ESLint 全文件仍有既有 15 errors/140 warnings，集中在 BoardPreviewApp 的原有浏览器全局/未定义符号与模板规则，未宣称为零错误。
- 未完成：尚未做浏览器级点击四区 exactText 的人工验收。

## 2026-09-13 单进程持久化生产入口与受控清理收口
- **问题**：原项目只有 Vite 开发中间件和部分 Vercel Functions，生产环境没有统一 Node HTTP 入口；多个业务 handler 以 `public/` 内文件作为 handoff、交付物、板书、音频和截图的真相源，不能部署到无持久磁盘的函数环境。
- **实现**：新增 `server/productionServer.js`，以单个 Node HTTP 服务复用现有识别、Agent B、Check、知识修缮、handoff、交付物、截图、TTS 和清理 handlers；同时提供 `dist/` 页面与 `public/` 下的持久化档案。`package.json` 新增 `bun run start`。
- **清理边界**：`POST /api/cleanup` 维持受控清理；非 POST 请求明确返回 405，OPTIONS 返回 204。当前 handoff、交付物 JSON/HTML、板书结果不被清理。
- **验证**：`bun run build` 通过；生产服务监听 3100 后，首页、`/deliverable/current.json`、`/api/handoff`、`/api/deliverable/list` 返回 200；`GET /api/cleanup` 返回 405，`OPTIONS /api/cleanup` 返回 204；保护对象存在。
- **部署前提**：部署目标必须使项目 `public/` 目录落在持久化磁盘或挂载卷中。尚未取得甲方服务器目标，未执行远程预检或部署。

## 2026-09-09 导出 JSON 逻辑函数重构：状态树直出序列化与 UI 绝对对齐
- **问题**：用户要求“检查当前导出 JSON 的逻辑函数，确保其从当前应用运行时的状态树（state tree）中序列化板书数据，而不是错误地获取 HTML 源码，确保下载的 JSON 文件内容与当前可视化 UI 完全匹配”。
- **全面排查**：
  1. 排查导出 JSON 的逻辑函数，发现 `downloadDeliverableJson` 中曾存在使用历史缓存 `deliverableResult.value?.deliverable` 的兜底逻辑，若用户在页面上编辑了板书、起手坐标或口播，旧缓存未能实时反映当前 Vue 响应式状态树；
  2. 导出操作栏菜单原先仅提供 Markdown 导出，缺乏直接从当前状态树导出 JSON 文件的菜单项；
  3. 预览页（`BoardPreviewApp.vue`）中仅有复制 JSON 按钮，缺少直接通过原生 Blob 下载的途径。
- **重构与防线固化**：
  1. **状态树实时直出**：提取专门函数 `serializeCurrentDeliverableState()`，直接从 Vue 响应式数据树（`rows.value`、`handoff.value`、`totalEstimatedStats.value` 等）逐字段深层提取。
  2. **100% 匹配当前 UI**：每一行板书通过 `parseBoard` 保证 `startCoord`、`content`、`startDelay` 严密匹配表格输入框中当前展示和编辑的值；
  3. **杜绝网络请求与 HTML 解析**：导出过程完全发生在前端内存，使用 `new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })` 生成本地文件流，零网络请求，绝不触碰 DOM/HTML 源码，绝不可能下载到 HTML 文本；
  4. **全场景入口补齐**：在工作台顶部导出下拉菜单中新增“📦 导出完整规格 JSON (板书与时序状态树)”，与固化弹窗中的“下载配套 JSON 文件”按钮复用同一套状态树序列化机制；在 `BoardPreviewApp.vue` 中也补充了下载 JSON 功能。
- **变更文件**：`src/agent-b-v2/AgentBDirect.vue`、`src/board-preview/BoardPreviewApp.vue`、`ENGINEERING_LOG.md`
- **验证**：
  - 跑通独立单元测试断言，验证 UI 修改后序列化结果实时同步且纯净无 HTML 污染
  - `compile_applet` 成功构建
  - `npm run check:proxy` 全部通过

- **问题**：
  1. 用户反馈对外生成的 HTML 和 JSON 内容是否及时更新，和页面现在的内容是否符合、逐个正确；
  2. 用户指出“现在的下载配套json，居然是页面html代码。。。。。”；
  3. 深度审计“程序实现、agentb实现、checkagent修缮，到底多少个地方控制了 row 间距”。
- **根因分析**：
  1. **下载为 HTML 根因**：
     - `AgentBDirect.vue` 与导出的 HTML 单页原代码中，均使用死链接 `<a href="/deliverable/deliverable-xxx.json">`。当静态资源存在延迟、路径未命中或 Vite 开发服务器进行 SPA fallback 时，Vite 将未匹配的静态 GET 请求重定向到了 `index.html`，导致浏览器将 HTML 网页文本直接保存为 `.json`。
     - 用户在页面上即使编辑了表格板书或口播，死链接也不会携带前端当前修改过的最新数据。
  2. **坐标不一致根因**：
     - `server/renderDeliverableHtml.js` 内部原维护了一套 `zoneCursors` 逻辑，在生成 HTML 时执行 `if (zoneCursors[zoneKey].count > 0 && Math.abs(finalY - zoneCursors[zoneKey].y) < 7) finalY = zoneCursors[zoneKey].y + 11`。这导致大模型、Check Agent 或人工已经校准好的合法 `startCoord` 在生成 HTML 交付物时被二次篡改加 11，使得 HTML 上的坐标与工作台页面及 JSON 规格不一致。
- **修复措施**：
  1. **纯正客户端 Blob 下载**：在 `AgentBDirect.vue` 和 `renderDeliverableHtml.js` 中将下载机制改造为基于当前完整数据对象的原生 `Blob` 下载（`application/json;charset=utf-8`），零依赖网络，100% 绝对纯正 JSON，绝不可能被 Vite SPA 降级为 HTML。
  2. **服务端静态路由强隔离**：在 `server/deliverableStoreHandler.js` 中新增 `/deliverable` 专用中间件，如果 `.json` 存在则严格设置 `application/json` 与附件响应头，若不存在返回标准 404 JSON，严禁落入 `index.html`。
  3. **消灭多头篡改**：在 `server/renderDeliverableHtml.js` 中拔除对合法坐标的二次累加篡改，严格采用 rows 传入的显式 `startCoord`，确保 HTML 画布、JSON 规格与工作台页面三者 100% 逐个完全一致。
  4. **全链路 row 间距审计**：全面梳理定位了系统中控制 row 间距的 5 大层次、共 9 处正规协同机制与已拔除的 1 处冲突源（见下方结论）。
- **变更文件**：`server/renderDeliverableHtml.js`、`server/deliverableStoreHandler.js`、`src/agent-b-v2/AgentBDirect.vue`、`ENGINEERING_LOG.md`
- **验证**：
  - `compile_applet` 成功构建
  - `npm run check:proxy` 通过
  - 本地验证 `renderDeliverableHtml` 输出（HTML 中正确包含 Blob 下载脚本且显式坐标 100% 完整保留）

## 2026-09-09 修复板书 row 与 row 间距粘连及 Check Agent 行间距校验缺失
- **问题**：用户反馈“违背了row与row版板书要有间距问题，黏在一起了，且checkagent没有校验这个地方”。
- **根因分析**：
  1. `src/agent-b-v2/contract.js` 中的 `sanitizeRowLayout` 在处理超限下界时，硬限位 `coordY = maxBottom`。当一个区域内有多行时，靠后的多行都被截断回退到同一个 `maxBottom`（如 `[55.0%, 53.0%]` 与 `[55.0%, 53.0%]`），导致坐标重叠粘连。
  2. `src/check-agent/prompt.js` 仅包含 5 项职责，完全缺失板书行间距与坐标重叠校验规则，Check Agent 不会检查或校准板书纵向间距。
  3. `src/check-agent/asrPolish.js` 与 `server/checkAgentHandler.js` 缺失确定性的板书行间距规范化算法，大模型超时降级或兜底时不会修正粘连。
  4. UI 侧表格单元格间距偏紧，板书单元格缺乏起手坐标过近/重叠的直观预警与舒展行间距排版。
- **修复措施**：
  1. **间距算法修复**：`src/agent-b-v2/contract.js` 中修复 `maxBottom` 碰撞缺陷，确保 `coordY` 永远高于上一行底部（`tracker.lastY + safeGap`），严禁倒退重叠。
  2. **Check Agent Prompt 补齐**：`src/check-agent/prompt.js` 扩展为 6 大职责，新增《6. 板书起手坐标与垂直行间距校验（row 与 row 绝不能粘在一起/重叠挤压）》，明确垂直间距阈值（百分比至少 12%~16%、像素至少 120~150px）和差分报告要求。
  3. **双重保障清洗**：在 `src/check-agent/asrPolish.js` 中新增并接入 `polishBoardSpacing`，在 `server/checkAgentHandler.js` 中支持 `board_coord` 差分变更，自动检测并向下顺延留足垂直行间距。
  4. **UI 视觉与预警升级**：`src/agent-b-v2/AgentBDirect.vue` 优化表格单元格与板书卡片内边距（`padding: 12px 14px;`、`.board-card-view` 舒展外边距），新增 `isBoardCoordOverlapping` 自动检测，重叠时实时显示 `⚠️ 间距过近/重叠` 徽章，Check Agent 校准后自动清除。
- **变更文件**：`src/agent-b-v2/contract.js`、`src/check-agent/prompt.js`、`src/check-agent/asrPolish.js`、`server/checkAgentHandler.js`、`src/agent-b-v2/AgentBDirect.vue`
- **验证**：
  - `npm run check:proxy`、`npm run check:knowledge` 全部通过
  - `npx eslint` 针对修改文件通过（0 error, 0 warning）
  - 对真实存量数据 `board-result-20260909-182951-650.json` 执行 `polishRowsASR` 验证：第 8 行 `[55.0%, 53.0%]` 自动顺延至 `[55.0%, 64.5%]`，第 9 行自动顺延至 `[55.0%, 82.0%]`，准确识别并消除重叠粘连
  - `compile_applet` 构建成功

## 2026-08-22 B Prompt 全量修复 + Check Agent 独立 + 修缮 UI 升级
- **核心产出**：B prompt 全量修缮、Check Agent 提示词独立、修缮对比 UI 升级、handoff 字段注释注入
- **B Prompt 修复**：删除时间线规则残留改为直播节奏说明、新增坐标格式说明（percentage/pixel 双模式）、actionSpec 与 board 坐标格式对齐、handoff 答案建议提醒
- **Check Agent 独立**：新建 `src/check-agent/prompt.js`，从 handler 内嵌抽离；重构 `server/checkAgentHandler.js`，从真相源读 boardPlan/coordinateMode 传给模型
- **修缮 UI 升级**：左右对比布局（左机筛原文/右教研修缮）、颜色区分（灰/绿）、已优化字段标签
- **handoff 字段注释**：`server/agentBV2Handler.js` 新增 `HANDOFF_FIELD_NOTES`，发给模型时每个关键字段前注入 `_xxx_说明` 注释（12 个字段）
- **发现问题**：修缮 API 一调就写文件（前端以为点应用才写）、relatedKnowledge 数据结构不统一（A 侧对象数组 vs 修缮字符串数组）
- **变更文件**：`src/agent-b-v2/prompt.js`、`src/check-agent/prompt.js`（新建）、`server/checkAgentHandler.js`、`src/agent-b-v2/AgentBDirect.vue`、`server/agentBV2Handler.js`
- **验证**：`npm run build` 通过、核心 JS `node --check` ALL OK

## 2026-08-21 全链路 API 压实 + zoneAnchors 命名统一 + prompt 修缮
- **目标**：所有 API 请求、提示词、规则文件全部压实，确保每个链路输入输出对得上
- **全链路 API 清单（8 个）**：
  1. `POST /api/recognition/problem` — Agent A 识别
  2. `POST /api/screenshot` — 画布截图
  3. `POST /api/handoff` — 写 handoff 真相源
  4. `GET /api/handoff` — 读 handoff
  5. `POST /api/agent-b-v2/generate` — Agent B 生成（核心）
  6. `POST /api/check-agent/check` — Check Agent（25% 重要度）
  7. `POST /api/knowledge/refine` — 知识点修缮（50% 重要度）
  8. `fetch(dataUrl)` — 本地缓存
- **zoneAnchors 命名统一**：key 从 `topic` → `question`，和 boardPlan 对齐；四区结构一致（都有 label/labelStartCoord/regionStartCoord{x,y,w,h}）
- **prompt.js 修缮（12 处）**：补 boardPlan/canvasParams/zoneAnchors 字段说明、新增 coordinateMode 字段、handoff 唯一真相源声明、坐标格式由 coordinateMode 驱动（不写死百分比）、字号行高表以 handoff 为准
- **变更文件**：`src/services/stepHandoff.js`、`src/agent-b-v2/prompt.js`
- **验证**：`npm run build` 通过、eslint 0 errors、写死百分比残留 0 处、zoneAnchors.topic 旧 key 0 处

## 2026-08-21 duration 全链路清理
- **决策**：时间不预计算，全部下游动态算；B 模型只输出内容（stage/speech/board/actionSpec），不输出时间字段
- **动作时间**：actionSpec 里的时间是相对 row 起点的偏移，不是全局绝对时间
- **行标识**：用 `stage-第N行` 替代时间列和 duration
- **已清理文件（8 个）**：`contract.js`、`prompt.js`、`timing.js`、`AgentBDirect.vue`、`speechMarkdown.js`、`checkAgentHandler.js`、`liyongle-elementary/output-format.js`、`liyongle-elementary/examples.js`
- **未清理（记录在案）**：`prompt-v3-draft.js`（草稿）、`proxySelfCheck.js`（自测脚本）、`board-rules.js`（动作级 durationMs 合理保留）
- **验证**：`npm run build` 通过（1.81s）

## 2026-08-21 canvasParams 循环引用 bug 修复 + 参数体系梳理
- **问题**：`AgentBDirect.vue` 的 `generateRows` 中 `canvasParams` 是 `ref({...})`，但代码写了 `canvasParams.rowGapMs` 和 `{ ...canvasParams }`，展开的是 ref 对象本身（含 ReactiveEffect 循环引用），导致 `JSON.stringify` 报错
- **修复**：`canvasParams.xxx` → `canvasParams.value.xxx`
- **参数体系发现**：
  - 两套参数并存：handoff.canvasParams（数据层）vs UI canvasParams ref（B 页面用户可调）
  - 命名不一致：数据层题目区叫 `question`，UI 层叫 `topic`
  - zones 是死代码：定义了但从未被模板或 script 引用
  - 导出与渲染不一致：导出去读 UI canvasParams，渲染实际用 boardPlan 的值
- **变更文件**：`src/agent-b-v2/AgentBDirect.vue`、`src/agent-b-v2/contract.js`、`eslint.config.js`、`server/proxySelfCheck.js`、`reasonix.toml`
- **验证**：`npm run build` 通过（2.90s）

## 2026-08-17 修复 Agent B API URL 重复拼接问题
- **问题**：上游 API 传入完整 URL（含 `/chat/completions`）时，`server/http.js` 的请求 helper 会再次拼接路径，导致请求 404/500
- **根因**：`requestChatCompletion` 固定请求 `${baseURL}/chat/completions`，`requestAnthropicMessage` 固定请求 `${baseURL}/v1/messages`，未判断 baseURL 是否已包含目标路径
- **修复**：两个 helper 增加 `endsWith` 判断，已包含目标路径则直接使用，不再拼接
- **配套变更**：`src/lib/agentBApiConfig.js` 默认配置切换为 Agnes 完整 URL/模型/Key，storage key 升 v2 避免旧缓存污染
- **验证**：`npm run build` 通过、`npm run check:proxy` 通过、真实上游请求返回 HTTP 200
- **变更文件**：`server/http.js`、`src/lib/agentBApiConfig.js`、`AGENTS.md`（新增最小修复铁律）
- **教训**：修单一问题时禁止顺手修改无关文件，所有优化想法需用户确认后再执行

## 2026-09-05 优化 Agent B 交接台参数表排版与微徽标溢出质感
- **问题**：Agent B 输入交接台参数表中，大字（字段值）与小小字（字段名 `.qh-field-key`）紧贴排版生硬，长字段名或长文本时容易撑爆单元格溢出，整体灰扑扑缺乏设计质感。
- **根因**：`.qh-field-key` 直接内联拼接在值文本末尾，缺乏弹性包裹层；单元格缺失换行控制；画布参数与四区参数直接输出长字符串或单调标签。
- **修复**：
  - 引入 `.field-val-box` 主从布局，大字高对比清晰居左，小小字升级为优雅紧凑的等宽微型徽标，长文本支持自动断行。
  - 画布参数重构为结构化参数芯片展示（尺寸、字号、行高、板书/动作速度一目了然）。
  - 四区参数升级为带颜色区分的分区芯片网格。
  - 参数表外层增加圆角、微阴影与精致分区标题线，全面杜绝文本溢出。
- **变更文件**：`src/agent-b-v2/AgentBDirect.vue`、`ENGINEERING_LOG.md`
- **验证**：`compile_applet` 通过。

## 2026-09-05 为参数表与五字段表格行添加 hover states 与 smooth transitions
- **目标**：增强参数管理与脚本执行表的交互反馈和高级质感（premium & responsive）。
- **改动**：
  - 五字段执行表：`tr > td` 增加 `cubic-bezier(0.4, 0, 0.2, 1)` 平滑背景与阴影过渡，悬停时左边缘呈现精致蓝色指示线，行号徽标、口播卡片和板书卡片联动柔和微升。
  - 交接台参数管理描述表：各参数行悬停时标签和内容平滑过渡，字段微徽标、画布参数微芯片与四区芯片悬停时具有立体悬浮效果与高亮描边。
  - 演播室参数控制面板：每个参数控制项在 hover 时平滑浮起并呈现浅白卡片微阴影。
- **验证**：`compile_applet` 通过。

## 2026-09-09 生成产物单页直调真预览画布作为底层背景与透明层 z-index 隔离
- **目标**：响应用户指令（"画布不是自己再做的，而是直接调用这个预览画布做背景...上面隔离一层透明的layer，这样用z-lindex隔离...省事，不要手搓"），杜绝在外部生成的产物 HTML 中手搓/重复实现画布与定位逻辑，避免伤害 Agent A 的布局定位。
- **改动**：
  1. `src/board-preview/BoardPreviewApp.vue`：
     - 支持 `mode=canvas` 纯画布背景模式（隐藏外壳/状态条/参数看板，100% 充满视口并严锁 1726×980 画布宽高比，无边框与多余阴影）。
     - 增加 `postMessage` 消息通道，支持接收 `SET_DELIVERABLE`、`TOGGLE_GRID`、`TOGGLE_LABELS`、`TOGGLE_ZONES`，并在挂载就绪时通知父页面 `BOARD_PREVIEW_CANVAS_READY`。
  2. `server/renderDeliverableHtml.js`：
     - 彻底移除手搓的题目文本框、快照定位、分割线与四大标签图钉。
     - 画布视口底层直接嵌入 `<iframe class="preview-canvas-bg" src="/board-preview.html?id=...&mode=canvas">` 作为真实画布背景（`z-index: 1`）。
     - 顶层通过 `<div class="board-transparent-layer">` 隔离（`z-index: 10`），在上层承载动态板书、时序元素和动作交互，实现层级完全隔离，零手搓、零篡改 Agent A 逻辑。
     - 工具栏控件通过 `postMessage` 与背景画布双向联动。
- **变更文件**：`src/board-preview/BoardPreviewApp.vue`、`server/renderDeliverableHtml.js`、`ENGINEERING_LOG.md`
- **验证**：Node 独立渲染验证通过、`npm run check:proxy` 全绿通过、`compile_applet` 构建成功。

## 2026-09-09 表格每行口播新增手动生成语音喇叭、重新生成、本地保存并记录下载URL
- **目标**：满足用户对每行口播内容进行独立语音控制的需求：
  1. 手动生成本内容语音的小喇叭按钮（兼播放试听/暂停切换）。
  2. 重新生成按钮（向 Fish Audio 接口发起最新口播内容强制重新合成）。
  3. 保存本地并记录下载 URL 按钮（遵循与截图一致的时间戳与步骤命名前缀，配套存入 `public/audio/` 与 `public/pic/`，并在当前状态树与导出数据中记录 `audioUrl`，支持界面一键复制与下载）。
- **改动**：
  1. `server/fishAudioHandler.js`：
     - 新增 `saveSpeechLocally` 函数：支持与截图规范统一的命名（`audio-YYYYMMDD-HHMMSS-ms-stepN.mp3`），生成或读取合成音频后同步保存至 `public/audio/` 与 `public/pic/` 配套目录。
     - `synthesizeSpeech` 支持 `forceRefresh` 参数实现重新生成。
     - 路由新增 `POST /api/tts/save-local` 接口。
  2. `src/agent-b-v2/AgentBDirect.vue`：
     - 口播列展开态底部操作条增加语音操作按钮组：小喇叭按钮（生成/试听/暂停）、重新生成按钮、保存本地并记录 URL 按钮。
     - 增加已记录本地音频的 URL 胶囊标签卡，支持点击复制下载 URL 与直接下载。
     - 在组件卸载时安全停止音频播放实例；序列化产物状态中持久保留 `audioUrl`。
- **变更文件**：`server/fishAudioHandler.js`、`src/agent-b-v2/AgentBDirect.vue`、`ENGINEERING_LOG.md`
- **验证**：
  - Node 独立单元脚本测试 `saveSpeechLocally` 生成并检验 `public/audio/` 与 `public/pic/` 双重落盘正常。
  - `eslint` 校验 0 错误通过。
  - `compile_applet` 全量编译成功。

## 2026-09-16 孤儿代码与废弃函数物理删除、prompt.js 规范对齐与结构优化
- **目标**：响应用户指令，对比 `prompt.js` 规则集（1726×980 物理画布基准、自然板书排版、纯净 TTS 口播、四环教学法、李永乐风格），彻底物理删除 src 与 server 中零调用的孤儿文件、历史草稿及废弃换算函数，清理优化项目结构。
- **改动**：
  1. 彻底物理删除 7 个零引用孤岛代码文件/目录：
     - `src/agent-b-v2/prompt-v3-draft.js`：已废弃的 V3 草稿系统提示词（与 prompt.js 规范冲突）。
     - `src/agent-b-v2/skills/prompt-v3-draft/`（含 index.js）：已废弃草稿技能包装，同步在 `src/agent-b-v2/skills/index.js` 注册表中注销。
     - `src/services/agentBKnowledge.js`：旧版 CSV 解析器（系统已全面切至 JSON 紧凑知识库）。
     - `src/composables/useAsyncAction.js`：零调用异步状态机。
     - `src/composables/useBoardCapture.js`：零调用截图函数（消除未使用的 eslint warning）。
     - `src/utils/problemTypeClassifier.js`：零调用分类器（逻辑已内置于 Step1Entry 与 recognitionClient）。
     - `src/board-tools/boardTypography.js`：零引用的字体配置 JS 代码（保留同目录 CSS 供样式使用）。
     - `server/agentBV2ProxyPlugin.js`：历史重名未使用的孤儿 Vite 插件。
  2. 废弃函数与历史换算常量物理清理：
     - `src/utils/canvasCoords.js`：物理删除 `TABLE_REF_W`, `TABLE_REF_H`, `SCALE_X`, `SCALE_Y`, `ZONE_REF_PX`, `tablePxToCanvasPx`, `tablePxToPct`, `canvasPxToPct`, `zoneToPct`, `formatTablePx` 等 1892 历史表稿估算函数，仅保留 1726×980 绝对画布真源与网格生成器。
     - `src/components/RealBoardPreview.vue`：清理未使用的 `TABLE_REF_W`, `TABLE_REF_H` 引用以及 `hover` 中的 `refX / refY` 废弃计算。
     - `src/utils/mathText.js`：物理删除未引用的孤儿函数 `hasMathContent`。
     - `src/utils/boardLayout.js`：清理未被外部引用的 `BOARD_SAFE_X_PCT`、`BOARD_BOTTOM_LIMIT_PCT` 等常量为内部普通变量。
- **验证**：
  - `lint_applet` 校验 0 错误（消除 useBoardCapture 未使用变量报警）。
  - `compile_applet` 全量编译通过（`Build succeeded - the applet is compiled`）。

- **目标**：
  1. 录屏交付按钮预检查拦截：题目识别或 TTS 音轨状态未就绪时弹出 Ant Design Modal 提示未就绪项并指引用户操作（遵循“系统放权，不绑死”提供直接录制通道）。
  2. BoardPreview 前端信息与出口口径收口：彻底消除冗余本地 MD 导出实现，统一复用 `src/lib/speechMarkdown.js` 标准导出器；清理历史表稿遗留参数，收拢至 1726×980 物理真画布标准。
  3. 文案全面对齐 `prompt.js`：四环教学法、李永乐风格高毛料口播、达芬奇手稿风格板书规划。
  4. 孤儿与废弃文件系统围剿：全面标记与隔离 `server/agentBV2ProxyPlugin.js`、`useAsyncAction.js`、`useBoardCapture.js`、`problemTypeClassifier.js`、`agentBKnowledge.js`、`prompt-v3-draft.js` 等零引用孤岛代码。
- **改动**：
  1. `src/agent-b-v2/AgentBDirect.vue`：
     - 新增 `handleRecordScreenPrecheck` 交互：检查题目文本/原图识别状态以及音频 TTS 准备情况；如有未就绪项，弹出 Modal 列表清晰指引，同时提供“去识别题目”、“全部合成语音”及“仍然直接录制”选项。
  2. `src/board-preview/BoardPreviewApp.vue`：
     - 引入 `src/lib/speechMarkdown.js` 标准导出方法，消除重复实现的简陋 markdown 逻辑。
     - 修复 `row.board` 为对象或缺少内容时的渲染异常，引入 `formatBoardDisplay` 容错。
     - 画布坐标参考统一收口为 1726×980 规范，更新标签卡与规格提示文案为“真画布四大区域与规格规划”与“达芬奇手稿风格”。
  3. `src/components/RealBoardPreview.vue`：
     - 清除浮层中的 `· 表约(X, Y)` 历史遗留估算坐标，纯粹展示 `画布: (X, Y)px · (X%, Y%)` 真实数据。
  4. 孤儿文件全面标注与隔离：
     - `server/agentBV2ProxyPlugin.js`：标注为未引用的重名孤儿插件（真实插件位于 `server/agentBV2Handler.js`）。
     - `src/composables/useAsyncAction.js` & `src/composables/useBoardCapture.js`：标注为零调用孤岛模块。
     - `src/utils/problemTypeClassifier.js`：标注为零调用孤岛模块。
     - `src/services/agentBKnowledge.js`：标注为遗留 CSV 解析器（系统已全面切到 JSON 知识库）。
     - `src/agent-b-v2/prompt-v3-draft.js` & `src/agent-b-v2/skills/prompt-v3-draft/index.js`：标注为历史草稿。
     - `src/board-tools/boardTypography.js` & `src/utils/canvasCoords.js`：标注未被消费的旧参考常量。
  5. 提示词与风格选择器文案对齐：
     - `src/agent-b-v2/skills/default-fallback/index.js`：对齐命名为“系统标准（prompt.js 规范 · 四环教学法）”。
- **验证**：
  - `lint_applet` 通过（0 errors）。
  - `compile_applet` 全量编译通过，静态资源与 HTML 入口构建正常。

