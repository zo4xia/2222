# 上下文精选摘要（续接会话专用 · 索引性质，非第二真相）

> 生成：2026-09-15（code-explorer sub 只读勘探 + 主 agent 落盘）
> 用法：新会话**先读本文件**，需要细节再按行号去源文件取。勿整体粘贴进上下文。
> 铁律：运行时代码（src/ + server/）> 文档 > 记忆。本文件可能过期，与代码冲突以代码为准。

---

## 0. 先读我：8 条纠错 / 已过期（2026-09-15 ayuan-aide 逐条复核：**8/8 仍成立**，无一被推翻；第 1 条已二次取证：数据侧 `startCoord`(DEMO:155)，代码侧 `:583 parseCoord(b.coord)` / `:611 parseCoord(task.coord)`，恒回落 `{x:8,y:44}`）

1. **DEMO 播放器代码读的不是 `startCoord`**：数据是 `startCoord`（`白板播放器-平行四边形DEMO.html:155/217/294/329`），代码却读 `b.coord` / `task.coord`（:583/611），恒回落默认 `{x:8,y:44}`。→ 旧结论「DEMO 要 board.startCoord」只对 JSON 成立，**对代码路径不成立**。
2. **「audioUrl 被 contract 丢弃」部分过期**：`AgentBDirect.vue:1223` 导出仍写 `audioUrl`，`deliverableStoreHandler.js:155` 用 `...row` 原样保留；**只有 Check 应用路径重走 `contract.js:131-137` 归一化才丢**。
3. **板书字号定论未落地**：裁决是「由 Agent B 在 1.2~1.5 倍区间定」（`truth/00-夏夏原话汇总.md:165-167`），但 `stepHandoff.js:16` 仍 `BOARD_FONT_SIZE=35` 且 prompt 未开放区间 → 代码为准。
4. **行高 38px/32px 口径已作废**：`stepHandoff.js:24-25` 已改「自然换行 + 渲染层抖动」，`LINE_HEIGHT_FORMULA` 不再含 38px。
5. **MEMORY.md 自相矛盾**：`:15` 写「dev 默认 3000/3001」，`:77` 写「3000 属另一个项目」→ **以后者为准**。
6. **L2 缺口精确位置**：`deliverableStoreHandler.js:150-160` 只补 `estimatedDurationMs`/`exclusiveExecutionPlan`/`timingPolicy`，**不补 `startCoord`、不做 `plan[]`/`totalDurationMs` 命名映射**。
7. **checkAgentHandler 缺 import 已确认**：`:227-229` 用 `path.resolve`/`fs.existsSync`/`fs.readFileSync`，import 仅 11/13/20/42 四处，缺 `node:fs`/`node:path`；异常被 `:241-243` 空 catch 吞。
8. **lecture 两 bug 复核为真**：`:543` 每次切 row 清空 `.board-content`；`:305` `scale()` 未设 `transform-origin: top left`（:33 是 center、:87 是 left center，均非 board）；`:207-211` 仍外链 `i.ibb.co`（违反禁境外资源）。

---

## 1. 定位与能力边界
- Vue3 + Vite + Node server 的「小学数学 AI 讲题板书生成」工具。
- **能跑**：Step1 贴题识别 → handoff 落盘 → Agent B 五字段生成 → Check Agent 校验 → 导出 JSON/HTML/口播 MD → 每行 TTS → `bun run start` 生产服务。
- **跑不了**：渲染层自然排版（无坐标时落座/防重叠）**未实现**；整篇连播播放器没有；`vite build` 必挂（缺 `lite-player.html` 入口）。
- **小史官制度已接入本机**（2026-09-15）：skill `C:\Users\zo4xi\.codebuddy\skills\xiaxia-historian\`（SKILL.md + agents/openai.yaml）；身份根 `E:\zeta-family\agents\historian\identity.md`（阿圆=左脑施工，小史官=右脑守史，互补非抢活）；影子 agent `C:\Users\zo4xi\.codebuddy\agents\ayuan-aide.md`（唯一可写：本 DIGEST + 当日 memory + pearls，禁碰运行代码）。
- ⚠️ 待清：`C:\Users\zo4xi\.codebuddy\agents\context-digest-writer.md` 与 ayuan-aide 抢同一文件（两个写手一个 owner），**待夏夏批准后删**。

## 2. 主链路
`src/main.js` → `src/App.vue` → `src/agent-b-v2/DirectFlow.vue` → `src/components/Step1Entry.vue` → `src/agent-b-v2/AgentBDirect.vue` → `src/agent-b-v2/service.js:28` → `POST /api/agent-b-v2/generate` → `server/agentBV2Handler.js`；导出走 `server/deliverableStoreHandler.js`（写入处 :142-189）。

## 3. 三层契约（最新架构定论）
- **L1 模型输出（已实现）**：rows 四字段 `stage/speech/board/actionSpec`，`board = {content, startDelay}`，**不产坐标、不产时长**。真源 `contract.js:5-9`（白名单）+ `:43-64`（`normalizeBoard` 剥离坐标）。
- **L2 流水线加工（部分实现）**：已补 `estimatedDurationMs`/`exclusiveExecutionPlan`（`deliverableStoreHandler.js:150-160`）；**未补** `board.startCoord`、`plan[]`/`totalDurationMs` 命名映射。
- **L3 对外交付（缺消费者）**：外部播放器要 `startCoord` + `audioUrl` + `estimatedDurationMs`；当前产物无 `startCoord`（09-14 剥离后）。
- **播放层终局（2026-09-15 夏夏拍板）：音频驱动 row-by-row** —— 每行 `audio.play()` → `startDelay` 触板书 → `ended` 驱动下一行，废弃全局时钟。已铺一半：`timing.js:79-84` 时长真相源优先实测 `row.audioDurationMs`（无则 160cpm 兜底）；`AgentBDirect.vue:598-621` `readAudioDuration()` 走 `loadedmetadata` 回填并重算时间线。**缺口**：全仓无整篇连播编排器（grep `playAll|连播|播放全部|autoPlay` 仅 `RealBoardPreview.vue` 一个 autoPlay prop）。三个边界：无音频降级 / 板书长于音频需自适应 / 断点续播（顺带解决 R5）。

## 4. 唯一真源参数
`src/services/stepHandoff.js:12-19`：画布 1726×980、`QUESTION_FONT_SIZE=30`、`QUESTION_LINE_HEIGHT=1.65`、`BOARD_FONT_SIZE=35`、`BOARD_FONT_RATIO_TEXT`、`LINE_HEIGHT_RULE`、`LINE_HEIGHT_FORMULA`、`buildCanvasParams()`。
- 9 个消费点已改 import（`server/handoffStoreHandler.js`、`agentBV2Handler.js`、`canvasCoords.js`、`boardLayout.js`、`speechMarkdown.js`、`prompt.js`、`contract.js`、`AgentBDirect.vue`、`BoardContentLayer.vue`）。
- 规则：需要这些值一律 import，出现字面值 = bug；CSS 不能 import JS，保留字面值合理。

## 5. 领地红线（`truth/00-TRUTH-BASE.md:37-76`）
- A Agent B：五字段、**板书不输出起手坐标**、不算时长只给 `startDelay`、单手串行 `order` 递增。
- B Contract：容错吸附 + 兜底，脏数据不流下游（坐标算法已下线）。
- C 工具：4 个白名单工具；`rough-notation` 必须 `target.exactText` 锚定真文；`rough-line/arrow` 走 region 内坐标、受 region 限位。
- D 口播：分数念分母分之分子；x→艾克斯、行→航数；严禁 LaTeX/Markdown 进 TTS。
- E 渲染：手稿感/微斜/抖动/速度扰动**全归渲染层**，禁塞给模型算。
- F Check：松门槛，不卡死解法多样性。

## 6. 防复发坑清单
1. **多套真相并存**（字号/行高/坐标/字体曾各有多处控制）→ 一律收敛为真源常量。
2. **端口 3000 是另一个项目** `G:\vedio\991-main-optimized-20260913`；本仓只能用 3001/3200/5199。
3. **`skills/demo.html` 及 skills 下 html 都是测试页，不是真相**（用户原话），其 rem 体系与正式代码不同。
4. **`vite build` 必挂**（`vite.config.js:46` 入口 `lite-player.html` 不存在）→ 开发期只跑 dev，不 build。
5. **缺失模板**：`handdraw-player.html` 不存在 → 「🎬 教学微课演播」按钮 404（用户称是自己删的，非缺陷）。
6. **`sanitizeRowLayout` 硬限位曾把多行压到同一 Y 致粘连** → 该算法已下线，勿复活。
7. **禁境外资源**（Google Fonts/jsdelivr/unpkg/ImgBB）；JS 库本地化 `public/`；唯一例外 `fontsapi.zeoseven.com` 字体源。

## 7. 未完成与断点
- 渲染层自然排版（无坐标落座/防重叠）——最大缺口。
- `board.startCoord` 缺失 → 外部三份播放器读不到坐标。
- `audioUrl` 在 Check 应用路径被 contract 丢弃（见纠错 2）。
- ~~R2 draw 工具空壳~~ → **2026-09-15 接线完成，但运行时为假**：`drawIntentTool.js` 新增 `prepareDrawIntentAction`（rough.js 真实绘制）+ `boardToolCatalog.js:87-91` 空壳换真 plan（lint 0 错、node 入队通过）；**但 `RealBoardPreview.vue:42` 的 resolveCanvas 返回 SVG，撞 `instanceof HTMLElement` 守卫 → 抛错被 :92 吞 → 静默 noop，页面上不画**（P0，同影响既有 rough-line/arrow）。修法待放行。R4 字体范围断言分裂 / R5 调度器无断点续播——用户裁定「有用、不可删除」，待改造（R5 顺带由音频驱动 row-by-row 解决）。
- `checkAgentHandler.js` 缺 fs/path import（见纠错 7）。
- R1 四区锚点缺浏览器级人工验收。

## 8. CONTINUITY.md 险情（已解除 · 2026-09-15 复核）
~~工作区 0 字节~~ → **已恢复**：`git checkout -- CONTINUITY.md`，现 **22101 字节**（`Get-Item` 实测）。此前误判为 0 字节；口径引用点（:240/321/352）现已可读。恢复命令留档见上。

## 9. 外部资产
- `D:\video-dev-restored\src.zip`（**实测 5985014 字节**，已解压 `%TEMP%\video-dev-src`，实测 228 文件，顶层 `src/`+`scripts/`）可移植纯函数：
  ① `src/modules/boardSticker/renderBoardTextStickerImage.ts` 确定性三路抖动（字号±4.5%/基线±5%/字距±5%）+ 自动换行 + **返回真实 width/height（可作排版高度累加器）**
  ② `boardReveal/getBoardRevealProgress.ts` smoothstep + drawSpeed(0.1~4)
  ③ `boardReveal/normalizeBoardRevealWindow.ts` 揭示窗口∩显示窗口 + 边界钳制
  ④ `boardSticker/boardStickerGeometry.ts` xPercent/yPercent/widthPercent/fontSize/drawSpeed 归一
  ⚠️ 解压在 `%TEMP%\video-dev-src`，**临时目录可能被系统清理**，长期需入库本仓（见第 10 节待办 5）。
 另有 `protocols/voiceTiming.ts`（`VoiceTimingSlice{rowId,audioUrl,startMs,endMs,durationMs}`=音频驱动 row-by-row 的数据形状）、`audioPlayback/useVoiceTrackAudio.ts`（播放时钟锚点 `performance.now()` 对齐音频，非估算）、27 个 `scripts/check-*.mjs` 验收脚本。
- 三份交稿（工作区根）：
  * `白板播放器-平行四边形DEMO.html` — 长：seed 确定性可 seek、贴纸图+斜梯形遮罩揭示、切口羽化、手绘几何、LRU/DPR2~3、LaTeX→Unicode。短：估算时钟非音频驱动、揭示线性匀速、`size=38` 写死、坐标写死。**注**：读 `task.coord` 不是 `startCoord`（纠错 1）。
  * `handwrite-compare潦草感优秀.html` — 长：**feTurbulence 笔触渗透（baseFrequency .022, numOctaves 3）**「手写感来自笔触，不是把字扭歪」+ 7 路抖动参数（B: ±1.5°/±10%/±1px/±1°；D: ±3°/±25%/±2px/±2.5°）。短：`Math.random()` 不幂等。
  * `lecture-动作不行，画布尺寸歪，写完板书没了。.html` — 长：逐字 `.char.revealed` opacity 揭示、`.frac` 真分数排版、时长自适应。短：三个 bug（见纠错 8）。

## 10. 待夏夏拍板
1. 板书字号终值：35px 还是严格 1.2~1.5 倍（36px 起）—— 你已承认笔误，值未定。
2. `meta.json` 12 条是否落码（3 条已过时、2 条属渲染层）。
3. 渲染层自然排版方案：是否按「每区 1 个起手坐标 + 代码流式累加」实施。
4. `handdraw-player.html`/`lite-player.html`：清引用 vs 补文件。
5. ~~`CONTINUITY.md` 是否从 git 恢复~~ → **已恢复（22101 字节），此项关闭**。改为：**`video-dev-src` 是否入库本仓**（现住 `%TEMP%`，会被清理）。
6. 合并版播放器：compare 抖动档位选 B / C / D 哪一档。
7. `context-digest-writer.md` 是否删除（与 ayuan-aide 抢 owner）。
