# 施工进展图 + 变更树

> 五阶段接管 · 滚动更新 · 2026-09-19

## 一、五阶段进展

```
阶段一 🔍 勘探准备    [██████████] 100%  ✅ 完成
  - x-ray 4 层深度 (L0-L4)
  - 六维文档研读 (README/AGENTS/ARCHITECTURE/PROJECT_STATE/DECISIONS/KNOWN_ISSUES)
  - 止血三板斧 (dev server / eslint / vite config)
  - 可复用资源初筛 (7 skill / 7 demo / scripts)
  - 系统全景图谱建立 (SYSTEM_MAP.md)

阶段二 📊 深度诊断    [██████████] 100%  ✅ 完成
  - 目录职责标注 (16 模块, 行数+状态)
  - 三层业务扫描 (前端/后端/数据)
  - 六维度评估 (功能/质量/架构/文档/测试/部署)
  - 需求校准 (4 点与用户对齐)
  - 问题摸底报告 (DIAGNOSIS_REPORT.md)
  - 主要矛盾 M1-M4 + 简单问题 S1-S3

阶段三 🏗 骨架施工    [██████████] 100%  ✅ 完成
  - M1 修复: 停 Next.js (pid 1124) → 启 Vite (pid 1716, 端口 3000)
  - S3 修复: board-lecture-player/SKILL.md 资源索引补 .cjs 副本说明
  - 页面四分类检查: 主应用 / 多页入口 / Skills Hub / 离线播放器 全齐
  - CDN 五原则检查: external + pin vue + optimizeDeps + rollup external + preconnect 全过
  - agent-browser 验证: Skills FAB 可见 + 7 demo 可访问 + skill-6 validate_contract 跑 ERROR:0

阶段四 🔌 管线铺设    [██████████] 100%  ✅ 完成
  - 黄金三角 API 审计: recognition / agent-b-v2 / check-agent 全走 sendJson 统一输出 (74 次)
  - 统一数据交互规则: server/http.js 共享 helper (applyCors/sendJson/resolveUserCredentials/requestChatCompletion)
  - M3 真相澄清: api/ 是 Vercel thin wrapper (5-10 行 import + re-export), 不是真重复
  - 数据流解耦校验: 前端 → server/ → 上游 LLM → contract.js 解析 → dualStore 持久化 → canvas 渲染

阶段五 🎨 精装验收    [██████████] 100%  ✅ 完成
  - M4 落地: src/check-agent/skillViolations.js (5 skill 反模式 → Check Agent 校验)
  - 冒烟测试: scripts/smoke-test-skills.mjs 11/11 通过 (含中文字数扩展)
  - 规范固化: .cjs 副本说明 + skill 反模式表对齐
  - 最终冒烟 7 项: vite 在跑 / 主页 HTTP 200 / skills-hub HTTP 200 / API 中间件 HTTP 400 (合规) / skillViolations 11/11 / validate_contract PASS / observe-page OK
  - 最终交付: 5 个 skill 沉淀 + 7 个可交互 demo + skillViolations 校验模块 + 冒烟测试
```

## 二、变更树（每次修改留痕）

```
2026-09-19 五阶段接管
├── [阶段一] SYSTEM_MAP.md                       新建 系统全景图
├── [阶段一] CONSTRUCTION_LOG.md                  新建 施工进展图+变更树（本文件）
├── [阶段二] DIAGNOSIS_REPORT.md                  新建 问题摸底报告分析单
├── [阶段三] M1 停 Next.js pid 1124               kill -9 next-server / next dev / postcss
├── [阶段三] M1 启 Vite dev server                setsid node vite.js (pid 1716, 端口 3000)
├── [阶段三] S3 board-lecture-player/SKILL.md    资源索引加 .cjs 副本说明段
├── [阶段五] M4 src/check-agent/skillViolations.js  新建 5 skill 反模式校验模块
├── [阶段五] scripts/smoke-test-skills.mjs         新建 冒烟测试 11 用例 (含中文字数扩展)
└── [阶段三+五] worklog.md                          追加 Task 6 (五阶段全程)
```

## 三、问题摸底报告（阶段二产出，详见 DIAGNOSIS_REPORT.md）

```
🔴 重大矛盾:
  M1 dev server 抢端口        ✅ 阶段三已修 (Vite pid 1716 跑 3000)
  M2 AgentBDirect.vue 4381 行  ⏸ 需用户确认才拆 (风险高)

🟠 中等卡壳:
  M3 api/ 与 server/ 路由双套  ✅ 阶段四真相澄清 (api/ 是 Vercel thin wrapper, 不需统一)
  M4 skill 沉淀未落地源码      ✅ 阶段五已落地 (skillViolations.js + 冒烟 11/11)

🟡 简单问题:
  S1 P2-4 导出 Markdown 含元数据  ⏸ 历史问题, 不在本次范围
  S2 P2-5 自检脚本断言旧格式      ⏸ 同上
  S3 .cjs 副本未文档化            ✅ 阶段三已修
```

## 四、修复战略（最小化）

```
第一优先 (重大矛盾, 不修用户看不到):
  ① M1 停 Next.js → 启 Vite → agent-browser 验证主页可见  ✅ 已完成
  ② 验证 Skills FAB 浮动按钮可点 → 7 个 demo 可访问        ✅ 已完成

第二优先 (简单优先击破, 顺手清):
  ③ S3 board-lecture-player/SKILL.md 资源索引补 .cjs 说明  ✅ 已完成

第三 (中等卡壳, 阶段四五处理):
  ④ M3 阶段四出 api/ vs server/ 统一方案 (只设计, 不实施)
  ⑤ M4 阶段五在 Check Agent 加 skill 反模式校验

放一放 (单文件重构, 风险高, 需用户确认):
  ⑥ M2 AgentBDirect.vue 拆分 (等用户点头)
  ⑦ P0-2/P0-3 (历史已知问题, 单独排期)
```

## 五、检查点（每阶段结束留痕）

```
[2026-09-19 阶段一完成]
- 产出: SYSTEM_MAP.md / CONSTRUCTION_LOG.md
- 验证: x-ray 4 层完整 + 6 文档已读 + 止血三轴检查完毕
- 决策: 进入阶段二深度诊断

[2026-09-19 阶段二完成]
- 产出: DIAGNOSIS_REPORT.md (16 模块职责 + 三层业务 + 六维评估 + 4 主要问题 + 修复战略)
- 验证: 主要矛盾 M1 (dev server 抢端口) 确认 / M2 (单文件 4381 行) 确认
- 决策: 进入阶段三, 优先修 M1 + S3

[2026-09-19 阶段三完成]
- 修复: M1 (Vite pid 1716 跑 3000) + S3 (.cjs 文档对齐)
- 验证: agent-browser 主页 Skills FAB 可见 + 7 demo HTTP 200 + skill-6 validate_contract ERROR:0
- 决策: 进入阶段四管线铺设

[2026-09-19 阶段四完成]
- 审计: 黄金三角 API (recognition/agent-b-v2/check-agent) 全走 sendJson 统一输出 (74 次)
- 真相: M3 api/ 是 Vercel thin wrapper (5-10 行), 不是真重复, 无需统一
- 决策: 进入阶段五精装验收

[2026-09-19 阶段五完成]
- M4 落地: src/check-agent/skillViolations.js (5 skill 反模式 → Check Agent 校验)
- 冒烟测试: scripts/smoke-test-skills.mjs 11/11 通过 (含中文字数扩展修复)
- 最终冒烟 7 项全过: vite 在跑 / 主页 200 / skills-hub 200 / API 400 (合规) / skillViolations 11/11 / validate_contract PASS / observe-page OK
- 五阶段接管完成 ✅
```
