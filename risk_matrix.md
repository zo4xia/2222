# 止血三板斧与风险矩阵 (Risk Matrix & Triage)

> 依据 `refactor-discovery` 止血三板斧标准建立：阻塞项识别 -> 优先级标记 -> 风险矩阵（严重性 × 概率 × 影响）。

## 1. 止血三板斧 (Immediate Triage)
1. **第一板斧（隔离与保护）**：保护已验证可用的 Agent A/B 主链路，禁止在未经隔离的情况下大面积重写核心组件；锁定 `src/agent-b-v2/prompt.js` 核心教学策略，禁止删减温柔循序渐进的引导用语与四环一体教学法。
2. **第二板斧（解耦与收口）**：对 5200+ 行超大组件 `AgentBDirect.vue` 与散落的多份 API Config 逻辑建立模块化引用收口，消除冗余状态。
3. **第三板斧（单体验证与阻断治理）**：修复 `server/proxySelfCheck.js` 中的断言偏差，确保 `npm run check:proxy` 与 `npm run check:knowledge` 100% 绿灯通过，构建零报错基线。

---

## 2. 风险矩阵评估表 (按风险值降序)

| 编号 | 风险项与现象 | 影响范围 | 严重性 (1-5) | 概率 (1-5) | 风险值 (S×P) | 缓解与重构方案 | 状态 |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: |
| **R-01** | `src/agent-b-v2/AgentBDirect.vue` 单文件达 5292 行，集成了 UI、TTS、Check、Handoff、本地持久化等多重逻辑，维护风险极高 | Agent B 核心工作台 | 5 | 5 | **25 (P0)** | 阶段三骨架施工时按职责拆分（UI、TTS控制器、Prompt切换器、状态持久化），保持接口单向流动 | 待施工 |
| **R-02** | `server/proxySelfCheck.js` 自检用例中 Check Agent changes 预期与实际兜底比对产生断言偏差 (4 !== 1) | 服务端自动化自检 | 4 | 5 | **20 (P0)** | 校验 `parseCheckResponse` 的 changes 过滤与比较规则，保持断言与真实契约一致 | 待修复 |
| **R-03** | 存在 3 份结构高度相似的 API Config 单例 (`userApiConfig.js`, `agentBApiConfig.js`, `checkAgentApiConfig.js`)，存在重复冗余代码 | 全局配置管理 | 3 | 4 | **12 (P1)** | 抽象通用 `createApiConfigStore` 工厂函数，减少 150+ 行重复样板代码 | 待重构 |
| **R-04** | `public/` 目录下历史 handoff、音频与交付物如果未定期受控清理，会导致磁盘无序膨胀 | 本地磁盘与部署空间 | 3 | 4 | **12 (P1)** | 规范 `server/cleanupHandler.js` 调用契约，前端增加清理触发或定时受控清理 | 待完善 |
| **R-05** | `row-player.html` 含有内嵌打包的大量资源 (5.2MB)，可能存在旧版本样式或离线依赖未同步更新 | 独立播放器分发 | 3 | 3 | **9 (P2)** | 统一使用 `server/renderDeliverableHtml.js` 动态模版生成，确保与主工程板书渲染器同源 | 待治理 |
| **R-06** | 上游 LLM 超时或返回非标准 JSON 导致前端渲染降级 | A/B 核心生成链路 | 4 | 2 | **8 (P2)** | 强化 `asrPolish.js` 本地兜底引擎与 JSON 自愈修复能力 | 已部分具备，待强化 |
