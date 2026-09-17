# 结构解耦与骨架固化方案 (Decoupling Strategy)

## 1. 结构解耦总体原则
1. **单向依赖铁律**：页面/业务组件 -> 服务层 (Services) -> 基础设施/配置 (Lib) -> 后端 API。禁止逆向依赖，禁止 UI 直连 API。
2. **开闭原则与零破坏**：重构对外暴露的函数签名与响应式对象（如 `userApiConfig`, `agentBApiConfig`, `checkAgentApiConfig`）保持 100% 接口兼容，调用方无需感知内部工厂化重构。
3. **公共资源严格收口**：公共工具函数与服务统一集中在 `src/services/` 与 `src/lib/`，禁止在各组件内复制粘贴重复逻辑。

---

## 2. 三大解耦实施方案

### 方案一：API 配置工厂化收口 (`src/lib/apiConfigStoreFactory.js`)
- **重构前**：每个配置各自手写 60-120 行相似逻辑（localStorage 解析、reactive 封装、snapshot 生成、密钥拆分、格式校验）。
- **重构后**：抽取高阶工厂函数 `createApiConfigStore(options)`：
  - 输入参数：`{ storageKey, defaultConfig, eventName? }`
  - 自动提供：`config` (reactive), `getSnapshot()`, `saveConfig(next?)`, `clearConfig()`, `isReady()`, `parseApiKeys()`, `subscribe()`
  - 收益：消灭 150+ 行重复代码，提升配置一致性与可维护性。

### 方案二：表现层 API 统一收口至 Service 层
- **新增服务模块**：
  1. `src/services/ttsService.js`：收口 `/api/tts/synthesize`、`/api/tts/save-local`、`/api/tts/status`。
  2. `src/services/deliverableService.js`：收口 `/api/deliverable`、`/api/deliverable/api-spec`、`/api/deliverable/list`。
  3. `src/services/cleanupService.js`：收口 `/api/cleanup` 历史资源受控清理。
  4. `src/services/knowledgeRefineService.js`：收口 `/api/knowledge/refine` 知识点辅助修缮。
- **收益**：`AgentBDirect.vue` 与其他组件中裸 `fetch` 全部清零，错误处理统一为 `{ ok, data, code, error }`。

### 方案三：校验点与断言对齐
- **修复点**：`server/proxySelfCheck.js` 的 Check changes 断言对齐 `server/checkAgentHandler.js` 的实际返回逻辑，确保本地自检通过。

---

## 3. 校验点自检 (Validation Checkpoint)
- [x] 页面四分类完成率 100%（公共布局 / 业务页面 / 功能组件 / UI组件）。
- [x] 单向依赖关系图已明确，无反向依赖边。
- [x] 三大耦合点（CP-01, CP-02, CP-03）均已提供明确落地策略。
- [x] 新旧架构对比图已在 `module_dependency_graph.md` 中完整呈现。