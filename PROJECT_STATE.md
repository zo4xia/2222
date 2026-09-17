# 项目实时状态 (PROJECT_STATE.md)
> 根目录 = `clean-package/`，以下路径均相对本目录。
> 最后更新：2026-09-17 —— 本轮为**过期项更正 + 断档补齐**，以 `git log/diff` 取证为准。

## 1. 当前真实阶段
- 五阶段重构流水线（决策 #001）：阶段一 勘探 → 二 诊断 → 三 骨架 → 四 管线 **已完成并留痕**。
- **阶段五 · 精装验收（冒烟 / test_report / P0-P4 评级）仍未执行**。原文件写"准备进入阶段五"属实，但后续重心已切走，不得误读为已完成。
- 03:51 之后的实际重心：运行时止血 → 首屏性能 → 首页白屏修复 → **首次真实跑通交付** → UI 收口 → Agent B 去冗余。
- 客观状态：主链（识别 → 生成 → 质检 → 交付打包）已跑通并产出真实产物；收尾项（图片题断链 / Vercel 缺口 / 硬编码密钥 / 字体真源不一致 / row-player 规则全页统一）**未闭环**。

## 2. 已产出交付物
- 阶段文档：`project_initial_state.md`、`resource_list.md`、`risk_matrix.md`、`diagnostic_report.md`、`calibrated_prd.md`、`module_dependency_graph.md`、`decoupling_strategy.md`、`dataflow_diagram.md`、`api_spec.yaml`。
- **首次真实交付产物**（推翻"产物层为零"旧结论）：`public/deliverable/current.html`（5.15 MB，内嵌板书字体）、`current.json`（23.8 KB）、`deliverable-deliverable-1789584993949.html/json`、`deliverable.schema.json`、`DELIVERABLE_API_SPEC.md`。
- 运行时资产：`public/board-result/` 39 个、`public/handoff/` 20 个、`public/pic/` 截图、`public/audio/`。

## 3. 变更树（2026-09-17 全天，倒序）
```
row-player.html                             [~ stage 标签定位改读导出物 boardPlan 四个 Label（新增 resolveTagAnchor，删内容锚反推）；DEMO 补 Label 字段；规格批注同步]  ★未提交
server/agentBV2Handler.js                   [~ 合同失败回灌提示按类型分诊（新增 buildRepairHint/looksTruncated）+ 附坏输出尾部 + warn 留痕与 diagnostic 补全]  ★未提交
src/agent-b-v2/AgentBDirect.vue            [~ 折叠入口三重重复收口：删工具条3芯片(模板30行+CSS43行)，保留表头+单元格入口；"展开 ◀▶"→"展开"]  ★未提交
src/components/Step1Entry.vue              [~ 补 QUESTION_FONT_SIZE 导入；全屏预览3入口→1；删写死 min-height(420/560)；RealBoardPreview 改异步；色值 token 化；两栏平衡；知识卡紧凑化]
src/components/BoardContentLayer.vue       [~ ResizeObserver / measureTopic 加 null 防护，修首页白屏 getBoundingClientRect]
src/agent-b-v2/DirectFlow.vue              [~ AgentBDirect 改 defineAsyncComponent 按需加载]
src/agent-b-v2/serializeDeliverableState.js[+ 交付物序列化纯函数模块抽取（输出契约不变）]
src/utils/superFilter.js                   [~ 字号硬编码改 import stepHandoff 常量；删自造 compactBoardFontSize；控制字符正则加 eslint-disable]
src/utils/mathText.js                      [- 删死代码 normalizeLatexControlChars（真源在 superFilter.cleanTextEscapes）]
src/lib/apiConfigStoreFactory.js           [+ 通用配置工厂]
src/lib/{userApiConfig,agentBApiConfig,checkAgentApiConfig}.js [~ 三份同构配置收口]
src/services/{ttsService,deliverableService,cleanupService,knowledgeRefineService,stepHandoff}.js [+ 统一服务层 / +fetchCurrentHandoff]
server/checkAgentHandler.js                [~ changes 对比 board 归一化，修断言偏差 4!==1]
server/deliverableStoreHandler.js          [~ 交付物落盘链路]
server/smokeTest.js                        [~ 冒烟脚本]
public/deliverable/*                       [+ 首次真实产物]
PROJECT_STATE.md / ENGINEERING_LOG.md / DECISIONS.md [~ 三份记录同步]
.codebuddy/memory/2026-09-17.md / MEMORY.md[~ 工作记忆与长期红线]
```

## 4. 过期结论更正
| 原记录（已过期） | 更正后 |
|---|---|
| `public/deliverable/` 0 文件，整条链从未产出 | **作废**：现有 6 个文件，首份真实产物 5.15 MB 已落盘 |
| `AgentBDirect.vue` 在 `src/components/` | 实为 `src/agent-b-v2/AgentBDirect.vue`（168 KB / 5200+ 行） |
| 阶段四完成 = 准备进入阶段五 | 阶段五**仍未执行**，中间插入运行时修复与 UI 收口 |
| 验证真空（无 test / 无 self-check 总入口） | 仍成立，但已有可人工点检的真实样本 `public/deliverable/current.html` |

## 5. 未闭环风险与挂起项
- **P0 1h2g 内存风险（2026-09-17 新增，服务器规格 1 核 2G）**：`server/productionServer.js:98` `res.end(readFileSync(filePath))` 与 `server/renderDeliverableHtml.js:57` 读取交付页模板 —— 均为「整文件进内存」，无流式/无缓存头，并发即 OOM。见决策 #007。（2026-09-17 晚：模板已从 5.26 MB 瘦到 **0.11 MB**，压力降一个数量级；流式改造仍待排期）
- ~~**P0 板书落点 `board.startCoord` 未被消费**~~ → **已修（2026-09-17 晚）**：`compile()` 组 board 计划项时未传 `coord` → 新增 `resolveBoardCoord`（三层回退：`board.startCoord` > `boardPlan[stage 区]` 左上角 +2%/+4% > 模板常量，`row-player.html` 编译期解析进 plan.coord）；`normRow` 保留 `startCoord`；`drawWriting` 兼容字符串/对象坐标。实测：带 startCoord → (56,16)；无 startCoord 竖图 → (56,18)；**无 startCoord 横图 → (38.4,55)，落点随 layoutMode 变化**；空 boardPlan → (8,44) 不崩。
- ~~**P0 图片题断链**~~ → **已修（2026-09-17 晚）**：图源 = **第一步截图**（`Step1Entry` 截 `.board-viewport` 存 `/pic/*.jpg`），不另找图、不重上传。`server/renderDeliverableHtml.js` 新增 `inlineProblemImage`：仅当 `boardPlan.image` 有图位（= 图片题）才把截图内嵌为 `screenshotDataUrl`；`row-player.html` 新增 `normData.problemImage` + `setProblemImage` + `drawProblemImage`，落座真源 `boardPlan.image`（限高保比例），画在底图之上、贴纸与板书之下。**文本题目没有 image 区 → 只把 `screenshotUrl` 带出去，绝不往板上贴截图**。实测：图片题交付页 139KB 含图，文本题 105KB 无图。
- **P0 硬编码密钥**：`server/fishAudioHandler.js:12-14` 明文 `sk-fish`，`getApiKeys()` 无条件混入。
- **P1 Vercel 部署缺口**：`vercel.json` 只覆盖 6 个 api 文件，缺 tts/handoff/deliverable/knowledge/screenshot/cleanup → 线上 404。
- ~~**P1 字体真源已拍板（2026-09-17，见决策 #006）**：本地自托管为准，CDN 仅作可选~~ → **2026-09-17 晚作废，见决策 #008**：交付页由客户自己的 Agent 生成、产物要给外部 API/Agent 做 skills，因此**字体必须走 CDN，禁止内嵌**；本地 `pingfang-qiaomu.ttf` 仅留作历史资产。
  - 已落地：交付页/设计灵感卡片/两份历史 deliverable HTML 的内嵌字体段全部删除，改引 `https://fontsapi.zeoseven.com/507/main/result.css`（平方乔木体）。
  - 体积结果：`row-player.html` 5.01 MB → **0.11 MB**；`public/deliverable/*.html` 5.03 MB → **0.12 MB**。
  - **素材（底图/贴纸/背景）仍必须内嵌 base64**：禁止任何相对路径外链 —— 产物要能脱环境双击打开。
- **P1 row-player 排版与落笔规则全页统一**：用户要求"所有页面都需要 row-player.html 里专门设计的规则"，**尚未执行**。
- ~~**P1 板书字号三处不一致**~~ → **已拍板统一 38px（2026-09-17 晚，用户定"38 号折中"）**：真源 `src/services/stepHandoff.js` `BOARD_FONT_SIZE = 38`（`superFilter.js` import 真源，自动同步；`BOARD_FONT_RATIO_TEXT` 同步改 38px）；`row-player.html` 的 `size` / `document.fonts.load` / `measureText` 共 4 处 42 → 38，并注释标注"与真源同步点"。**⚠ 遗留约束：row-player 是离线单文件不能 import，字面值与真源必须成对改**，改动时两边一起改。
- **P2 记忆与 DIGEST 归属（待拍板）**：上层仓库 `.codebuddy/memory/CONTEXT-DIGEST.md`（2026-09-15）是**旧工作区口径**（`src/main.js` 主链路、vite build 必挂、3000 属别的项目），与决策 #003「上层是脏区、不维护不引用」冲突；clean-package 下**没有** DIGEST。取舍：废弃上层 DIGEST / 或在 clean-package 新建并指定 owner。
- **P2 孤儿文件**：`lite-player.html` 全仓 0 引用；仓库上层 `设计灵感卡片-row-player.html` 有 342+/85- 未提交改动，来源待确认。
- **P2 运行时写 `public/`** 共 6 处（audio/pic/handoff/board-result/deliverable/knowledge），线上持久化方案未立。

## 5.5 军工级全栈审计结论（2026-09-17，只读取证）

- 产出：`FULL_STACK_AUDIT_2026-09-17.md`（48 条：P0×4 / P1×10 / P2×17 / P3×12 / P4×5）+ `DELIVERY_PACKAGE.md`。
- **交付判定：有条件 GO**（2026-09-17 决策 #018 执行后更新）。**P0 已全部清零**：① 解答段 3 行音频已补（9/9 有声，80.2s，静音 0）② 音频路径已归一 `../audio-cache/`（`file://` 脱环境实测 9/9 命中）③ `mp3` 字段全量补齐 + 契约四处统一 + schema 顶层 required 校验通过 ④ `productionServer.js` 已流式化。**仍差**：P1 五项未处置 + 人工点检 A~C 未做（无浏览器）+ 全仓 eslint 46 既有风格 error（P2）。
- **上一版判定（NO-GO，已作废）**的阻断 4 条：① **解答段 3 行 100% 无音频**（静音 61.6s / 总 110.9s = **56%**，改代码救不了，必须重跑 TTS）② 音频路径 `/audio-cache/` 为服务端绝对路径 → `file://` 双击 404 → 静音降级（决策 #017 定解：`../` 归一，未落地）③ 契约不自洽：`mp3` 9/9 缺失（P1，播放器有 `audioUrl` 兜底）+ 顶层形状分裂（current 包裹 vs 归档扁平且缺 3 键）④ `productionServer.js:98` 整文件吞吐（1h2g）。
- **已闭环**：`startCoord` 分支（决策 #016 降为可选）。
- **已推翻的前结论**：「脱环境 0 条相对路径 = 可播」为**假阴性**（音频地址在内嵌 JSON 里，grep 扫不到）；「mp3 缺失」由 P0 降 P1。
- **P0 更正（2026-09-17 用户拍板）**：~~① 硬编码密钥 5 处~~ → **作废**。用户明确「甲方预设演示账号，不许删」；`server/fishAudioHandler.js:13-14` 与三个 `src/lib/*ApiConfig.js` 的硬编码属**产品决策**，严禁删除/吊销/改 env/清 git 历史。仅降级为 P3 文档化（加注释「甲方预设演示账号，勿删」+ 部署手册说明额度共用风险）。
- **过期结论更正（以运行时为准）**：
  1. ~~运行时写 `public/` 共 6 处（含 knowledge、audio）~~ → `public/knowledge`、`public/audio` **均不存在**；实为 4 个有效目录（pic/handoff/board-result/deliverable）+ `audio-cache`。
  2. ~~端口 3000 属别的项目~~ → **3000 是本仓端口**（`package.json:7,11`、`vite.config.js:33,38`、`productionServer.js:24` 全写死，`dev-smoke.log` 实证）。
  3. ~~开发期禁止 vite build~~ → 入口缺失属实，但 `dist/` 已存在（192 文件 / 10.873 MB，07:26），**dist 处于「已生成但缺入口校验」的脏状态**。
- **验证体系实测**：0 单测 / 0 e2e / **无 `.github` 目录** / CodeQL 包未接线 / `scripts/verifyDeliverableTruthSource.mjs` 未接 npm script 且会 `rmSync` 删 `current.html`（具破坏性）。
- **仓库卫生**：`clean-package/.gitignore` 全文仅 `.chat/` → 7.597 MB 运行时产物（120 文件，含用户原题与上传截图）全部入库且静态可匿名直取。

## 6. 下一步接力棒
1. 阶段五 · 精装验收：跑全链路冒烟，产出 `test_report.md` + P0-P4 评级，P0 清零。
2. ~~字体真源拍板~~ → **已完成（决策 #008：字体走 CDN、素材内嵌；交付页 5.01 MB → 0.11 MB）**。后续：① 应用内 490 与交付页 507 统一为同一字族（书同文）② 落地符号降级规则（决策 #009）。
3. row-player 排版与落笔规则全页统一（待上条拍板后一并执行）。
4. ~~图片题断链修复~~（已修）→ 剩 Vercel 配置补全、密钥移出代码。
5. **Agent B 软修缮真实联调**（决策 #011）：带一份坏输出（截断 / fence 包裹）跑一次 `/api/agent-b-v2/generate`，确认模型回灌后确能修好；目前只有静态分诊验证。
6. **交付页标签人工点检**：换一份 `layoutMode=landscape-top-image` 的导出物打开 `row-player.html`，确认四标签随导出物落位、书写区不再错位（`row-player.html` 不进 build，无法靠 `npm run build` 验证）。
