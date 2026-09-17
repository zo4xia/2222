# 模块依赖图与耦合点标记 (Module Dependency Graph)

## 1. 页面与组件四分类 (Four Categories)
| 分类 | 包含模块 / 组件 | 依赖规则与方向 |
| :--- | :--- | :--- |
| **1. 公共布局 (Layouts)** | `QhPageHeader.vue`, `ProcessLoadingModal.vue`, `GlobalPulseLoading.vue` | 纯展示与状态指示，仅接收 props/全局状态，不直接依赖业务数据 |
| **2. 业务页面 (Pages)** | `App.vue`, `BoardPreviewApp.vue`, `DirectFlow.vue` | 负责装配功能组件，调度全局路由与交接上下文 |
| **3. 功能组件 (Feature Components)** | `Step1Entry.vue`, `AgentBDirect.vue`, `VisualTimeline.vue`, `RealBoardPreview.vue` | 业务状态机与交互编排，通过 services 层与后端通信，严禁直接 fetch |
| **4. UI与渲染组件 (UI Components)** | `BoardContentLayer.vue`, KaTeX渲染器, Ant Design 基础控件 | 纯渲染受控组件，依赖 props 与 board-tools/utils，无网络副作用 |

---

## 2. 单向依赖拓扑设计 (Single-Direction Dependency Chain)
```mermaid
flowchart TD
  subgraph Layer1 [第 1 层：业务页面 (Pages)]
    App[App.vue] --> DirectFlow[DirectFlow.vue]
    PreviewPage[BoardPreviewApp.vue]
  end

  subgraph Layer2 [第 2 层：功能组件 (Features)]
    DirectFlow --> Step1[Step1Entry.vue (Agent A)]
    DirectFlow --> AgentB[AgentBDirect.vue (Agent B)]
    AgentB --> Timeline[VisualTimeline.vue]
    AgentB --> RealPreview[RealBoardPreview.vue]
  end

  subgraph Layer3 [第 3 层：UI与绘图引擎 (UI & Board Engine)]
    AgentB & PreviewPage & RealPreview --> BoardLayer[BoardContentLayer.vue]
    BoardLayer --> RoughDraw[board-tools/roughDrawingTool.js]
    BoardLayer --> RoughNote[board-tools/roughNotationTool.js]
    BoardLayer --> Scheduler[board-tools/handActionScheduler.js]
    BoardLayer --> LayoutUtil[utils/boardLayout.js]
  end

  subgraph Layer4 [第 4 层：业务服务层 (Services Layer)]
    Step1 --> RecogService[services/recognitionClient.js]
    Step1 & AgentB --> HandoffService[services/stepHandoff.js]
    AgentB --> BV2Service[agent-b-v2/service.js]
    AgentB --> CheckService[check-agent/service.js]
    AgentB --> TTSService[services/ttsService.js (新建收口)]
    AgentB --> DeliverableService[services/deliverableService.js (新建收口)]
    AgentB --> CleanupService[services/cleanupService.js (新建收口)]
  end

  subgraph Layer5 [第 5 层：基础设施与配置层 (Lib & Storage)]
    Services --> ApiConfigStore[lib/apiConfigStoreFactory.js (通用配置工厂)]
    Services --> HttpUtil[server/http.js 对应的前端请求客户端]
  end
```

---

## 3. 显式标记的耦合点 (Coupling Points & Solutions)

### 【CP-01】表现层裸 fetch 穿透
- **位置**：`src/agent-b-v2/AgentBDirect.vue` 中散落的 10+ 处裸 fetch 调用（TTS、交付物、清理、知识修缮）。
- **成因**：前期快速迭代时直接在组件内调用 API，跳过了 Service 层。
- **解耦方案**：**模块拆分 + 统一 Service 抽象**。提取 `ttsService.js`、`deliverableService.js`、`cleanupService.js`，组件只调用 Service 方法并处理响应数据。

### 【CP-02】API 配置模块三副本冗余
- **位置**：`src/lib/userApiConfig.js`、`src/lib/agentBApiConfig.js`、`src/lib/checkAgentApiConfig.js`。
- **成因**：为各 Agent 独立配置复制了相同的 storage 读取、reactive 封装与 parseApiKeys 逻辑。
- **解耦方案**：**工厂模式抽象**。创建 `createApiConfigStore({ storageKey, defaultConfig })` 工厂函数，三份配置各用 1 行实例化，对外 API 接口保持 100% 向后兼容。

### 【CP-03】独立单文件播放器与主工程渲染器逻辑漂移
- **位置**：`row-player.html` (5.2MB) 静态文件 vs `src/components/BoardContentLayer.vue`。
- **成因**：离线单文件播放器独立维护导致手绘与布局改动无法实时同步。
- **解耦方案**：**服务端动态同源渲染模板**。统一通过 `server/renderDeliverableHtml.js` 引用相同核心板书脚本动态装配，确保离线与在线体验一致。