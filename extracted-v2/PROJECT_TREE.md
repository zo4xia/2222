# 关键项目树（仅核心文件，非完整列表）

```
K:\4\
├── AGENTS.md              # 代理操作协议（核心规则）
├── PROJECT_STATE.md       # 项目当前状态与主链说明
├── ENGINEERING_LOG.md     # 工程日志
├── DECISIONS.md           # 重要决策记录
├── KNOWN_ISSUES.md        # 已知问题与规避
├── ARCHITECTURE.md        # 架构说明
├── vite.config.js         # 构建与开发服务器配置
├── package.json           # 依赖与脚本
├── src/
│   ├── main.js            # 启动入口
│   ├── App.vue            # 页面壳
│   ├── agent-b-v2/        # Agent B 核心逻辑
│   │   ├── prompt.js      # B 教学提示词（禁止随意删减）
│   │   ├── service.js     # B 生成接口调用
│   │   ├── contract.js    # 五字段解析与校验
│   │   ├── AgentBDirect.vue
│   │   └── DirectFlow.vue
│   ├── components/        # 通用组件（Step1Entry、画布层等）
│   ├── lib/               # 配置与工具
│   │   ├── agentBApiConfig.js  # B API 配置
│   │   ├── checkAgentApiConfig.js
│   │   └── userApiConfig.js
│   └── board-tools/       # 板书工具（rough.js 封装）
└── server/
    ├── http.js            # 共享请求 helper（URL 拼接、重试、超时）
    ├── agentBV2Handler.js # B 生成接口代理
    ├── checkAgentHandler.js
    ├── recognitionHandler.js
    └── proxySelfCheck.js  # 代理回归自检
```
