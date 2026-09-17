# 项目工作日志 (worklog.md)

> 项目：小学数学 AI 讲题板书生成工作台（Vue3 + Vite + Node）
> 仓库根：`/home/z/my-project/extracted/`
> 交付包目录：`/home/z/my-project/download/`
> 用途：跨会话接力棒，记录每次会话的扫描/治理/施工工作。

---

## 项目背景与铁律

- **项目本质**：Vue3 + Vite + Node 的「小学数学 AI 讲题板书生成」工具，三层 Agent 解耦（A 识别 / B 生成 / C 检查）
- **核心铁律**：
  1. 不动 A/B 主链路（contract / prompt / stepHandoff / service / timing）
  2. 不删预设账号（userApiConfig / agentBApiConfig / checkAgentApiConfig 默认值）
  3. dev 期不 build，dev 端口 3001/3200/5199（3000 是另一个项目）
  4. 禁境外资源（仅 zeoseven 字体允许例外）
  5. 真相源分级：代码 > 文档 > 记忆
  6. 画布参数唯一真源：`src/services/stepHandoff.js`
  7. 区域命名统一：question / analysis / solution / summary（禁用 topic）
  8. 变更必留痕：PROJECT_STATE + ENGINEERING_LOG + DECISIONS 三件套
- **handoff 定位**：流水线加工，每个环节逐步修缮，不是一次成型。

---

Task ID: 2-a
Agent: 深度扫描·前端勘探员（Explore subagent）
Task: 对 `/home/z/my-project/extracted/src/` 全部前端源码做只读深度扫描，输出文件清单 + 业务逻辑三层追踪 + L1/L2/L3 问题分级 + 依赖分析 + 跨层耦合点 + prompt.js 对齐情况

Work Log:
- 读取 44 个前端源文件（约 17,000 行）
- 按 8 个目录分组扫描：main/App/style/index、agent-b-v2/、components/、board-preview/、board-tools/、check-agent/、services/、lib/、utils/
- 函数层追踪 confirmStep1 → buildStep1Handoff → captureAndSaveScreenshot → POST /api/handoff → enterAgentB → generateRows → applyAgentBV2Timeline → checkRows → applyCheckResult → handlePlayOrSynthesizeSpeech → generateDeliverablePage 全链路
- 业务层 25 个环节梳理，标注当前状态（已接入/部分接入/有 bug）
- L1 发现 13 项（命名混乱 / 重复实现 / 魔法数字 / 注释残留）
- L2 发现 13 项（单文件超限 / 参数双轨 / API 字段不一致 / 空 catch / 死代码）
- L3 发现 6 项（业务UI混合 / 安全漏洞 / 跨模块耦合 / 长期静默失效）
- 第三方资源合规：除 zeoseven 外无境外资源 ✅
- prompt.js 对齐情况：核心规范对齐，但 4 项需修正（draw 工具注册 + examples.js 字段名 + output-format.js 自检清单 + board-rules.js 工具清单）

Stage Summary:
- 前端 44 个文件 17,000 行已完整扫描
- 主链路全部接通（贴题 → 识别 → handoff → B → Check → TTS → 导出 → deliverable）
- 8 个超限文件（AgentBDirect 5330 行最严重）
- 4 处死代码（cdnLoader / dualStore / simpleIndexedDb / boardTypography.css 共 638 行）
- 11+ 处空 catch 静默吞异常
- prompt.js 4 项冲突需立即修复
- 详见 `/home/z/my-project/download/01-深度扫描/01_项目目录树.md` 与 `02_业务逻辑流映射图.md`

---

Task ID: 2-b
Agent: 深度扫描·后端勘探员（Explore subagent）
Task: 对 `/home/z/my-project/extracted/` 的 server/ + api/ + 配置文件 + 6 个 public/ 子目录 + 6 个 doc 规范文档做只读深度扫描

Work Log:
- 读取 19 个 server/ .js + 6 个 api/ Vercel Function + 6 个配置 + 3 个 HTML 入口
- 业务三层追踪：22 个 API 端点全文档（含方法/处理函数/请求体/响应体/上游依赖/持久化目录/状态）
- L1 发现 8 项（注释残留 / 冗余别名 / 字面值硬编码 / LRU 手写）
- L2 发现 11 项（重复实现 / 字段口径分散 / 空 catch / 跨层调用 / 复刻版工具函数）
- L3 发现 9 项（7 个安全漏洞 + 2 个业务断链 + 0 测试 + Vercel Functions 覆盖率 27%）
- 持久化数据结构梳理：handoff/ + deliverable/ + board-result/ + audio/ + audio-cache/ + pic/ 6 个目录
- 安全审计：CORS 默认紧 / UPSTREAM 默认松（行为不一致）；Fish Audio 双 Key 硬编码；5 处目录穿越漏洞
- 与 doc/ 文档校准：8 处差异识别（文档声明已实现但代码未实现 / 代码已实现但文档未声明 / 字段命名不一致 / P0 阻塞问题状态）

Stage Summary:
- 后端 19 个 handler + 6 个 Vercel Function 已完整扫描
- 22 个 API 端点全文档化
- 9 个 L3 重度问题（含 7 个安全漏洞 + 2 个业务断链）
- Vercel Functions 覆盖率仅 27%（22 端点缺 16 个 Function）
- 3 个 P0 立即修复项：knowledge/revert 不可达 / handdraw-player.html 缺失 / cleanupHandler 误删 .original.json
- 详见 `/home/z/my-project/download/01-深度扫描/03_性能评估表.md` 与 `04_需求校准表.md`

---

Task ID: 2-main
Agent: 主 agent（GLM）
Task: 阶段一·深度扫描 + 阶段二·遗留治理 + 阶段三至六施工手册产出 + prompt.js 专项审查

Work Log:
- 读取项目 memory（.codebuddy/memory/MEMORY.md + CONTEXT-DIGEST.md + 2026-09-15.md + workbuddy/memory + CONTINUITY.md + PROJECT_STATE.md + KNOWN_ISSUES.md + AGENTS.md + AGENTS.local.md + 项目实时架构模块图.md + ARCHITECTURE.md + PROJECT_TREE.md + TOOLKIT.md + metadata.json + vercel.json + vite.config.js + index.html + .env.example + package.json + eslint.config.js + reasonix.toml）
- 读取 prompt.js 真源（396 行）确认 4 字段合同 + 3 工具白名单 + board 只 content+startDelay + 首行约束 + 单手互斥时间线 + 固定开场/收尾话术 + 数字保留阿拉伯 + 分数 \frac{}
- 派发 2 个 Explore subagent 并行扫描前端（Task 2-a）和后端（Task 2-b）
- 整合两份扫描报告，产出 7 份阶段交付文档到 `/home/z/my-project/download/`：
  1. `01-深度扫描/01_项目目录树.md`（4 层完整目录树 + 颜色职责标注 + 文件超限标记）
  2. `01-深度扫描/02_业务逻辑流映射图.md`（4 张 Mermaid 图：系统全景/主链路时序/API数据流/持久化目录关系）
  3. `01-深度扫描/03_性能评估表.md`（6 维度评估：性能/可用性/依赖复杂度/安全性/可维护性/兼容性 + 核心库版本矩阵）
  4. `01-深度扫描/04_需求校准表.md`（对照 truth/ + doc/ + CONTINUITY.md + KNOWN_ISSUES.md + AGENTS.md 共 140 项校准）
  5. `02-遗留治理/05_遗留问题分级清单.md`（L1 19 项 + L2 22 项 + L3 18 项 + 六步心法治理批次规划）
  6. `02-遗留治理/06_治理记录与解耦边界图.md`（3 个典型治理示例 + 解耦边界 Mermaid 图 + 治理后预期架构）
  7. `03-骨架施工/07_视觉骨架与边界固化.md`（页面分类 + CDN 五原则落实 + 健康检查/Mock + 大文件拆分计划）
  8. `04-API通链/08_API总闸与数据通链.md`（22 端点接入清单 + 统一拦截器/中间件 + 数据流 Mermaid）
  9. `05-UI优化/09_数据驱动UI与优化.md`（魔法数字替换 + 加载三件套 + .env 改造 + ESLint/Prettier + 性能调优 + 30 个冒烟测试用例）
  10. `06-收尾验收/10_项目开发规范手册.md`（10 条铁律 + 接口规范 + 命名规范 + 三页纸总结）
  11. `06-收尾验收/11_操作手册.md`（环境准备 + 启动项目 + 首次冒烟 + 常见问题 + 必读文档 + 命令速查）
  12. `06-收尾验收/12_总体体检报告.md`（P0 13 项 + P1 14 项 + P2 22 项 + P3 5 项 + P4 5 项 + 6 维度评级）
  13. `07-对齐审查/13_prompt.js对齐审查报告.md`（4 项冲突 + 26 处陈旧信息块围剿清单）

Stage Summary:
- 完整 6 阶段流水线产出（深度扫描 → 遗留治理 → 骨架施工 → API 通链 → UI 优化 → 收尾验收）
- 额外产出 prompt.js 专项对齐审查报告
- 综合评级：治理前 C（合格但有显著问题），治理后预期 A-（仅长期项待推进）
- P0 阻断 13 项 + P1 严重 14 项 + P2 中等 22 项已识别并给出修复方案
- prompt.js 对齐率：当前 93%，修复 4 项冲突后预期 100%
- 26 处陈旧信息块已识别（13 处代码 + 8 处文档 + 5 处 memory）
- 本轮为只读分析与施工手册产出，未实际修改运行时代码（遵守用户铁律「未完成交叉 + 0 置信度 agent 审计之前，禁止修改代码」）
- 下一接手人员可按 6 阶段施工手册逐项执行，每改一测一

---

## 下一接手人员的接力棒

### 必读文档（按优先级排序）
1. `.codebuddy/memory/MEMORY.md`（长期口径，最高优先级）
2. `.codebuddy/memory/CONTEXT-DIGEST.md`（上下文精选摘要）
3. `PROJECT_STATE.md`（实时真相）
4. `CONTINUITY.md`（用户核心诉求）
5. `KNOWN_ISSUES.md`（已知问题）
6. `/home/z/my-project/download/06-收尾验收/12_总体体检报告.md`（P0-P4 评级）
7. `/home/z/my-project/download/07-对齐审查/13_prompt.js对齐审查报告.md`（对齐专项）
8. `/home/z/my-project/download/02-遗留治理/05_遗留问题分级清单.md`（治理批次规划）

### 推荐执行顺序
1. **立即（1-2 天）**：P0 全部 13 项
   - 7 项安全（Fish Audio Key 移 .env + 5 处目录穿越 + UPSTREAM_HOSTS 默认值）
   - 4 项业务（knowledge/revert 修复 + handdraw-player.html 内联模板 + cleanup 保留 .original.json + productionServer 鉴权）
   - 2 项维护（AgentBDirect 拆分 + vitest 引入）
2. **短期（3-5 天）**：P1 全部 14 项
3. **中期（5-10 天）**：P2 全部 22 项
4. **长期（待夏夏拍板）**：P3 5 项 + P4 5 项

### 必守铁律
- 不动 A/B 主链路（contract / prompt / stepHandoff / service / timing）
- 不删预设账号（userApiConfig / agentBApiConfig / checkAgentApiConfig 默认值）
- 不补 handdraw-player.html / lite-player.html（用户明示不补回）
- 不用 3000 端口验证本仓（属另一个项目）
- 不执行 vite build 验证未完成功能
- 不引用境外资源（仅 zeoseven 字体允许例外）
- 不删 R2/R4/R5（用户裁定有用）
- 不把 demo.html 当真相源
- 改一测一：每改完一项立即跑 lint + check:proxy + 浏览器手测
- 变更留痕：三件套（PROJECT_STATE + ENGINEERING_LOG + DECISIONS）

### 当前状态
- ✅ 6 阶段产出文档全部就位
- ✅ 13 份交付文档归档到 `/home/z/my-project/download/`
- ⏳ 实际治理尚未执行（待接手人员按手册执行）
- ⏳ P0-P4 全部问题待治理

---

## 文件清单

```
/home/z/my-project/download/
├── 01-深度扫描/
│   ├── 01_项目目录树.md                  （4 层完整目录树 + 颜色职责标注）
│   ├── 02_业务逻辑流映射图.md            （4 张 Mermaid 图）
│   ├── 03_性能评估表.md                  （6 维度评估 + 核心库版本矩阵）
│   └── 04_需求校准表.md                  （140 项校准）
├── 02-遗留治理/
│   ├── 05_遗留问题分级清单.md            （L1 19 + L2 22 + L3 18 + 六步心法）
│   └── 06_治理记录与解耦边界图.md        （3 个治理示例 + 解耦边界 Mermaid）
├── 03-骨架施工/
│   └── 07_视觉骨架与边界固化.md          （页面分类 + CDN 五原则 + 大文件拆分）
├── 04-API通链/
│   └── 08_API总闸与数据通链.md           （22 端点接入清单 + 统一拦截器 + 数据流 Mermaid）
├── 05-UI优化/
│   └── 09_数据驱动UI与优化.md            （魔法数字替换 + 加载三件套 + .env 改造 + 30 个冒烟用例）
├── 06-收尾验收/
│   ├── 10_项目开发规范手册.md            （10 条铁律 + 接口规范 + 命名规范 + 三页纸总结）
│   ├── 11_操作手册.md                    （一页纸快速上手指南）
│   └── 12_总体体检报告.md                （P0 13 + P1 14 + P2 22 + P3 5 + P4 5）
└── 07-对齐审查/
    └── 13_prompt.js对齐审查报告.md       （4 项冲突 + 26 处陈旧信息块围剿）
```

---

## 变更树（本会话）

```
2026-09-17 主 agent 6 阶段流水线产出（只读分析 + 施工手册，未改运行代码）
├─ 读取 memory（.codebuddy/memory/* + .workbuddy/memory/* + CONTINUITY/PROJECT_STATE/KNOWN_ISSUES/AGENTS）
├─ 读取 prompt.js 真源（396 行，确认 4 字段 + 3 工具 + 单手互斥时间线）
├─ 解压 upload/remix-remix-remix-copy-of--googel--1-.zip 到 extracted/
├─ 派发 Explore subagent 2-a（前端深度扫描，44 文件 17000 行）
├─ 派发 Explore subagent 2-b（后端深度扫描，19 handler + 6 Vercel Function）
├─ 整合两份扫描报告，产出阶段一 4 份文档（目录树/业务流图/性能评估/需求校准）
├─ 产出阶段二 2 份文档（遗留分级清单/治理记录与解耦边界图）
├─ 产出阶段三 1 份文档（视觉骨架与边界固化，交接给 ui前端 subagent）
├─ 产出阶段四 1 份文档（API 总闸与数据通链，交接给 全栈 subagent）
├─ 产出阶段五 1 份文档（数据驱动 UI 与优化，交接给 全栈 subagent）
├─ 产出阶段六 3 份文档（规范手册/操作手册/总体体检报告，交接给 审计 subagent）
└─ 产出阶段七 1 份文档（prompt.js 对齐审查报告，专项产出）
```

---

> 本 worklog 为流水线加工型，每个接手 agent 完成自己的任务后追加段落，不要覆盖已有内容。
> 格式：每个段落以 `---` 分隔，必含 Task ID / Agent / Task / Work Log / Stage Summary 五字段。
