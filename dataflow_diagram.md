# 数据流拓扑与解耦校验 (Dataflow Decoupling Validation)

## 1. 黄金三角与主链路数据流 (Golden Triangle Dataflow)
```mermaid
sequenceDiagram
  autonumber
  actor User as 用户 / 教师
  participant S1 as Step1Entry.vue (题目入口)
  participant RS as recognitionClient.js
  participant SH as stepHandoff.js
  participant AB as AgentBDirect.vue (教学编排)
  participant BS as agent-b-v2/service.js
  participant CS as check-agent/service.js
  participant DS as deliverableService.js
  participant API as 后端 Server Handlers

  Note over User,API: 1. 黄金三角第一角：识别与知识检索 (Data Fetch)
  User->>S1: 上传题目图片或输入题干
  S1->>RS: recognizeProblem(payload)
  RS->>API: POST /api/recognition (Top-K 检索)
  API-->>RS: 返回题目题型、四区规划、知识点编号与公式
  RS-->>S1: 响应式装配题目事实与锚点

  Note over User,API: 2. 状态交接：A -> B Handoff (Context Handoff)
  S1->>SH: buildStep1Handoff() 过滤纯文本白名单
  SH->>API: POST /api/handoff (持久化交接状态)
  API-->>SH: 状态存盘成功

  Note over User,API: 3. 黄金三角第二角：五字段教学生成 (Data Generation)
  User->>AB: 触发 Agent B 生成
  AB->>BS: generateAgentBV2Rows({ handoff, systemPrompt })
  BS->>API: POST /api/agent-b-v2/generate
  API-->>BS: 返回五字段 (stage, duration, speech, board, actionSpec)
  BS-->>AB: 动态排布 160字/分 + 1.5s 时间线

  Note over User,API: 4. 独立第二双眼质检 (ASR Polish & Verification)
  User->>AB: 触发 Check 质检或本地兜底
  AB->>CS: checkAgentRows(rows, handoff)
  CS->>API: POST /api/check-agent/check
  API-->>CS: 返回润色口播纯中文发音与 changes 报告
  CS-->>AB: 应用润色成果并保留原始比对

  Note over User,API: 5. 黄金三角第三角：离线微课包交付 (Data Submission)
  User->>AB: 点击「生成独立微课包」
  AB->>DS: saveDeliverablePackage({ deliverable })
  DS->>API: POST /api/deliverable
  API-->>DS: 生成自包含 HTML 离线播放器与归档快照
  DS-->>AB: 返回独立离线播放器访问链接与状态
```

---

## 2. 非核心 API 分批接入与数据流走向
| 批次 | API 路由 | 承载 Service 模块 | 数据流向 | 状态 |
| :--- | :--- | :--- | :--- | :---: |
| **批次 1 (音频)** | `/api/tts/synthesize`<br/>`/api/tts/save-local` | `src/services/ttsService.js` | UI 组件 -> ttsService -> fishAudioHandler -> Fish Audio API | ✅ 已接入 |
| **批次 2 (质检)** | `/api/check-agent/check`<br/>`/api/check-agent/apply` | `src/check-agent/service.js` | UI 组件 -> checkService -> checkAgentHandler (本地ASR兜底) | ✅ 已接入 |
| **批次 3 (归档清理)** | `/api/deliverable`<br/>`/api/cleanup` | `src/services/deliverableService.js`<br/>`src/services/cleanupService.js` | UI 组件 -> Service -> deliverableStoreHandler / cleanupHandler | ✅ 已接入 |

---

## 3. 数据流解耦校验点总结
1. **单向流动**：所有 API 请求严格经过 `services/` 封装层，组件不再直接操作 `fetch` 与网络响应协议。
2. **统一响应封套**：各服务层接口统一返回标准化数据模型，网络异常与服务端报错统一转换为友好 Error 提示。
3. **自检 100% 绿灯**：`proxySelfCheck.js` 与 `agentAKnowledgeSelfCheck.js` 全链路通过，阻断级问题清零。