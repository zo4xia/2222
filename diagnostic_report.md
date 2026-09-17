# 深度诊断报告 (Diagnostic Report)

## 1. 目录职责标注与边界审计
| 目录 / 文件 | 理论职责分类 | 实际现状 | 越界与混杂问题分析 |
| :--- | :--- | :--- | :--- |
| `src/agent-b-v2/AgentBDirect.vue` | 表现层 (UI组件) | 混入大量业务逻辑与直接网络请求 (5292行) | ❌ **严重越界**：直接调用 `/api/handoff`, `/api/cleanup`, `/api/tts/*`, `/api/deliverable` 等，缺少 Service 层抽象 |
| `src/components/Step1Entry.vue` | 表现层 (UI组件) | 混入 OCR 网络请求与本地 Cache 处理 (1511行) | ⚠️ **轻度越界**：部分接口直接 fetch，未完全走 `recognitionClient.js` |
| `src/board-preview/` | 表现层 (独立页面) | 包含直接拉取板书结果的 fetch 逻辑 | ⚠️ 应收口至 `services/boardResult.js` |
| `src/board-tools/` | 工具层 (绘图引擎) | 职责清晰纯粹（Rough.js / Notation / Scheduler） | ✅ **规范**：无业务状态污染，纯函数与渲染调度 |
| `src/lib/` | 基础设施与配置层 | 存在 3 份高度同构的 API Config 响应式单例 | ⚠️ **代码冗余**：`userApiConfig`, `agentBApiConfig`, `checkAgentApiConfig` 重复实现 |
| `src/services/` | 业务逻辑层 / 服务层 | 已有 `recognitionClient`, `stepHandoff`, `globalLoading` | ⚠️ **覆盖不全**：缺少 TTS、Deliverable、Cleanup 的统一服务接入 |
| `server/` | 基础设施与数据层 | 职责明确，具备白名单过滤、安全Origin与Node持久化 | ✅ **规范**：单进程集中调度，隔离性好 |

---

## 2. 三层业务扫描结论 (Three-Layer Business Scan)

```mermaid
flowchart TD
  subgraph Presentation [1. 表现层 (Presentation Layer)]
    UI1[AgentBDirect.vue]
    UI2[Step1Entry.vue]
    UI3[BoardContentLayer.vue]
  end

  subgraph ServiceLayer [2. 业务逻辑与服务层 (Service Layer)]
    S1[recognitionClient.js]
    S2[stepHandoff.js]
    S3[Missing: ttsService.js]
    S4[Missing: deliverableService.js]
  end

  subgraph DataLayer [3. 基础设施与数据层 (Data / Backend)]
    API1[/api/recognition]
    API2[/api/agent-b-v2/generate]
    API3[/api/check-agent]
    API4[/api/tts/*]
    API5[/api/deliverable]
  end

  UI1 -.->|❌ 跨层直连 10+ 处 fetch| API4 & API5
  UI1 --> S2 --> API2
  UI2 --> S1 --> API1
  ServiceLayer --> DataLayer
```

- **表现层 -> 业务逻辑层**：大部分主流程（识别、生成）已通过 Service 封装，但 TTS、交付物生成、清理等散落逻辑存在严重跨层直连。
- **业务逻辑层 -> 数据层**：数据交互格式基本为 JSON，但部分接口未严格使用统一响应封套 `{ ok, data, code, error }`。

---

## 3. 六维度 1-5 分评估与雷达现状 (Six-Dimension Evaluation)

| 评估维度 | 得分 (1-5) | 核心扣分项与依据 | 优势与基线 |
| :--- | :---: | :--- | :--- |
| **1. 可读性 (Readability)** | **3 / 5** | `AgentBDirect.vue` 长达 5292 行，模板、样式与几十个方法混杂，新接手人员定位困难。 | 代码命名符合行业语义，核心算法带清晰中文注释。 |
| **2. 可维护性 (Maintainability)** | **2 / 5** | API 配置多处重复，组件与网络请求强耦合，修改接口需要改动多处 UI 代码。 | 目录结构整体层次清晰，静态资源归类明确。 |
| **3. 性能 (Performance)** | **4 / 5** | 交付物离线包内嵌资源较大 (5.2MB)。 | 具备 24 小时服务端 Top-K 缓存、本地 ASR 纯规则极速润色、无冗余重渲染。 |
| **4. 安全性 (Security)** | **4 / 5** | 历史残留日志与生成文件若无受控清理可能泄漏敏感输入。 | 密钥全部前端持久化不落云端、服务端严格校验 CORS Origin 与上游 Host 白名单。 |
| **5. 可测试性 (Testability)** | **2 / 5** | 核心组件未与网络层解耦导致难以编写组件单测；`proxySelfCheck.js` 断言偏差阻断自检。 | 知识库自检具备独立运行脚本且 100% 绿灯。 |
| **6. 可扩展性 (Extensibility)** | **3 / 5** | 新增播放器或独立页面时需要重复编写网络通信逻辑。 | 具备动态 Prompt Skill 注入机制与插件化架构设计。 |

---

## 4. 核心问题归因与重构优先级 (Root Causes & Priority)

1. **Top 1 (P0) 阻断与解耦**：
   - 修复 `server/proxySelfCheck.js` 单测断言偏差，确保自动化自检 100% 通过。
   - 提取 `services/ttsService.js`、`services/deliverableService.js`、`services/cleanupService.js`，彻底消除 UI 组件内的裸 `fetch`。
2. **Top 2 (P1) 配置与模块收口**：
   - 将 3 份 API Config 抽象为通用工厂 `createApiConfigStore`，收口至统一配置管理。
   - 模块化拆分 `AgentBDirect.vue` 中的辅助子功能（如 TTS 配音栏、交付物管理抽屉、Prompt 技能选择器）。
3. **Top 3 (P2) 规范固化与交付物同源**：
   - 统一单文件独立播放器 `row-player.html` 与 `BoardContentLayer.vue` 的渲染逻辑，统一由后端模板动态注入。
