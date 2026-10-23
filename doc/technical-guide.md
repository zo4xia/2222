# 技术说明书 · 小学数学 AI 讲题视频生成工作台

> 面向开发者 / 接手人 / 运维的技术视角全解。
> 本文一切机制、接口、命令均以**代码实态**（仓库文件 + 本地实测）为准；无法求证的点显式标注「待查」。
> 配套读物：`README.md`（业务概览）、`AGENTS.md`（仓库宪法）、`skills/`（契约沉淀）。本文比前两者深一层：模块细节、机制原理、部署实态、坑记档。
> 基准版本：main @ `4d6c2a7`（2026-10-23），三胞胎 row-player MD5 `5e1c1751` 强一致（本文落笔时实测）。

---

## 目录

1. [系统总览：五步流水线](#1-系统总览五步流水线)
2. [架构与目录地图](#2-架构与目录地图)
3. [核心机制深解](#3-核心机制深解)
   - 3.1 四区画布与坐标单一真源
   - 3.2 板书动作锚定引擎 boardAnchorCore
   - 3.3 superFilter 12 步过滤链
   - 3.4 row-player 单文件播放器（时钟 / 揭示 / Tuner / 贴纸 / 录制 / AgentCanvas）
   - 3.5 字体宪法 v2.1
   - 3.6 三胞胎同步机制
   - 3.7 时间轴与估算/实播两轴分工
4. [交付物契约](#4-交付物契约)
5. [部署与运维](#5-部署与运维)
6. [测试与哨兵体系（30 套件）](#6-测试与哨兵体系30-套件)
7. [已知边界与坑记](#7-已知边界与坑记)
8. [附录：单一真源速查表](#8-附录单一真源速查表)

---

## 1. 系统总览：五步流水线

一句话定位：**把一道小学数学题（文字/图片）变成一个「真实音频驱动、手写板书逐字揭示、带圈划动作」的微课视频**，全链在一个 Vue3 工作台里完成，零数据库、单进程。

```
用户输入题目文本 / 上传图片
        │
┌───────▼───────────────────────────────────────────────────────────┐
│ Step1 贴题识别（Agent A，src/components/Step1Entry.vue）            │
│  · 图片先压缩（长边≤1600px / JPEG 0.85，recognitionClient.js）      │
│  · POST /api/recognition/problem → 上游多模态 LLM                  │
│    （服务端单次超时 110s、超时快速失败不重试 recognitionHandler.js） │
│  · 产出：problemText / 题型 / 知识点匹配 / 四区落坐 boardPlan       │
│  · 「确定进入生成表」→ POST /api/handoff 写 handoff-*.json          │
├───────────────────────────────────────────────────────────────────┤
│ Step2 五字段生成（Agent B，src/agent-b-v2/AgentBDirect.vue）       │
│  · GET /api/handoff 读 handoff JSON（唯一真相源）                  │
│  · POST /api/agent-b-v2/generate → 上游 LLM 按 prompt.js 契约生成   │
│  · parseLLMJson 解析 → contract.js 归一（stage/speech/board/action） │
│  · timing.js 计算 1D 单手串行估算时间轴（160cpm 兜底 + 220ms/字）   │
│  · B 页画布实时预览 RealBoardPreview（板书文字 + 动作 SVG）          │
│  · 结果缓存 localStorage（2h TTL，键含 prompt 摘要 + boardPlan 指纹）│
├───────────────────────────────────────────────────────────────────┤
│ Step3 校验润色（Check Agent C，src/check-agent/，可选手动触发）    │
│  · POST /api/check-agent/check → 独立模型只润色 speech             │
│  · auditRowsBySkills 5 技能红线校验（不阻断，进 changes 报告）      │
│  · POST /api/check-agent/apply 写回 handoff                       │
├───────────────────────────────────────────────────────────────────┤
│ Step4 演播录制（row-player.html 单文件播放器）                      │
│  · openHanddrawPlayer：写 localStorage 'agent-b-deliverable'      │
│    + POST /api/deliverable 归档 → 打开 /row-player.html?deliverable │
│  · compile(data) 编译全局时间轴 → 音频主时钟驱动 render(t)          │
│  · 字体门 → 预热手写字形 → 一笔一笔揭示 → ● 录制 webm（60fps）      │
├───────────────────────────────────────────────────────────────────┤
│ Step5 导出交付（AgentBDirect 四出口 + deliverableStoreHandler）    │
│  · 口播稿 MD / 画布分镜总表 MD / 完整规格 JSON / 下游 API 规范      │
│  · deliverable-*.json + companion HTML（固化单页，注入数据直开即播） │
└───────────────────────────────────────────────────────────────────┘
```

产品哲学（`AGENTS.md`，改代码前必读）：**最低兼容适配，不是把题型压成死规范**。程序只做「最小必要引导 + 最大兼容」，安静接住口播、板书、动作与时间线；不得用验证门槛压扁题型、教学过程或孩子的理解路径。Check Agent 是「第二双眼睛」，不是拦截器。

---

## 2. 架构与目录地图

### 2.1 技术栈（实测 package.json）

| 层 | 技术 |
|---|---|
| 前端 | Vue 3.5.39（Composition API + `<script setup>`），Ant Design Vue 4.2.6 |
| 构建 | Vite 8.1.1（dev server + production build，`@vitejs/plugin-vue` 6.x） |
| 数学渲染 | KaTeX 0.18.4（仅 App 预览侧；播放器是纯 canvas 无 KaTeX） |
| 手绘动作 | rough-notation 0.5.1 + roughjs 4.6.6（仅 App 预览侧；播放器自绘 rline/rellipse） |
| 后端 | Vite server middleware（`server/*.js` 插件，dev）；`server/productionServer.js` 独立 Node HTTP（生产） |
| Serverless | `api/` 5 个 thin wrapper（Vercel） |
| 测试 | Node `assert/strict`，`scripts/run-all-tests.mjs` 统一入口 30 套件 |

### 2.2 目录地图（关键文件逐一有责）

```
repo-2222/
├── index.html                    工作台唯一业务入口（Step1/Step2 同页 DirectFlow 切换）
├── board-preview.html            全屏画布预览页（vite 第二 build 入口）
├── row-player.html               ★ 演播单文件播放器【三胞胎真源·根】（2455 行，零依赖双击可开）
├── src/
│   ├── App.vue / main.js         壳与入口
│   ├── agent-b-v2/
│   │   ├── DirectFlow.vue            Step1↔Step2 页面切换器
│   │   ├── AgentBDirect.vue          B 工作台主组件（五字段表格 / 校验 / 导出 / 演播入口）
│   │   ├── prompt.js                 B 系统提示词（教学叙事 + 五字段契约；长是有意的）
│   │   ├── contract.js                LLM 行 → 程序行 归一（normalizeStage/Board/ActionSpec）
│   │   ├── timing.js                  估算时间轴（160cpm 兜底 + 220ms/字 + 标点停顿）
│   │   ├── service.js / knowledgeRefinePrompt.js
│   │   ├── composables/useBCache.js  localStorage 缓存（2h TTL + prompt 摘要进键）
│   │   └── skills/liyongle-elementary/ 人设/口播规则/坐标规则/四环等教学技能模块
│   ├── check-agent/               Check Agent C（prompt/service/skillViolations/asrPolish）
│   ├── components/Step1Entry.vue  Step1 贴题识别（上传/识别/落坐/handoff）
│   ├── components/RealBoardPreview.vue + BoardContentLayer.vue  画布 DOM 渲染（预览域）
│   ├── board-tools/               板书工具域：
│   │   ├── boardAnchorCore.js       ★ 动作锚定引擎 ESM 真源（findRange 四函数字节级镜像播放器）
│   │   ├── boardToolCatalog.js      动作 1.0 白名单真源（version 1.5.0）
│   │   ├── roughNotationTool.js / roughDrawingTool.js  预览侧动作执行
│   │   ├── handActionScheduler.js   预览动作墙钟队列
│   │   ├── textTargetRegistry.js     DOM Range 锚定（VALID_REGIONS 四区白名单）
│   │   ├── boardToolTiming.js        动作时长真源（MIN_HAND_LIFT_GAP_MS 等）
│   │   └── stableHash.js
│   ├── services/
│   │   ├── stepHandoff.js           ★ 画布参数唯一真源（字体宪法 v2/v2.1）+ handoff 构建
│   │   │                              + applyBoardPlanRevision（布局修订三同步）
│   │   └── recognitionClient.js      识别客户端（130s AbortController + 图片压缩）
│   ├── utils/
│   │   ├── superFilter.js           ★ 12 步板书过滤流水线唯一真源
│   │   ├── boardLayout.js           ★ 四区坐标真源（BOARD_LAYOUT + DEFAULT_BOARD_PLAN）
│   │   └── canvasCoords/mathText/biuBubble…
│   ├── lib/                        parseLLMJson / safeJsonFetch / deliverableAssetPaths / 各 agent API 配置
│   └── board-preview/              全屏预览页应用
├── server/                        9 个 API handler + productionServer + http（代理内核）+ loadDotEnv
├── api/                           Vercel serverless 5 件（recognition / agent-b-v2 / check×2 / cleanup）
├── public/
│   ├── row-player.html            三胞胎之二（与根 MD5 强一致）
│   ├── canvas.png + topic/analysis/solution/summary.png   画布底图与四标签（CDN 备胎）
│   ├── snapdom.js                 快照依赖（本地 vendored，162KB）
│   ├── skills-hub/                7 个 skill 交互 demo 页 + integration-guide
│   └── handoff / board-result / deliverable / audio-cache / pic   ★ 运行时数据目录（活档）
├── dist/row-player.html           三胞胎之三（构建产物，npm run build 重生）
├── skills/                        8 个 skill pack（SKILL.md + meta.json；board-lecture-player 为交付物 skill）
│   └── board-lecture-player/        assets/sample-rows.json + scripts/validate_contract.cjs + references/
├── scripts/                       30 个测试套件 + run-all-tests + sync-twin-player + ensureDeps + 运维工具
└── doc/                           知识库活数据（knowledge-a.compact.json）+ 档案（本文所在）
```

**双入口说明**：`index.html`（vite `main` 入口）承载全部业务流；`board-preview.html` 是独立全屏预览页；`row-player.html` **不走 vite 构建**，是自包含静态文件，由三胞胎机制独立守护。

---

## 3. 核心机制深解

> 本节每条机制均已对照代码逐行求证。行号以当前 main（4d6c2a7）为准。

### 3.1 四区画布与坐标单一真源

**画布规格（固定死规）**：1726 × 980 px（≈16:9），原点左上，坐标一律百分比 0–100。四区：题目 / 分析（左列上、下）、解答 / 总结（右列上、下），加四个区标签（topicLabel 等）。

**真源结构**（`src/utils/boardLayout.js`）：

- `BOARD_LAYOUT` — 名义坐标表（question `{x:6, y:13.2, w:44, h:22}` 等，其中 `w:44` 是**左列区域宽**口径）；
- `TOPIC_TEXT_W_PCT = 40.4` / `TOPIC_IMAGE_W_PCT = 38` — 题目**文字块宽**与**竖版题目图宽**口径，与 44 显式分工（Task 60 归一注释在案）；
- `DEFAULT_BOARD_PLAN = planLabelsFromTopic({...})` — 程序派生的默认九键布局（唯一兜底真源）；
- `planLabelsFromTopic()` — 三模式规划器（纯文字竖版 / 竖图左图右三区 / 横图上下），Step1 贴题落坐与预览拖拽修订共用。

**消费纪律**：全仓所有 fallback 布局一律 `import { DEFAULT_BOARD_PLAN }` / `extractZoneAnchors`（`stepHandoff.js`），**禁止手抄坐标数字**。历史上曾有两组值系 × ≥11 处手抄副本（13.32/40.32 抖动快照误冻结 + 40.62/54.38 程序输出），Task 60 全部归一。

**布局修订闭环**（Task 60 落刀）：`stepHandoff.applyBoardPlanRevision()` — 修订 boardPlan 时同时覆写 `zoneAnchors`（动作落点参考，随 handoff 进 prompt）与 `topicLayout`（预览渲染优先源），一处修订三处同步，消灭「动作按旧坐标、文字按新布局」。

**哨兵**：`scripts/test-board-layout-single-source.mjs`（21 断言）锁派生真源结构、手抄字面量不复活、三消费方 import 在位、row-player 异端兜底不复活、死键不复活、九键指纹、文档不失真。

### 3.2 板书动作锚定引擎 boardAnchorCore

**问题域**：Agent 生成的动作指令用 `target={region, exactText, occurrence}` 锚定「已写出的文字」。生成工作台要**校验锚点存在**，播放器要**按字池坐标执行**——两侧必须语义完全一致，否则「校验放行、播放拒画 = 静默丢线」。

**真源**（`src/board-tools/boardAnchorCore.js`，123 行）：

| 导出 | 职责 |
|---|---|
| `findRange(chars, sub, occ, opts)` | 行内滑窗匹配（板书域严格行内）；`opts.allowWrap=true` 时连续流匹配 + 命中区间按行切段（题目区自动折行用），返回 `{x1,y1,x2,y2,size,segments[]}` |
| `sameBoardLine(a,b)` | 同行判据：优先全局 `li`（行号），旧池无 li 时同基线 y 兜底 |
| `tokenizeLine(s)` / `readBrace(s,idx)` | 行切词：`\frac{a}{b}` 识别为整块 token（防止 exactText 误锚进公式字面量） |
| `REGION_STAGE_ZH` | 中英词汇桥 `{analysis:'分析', solution:'解答', summary:'总结'}`——rows.stage 是中文硬约束，target.region 是英文白名单（`textTargetRegistry.VALID_REGIONS`），执行器单点归一 |
| `buildBoardAnchorFlow(lines)` / `buildQuestionAnchorFlow(text)` | 行数组 → 零坐标字符流（校验侧消费，坐标全零不影响行界/occ 判定） |

**四函数与 row-player.html 内嵌版字节级一致**（Task 63/64 抽核）；播放器侧的执行版（`drawAction` L1359 起）做同样的路由：`region=question → 题目池（allowWrap）`；板书区 → stage 分桶（词汇桥双试过滤）；缺 region（旧档）→ 板书全局→题目兜底 + warn。

**三条防错铁律**（Task 62/63 根治史，注释在案）：
1. **行内匹配拦截跨行**：exactText 横跨两行时宁可明示拒画（warn 跳过），不画跨行乱线；
2. **题目区跨折行分段**：题目 30px 自动折行 Agent 不可预知，`allowWrap` 连续流命中后按行切段、每段独立下划线（一行一段 = 老师跨行划重点的手部动作）；circle 跨折行明示拒绝（圈两行必歪）；
3. **occurrence 语义两侧归一**：桶内（region 范围内）第 N 个连续匹配，与 App 侧 DOM Range 校验同语义。

**达成的不变量**：**校验放行 ⇒ 播放必画**（生成工作台报绿的锚点，播放器必然画得出）。锁面：`test-player-mirror-parity.mjs` B9–B13（行为对拍 + 源文本字节级对拍）。

### 3.3 superFilter 12 步过滤链

**为什么存在**：LLM 产物里的 LaTeX / HTML 实体 / Unicode 数学符号 / 全角变体，落进手写板书 canvas 会缺字（字库实测：5/5 可选手写体全缺 `→ ⇒ ≤ ≥ ≠ ≈ × ÷ − ± · √ ° ∠ ⊥ ∥ π ∞ ∵ ∴ ℃` 与全部全角字母数字）。「车同轨·书同文」过滤器把一切文本归一进**手写安全白名单**。

**真源**：`src/utils/superFilter.js`（v2，2026-10-12 字库实测校准版）。播放器内嵌同款镜像（row-player.html §5c，L973 起），A 组行为对拍哨兵用同一语料双跑两侧必须逐字一致。

**12 步流水线**（顺序不能倒，两侧同构）：

```
① 真实 \r\n \r 统一为 \n      ①' 字面量 \n 还原（排除 \neq \notin \nabla 与单字母变量 \nS）
② 控制字符退化为空格          ③ HTML 实体解码（&amp; 最后解，防二次解码）
④ LaTeX 转义损伤修复（\frac 被吃成 rac/frac）  ④' <br>→\n + 白名单标签剥除
⑤ aligned 环境剥壳 + 删 $ \left \right
⑥ 全角变体归半角（保留全角标点）
⑦ Unicode 缺字凑法降级（×→x、÷→/、→→->、≤→<=、∵→因为……）
⑧ LaTeX → 板书安全凑法（\times→x、^\circ→度、\sqrt{x}→根号x……长命令在前）
⑨ ^2 ^3 → ² ³（渲染层按小字号上标画，不取 ²³ 字形）
⑩ 纯整数 a/b → \frac{a}{b}（严禁误伤小数与单位）
⑪ 压行内空白（保护前导空格供竖式对齐）
⑫ 连续 3+ 换行压成 2 个
```

配套：`toBoardLines()`（字符串/数组/对象统一 → 一行一个的行数组，绝不动显式 `\n`）；`findUnsafeChars()` 白名单校验（告警清单不静默丢）；`boardTextToPlain()` 跨环境兜底（\frac→a/b、²→^2，导出/日志环境不产生 DSL 字面）。

**历史坑（修法即注释）**：`\s+/g` 含 `\n` 会把多行板书压成一行——所以 ⑪ 只压行内空白；`&amp;` 必须最后解否则二次解码；`<[^>]+>` 会误吃「3 < x, 5 > x」的不等式文本——所以标签剥除走白名单。

### 3.4 row-player 单文件播放器

**定位**：交付端最终渲染器 + 录制器。零依赖单文件（双击可开、离线可用），吃 deliverable JSON（协议 v2.0.0），输出「真实音频驱动、板书逐字一笔一笔揭示、rough 圈划」的微课，可一键录制 webm。文件结构（2455 行）：§0 内嵌 base64 素材 → §1 示例 DATA → §2 抖动与坐标 → §3 compile 时间轴 → §4 rough 自绘 → §5 排版与字池 → §5b 行图缓存 → §5c superFilter 镜像 → §6 渲染核心 → §7 时钟 → §8 装载与录制 → §8b Tuner → §8c 贴纸拖拽 → §9 AgentCanvas 控制桥。

#### 3.4.1 渲染管线与「一行一图 + 遮罩揭示」模型

- `render(t)` **幂等纯函数**（seek / 暂停 / 拖拽全靠它不漂移）：全清画布 → 纸白底色 `#fbfaf6` → 题目区静态印刷体（30px，考卷式一打开就写好，`C.Q` 惰性挂载——换档/字体门/文本改动 = 新 C 自动失效）→ 逐 row plan 循环按局部进度调 `drawWriting`/`drawAction` → 贴纸底图最后盖（板书越界被边框盖住 = 贴纸压字的真实手感）→ 题目图 → 四区标签（180ms 弹出）→ 字幕（变更守卫，同串不重写 DOM）。
- **板书揭示**：`compile` 期 `layoutBoardLines` 把行布局算死（自然行高 + 向下写 → 到底换列 → 行超宽自适应缩字号、下限 14px）；每行经 `rowImage` 一次性 `fillText` 成**离屏行图**（ROW_CACHE：Map LRU 上限 120，键 `content|li|x|0|y|0|size|font|color|FONT_VER|DPR`）；播放期对行图做**斜边梯形 clip 遮罩揭示**（顶边超前/底边滞后 ≈1.5:1，斜率随机 2%~5%、方向随机、px 封顶收进约一字宽）+ `FEATHER_PX=2` 法线软边（笔尖拟态）。机制血统自旧作 AutoHandwritingLayer 的 clip-path 擦除。
- **一笔一笔节奏**（2026-10-23 拍板）：行内进度不线性铺满（幕布感），改**按字推进**——`rowImage` 返回 `gs[]`（逐字盒子），`drawWriting` 建节奏表 `R.ry`（惰性一次、随缓存走）：每字独立小揭示窗，窗内 smoothstep（起笔慢·行笔快·收笔慢），字后行笔微顿（全角 18%/半角 6%，末字不顿 = 收笔即离纸），每字时长确定性 ±18%（随机流 `seed+97+li` 独立于斜边流，同档同节奏、seek 不变）。无 gs（rough 横线行）回退线性扫。**时间账零动**：行 seg 权重不变，pr=1 仍揭满全行 → 终态与旧版逐像素一致。
- **性能要点**（68 评审会落刀）：完成行 `pr>=1` 直贴行图（免清/裁/羽化/回贴五连光栅，60 行档占每帧光栅 44%）；区框拖动 / seek 拖动一律 rAF 合流（120Hz 指针每帧至多一次 compile+render）；死画布 `drawTimeline` 已摘除（画进 `display:none` 的纯烧 CPU 桩）。

#### 3.4.2 时钟：音频主时钟 + 虚拟钟

```
每 row 两种钟：
  有 mp3 → audioEl.currentTime 是唯一行时钟（onended 串行切下一行，绝不截断）
  无 mp3 → 虚拟钟 performance.now()（startRow 重基线，页面隐藏多走的墙钟被逐行吸收）
全局状态四元组：playing / pausedCur（冻结钟位）/ rafId / audioEl.paused
统一出口 uiNow()：播着=活钟钳 total；暂停/终局=冻结位（pausedCur 优先，T 兜底）
```

- **时长三级铁律**（compile L531 起）：`audioDurationMs`（试听实测真实时长，唯一主时钟）> `duration` 秒（旧协议兼容）> 160cpm + 标点停顿估算（。700/，500/……1000，下限 1500ms，仅无声演示兜位）。
- **有音频行锁时长**：板书/动作绝不拉长行、绝不截断音频；动作排不下只压抬笔间隔（`compactActionsIntoWindow`，gap 下限 200ms，首动作起点不动）；无音频行按 maxEnd 拉长完整呈现。音频行 `gapAfter=0`（onended 自然紧接），无声行 GAP=1000ms。
- **音频孤儿防火门**（trial2-b 根治）：`onended` 带 `rowHasAudio` 门（孤儿 ended 事件不得按 rowIdx 硬切跳行）；`onloadedmetadata` 带同源门（迟到元数据不得把旧音频时长写进别行并经保存持久化）；seek 落无声行 `audioEl.pause()` 停孤儿配音；`load()` 换档咽喉统一停音。
- **元数据校正**：`reflowWithRealDuration(i, realMs)` — 交付物缺 audioDurationMs 时，元数据到达后用真实时长重排全轴（不重载 src、不打断）。
- **seek 语义**：`seekTo(v)` 拨针 + 冻结 `pausedCur`；同行同源只拨 `currentTime`（字面比对 src，杜绝重挂断流），真换行才换 src 且播放中续播；拖回已 ended 音频行若在播且音频停着就 `play()` 续上。
- **暂停→恢复 = 整行重播**：`startRow` 恒重基线行首。这是**设计语义**（行 = 教学原子单元），产品已销案，不是 bug。

#### 3.4.3 字体门（canvas 字体生效机制）

**病灶**：CSS `@font-face` 只声明不下载——没有 DOM 元素用到该字体时浏览器根本不请求字形分片，`document.fonts.ready` 会先一步 resolve，首帧渲成回退楷体并被行图缓存，之后怎么重绘都是错的；且 `fonts.load()` **不带 text 参数 = 不加载**（实测 5 分片加载前后同文本宽度 228→176.1）。

**机制**（`load()` 唯一咽喉 → `warmBoardFonts()`）：按真实语料 `collectBoardText()`（题目 + 口播 + 板书全量文本）`document.fonts.load('40px "平方乔木体"', 语料)` → 完成后 `FONT_VER++` + `ROW_CACHE.clear()`（行图整批作废）+ `compile(C.data)` 整轴重排（字宽变了坐标必须重算）→ `render`。世代计数 `WARM_GEN` 防旧预热迟到回关门。`document.fonts.ready` 再来一轮同款重排（双门并列，被 stage-flow 哨兵锚死）。`reportFontState()` 量宽对比手写体与 serif，宽度一致 = 字体没生效，页面上明说（不搞玄学）。

播放按钮在字体分片未齐时是 `⏳ 字体加载中…`（禁播防「中途换脸跳位」）。

#### 3.4.4 Visual Layout Tuner（布局手工微调）

开启 Tuner（开时自动暂停）：8 个可拖框（四区 + 四标签；区框可拖宽高 e/s/se 手柄，标签只可平移）+ 可选原题图框。特性：
- **磁吸 0.5%**、坐标实时显示、**越界警告**（红框 + 四边警示条 + 分向超量文案，1726×980 有效范围校验）；
- 松手**轻柔收敛**回画布内（不硬弹）；
- 拖动全程 **rAF 合流**（DOM 框即时跟手，canvas 每帧至多重排一次）；
- 「💾 保存布局」写 `localStorage 'agent-b-deliverable'`；「📥 导出 JSON」下载微调后完整交付档；「🔄 恢复预设」重置九键默认 + **清空全部贴纸 dragOffset**。

#### 3.4.5 行级贴纸拖拽（dragOffset）

学旧作贴纸模型：**每句板书 = 一枚可拖贴纸**。开启 Tuner 时 `initRowStickers()` 按每行板书包围盒生成贴纸（第 N 句 + 内容预览，pinned 琥珀色标记已有手动位）。

- **数据模型**：`dragOffset={dx,dy}`（px，**相对自动流位置的偏移**而非绝对坐标——区框拖动/文本改动触发自动重排后偏移语义仍成立）；旧档无字段 = 行为零变化。
- **compile 唯一消费点**：游标推进用**未偏移** L（被拖走的行让出自动流座位，后续行自然补位）；偏移版 LV 同时喂 `boardCharPool` + `plan.board` → 行图渲染、动作锚定字池、rowImage 缓存键（含 x|y 自动失效重渲）**三路同源平移**——62/63/64 的「校验放行⇒播放必画」不破。
- **交互**：拖动 rAF 跟手预览（canvas 不动，松手 compile 落位）+ clamp 不越画布；**双击撤消**回自动排版；**拖回原位 = 撤消语义**；纯点击不重建贴纸 DOM（保住 Chrome dblclick 的节点同一性——真实鼠标双击撤消因此可用）。
- **透传**：`normRow` 白名单透传 dragOffset（Tuner 保存 → reload 存活）；`Math.round` 整数化与缓存键 `x|0/y|0` 精确对齐。

#### 3.4.6 录制（webm 一键导出）

`toggleRec`：合成层 canvas（板书底 + 批注 ink 层）`captureStream(60)` + 音频轨（`AudioContext.createMediaElementSource(audioEl)` → MediaStreamDestination，不回环不哑音）→ `MediaRecorder`（vp9/opus，6Mbps；不支持时裸 MediaRecorder）→ 停止自动下载 `项目编码.webm`（剪映/OBS 可直接认）。

**跨域污染防线**：CDN 素材（i.ibb.co）画进主画布必须带 `crossOrigin='anonymous'`（实测该 CDN 回 `access-control-allow-origin: *`），否则 canvas tainted → captureStream 抛 SecurityError。`loadStageImg` 顺序铁律：**先设 crossOrigin 再赋 src** + `usedFallback` 一次门防回环；CDN 撤头自动落内嵌 base64 兜底链（单文件离线死规不破）。`toggleRec` 全程 try/catch + warn（按钮不僵尸）。已知半盲区：`setProblemImage`（题目图，外域无 ACAO 时）未设 crossOrigin——录制被 try/catch 兜住降级，属「显示优先 vs 可录优先」权衡，挂账在案。

#### 3.4.7 AgentCanvas 控制桥（画布对 agent 开放）

铁律：**不改渲染管线**（render 纯函数 / 音频主时钟 / 幂等 seek 一概不动），只开「读状态 + 换数 + 播放控制」的门。浏览器控制台 / 自动化注入均可用。**逐方法与实现核对签名**（row-player.html L2403-2452，`version:'1.0'`）：

| 方法 | 签名（实现实态） | 说明 |
|---|---|---|
| `state()` | `→ {projectCode, totalMs, nowMs, playing, rows[{stage,duration,speech(截50字),board,actionSpecCount}]}` | 只读摘要（注意：`nowMs` 暂停态为冻结位，但 `T` 兜底口径在暂停态陈旧——桥观测失真点，见坑记） |
| `load(json)` | `(deliverableJSON) → {ok, rows, totalMs} \| {ok:false, err}` | 整体换题，走 normData 归一 + 字体随档切 + 落输入框（同「导入 JSON」按钮） |
| `setRow(i, patch)` | `(i, {stage?, speech?, duration?, content?, startCoord?, startDelay?}) → {ok, row, keptMs} \| {ok:false, err:'no row i'}` | 改第 i 行板书/口播；**保持时间位置原地重渲**（播着用活钟，暂停用冻结位，钳 total） |
| `play()` | `() → void` | 开播（字体门未过则拒绝并提示；未开播恒从 0；播放中再调不重跳——但桥直调在播放中会整行重头播，桥专属行为，见坑记） |
| `pause()` | `() → void` | 暂停并冻结钟位 |
| `seek(ms)` | `(ms) → void` | 幂等定位（自动钳 [0, total]） |
| `setProblemImage(url)` | `(url) → {ok:true}` | 换题目图（画不画仍由 boardPlan.image 决定，不越权贴图） |
| `screenshot()` | `() → dataURL(PNG 1726×980)` | 当前帧截图，agent 视觉核验专用 |
| `getBoardPlan()` | `() → boardPlan` | 读布局（**实现有、头注释未列**——文档漂移点） |
| `setBoardPlan(bp)` | `(bp) → {ok:true}` | 换布局：compile 重排 + render + Tuner 开着刷新区框贴纸（**实现有、头注释未列**） |

消费样例：`AgentCanvas.load(deliverableJSON)` → `AgentCanvas.play()` → `AgentCanvas.seek(8000)` → `AgentCanvas.screenshot()` 逐时刻视觉核验。

### 3.5 字体宪法 v2 / v2.1

**唯一真源**：`src/services/stepHandoff.js`。全项目画布尺寸/字号/字体族/颜色/行高口径只在此定义，其余位置一律 import；**发现别处硬编码 30 / 40 / 1726 / 980 / #dc2626 = 那处是 bug**。

| 项 | 规矩 | 常量 |
|---|---|---|
| 画布 | 1726 × 980 px | `CANVAS_SIZE` / `COORDINATE_SYSTEM` |
| 题目区 | 微软雅黑 30px 印刷体（黑色） | `QUESTION_FONT_SIZE=30` / `QUESTION_FONT_FAMILY` |
| 板书区 | 40px 手写体（分析红 `#dc2626`，解答/总结黑） | `BOARD_FONT_SIZE=40` / `ANALYSIS_TEXT_COLOR` / `BOARD_TEXT_COLOR` |
| 手写双态 | 默认乔木态（qiaomu）；备选韶华态（shaohua，选了韶华就不要乔木） | `HANDWRITING_FONT_CHOICES` / `HANDWRITING_FONT_CHOICE_DEFAULT='qiaomu'` |
| 降级链 | 乔木态：507 乔木→157 韶华→511 上上谦→510 三生→509 韶拓→490 栗壳→楷体→STKaiti→PingFang SC→serif；韶华态同族去掉 507 | `HANDWRITING_FONT_STACK` / `_ALT`（与播放器 `HAND_FONT_STACKS` 值级一致，H2 哨兵 noWs 压缩比对锁死） |
| CDN | `fontsapi.zeoseven.com` 6 个 result.css（507 主链同步，其余 media=print onload 转 all 异步按需——cn-font-split 按 unicode-range 分片，canvas 用哪族才下载哪族字形） | `HANDWRITING_CSS_HREF(_FALLBACKS)` |
| 行高 | 自然行高（字体自身度量 = CSS line-height: normal 口径），不设强制行高；**题目层 +2px 分数余量**（`NATURAL_LINE_HEIGHT_EXTRA_PX=2`）；**板书层 +4px = 2px 分数余量 + 2px 行距呼吸**（v2.3，`BOARD_LINE_HEIGHT_EXTRA_PX=4`）；度量不可用退估算比数 1.2 | `LINE_HEIGHT_ESTIMATE_RATIO` |
| 速度 | 板书 1 秒 4~5 字（220ms/字基准），行配速 ±10%；书写时长超窗自适应加速压进音频 | `BOARD_SPEED_CHARS_PER_SEC` / `BOARD_SPEED_JITTER` |

**v2.1 切换器机制**：选择值全链路唯一键 = `uiSettings.handwritingFontChoice`（**数据键，随档走**），全消费端用 `resolveHandwritingFont(choice)` 派生栈，禁止手写备选栈字面量。播放器 `normData` 读同键（`uiSettings.handwritingFontChoice` 优先，`canvasParams.fontSource.handwriting.choice` 兜底），首 load 前调 `applyHandFontChoice` 首排就用对字体；换字体 = `FONT_VER++` + `ROW_CACHE.clear()` 整批重建行图。

**书写抖动史**：位置抖动/逐字旋转/整行微倾已于 2026-10-17 夏夏拍板**全拔**（「太奇怪」）——手写感只由手写字体 + rough 笔触 + 时序节奏（每字 ±18%）承载。注意口径：**位置抖动全拔 ≠ 节奏人味拔除**（68-a 观感三问裁决：行配速 spJ ±10% 与每字 ±18% 留）。

### 3.6 三胞胎同步机制

**铁律**：`row-player.html` 存在**三份字节级 MD5 强一致副本**——根目录（人肉维护唯一真身）/ `public/row-player.html` / `dist/row-player.html`（构建产物）。

**守护器**：`scripts/sync-twin-player.mjs`：
- 常规模式：比较三份 MD5；根=public 一致而仅 dist 陈旧（或 `--force`）→ 根版刷 public+dist；根≠public → **按 mtime 单向同步**（新 → 旧）；任一份缺失自动补建。
- `--check` 模式：只读校验，不一致退 1（CI/测试用，绝不写文件）。

**接线（四重保险）**：
1. `npm test` / `npm run build` **前置**调用 sync（package.json scripts 实态）；
2. vite 插件 `twinPlayerGuardian`：`buildStart` 调 sync + dev watcher 监听 row-player.html 变化即刷；
3. Dockerfile Stage1 **显式 COPY `row-player.html`**（Task 57 教训：vite.config import sync 脚本 + buildStart 调用，缺根版或 scripts/ 构建必炸）；
4. 哨兵 `test-player-mirror-parity` / `test-repo-hygiene` 锁镜像行为。

**消费四方口**：`/row-player.html` 静态路由（生产读 dist 副本）→ `renderDeliverableHtml` 固化单页模板链（root→public→public/deliverable 回退）→ dev watcher → sync 自身。改播放器唯一正确姿势：**只改根版 → `npm run sync:twin` → `npm test` 过 check:twin = 新基线**。

**纪律红线（坑记在案）**：sync 的 mtime 分支是双向的——**直接手改 public 版再跑 npm test，会把直改静默反哺进根真源**；无 pre-commit hook、无 CI（守护全靠「只改根文件」纪律）。

### 3.7 时间轴与估算/实播两轴分工

系统里存在两条时间轴，**分工是刻意的**（AGENTS.md「刻意平行实现」清单在案，当 bug 修会引入真回归）：

| 维度 | 估算轴（timing.js / VisualTimeline / 导出 estimated*） | 实播轴（row-player compile + 时钟） |
|---|---|---|
| 角色 | 生成期给用户看的排期上界 | 播放期真实执行 |
| 音频行 | 锁真实时长、gap=0 | 同（B0–B8 函数级对拍锁死一致） |
| 动作压窗 | **不压**（超载可见 = 有意让用户看到排不下） | `compactActionsIntoWindow` 压抬笔间隔收进音频窗 |
| 板书写不完 | 如实显示溢出 | 自适应加速压进窗口（音频铁律最高优先） |
| 行切分 | `splitBoardLines` 只剥空白 | `toBoardLines` 过 superFilter（\times 6字→×1字，字数口径不同） |
| readBrace 嵌套 | slice 保留嵌套花括号 | 剥内层（B5 哨兵显式锁**差异**非一致） |

一致性由 `test-player-mirror-parity` B 组行为对拍（同一语料双跑两版必须同值）与 `test-playback-speed-sync` 锁死；**改任一侧先跑哨兵**。

**排期核心常量**（两侧值级锁）：GAP=1000ms（`AGENT_B_V2_ROW_GAP_MS`）、BASE_CHAR_MS=220ms/字、HAND_LIFT_MS=1000ms（动作抬笔换手）、160cpm 兜底 + 标点停顿（。700/，500/……1000）+ 1500ms 下限、动作分档（circle/横线固定 1000；underline ≤5字 1000 / >5字 1500 / >10字 2000）、纯动作行首动作前置 `min(1200, max(600, 12%·dur))`、关键词触发 `kwTimeMs` = 词位比例 × dur（clamp 0.95）+ 互斥钳制（不早于前序结束）。

---

## 4. 交付物契约

### 4.1 deliverable JSON（协议 apiSpecVersion 2.0.0）

**实态字段**（从 `public/deliverable/current.json` 实测核出）：

```jsonc
{
  "apiSpecVersion": "2.0.0",
  "specificationSummary": "...",     // 规格自描述摘要
  "specAnnotation": "...",           // 规格批注（车同轨·书同文口径）
  "projectCode": "deliverable-<毫秒时间戳>",
  "problemText": "题目原文",
  "sourceImageUrl": "...", "keepOriginal": ..., "screenshotUrl": "...",  // 题目图三槽
  "topicLayout": {...},              // Step1 贴题布局（topicLabel/question/image/blocks）
  "canvasParams": {...},             // buildCanvasParams() 产物：canvasSize/fontSource/fontSize/lineHeight/boardSpeed…（含字体宪法全文）
  "boardPlan": { canvas, layoutMode, topicLabel, question, analysisLabel, analysis,
                 solutionLabel, solution, summaryLabel, summary, image },  // 九键 + image（Tuner 微调写回处）
  "uiSettings": { coordinateMode, questionFontSize, questionFontFamily,
                  lineHeightPolicy, audioSpeedPolicy,
                  handwritingFontChoice, handwritingFont },   // v2.1 字体选择数据键在此
  "problemInfo": {...}, "meta": {...}, "stats": {...}, "checkInfo": {...},
  "rows": [{
      "stage": "题目|分析|解答|总结",     // 中文硬约束
      "mp3": "<可播音频 URL；占位串归空>",
      "audioUrl": "...",                  // 服务端归一 mp3→../audio-cache 后双写
      "audioDurationMs": 11546,           // 真实时长（试听探测），唯一主时钟
      "duration": 11.5,                   // 秒（audioDurationMs/1000 一位小数；缺音频恒 0）
      "durationLabel": "真实音频时长",
      "speech": "口播纯文本（无 TTS 控制标签）",
      "board": { "stage": "...", "content": "...", "startDelay": 0 },   // ★ 无坐标：位置是渲染层职责
      "actionSpec": [{
          "triggerKeyword": "12个苹果",   // entry 级（口播触发词，词位比例锚）；可省略=板书写完串行
          "action": {
              "tool": "rough-notation",   // 白名单：rough-notation | rough-line
              "action": "underline",      // 白名单：underline | circle（notation 独有）
              "target": { "region": "question", "exactText": "12个苹果", "occurrence": 1 },
              "order": 1,
              "options": { "color": "#dc2626", "multiline": false, ... }
          }
      }],
      "dragOffset": { "dx": 167, "dy": 83 },   // 65-i 贴纸拖拽偏移（px，可选，normRow 白名单透传）
      "estimatedDurationMs": ..., "exclusiveExecutionPlan": [...],   // 导出时 computeRowGroupTimeline 重注入（估算声明）
      "timingPolicy": "...", "totalDurationMs": ..., "plan": [...]   // 1D 单手串行执行计划（导出侧自描述）
  }]
}
```

**契约要点**：
- `board` 不输出起手坐标（`contract.normalizeBoard` 只认 `{content, startDelay}`；旧坐标字段触发弃用弹窗）；`duration` 统一秒（**不是毫秒**——历史上 1000 倍膨胀事故的口径记录在 README FAQ）。
- `actionSpec` 只认 **entry 级包裹格式**（triggerKeyword 与 action 平级在外层）；旧裸格式仅兼容兜底。
- 动作白名单真源 = `src/board-tools/boardToolCatalog.js`（version 1.5.0）：**动作 1.0 三动作**（rough-notation 的 underline/circle + rough-line 横线），颜色统一红 `#dc2626`；highlight / rough-arrow / draw 已砍（Task 43 拍板）。
- 音频地址白名单 `isAudioSrc`：只认 `data:audio/ blob: http(s) 相对路径` 或音频扩展名——挡住「音频暂未生成」占位串被当 URL 404 卡死首行。
- `normalizeDeliverableAssetPaths`（`src/lib/deliverableAssetPaths.js`，前后端共享真源）：服务端归一 mp3 → `../audio-cache` 相对路径，file:// 导入必响。

### 4.2 播放器入口归一（normData / normRow）

播放器对任何来源（URL query `?deliverable=` / localStorage `agent-b-deliverable` / 固化注入 `window.__INITIAL_DELIVERABLE__` / 手动导入 JSON / AgentCanvas.load）一律过 `normData` → `normRow`：**外面 JSON 再乱，只捞绑定的槽，其余全丢**。多槽名兼容（`stage|role|section|step`、`mp3|audio|audioUrl|voice`、`duration|durationSec|estimatedDurationMs/1000`、`boards[]` 数组板书合并……），字段表见播放器配置面板内置帮助表（「多的字段忽略」）。题图候选链：`screenshotDataUrl`（base64 离线稳）> `screenshotUrl`（/pic/）> `sourceImageUrl` > `problemImage`，onerror 逐级降试。

### 4.3 validate_contract（交付端合同校验）

`skills/board-lecture-player/scripts/validate_contract.cjs`（零依赖 Node；`.js` 双胞胎已删——ESM 下 require 必崩；`.cjs` 为主）：

- 用法：`node validate_contract.cjs <rows.json> [--json 机读输出]`；退出码 0=PASS / 1=有 ERROR / 2=用法错误。
- 校验三条非协商修订：① 真实音频唯一时长真相源（禁字数估算时长）② keyword 管制（board 域零 keyword；actionSpec entry 级 triggerKeyword 受控放行）③ board 零坐标；外加动作白名单（`PHASE1_TOOLS=['rough-notation','rough-line']` / `PHASE1_ACTIONS=['underline','circle']`）、stage 四值、坐标黑键（startCoord/coord/x/y/left/top/position）、同步黑键（keyword/keywords/cue/triggerAtWords）深扫、语速合理性。
- 样例：`assets/sample-rows.json`（4 行完整档，跑校验应为 ERROR 0 / WARN 0；已注册进主测试套件第 22 项）。

### 4.4 归档与固化单页

`server/deliverableStoreHandler.js`：每次导出独立 `deliverable-<时间戳>.json` + companion HTML（`renderDeliverableHtml`：读三胞胎模板 → 注入 `__INITIAL_DELIVERABLE__` + `<title>` 随题走 + DOCTYPE 病头防御补正）→ `current.json` 指针文件记录活跃产物；支持历史回溯与早期 JSON 补齐 companion HTML。固化单页**双击即播**（内嵌数据，离线可用）。

---

## 5. 部署与运维

### 5.1 命令速查（package.json 实态）

```bash
npm run dev          # 开发：ensureDeps 自愈检查 → vite --host 0.0.0.0 --port 3000
npm run build        # 构建：sync-twin-player → ensureDeps → vite build（产物 dist/）
npm run start        # 生产：node server/productionServer.js（读 $PORT/$HOST）
npm test             # 测试：sync-twin-player → ensureDeps → run-all-tests（30 套件）
npm run sync:twin    # 手动刷三胞胎（根 → public+dist 单向）
npm run check:twin   # 三胞胎只读校验（CI 用，不写文件）
npm run test:refine-degrade   # 网络型独立测试（真实上游降级链路，不入主套件）
npm run check:proxy / check:knowledge   # 动作白名单运行时自检 / 知识库自检
```

`scripts/ensureDeps.mjs`：依赖完整性自愈（antd 被裁剪时自动补装），dev/build/test 三入口前置。

### 5.2 运行时拓扑（三种部署形态共用一套 server handler）

| 形态 | 前端静态 | API | 说明 |
|---|---|---|---|
| dev | Vite dev server (3000) | Vite middleware 插件（vite.config.js 挂 9 个 handler + health + twinPlayerGuardian） | 单源同端口；host 0.0.0.0、allowedHosts: true |
| 生产（Node） | productionServer.js：`/` 走 `dist/`，`/audio /audio-cache /board-result /deliverable /handoff /pic` 走 `public/` | 同 dispatchApi 分发表 | 无数据库；运行时数据全在 public/ 目录 |
| Vercel | dist/ 静态 | api/ 5 个 thin wrapper → 复用 server/ handler | vercel.json：recognition 120s（含 doc/**）、agent-b-v2 180s、check 180s（含 doc/**）、apply 30s；cleanup.js 无条目（平台自动探测 + 前端实调） |

**API 路由清单**（productionServer.js dispatchApi 实态）：`/api/health`、`/api/recognition/problem`、`/api/agent-b-v2/generate`、`/api/check-agent/check`、`/api/check-agent/apply`、`/api/cleanup`、`/api/handoff(/list)`、`/api/knowledge/*`、`/api/deliverable*`、`/api/tts`、`/api/screenshot`。

### 5.3 环境变量（以代码实态为准）

加载语义（`server/loadDotEnv.js`）：`.env` 幂等加载（已存在键不覆盖）→ 平台注入 env > .env 文件 > 内置默认；dev 由 vite `loadEnv` 桥回写 process.env 并 `define` 注入前端 `import.meta.env.AI_API_*`。

| 变量 | 用途 | 缺省行为 |
|---|---|---|
| `PORT` / `HOST` | 生产监听端口/地址 | 3000 / 0.0.0.0 |
| `AI_API_ENDPOINT` / `AI_API_MODEL` / `AI_CHECK_MODEL` / `AI_API_KEY` | 上游 LLM 预设（编译期注入前端） | 可全空——**Agent A/B/C 的凭据由用户在前端「Agent 配置」面板运行时填写（localStorage），不是 env、不要求启动就有** |
| `AI_API_KEYS`（逗号分隔多 key） | 代理层轮询 | 单 key 直用；多 key 轮询 + 429 退避（`server/http.js` requestChatCompletion：至少重试 2 次、每 key 至少轮一次、上限 4 次） |
| `UPSTREAM_HOSTS` | endpoint 域名白名单（逗号分隔） | 空 = 不限制 |
| `CORS_ORIGINS` | CORS 白名单 | 空 = 不加 CORS 头 |
| `FISH_AUDIO_API_KEY(S)` / `FISH_AUDIO_MODEL` / `FISH_AUDIO_REFERENCE_ID` / `FISH_AUDIO_API_BASE_URL` | TTS（/api/tts，Fish Audio） | 内置默认 key 与模型存在，可全省略 |

### 5.4 超时链（第一步卡死防线，实测代码）

识别是全链最重的多模态调用：**服务端单次 110s + `retryOnAbort:false`**（超时快速失败，不重试——旧 60s×2 次重试会撞穿 Vercel 120s maxDuration 被平台击杀）；**客户端 130s AbortController** + 友好失败文案；**上传前压缩** `compressImageToDataUrl`（长边≤1600px / JPEG 0.85，原图 4~10MB → 200~600KB，失败自动回退原图）。其余调用默认 300s / `retryOnAbort:true`（http.js）。

### 5.5 Docker（Dockerfile 两阶段，实测）

```dockerfile
# Stage 1 build：node:22-bookworm-slim，npm ci --include=dev
#   COPY：package*.json → index.html board-preview.html vite.config.js
#         → server/ src/ doc/ public/ scripts/（★ Task 57：build 前置依赖，缺则构建必炸）
#         → row-player.html（★ 显式 COPY 三胞胎真源 = 构建确定性姿势）
#   RUN npm run build
# Stage 2 runtime：node:22-bookworm-slim，npm ci --omit=dev
#   COPY --from=build：dist server src doc public（server/ 运行时真吃 src/ 与 doc/，不能只带 dist）
#   mkdir -p public/{audio,audio-cache,board-result,deliverable,handoff,pic} && USER node
#   HEALTHCHECK: fetch /（注意打的是根路径 200，不是 /api/health）
#   CMD ["node", "server/productionServer.js"]
```

```bash
docker compose up -d --build   # docker-compose.yml：3000:3000，named volume app-data:/app/public（运行时数据持久化）
```

Zeabur 部署同 Dockerfile；`PORT` 由平台运行时注入。

### 5.6 运行时数据目录（public/，都是活档别乱删）

| 目录 | 内容 | 指针 |
|---|---|---|
| `public/handoff/` | Step1→Step2 交接档 `handoff-*.json` | `current.json` |
| `public/board-result/` | B 生成结果存档 | — |
| `public/deliverable/` | 交付物 JSON + companion HTML + `current.html` | `current.json` |
| `public/audio-cache/` | TTS 音频缓存 | — |
| `public/pic/` | Step1 截图底图 | — |

运维工具：`scripts/backfillDeliverableAudio.mjs`（历史交付档补音频，头注自带 `--check` 自检模式；不在 package.json alias，独立运行）。

### 5.7 健康与排障

- `GET /api/health` → `{ok:true, status:'healthy', service:...}`（dev 与生产两套实现，口径一致）。
- 播放器内置可观测：控制台 warn 家族（音频降级 / 动作白名单外工具 / 锚点找不到 / 缺 region 兜底 / 录制失败原因 / 字体未生效明示）。
- ⚠ agent-browser / headless 排障注意：**控制台对 uncaught 异常有盲区**——「零报错」结论要打折，关键路径看自包 try/catch 的 warn。
- 凭据纪律：GitHub token 一律一次性 URL 推送、用完即毁、不落盘不进 remote（历史已多次催销毁聊天露脸 token）。

---

## 6. 测试与哨兵体系（30 套件）

`node scripts/run-all-tests.mjs` 一键全跑（任一失败退非零；execSync 单套件 15s 超时）。**离线 30 套件**（实态注册表）：

| # | 套件 | 守什么 |
|---|---|---|
| 1 | superFilter v2（96 用例） | 12 步流水线行为 + 镜像标识符在场 |
| 2 | parseLLMJson（16） | LLM JSON 四级兜底解析（fence/尾补/brace/rows） |
| 3–4 | timing fix / computeRowGroup | 估算公式回归 + 排期不变量 |
| 5 | skillViolations（12） | 5 技能红线校验器 |
| 6 | boardToolCatalog（8） | 动作白名单降级隔离 |
| 7–8 | knowledge contract / apply | 知识关联链契约 / 先确认再落盘 |
| 9 | env config（17） | Task 18 env 统一化 |
| 10 | board background（6） | 截图底图链 |
| 11–13 | cleanup keep / b cache / check ratio | 误删修复 / 缓存键盲区（prompt 摘要 + 九键指纹进键）/ 配比盲视 |
| 14 | deliverable doctype（10） | 固化单页病头防御 |
| 15 | speech regen button（6） | 按钮消失修复 |
| 16 | visual timeline（10） | 时间轴滚动 + 动作 |
| 17 | row-player stage flow（34） | 同 stage 顺序排版端到端（mock MCTX 沙箱跑真 compile） |
| 18–20 | step1 recognition robustness / canvas text / content region | 第一步卡死防线 / 回填 / 贴图布局 |
| 21 | refine json safe（20） | 优化确认 json 报错 |
| 22 | validate_contract | 交付端三条非协商（§4.3） |
| 23 | action whitelist sync（54） | 白名单真源同步哨兵 |
| 24 | proxy self check | 动作白名单运行时自检（server/proxySelfCheck.js） |
| 25 | playback speed sync（79） | 提速归一（播放器提取版对拍，不再手抄第三份公式） |
| 26 | font single source（61） | 字体宪法 v2+v2.1 切换器归一（栈值 noWs 比对） |
| 27 | audio url lifecycle（16） | 哑巴根因链 |
| 28 | repo hygiene（30） | 版本/镜像/死档不复活/宪法内容 |
| 29 | board layout single source（21） | 四区坐标单一真源（§3.1） |
| 30 | player mirror parity（28 组断言） | ★ 播放器镜像**行为对拍**：A 组=superFilter §5c 整节语料对拍；B 组=时序族 B0–B8（isRuleLine/readBrace/visualLen/actionDurationMs/isAudioSrc/estSpeech/findRange）+ B14 一笔一笔揭示节奏块（确定性/单调/揭满/rough 回退/非线性）；C 组=boardPlan 五处值锁（真源 import 派生比对）；D 组=字体栈/PRINT_FONT 宪法 + CDN 六链三文件一致。run-all-tests 标签写「22 用例」系陈旧口径，以文件实态为准 |

**体系设计哲学**：从「值级锁」（md5/字面量断言）进化到「行为对拍」（同一语料双跑真源与播放器提取代码，分叉即红）——「改那边必须同步这边」的祈祷式约定已退役。哨兵先行：**新口径必须配新断言**（AGENTS.md 收尾清单铁律）。

另有网络型 `test:refine-degrade`（真实上游降级链路，外网依赖，**故意不入主套件**）。

---

## 7. 已知边界与坑记

> 来源：worklog Task 60–69 全程坑档 + 68/69 两轮试运行评审 + 68-close「1.0 冻结方针」（观感类全不动，真 bug 已修）。接手人按此表避坑。

### 7.1 字体与素材

1. **canvas 不触发 @font-face 下载**——必须 `document.fonts.load(族, 真实语料)`（无 text 参数=不加载），完成后 FONT_VER++ 整批作废行图缓存并重排。换数据不换字体也要重预热（新语料可能缺分片）。
2. **手写体 CDN（fontsapi.zeoseven.com）在部分环境不可达**——应用优雅降级到系统楷体，`reportFontState` 页面明示；离线场景内嵌素材兜底链全部可用。
3. **CDN 素材 crossOrigin 顺序**：必须先 `img.crossOrigin='anonymous'` 再赋 `src`；漏了 = 画布污染 → 录制 SecurityError（try/catch 兜住降级，但录制不可用）。`setProblemImage`（题目图）暂未设 crossOrigin——「显示优先 vs 可录优先」权衡挂账，外域无 ACAO 的题图录制时降级。

### 7.2 播放器行为语义（不是 bug，别顺手修）

4. **暂停→恢复 = 整行重播**（行 = 教学原子单元；68-close 夏夏销案「ok 的，没事」）。
5. **Tuner 区框拖动后 stage 标签不跟随**（标签是独立 handle 设计；用户可用 lite player 贴纸拖拽兜需求，夏夏销案）。
6. **估算域 vs 播放域刻意分叉**（§3.7 表；AGENTS.md「刻意平行实现」清单）：App 预览 roughjs 笔触 vs 播放器自绘；App 题目层 KaTeX vs 播放器纯文本；readBrace 嵌套差异；压窗分工。当 bug 修 = 引入真回归。
7. **行配速 spJ ±10% 与每字时长 ±18% 是拍板保留的人味**（观感三问裁决：不拔；要机械匀速须单独拍板）。

### 7.3 数据边界（垃圾进垃圾出哲学，挂账在案）

8. `dragOffset` 走**数据路**（导入 JSON 手填巨值）无 clamp——行整体离画布隐形且 Tuner 贴纸不可寻回（仅剩「恢复预设」）；拖拽指针路有 clamp。手写档自担。
9. 超长无换行点 CJK 单行：字号 14px 触底后仍可越出画布（60–80 字真实区间正常缩字号；130 字病态档溢出 61%）。
10. 畸形 `\frac{1}{`（缺右花括号）吞尾：readBrace 吃到行尾、后续文字静默并入分母。生成环产物会过 contract 不踩；手写 JSON 才会。
11. `rows: []` 空档导入静默死（URL 路有守卫，导入路无 rows.length 门）。

### 7.4 工程纪律红线

12. **三胞胎 mtime 双向反哺**：直改 public/row-player.html 再跑 npm test 会静默反哺进根真源。**唯一正确姿势 = 只改根版 + sync:twin**。无 pre-commit hook、无 CI（纪律守护）。
13. **同 HTML 连发多 Edit 会静默漏改**（约两个漏一个；skills 坑表记档）——一次一改，每改一处 grep 校验。
14. **`drawImage` 5 参数 = 整图缩放**：取子区域必须 9 参数（历史 bug：板书缩成微缩图堆左上角，行内注释记档）。
15. **同 t 连帧渲染逐字节一致 / seek=play 像素级一致**是播放器不变量（哨兵 + A/B 像素对拍锁）——任何揭示/笔触改动跑 `make-jitter-range.mjs` 靶场双版对拍。
16. **agent-browser 时间敏感编排必须 eval 内联 setTimeout**（CLI 往返 0.8~2.5s 会污染时序，产生「冻结假象」——trial2 踩 3 次方悟）；「DOM 存在 ≠ 可见」（display:none 里 querySelector 照样命中）；uncaught 异常是 console/errors 双盲区。
17. **无手势环境（iframe / API 嵌入）`audioEl.play()` NotAllowedError 被静默吞** → 钟冻 + 按钮⏸ + 零提示僵尸态。真实 UI 点按钮带手势不踩；嵌入式消费方须自带手势引导。
18. **B 缓存 2h TTL**（夏夏拍板）：改提示词后旧缓存自动失效（promptVersionDigest 进键）；布局修订只动非 question 区也能失效（九键指纹）。
19. duration 口径：**交付物与 serialize 全链统一秒**；播放器 mp3/audioDurationMs 是毫秒、duration 是秒——三层时长优先级见 §3.4.2。

### 7.5 遗留挂账（1.0 冻结，观感类全不动）

- Tuner 松手文案「正在调整」小疵；装载期 img 迟到 idle 钟痕（HUD 面上 0.0x s，肉眼不可见）；
- 字体门双门（warm + fonts.ready）存在 1–2 次冗余 compile（10ms 级一次性，被哨兵锚死，动哨兵不值）；
- `rowImage` 缓存键缺 `o.seed` 且 x/y `|0` 截断（实践恒整数变化，休眠洞）；
- GitHub dependabot 6 漏洞（1 high）专项待办；
- README 个别口径张力（「书写抖动已全拔」与节奏人味 ±18% 并存——准确口径见 §3.5 末）。

---

## 8. 附录：单一真源速查表

> 「契约真源 = 代码，非文档」。接手人改任何数值前先对表（AGENTS.md 冲突仲裁原则：用户钦定规格 > 播放端事实 > 生成侧白名单）。

| 域 | 真源 | 镜像/锁 |
|---|---|---|
| 画布尺寸 / 字号 / 字体族 / 颜色 / 行高 | `src/services/stepHandoff.js`（字体宪法 v2.1） | row-player 字面量镜像 + `test-font-single-source`（H2/D 组） |
| 四区坐标 / 默认布局 | `src/utils/boardLayout.js`（BOARD_LAYOUT + DEFAULT_BOARD_PLAN） | `test-board-layout-single-source`（21 断言） |
| LLM JSON 解析 | `src/lib/parseLLMJson.js` | `test-parseLLMJson` |
| B 五字段归一 | `src/agent-b-v2/contract.js` | `test-action-whitelist-sync` |
| 时间估算 / 排期公式 | `src/agent-b-v2/timing.js`（估算域） | row-player compile 内嵌版行为对拍（mirror-parity B 组 + playback-sync） |
| 动作白名单 | `src/board-tools/boardToolCatalog.js`（1.5.0，动作 1.0 三动作） | validate_contract + proxySelfCheck |
| 动作锚定 | `src/board-tools/boardAnchorCore.js`（ESM 真源） | row-player 内嵌版字节级；mirror-parity B9–B13 |
| 板书文本净化 | `src/utils/superFilter.js`（12 步） | row-player §5c 镜像；mirror-parity A 组 |
| 音频地址白名单 | `src/agent-b-v2/timing.js isAudioSrc`（+播放器内嵌同正则） | mirror-parity B8 |
| 播放器本体 | `row-player.html`（根，人肉维护唯一真身） | 三胞胎 sync + check:twin + vite guardian |
| 交付物资产路径 | `src/lib/deliverableAssetPaths.js`（前后端共享） | `test-audio-url-lifecycle` |
| 播放器行为基线 | git commit message（每轮工作记录唯一真源） | 本地 worklog.md（不入库，会话级） |
| 工作记录 | git 历史（背景→执行→验证→接力棒） | 禁止再建平行状态档案（AGENTS.md） |

---

*文档版本：v1.0 · 2026-10-23 · 技术说明书撰写官（Task 70-a）*
*求证方式：全量 worklog（Task 1–69）+ 逐文件读码 + 实机 curl（dev server 3000 端口健康/路由验证）+ 三胞胎 MD5 实测（5e1c1751×3）+ 交付物 current.json 字段实测。*
