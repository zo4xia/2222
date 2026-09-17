# 架构说明

## 核心主链
```
Step1Entry（贴题/识别）→ handoff → AgentBDirect → generateAgentBV2Rows
→ POST /api/agent-b-v2/generate → server/agentBV2Handler.js
→ server/http.js（请求上游 API）→ 模型返回 → contract.js 解析五字段
→ 时间线计算 → 画布渲染
```

## 模块分层
- **前端**：`src/`（Vue 组件、服务、工具、板书工具）
- **后端代理**：`server/`（本地 Node 代理，转发上游 API 请求，避免 CORS）
- **配置**：`src/lib/` 下各 agent 独立配置文件（A/B/C 不共用 API）
- **教学内容**：`src/agent-b-v2/prompt.js`（B 提示词，禁止随意删减）、`doc/建议提示.md`（源文件）

## 关键约束
- A/B/C 三个 agent 配置完全独立，互不影响
- B 只负责生成五字段内容，画布执行由后续层负责
- 所有上游请求统一走 `server/http.js` 的 helper，不自行拼接 URL
- 教学内容是核心资产，禁止为了省 token 或简化代码删除/压缩
