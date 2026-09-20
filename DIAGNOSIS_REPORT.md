# 问题摸底报告分析单

> 五阶段接管 · 阶段二产出 · 2026-09-19
> 马列主义矛盾观：抓主要问题，分模块统计小问题，分区分模块治理

## 一、分区/模块职责标注

```
┌────────────────────────────────────────────────────────────────────┐
│ 模块                  │ 职责                          │ 行数   │ 状态  │
├────────────────────────────────────────────────────────────────────┤
│ src/agent-b-v2/       │ Agent B 核心 (UI+契约+服务+提示) │ 5186  │ 主链  │
│   ├ AgentBDirect.vue │ B 页面 (4381 行, 超大单文件)    │ 4381  │ 🔴    │
│   ├ prompt.js        │ B 提示词 (教学资产, 禁删)       │ 400   │ 锁定  │
│   ├ contract.js      │ 五字段解析                      │ 298   │ 主链  │
│   ├ timing.js        │ 时间线计算                      │ 163   │ 主链  │
│   └ service.js       │ B API 调用                     │ 58    │ 主链  │
│ src/components/       │ 通用组件                        │ 2387  │ 主链  │
│   ├ Step1Entry.vue   │ Step1 贴题/识别 (1376 行)       │ 1376  │ 🔴    │
│   └ VisualTimeline   │ 时间线可视化                    │ 606   │ 主链  │
│ src/board-tools/      │ 板书工具 (互斥队列+rough)       │ ~1000 │ 主链  │
│ src/check-agent/      │ Check Agent C (可选)            │ ~400  │ 可选  │
│ src/lib/             │ 配置 + 双写存储                  │ ~400  │ 主链  │
│ src/services/        │ 知识/策略/handoff                │ ~600  │ 主链  │
│ src/utils/           │ 坐标/布局/数学文本               │ ~600  │ 主链  │
│ server/              │ Vite server 插件 (9 个)          │ ~2000 │ 主链  │
│ api/                 │ Vercel serverless (5 个)         │ ~50   │ 备用  │
│ public/skills-hub/   │ 7 skill 可交互 demo              │ ~2000 │ 已就绪│
│ skills/              │ 7 skill SKILL.md 沉淀            │ ~2500 │ 已就绪│
└────────────────────────────────────────────────────────────────────┘
```

## 二、三层业务扫描

### 2.1 前端业务层

```
入口: src/main.js → createApp(App).use(Antd).mount('#app')
路由: 单页 DirectFlow → Step1Entry (贴题) → AgentBDirect (生成)
状态: dualStore (localStorage 主 + IndexedDB 备) 双写
组件复杂度: AgentBDirect.vue 4381 行 = 🔴 单文件过大 (需拆分潜力大)
```

### 2.2 后端业务层

```
Vite dev: server/*.js 9 个插件 (recognition/agentB/check/knowledge/handoff/screenshot/deliverable/tts)
Vercel prod: api/*.js 5 个 serverless (与 server/ 部分重复)
共享 helper: server/http.js (applyCors/sendJson/isOptions/resolveUserCredentials/requestChatCompletion)
路由数: 10 个 (recognition/agent-b-v2/check-agent×3/knowledge×2/handoff/screenshot/deliverable/tts)
```

### 2.3 数据/状态层

```
handoff:    public/handoff/     21 文件 (Agent A 产物存档)
deliverable: public/deliverable/ 10 文件 (Agent B 产物存档)
board-result: public/board-result/ 21 文件 (画布快照)
audio-cache: public/audio-cache/  4 文件 (TTS mp3)
配置存储:   localStorage (agentBApiConfig/checkAgentApiConfig/userApiConfig) + IndexedDB (dualStore)
```

## 三、六维度评估

| 维度 | 现状 | 风险 |
|---|---|---|
| **1. 功能完整** | A/B/Check 三链通, 7 skill 沉淀齐 | P0-2/P0-3 未修 (B 解析过严/修缮误写) |
| **2. 代码质量** | 14883 行, AgentBDirect 4381 行过大 | 🔴 单文件巨型, 难维护 |
| **3. 架构清晰** | 前端 src + 后端 server + api/ 双套 | 🟡 api/ 与 server/ 部分重复 |
| **4. 文档完备** | 12 份 .md (AGENTS/ARCHITECTURE/DECISIONS/...) | ✅ 完善 |
| **5. 可测试** | validate_contract.cjs / observe-page.mjs 可跑 | 🟡 缺前端组件测试 |
| **6. 部署** | vite dev / vercel prod 双目标 | 🟡 双套路由需对齐 |

## 四、主要问题摸底（按矛盾大小排序）

### 🔴 重大矛盾（影响用户能看到东西）

```
M1: dev server 抢端口
   - 现象: Next.js (pid 1124) 占 3000, Vue 项目被顶掉
   - 影响: 用户在预览面板看不到 Vue 工作台 (这是之前"夏夏看不到"的根因)
   - 关联: 沙箱每次会话开始会自动启 Next.js on 3000
   - 修复战略: 每次开工先 pkill Next, 再启 Vite (double-fork daemon)

M2: AgentBDirect.vue 4381 行单文件过大
   - 现象: UI + 业务 + 渲染 + 时间线 全堆一个 .vue
   - 影响: 任何小改都动这个文件, 风险极高
   - 关联: 已知问题 P0-2 (解析过严) / P0-3 (修缮误写) 都在这
   - 修复战略: 阶段三骨架施工时按职责拆 (UI/业务/渲染分离)
```

### 🟠 中等卡壳（局部, 可放一放）

```
M3: api/ 与 server/ 路由双套
   - 现象: api/recognition/problem.js (10 行) vs server/recognitionHandler.js (153 行)
   - 影响: 改一处忘改另一处 → 行为漂移
   - 关联: vercel.json 用 api/, vite.config.js 用 server/
   - 修复战略: 先放一放, 阶段四管线铺设时统一

M4: 7 个 skill 沉淀与项目代码的引用关系未打通
   - 现象: skills/board-zone-layout/SKILL.md 描述的硬约束, 源码里没引用
   - 影响: skill 是"文档级"约束, 没落地为"代码级"校验
   - 关联: 我之前沉淀了 SKILL.md 但没改源码引用
   - 修复战略: 阶段五精装时, 在 Check Agent 加 skill 反模式校验
```

### 🟡 简单问题（优先击破）

```
S1: KNOWN_ISSUES P2-4 导出 Markdown 含元数据
   - 现象: TTS 会读 "# 口播稿" 等元数据
   - 修复: speechMarkdown.js 只导出 speech, 行间空一行

S2: KNOWN_ISSUES P2-5 自检脚本断言旧格式
   - 现象: proxySelfCheck.js 仍要求 Markdown 含 "# 口播稿"
   - 修复: 与 S1 同步改

S3: dev server 启动脚本 .cjs 副本未文档化
   - 现象: validate_contract.cjs 是为绕 ESM 加的副本, SKILL.md 没记
   - 修复: 在 board-lecture-player/SKILL.md 资源索引加 .cjs 说明
```

## 五、修复战略（最小化）

### 执行顺序

```
第一优先 (重大矛盾, 不修用户看不到):
  ① M1 停 Next.js → 启 Vite → agent-browser 验证主页可见
  ② 验证 Skills FAB 浮动按钮可点 → 7 个 demo 可访问

第二优先 (简单优先击破, 顺手清):
  ③ S3 board-lecture-player/SKILL.md 资源索引补 .cjs 说明

第三 (中等卡壳, 阶段三四再处理):
  ④ M4 阶段五在 Check Agent 加 skill 反模式校验 (放后)
  ⑤ M3 阶段四统一 api/ 与 server/ (放后)

放一放 (单文件重构, 风险高, 需用户确认):
  ⑥ M2 AgentBDirect.vue 拆分 (阶段三, 但需用户点头)
  ⑦ P0-2/P0-3 (KNOWN_ISSUES 历史问题, 不在本次接管范围)
```

### 验证标准

```
阶段二完成 = 本报告分析单 + SYSTEM_MAP 已建立
阶段三完成 = M1 修复 (用户能看到) + S3 修复 (文档对齐)
阶段四完成 = M3 路由统一方案 (不实施, 只设计)
阶段五完成 = M4 skill 反模式校验落地 Check Agent + 冒烟测试通过
```

## 六、需求校准（与用户对齐点）

```
需用户确认:
1. 本次接管核心目标 = 让 7 skill 在预览面板可见可用?  (默认 yes)
2. M2 AgentBDirect.vue 4381 行是否要拆? (风险高, 默认 no, 等用户点头)
3. P0-2/P0-3 历史已知问题是否纳入本次? (默认 no, 单独排期)
4. api/ 与 server/ 双套是否要统一? (默认 no, 阶段四只出方案)
```
