# 项目状态

## 最小闭环保护入口

动态代码图谱与可搜索回归锚点：[`doc/minimal-runtime-loop.md`](doc/minimal-runtime-loop.md)。它是施工索引，不是第二真相；任何主链删除、改名、路由或合同变更，必须同步更新图谱并通过 `npm run build` 与 `npm run check:proxy`。

## 当前目标

保护已能跑通的前端主流程。当前目录是可独立安装、构建、启动的完整项目。

生产运行入口为 `bun run start`（`server/productionServer.js`）。它复用既有 server handlers，提供 `dist/` 前端和 `public/` 的 handoff、交付物、音频、截图等持久化档案；部署时必须将整个 `public/` 目录放在可持久化磁盘上，不能部署到无持久本地磁盘的函数运行时。

运行代码按 `src/`、`server/`、`doc/`、`public/` 层级保存；这里是现行主流程文件的唯一位置，不是副本。

稳定边界：已经能用的 A/B 主链不重构、不搬动、不替换。新增能力走独立插件、独立接口和独立配置，先验证后接入。
Agent A 知识边界：夏夏提供的云端 Knowledge-A 是规范来源，地址、季度更新节奏和已核验指纹记录在 `doc/knowledge-a-source.json`；`doc/knowledge-a.compact.json` 是运行时快照。请求时不依赖外网，文本题只注入服务端 Top-K，图片题只注入紧凑 ID 目录；知识记录主键统一为 `knowledgeId`，不再使用旧 CSV 命名 `csvId`。Agent B 只接收 Agent A handoff 的相关知识或本地快照检索结果，不再每次注入旧 `knowledge-list.md` 全库。约每三个月维护时从云端刷新并重新验真，禁止每次请求全量注入或实时抓取知识文件。同一用户配置、模型、题文/图片和知识版本的 Agent A 识别结果在本地服务器内存中缓存 24 小时，最多 100 条；命中缓存不重复调用付费上游，进程重启后自然清空。
A/B 是必要主链；Check Agent C 是可选后处理。C 未配置、失败或未点击时，A/B 仍必须独立完成生成。
产品原则：系统放权，不绑死。题目事实和四区骨架负责锚定，Agent A 的题型、知识、公式、策略与布局均是给 Agent B 的软建议，不是门槛、评分清单或强制输出项；面对多样题型，Agent B 可以取用、改写、补充或舍弃。用户可修改生成内容、决定是否触发 C，并以点击时的当前文本作为审计真相；检查不是审批门槛。
A/B 两页的知识关联点统一使用浅蓝胶囊标签，点击后显示完整单列详情表。布局百分比在 A→B handoff 边界统一四舍五入至最多两位小数，页面显示和 Agent B 输入均不得传播循环长小数。
Agent B 的运行时输入收敛为核心合同、`doc/speech-board-guide.md`、`doc/self-check.md` 与 Agent A handoff。知识、公式与题目事实由 Knowledge-A handoff 提供，Check Agent 的独立参考链保持隔离。
Agent B 实链审查已修复：板书数学软校验改查真实 `board` 字段；Check 保留现有 duration；服务端按题型传递几何合同校验；B 页面补回 `notes` 列；每行口播新增手动语音合成喇叭、重新生成、本地持久化与记录下载 URL。
Agent B 后续压实：Agent A 到 B handoff 过滤文本字段，彻底停止向 B 发送原图、Base64 或画布快照；用户修改口播或环节后立即重算时间线；缺少真画布预览时给用户可见降级提示。
Agent B 提示真相已收敛：系统 Prompt 支持 Skill 动态加载与自定义注入；`prompt.js` 保留核心合同；口播和板书方法收敛至 `speech-board-guide.md`；机器合同负责工具 schema、全局 order 和输出字段。
BoardPreview 与交付物收口压实：录屏前置弹窗预检查拦截未就绪项并放权放行；BoardPreview 全量复用 `speechMarkdown.js` 标准导出，板书呈现增加格式容错，四区基准统一收拢至 1726×980 达芬奇手稿风格；已彻底物理删除 7 个孤儿文件与全部废弃历史换算函数。

## 业务边界

本项目采用软边界：合同只规定能继续协作的最低格式，不把生成内容卡成唯一答案。标为“参考”的题型、年级、知识点、策略和布局应优先使用，但 Agent 可在信息不足、遗漏或不适合当前题目时自行补充和调整。只有缺少完成任务所必需的信息时才阻断；其余情况允许继续生成并保留 Agent 的判断力。

## 运行主链（唯一入口）

```text
src/main.js
  -> src/App.vue
  -> src/agent-b-v2/DirectFlow.vue
  -> src/components/Step1Entry.vue
  -> emit handoff -> DirectFlow memory -> AgentBDirect prop
  -> src/agent-b-v2/AgentBDirect.vue
  -> generateAgentBV2Rows(...)
  -> /api/agent-b-v2/generate
```

回退链：`AgentBDirect` emits `back-to-step1` -> `DirectFlow.backToStep1()` -> `Step1Entry`。

## 不能删 / 主流程依赖

```text
src/main.js                         Vue + Ant Design 启动入口
src/App.vue                         当前唯一页面壳，直接挂 DirectFlow
src/agent-b-v2/DirectFlow.vue       第 1 步 / Agent B 页面切换、内存交接与回退
src/components/Step1Entry.vue       贴题、识别；以可见参数表确认题目/题型/侧重/参考年级，再发出文本或题图交接数据
src/components/RealBoardPreview.vue L1-L4 叠层编排、坐标调试、L3 播放插槽
src/components/BoardContentLayer.vue L2 唯一渲染边界：题目、标签、区域引导、网格、题块测量
src/components/QhPageHeader.vue     Step1Entry / AgentBDirect 共用页头
src/agent-b-v2/AgentBDirect.vue     接收 Agent A 情报、生成五字段表
src/agent-b-v2/service.js           Agent B 生成接口调用与时间线落座
src/style.css
src/board-tools/boardTypography.css 字体配置冻结，等待独立播放器处理
```

## 不能删 / 主链支撑

```text
src/services/recognitionClient.js   第 1 步图片/文本识别与文件转 data URL
src/services/stepHandoff.js         第 1 步确认数据的构建与完整度校验
src/services/agentBKnowledge.js     知识关联；识别失败时也供 Agent B 生成回退
src/lib/userApiConfig.js            Step1 / Agent B 共用 endpoint、model、apiKey
src/lib/checkAgentApiConfig.js      Check Agent C 独立 endpoint、model、apiKey
src/utils/mathText.js               题目数学文本渲染
src/utils/cdnLoader.js              双 CDN 动态加载与多级降级兜底模块
src/utils/boardLayout.js            四区标签规划，确认第 1 步的前置条件
src/utils/canvasCoords.js           Agent B 画布固定坐标
src/agent-b-v2/prompt.js            Agent B 生成提示词
src/board-tools/boardToolCatalog.js Agent B 可用板书工具目录
src/board-tools/boardTypography.js  字体配置与字体加载
src/board-tools/roughNotationTool.js
src/board-tools/roughDrawingTool.js
vite.config.js                      开发服务器挂载代理插件
server/agentBV2Handler.js           POST /api/agent-b-v2/generate 的本地代理实现
server/checkAgentHandler.js         POST /api/check-agent/check 的独立代理实现
```

## 已移除旧线

```text
/api/agent-b/board-draft
BoardParamDraft.vue / SolutionReviewPanel.vue / Step2PhaseBar.vue
agentBDraftResult.js / agentBContract.js
```

当前唯一入口是 `DirectFlow -> Step1Entry -> AgentBDirect`。

## API 唯一真相

```text
前端识别 -> POST /api/recognition/problem -> server/recognitionHandler.js
前端生成 -> POST /api/agent-b-v2/generate -> server/agentBV2Handler.js
前端检查 -> POST /api/check-agent/check -> server/checkAgentHandler.js
本地 Vite 与 Vercel Functions 共用以上三个 handler
```

跨域白名单只读 `CORS_ORIGINS`；生产上游域名白名单只读 `UPSTREAM_HOSTS`。源码无 `127.0.0.1` / `localhost` 绑定。

## Agent B 唯一真相

```text
system prompt       src/agent-b-v2/skills/ (动态加载) -> server/agentBV2Handler.js
Agent A 情报         src/agent-b-v2/service.js 组装为 userPayload
Agent A 知识库        doc/knowledge-list.md
Agent B 必读资料      doc/key.md + doc/knowledge-list.md + doc/speech-board-guide.md
```

前端不持有 Agent B system prompt。生成请求沿用既有 prompt；自检请求由服务端读取并注入上述三份规范，不复用生成 prompt。

## Check Agent C 唯一真相

```text
检查范围主人        doc/key.md（坐标排版、口播稿、公式板书）
检查细化依据        doc/self-check.md (润色规则) + doc/speech-board-guide.md (口播板书规则)
前端调用            src/check-agent/service.js
服务端提示与解析    server/checkAgentHandler.js + src/check-agent/contract.js
```

Check Agent C 不复用 Agent B 生成提示词，只能修改 `speech`、`board`、`actionSpec`；步骤数量、顺序、`duration`、`stage`、`notes` 保持原样。
Check Agent C 的唯一业务输入是用户点击时页面中的当前 rows；用户手动修改后的内容优先。C 不读取 A/B 交接、题图、画布预览或生成过程。

## 存储唯一真相

```text
qinghuabu.userApiConfig.v1       endpoint / model / apiKey
Agent B rows                     当前页面内存
```

Agent B 不写 localStorage 或 IndexedDB。
Check Agent C 配置只写 `qinghuabu.checkAgentApiConfig.v1`，不迁移、不覆盖 A/B 配置。

## 已验证

```text
依赖闭包验证通过：新线代码和配置无路径逃出当前目录
npm run build 在当前目录通过（仅产物体积告警）
独立开发服务返回 200
入口 /src/main.js 返回 200
画布图片、题目图片、手写字体返回 200
识别代理、Agent B V2 代理、Check Agent C 代理均已挂载
Vercel API handlers 位于 `api/recognition/problem.js`、`api/agent-b-v2/generate.js`、`api/check-agent/check.js`
旧 `/api/agent-b/board-draft` 返回 404
`npm run check:proxy` 通过
Check Agent C 自检修正明细、一键导出口播稿 MD 已接入
上游 LLM 网络错误、超时、408/429/5xx 自动重试 1 次；确定性 4xx 不重试
口播稿 MD 不输出环节标题；同环节步骤空 1 行，切换环节空 2 行
固定版 Chrome 桌面端首页配置抽屉检查通过
Vercel Preview 已部署：`https://4-bihw4v8ev-xiaxias-projects-0475c061.vercel.app`
Preview 已启用 Vercel Deployment Protection；登录 `xiaxia` 账号后访问
线上首页返回真实 Vite 入口；识别、Agent B、Check Agent 三条 POST 路由均命中函数并返回预期缺参错误
线上 OPTIONS 返回 204，`Access-Control-Allow-Methods: POST, OPTIONS`
`npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`：0 vulnerabilities
`bun run build` 通过；`bun run start` 本机监听后首页、handoff、deliverable 均返回 200
`GET /api/cleanup` 返回 405；`OPTIONS /api/cleanup` 返回 204；当前 handoff、交付物 JSON/HTML、板书结果均保留
```

## 未验证 / 边界

```text
未使用真实付费 API 做自动自检；代理路径由 mock 上游覆盖。
不改主流程；不删闲置件；不新建第二份流程记录。
```

## 下一步

使用独立 Check Agent C 配置手动点击一次“Check Agent”，确认上游模型按当前账号返回结构化修正结果。

## Vercel 部署

```text
项目             xiaxias-projects-0475c061/4
Preview          https://4-bihw4v8ev-xiaxias-projects-0475c061.vercel.app
Preview 部署 ID  dpl_7VBWjN4sUKzZqrg5iWuTmxX4WmQf
Production 别名  https://4-rho-seven.vercel.app
```

Vercel 首次创建项目时自动把首次部署标成 Production；随后已重新部署出独立 Preview。未删除任何 API 或线上部署。

## 已确认设计方向

板书播放改为“完整板书预排版 + 分步骤遮罩揭示”：先渲染最终板书，每个板书块按所属步骤覆盖白色遮罩，播放时擦除遮罩露出内容；下划线、高亮、圈画、箭头等保留为独立动画层。这样避免播放过程中字体、换行、公式和坐标漂移。每个板书块必须绑定步骤，防止后续答案提前露出。

状态：仅记录方向，尚未实现，不代表当前运行能力。

## 变更树（勘察留痕）

```text
2026 板书代码深度分析轮次（refactor-discovery 阶段一 X-RAY 四层扫描）
├─ 新增交付物（doc/，只读分析，未改运行代码）
│  ├─ doc/board_resource_list.md   资源清单 + 依赖边 Mermaid
│  ├─ doc/board_risk_matrix.md     风险矩阵 R1-R5 + 止血优先级
│  └─ doc/board_initial_state.md   初始状态快照 + 四区对齐表
├─ 关键发现（均经真实代码核验）
│  ├─ R1 [P1] rough-notation 仅 question 区可运行：
│  │        BoardContentLayer.vue:551 仅 data-board-region="question"；
│  │        RealBoardPreview.vue:44 querySelector 查 DOM；
│  │        textTargetRegistry.js:116 requireElement 找不到即抛错。
│  │        → analysis/solution/summary 三区文本标记运行时崩。
│  ├─ R2 [P2] draw 意图工具执行空壳：
│  │        boardToolCatalog.js:86-95 prepare 给 DRAW_INTENT 返回 execute:()=>{}；
│  │        真实几何由 roughDrawingTool 的 rough-line/rough-arrow 承担 → 死重。
│  ├─ R3 [P3] L4 用户画笔层未实现：RealBoardPreview.vue:181 仅空 div aria-hidden。
│  ├─ R4 [P2] 手写字体范围断言(boardTypography.assertHandwritingScope) 与标记层 region 语义分裂。
│  └─ R5 [P2] 调度器无断点续播/单步隔离，长板书中途异常整体失败。
├─ 纠正旧结论
│  └─ drawIntentTool.js 非文件空壳（有 schema+校验），问题是执行路径 no-op（见 R2）。
└─ 处置建议
   ├─ R1 已执行最小修复：RealBoardPreview.vue L3 按 rows 渲染 analysis/solution/summary 真实文本锚点，并兼容百分比/像素 startCoord；BoardPreviewApp.vue 汇总并传递 rows.actionSpec。
   └─ R2/R4/R5 待夏夏确认后单独清理
```

状态：R1 代码修复已落地；Vite 实际编译通过、diff check 通过；尚缺浏览器级四区 exactText 点击验收，不能标记为完全收口。

