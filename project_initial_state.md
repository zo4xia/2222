# 项目初始状态快照 (Project Initial State Snapshot)

## 1. 项目概况与技术栈
- **项目定位**：小学数学题目智能引导视频生成工作台。以具体题目为载体，采用清华附小教学法，给出温柔、循序渐进的引导，启发孩子看条件、问为什么、回顾学过知识、建立解题直觉与世界观，生成包含口播、板书、手势动作与时间线的多维教学剧本与交互播放器。
- **前端技术栈**：Vue 3 (v3.5.39) + Vite (v8.1.1) + Ant Design Vue (v4.2.6) + @ant-design/icons-vue (v7.0.1)
- **手绘视觉与公式引擎**：Rough.js (v4.6.6 手绘线条/图形) + Rough Notation (v0.5.1 手绘文本高亮标注) + KaTeX (v0.18.4 数学公式渲染)
- **后端运行时**：Node.js (v22 ESM) 单进程服务 (`server/productionServer.js`) + Vite 开发代理中间件 (`server/*Handler.js`) + Vercel Serverless Function 转发入口 (`api/*`)
- **持久化方案**：`public/` 物理目录（挂载卷），包含 `handoff/`（A->B交接数据）、`board-result/`（板书执行态）、`deliverable/`（交付物离线包与配置）、`audio-cache/`（TTS缓存）、`pic/`（板书与步骤截图）、`fonts/`（离线手写体字体包）。
- **代码规模**：核心业务代码约 1.5 万行，Vue 单文件组件 11 个，JS 后端与工具库 84 个，独立 HTML 页面 6 个。

---

## 2. 初始架构依赖图 (Mermaid)

```mermaid
flowchart TD
  subgraph Frontend [前端表现层 (Vue 3 + Vite)]
    Index[index.html / App.vue] --> Step1[Step1Entry.vue (Agent A 识别/配置)]
    Step1 --> DirectFlow[DirectFlow.vue (主工作流编排)]
    DirectFlow --> AgentB[AgentBDirect.vue (Agent B 核心工作台 - 5292行)]
    AgentB --> Timeline[VisualTimeline.vue (动态时间轴)]
    AgentB --> BoardContent[BoardContentLayer.vue (真实板书渲染层)]
    AgentB --> RealPreview[RealBoardPreview.vue (实时缩略预览)]
    AgentB --> Modal[ProcessLoadingModal.vue (生成进度弹窗)]
    
    BoardPreviewApp[board-preview.html / BoardPreviewApp.vue] --> BoardContent
    
    Player[row-player.html / lite-player.html] --> PublicAssets[public 交付物/音频/板书]
  end

  subgraph ServicesAndLib [客户端服务与工具库]
    Step1 --> RecogClient[services/recognitionClient.js]
    Step1 --> StepHandoff[services/stepHandoff.js]
    AgentB --> AgentBService[agent-b-v2/service.js]
    AgentB --> CheckService[check-agent/service.js]
    AgentB --> MathASR[lib/mathAsrConverter.js]
    AgentB --> SpeechMD[lib/speechMarkdown.js]
    AgentB --> BoardTools[board-tools (Rough.js / Notation / HandAction)]
  end

  subgraph Server [服务端 / API 代理层 (Node ESM)]
    ProdServer[server/productionServer.js]
    VitePlugin[vite.config.js / Server Handlers]
    ApiDir[api/* (Vercel Functions)]
    
    ProdServer & VitePlugin & ApiDir --> RecogHandler[server/recognitionHandler.js]
    ProdServer & VitePlugin & ApiDir --> BV2Handler[server/agentBV2Handler.js]
    ProdServer & VitePlugin & ApiDir --> CheckHandler[server/checkAgentHandler.js]
    ProdServer & VitePlugin & ApiDir --> DeliverableHandler[server/deliverableStoreHandler.js]
    ProdServer & VitePlugin & ApiDir --> FishAudioHandler[server/fishAudioHandler.js]
    ProdServer & VitePlugin & ApiDir --> CleanupHandler[server/cleanupHandler.js]
    ProdServer & VitePlugin & ApiDir --> HandoffHandler[server/handoffStoreHandler.js]
  end

  subgraph Storage [持久化与外部服务]
    RecogHandler --> KnowledgeBase[(doc/knowledge-a.compact.json 247条知识点)]
    RecogHandler & BV2Handler & CheckHandler --> UpstreamLLM[(外部大模型 Chat Completions)]
    FishAudioHandler --> FishAudioAPI[(Fish Audio TTS 接口)]
    DeliverableHandler & HandoffHandler & CleanupHandler --> PublicDir[(public/ 物理持久化目录)]
  end
```

---

## 3. 四层 X-RAY 扫描结论

### 第 1 层：目录树与空间布局
- `src/agent-b-v2/`：Agent B 核心交互、五字段生成脚本、Prompt 策略、动态 Skills（default-fallback, liyongle-elementary, prompt-v3-draft）。
- `src/check-agent/`：Check Agent 独立质检、ASR 规范中文口播润色、合同定义与调用服务。
- `src/board-preview/`：全屏与分屏独立板书调试预览页。
- `src/board-tools/`：Rough.js 手绘几何/连线、Rough Notation 文本高亮圈注、手势时序调度器、文本目标注册表。
- `src/components/`：核心业务组件与公共 UI 组件（Step1Entry, BoardContentLayer, VisualTimeline 等）。
- `src/lib/`：配置中心（userApiConfig, agentBApiConfig, checkAgentApiConfig）、公式转换器、语音 Markdown 导出。
- `src/services/`：前端业务服务（题目识别、Handoff传递、全局Loading等）。
- `src/utils/`：板书排版、百分比/像素坐标转换、数学公式文本清洗。
- `server/`：Node 服务端 Handlers（HTTP代理、安全过滤、持久化、TTS桥接、受控清理）。
- `api/`：Vercel Serverless Function 转发薄层。
- `public/`：生产持久化数据源（当前 handoff、板书成果、交付物 HTML/JSON、音频、截图、字体等）。
- `doc/`：知识库紧凑快照 (`knowledge-a.compact.json`)。

### 第 2 层：依赖图与拓扑结构
- **前端核心扇入节点（高被依赖中枢）**：
  1. `src/lib/userApiConfig.js`、`src/lib/agentBApiConfig.js`：被组件与服务频繁引用，负责响应式凭证读取。
  2. `src/services/stepHandoff.js`：A→B 交接状态流转中心。
  3. `src/board-tools/roughDrawingTool.js` & `roughNotationTool.js`：板书手绘与标注核心引擎。
  4. `src/utils/mathText.js` & `src/lib/mathAsrConverter.js`：数学公式与口播 ASR 归一化。
- **服务端核心中枢**：
  1. `server/http.js`：统一请求处理、CORS、Upstream 代理重试与错误封装。
  2. `server/deliverableStoreHandler.js`：交付物渲染、自包含 HTML 打包与历史查询。

### 第 3 层：核心业务模块定位 (6 大中枢)
1. **Agent A 题目识别与知识检索中枢** (`server/recognitionHandler.js` + `src/services/recognitionClient.js`)：负责题目图文 OCR 提取、四区锚点规划、云端/紧凑库 247 条知识点 Top-K 检索注入。
2. **Agent B 教学口播与板书编排中枢** (`server/agentBV2Handler.js` + `src/agent-b-v2/AgentBDirect.vue`)：基于清华附小教学法生成五字段（stage, duration, speech, board, actionSpec）教学脚本。
3. **Check Agent 独立质检与 ASR 润色中枢** (`server/checkAgentHandler.js` + `src/check-agent/service.js`)：独立双重视角审查，纯本地 ASR 引擎兜底，确保口播纯汉字发音、消除机械腔。
4. **板书手绘与视觉标注中枢** (`src/board-tools/*` + `src/components/BoardContentLayer.vue`)：基于 Rough.js 与 Rough Notation 实现自然手绘质感与时序动作调度。
5. **交付物归档与单文件 Player 打包中枢** (`server/deliverableStoreHandler.js` + `row-player.html`)：生成自包含单文件独立播放器，支持全平台离线播放。
6. **TTS 音频合成与单行配音中枢** (`server/fishAudioHandler.js`)：代理 Fish Audio 接口，提供单行手动试听、一键配音与本地缓存。

### 第 4 层：关键函数与实现评估
1. `handleAgentBV2Request()` (`server/agentBV2Handler.js`)：注入 Handoff 白名单字段、参数调优、多轮重试与五字段结构归一化。
2. `handleCheckAgentRequest()` (`server/checkAgentHandler.js`)：执行独立第二双眼睛审查，白名单字段过滤，支持本地 ASR 兜底引擎。
3. `polishRowsASR()` (`src/check-agent/asrPolish.js`)：纯本地规则引擎，将阿拉伯数字转换为中文发音、规范标点与数学口播表达。
4. `applyAgentBV2Timeline()` (`src/agent-b-v2/timing.js`)：基线 160 字/分钟，结合行间 1.5s 停顿动态排布时间线，拒绝死板硬编码。
5. `requestChatCompletion()` (`server/http.js`)：统一 Upstream 调用，支持多 API Key 轮询、503 自动退避重试、安全 Origin 校验。
6. `saveDeliverableState()` (`server/deliverableStoreHandler.js`)：生成带完整状态快照的独立离线播放包，支持一键分发。

---

## 4. 六维文档研读结论
| 维度 | 文档名称 | 现状 | 说明与风险 |
| :--- | :--- | :--- | :--- |
| 1. README | `README.md` | 缺失 | clean-package 根目录未放置说明，已通过 AGENTS.md 与父目录补充 |
| 2. API 文档 | `api/*`, `server/*` | 完备 | 服务端路由与入参出参规范已固化在 handler 中 |
| 3. 贡献指南 | `CONTRIBUTING.md` | 缺失 | 遵循项目 AGENTS.md 准则与五阶段工作法 |
| 4. CHANGELOG | `CHANGELOG.md` | 缺失 | 改由 `ENGINEERING_LOG.md` 逐项精准留痕 |
| 5. 测试文档 | `server/*SelfCheck.js` | 具备 | 具备代理与知识库自检脚本，需扩充单元冒烟测试 |
| 6. 架构文档 | `项目实时架构模块图.md` | 建立 | 全景 Mermaid 架构图实时维护 |
