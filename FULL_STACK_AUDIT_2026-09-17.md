# 全栈审计报告（军工级）· 2026-09-17

> 审计根：`clean-package/`（上层仓库为脏历史区，不引用）
> 审计性质：**只读取证，未修改任何业务代码**
> 方法：四路并行只读 sub（前端 / 交付链路 / 安全依赖 / 服务端部署）+ 负责人逐条交叉验证
> 评级口径：**P0** 阻断交付或安全外泄 · **P1** 主链路错值或线上不可用 · **P2** 真源分裂/契约不一致 · **P3** 卫生与体验 · **P4** 待产品拍板

---

## 0. 审计结论摘要

| 项 | 结论 |
|---|---|
| 主链路（识别 → 生成 → 质检 → 交付打包 → 播放） | **已跑通**，有真实产物（`public/deliverable/current.html` 141 KB / `current.json` 34 KB） |
| 代码质量 | 主链函数完整、容错链（音频四级时长回退、异步组件重试、Check 回滚）齐备 |
| 是否达到「商业交付」门槛 | ❌ **不达到**。存在 **3 类 P0**：产物音频不全、交付契约不自洽、生产服务器吞吐风险（原第 4 类「硬编码密钥」经用户拍板为**甲方预设演示账号，保留**，已作废，见 AUD-P0-01 更正） |
| 验证体系 | ❌ **验证真空**：0 单测 / 0 e2e / 0 CI workflow / CodeQL 包未接线 / 唯一类测试脚本未接 npm script 且具破坏性 |
| 缺陷总数 | **P0 ×3 · P1 ×10 · P2 ×17 · P3 ×13（含已作废的密钥项降级） · P4 ×5**（合计 48 条，均有文件行号证据） |

**负责人判定：当前可对外演示「技术能力」，不可对外签署商业交付。P0 清零 + 五验通过后方可发版。**

---

## 1. 审计范围与取证方式

| 面 | 覆盖 | 取证手段 |
|---|---|---|
| 服务端/部署 | `server/*` 19 个、`api/**` 6 个、`vercel.json`、`vite.config.js`、`productionServer.js` | 负责人亲验 + sub |
| 交付链路 | `row-player.html`、`renderDeliverableHtml.js`、`deliverableStoreHandler.js`、`serializeDeliverableState.js`、`public/deliverable/**` | B 路 + 负责人亲验 |
| 前端 | `src/**`、`style.css`、根 3 个 HTML | C 路（eslint JSON + 全量 grep） |
| 安全/依赖/构建 | 全仓密钥扫描、lock 比对、`scripts/**`、`public/**` 体积实测 | D 路（PowerShell 实测） |

**负责人亲自交叉验证的 8 条关键结论（不采信单一来源）：**

| # | 结论 | 验证结果 |
|---|---|---|
| V1 | 硬编码密钥 5 处 | ✅ 证真：`server/fishAudioHandler.js:13-14`（sk-fish×2）、`src/lib/userApiConfig.js:8`、`agentBApiConfig.js:5`、`checkAgentApiConfig.js:5`（同一把 sk-Wy5cJ9…） |
| V2 | 密钥已进构建产物 | ✅ 证真：`dist/assets/main-C-tGZArW.js` 命中 `sk-Wy5cJ9` |
| V3 | 生产服务器整文件吞吐 | ✅ 证真：`productionServer.js:98 res.end(readFileSync(filePath))`、`:96 Cache-Control: no-cache`，无流式/无 ETag/无 gzip |
| V4 | `api/**` 与 `server/**` 关系 | ✅ 证真：薄转发（`api/agent-b-v2/generate.js` 全文 5 行，仅 import handler 后调用），**无重复实现** |
| V5 | Vercel 部署缺口 | ✅ 证真：`vercel.json` 仅 5 个 function；`server` 路由 11 类（recognition/generate/check×3/cleanup/handoff/knowledge/deliverable/tts/screenshot）→ **6 类线上 404** |
| V6 | 抬笔间隔真源分裂 | ✅ 证真：`boardToolTiming.js:1 = 1000` vs `timing.js:7 = 600`；`handActionScheduler.js:8-9` 对 <1000 抛错 |
| V7 | 服务端丢弃 `startCoord` | ✅ 证真：`deliverableStoreHandler.js:167-173` 重建 board 只含 `content/lines/(triggerKeyword|startDelay)` |
| V8 | 产物音频不全 | ✅ 证真（node 实测 current.json）：9 行中 **row4/5/6（解答段）audioUrl 为空、audioDurationMs=null**，未生成音频时长 61.6s / 总 114s = **54%** |

`registerAntd.js` 注册清单亲验：确无 `Modal / Badge / Dropdown / Menu / Spin / Result` → C 路 P1 证真。

---

## 2. P0 · 阻断交付（必须清零）

### AUD-P0-01 ~~硬编码密钥 5 处，且已随构建产物外泄~~ → 【用户拍板作废 · 2026-09-17】
> **更正**：用户明确「说了很多次，甲方预设演示账号，不许删」。这 5 处硬编码是**产品决策（演示账号）**，不是缺陷。
> **撤销原处置建议**（吊销 / 改 env / 清 git 历史）。降级为 **P3 · 文档化**：仅在上述 5 处加一行注释标明「甲方预设演示账号，勿删」，并写入部署手册说明其用途与风险（第三方可共用额度）。**代码行为一律不动。**
- `server/fishAudioHandler.js:13-14`：`DEFAULT_API_KEYS` 明文两条 Fish Audio 生产密钥；`:34 getApiKeys()` `[...new Set([...envKeys, ...DEFAULT_API_KEYS])]` → **配了环境变量也关不掉**；`:35` 再兜底返回默认值。
- `src/lib/{userApiConfig.js:8, agentBApiConfig.js:5, checkAgentApiConfig.js:5}`：同一把 `sk-Wy5cJ9…` 写死为 `Object.freeze` 默认值，端点 `newapi.prorisehub.com` 亦写死。
- **升级项**：`dist/assets/main-C-tGZArW.js` 已含该密钥 → 一旦部署即对外公开（源码问题升级为泄漏事故）。
- 附带：`.chat/*.json`（0.713 MB，已被 `.gitignore` 忽略）内嵌含密钥的源码原文 → 二次泄漏面。
- **处置（需用户授权，未擅自动）**：① 立即吊销这 3 把密钥 ② 全部改读 `process.env`，无 env 时**报错而非兜底** ③ 清 git 历史（`git filter-repo`）④ 补 `.env.example`。
- 复现：`Select-String -Path server\fishAudioHandler.js,src\lib\*ApiConfig.js -Pattern 'sk-'`

### AUD-P0-02 交付产物音频不全，与「语音全程」卖点直接冲突 【交付完整性】
- 实测 9 行中 row4/5/6（**解答段，全片主体**）无音频，走无声虚拟时钟；未生成音频占 54%。
- 根因（待确认，属运行时链路）：TTS 仅逐行小喇叭手动触发，无批量生成入口；生成是否失败需查服务端日志。
- **商业后果**：客户拿到的交付页在核心解题段静音空跑，且 `specificationSummary`（`current.json:10`）仍宣称「语音全程」= 交付物与实际不符。
- **处置**：① 补批量 TTS 入口并在导出前校验「有 speech 必有音频」② 导出时若仍有缺音频行 → 明确标注「待生成」并禁止标记完成 ③ 修 `specificationSummary` 使其按实际统计。
- 复现：`node -e '...读 current.json 逐行打印 audioUrl/audioDurationMs...'`（见 §1 V8）

### AUD-P0-03 交付契约不自洽，盲测线（决策 #012）通不过 【契约】
- 零上下文 Agent 按 `deliverable.schema.json` 顶层 `required: [apiSpecVersion, projectCode, problemText, boardPlan, rows]` 校验 `current.json` → **直接失败**（其顶层只有 `projectCode/filename/htmlFilename/createdAt/deliverable`，真身在 `deliverable` 子对象里；而归档 JSON `deliverable-20260917-071449-686.json` 却是**扁平**结构，两种形状并存）。
- 行级 `mp3` 字段 **0 处**（schema:141 标「盲测优先第一取值槽」，API SPEC:141 标 ✔）；`board.startCoord` **0 处**。
- ~~契约自相矛盾（startCoord 部分）~~ → **已闭环（2026-09-17 用户拍板：降为「可选」）**：「区左上角 +2%/+4% 回退已能把四区排开，不带也能演」。口径已统一（决策 #016）。**仍阻断的是 `mp3` 缺失与顶层包裹结构**。
- 链路断点（V7 已证）：即使上游产出 `startCoord`，服务端也会抹掉；`src/lib/speechMarkdown.js:250-263 parseBoardField` 三个 return 均只含 `{content,lines}`，不透传 `startCoord/triggerKeyword` → API SPEC 声称的「已修」不成立。
- **处置（2026-09-17 更新）**：startCoord 分支**已拍板闭环**（降为可选，见决策 #016）。**剩余处置**：① 补 `mp3` 字段（未生成写 `""`）② 统一 `current.json` 顶层形状与归档一致（或明确「两种形状并存」并写进 schema）③ 补一份**通过 schema 校验的最小可播样例 JSON** 作为盲测基准。服务端透传（`deliverableStoreHandler.js:167-173`）因已降为可选，**不再作为阻断项**，转 P2 待办。

### AUD-P0-04 生产服务器整文件吞吐 + 无缓存策略（1h2g 演示机） 【性能 · 决策 #007 未修】
- `productionServer.js:98 res.end(readFileSync(filePath))`：每个请求整文件进内存，无流式、无 gzip、无 ETag；`:96 Cache-Control: no-cache` 强制每次回源。
- 叠加：`public/fonts/pingfang-qiaomu.ttf` 3.683 MB、`deliverable/*.html` 141~178 KB、音频 1.893 MB 共用同一条路径。
- **处置**：`createReadStream` + `Content-Length` + `Cache-Control: public, max-age` + ETag；字体/音频可加 gzip 预压缩。
- 缓解现状：模板已从 5.26 MB 瘦到 0.11 MB（决策 #008），**压力降一个数量级但未消除**。

---

## 3. P1 · 主链路错值 / 线上不可用

| 编号 | 位置 | 事实 | 影响 |
|---|---|---|---|
| AUD-P1-01 | `server/http.js:94-100` | `UPSTREAM_HOSTS` 未配置时 `allowedHosts.length===0`，`:98 if(allowedHosts.length && …)` 直接跳过校验 | **SSRF**：任意 endpoint（含内网）可被服务端代理 |
| AUD-P1-02 | `server/http.js:7-19` | 非白名单 origin 只「不发 ACAO 头」，不拒绝；`CORS_ORIGINS` 未配时合法前端也全跨域失败 | 生产静默半残 |
| AUD-P1-03 | `vite.config.js:31-40` | `host:0.0.0.0` + `allowedHosts:true`，dev/preview 均关闭 Host 校验 | DNS-rebinding / CSRF 面 |
| AUD-P1-04 | `vercel.json` | 仅 5 个 function；缺 tts / handoff / knowledge / deliverable / screenshot / cleanup（含 `api/cleanup.js`） | **线上 6 类接口 404**，Vercel 部署等同不可用 |
| AUD-P1-05 | `src/lib/registerAntd.js:46-88` | 未注册 Modal/Badge/Dropdown/Menu/MenuItem/Spin/Result，模板 7+ 处在用 | 经 `/agent-b-v2.html` 进入时弹窗、下拉、加载态解析失败 |
| AUD-P1-06 | `boardToolTiming.js:1`=1000 vs `timing.js:7`=600 | 抬笔间隔两份真源；`handActionScheduler.js:8-9` 对 <1000 **抛错** | 按 timing 排的 600ms 计划到运行时被判非法 |
| AUD-P1-07 | `AgentBDirect.vue:1046-1056` + `timing.js:75` | UI「语速」可调，`watch` 触发重算，但 `timing.js` 不接收语速参数（`options` 声明未用） | **语速控件无效**，预估用时变而时间轴不变 |
| AUD-P1-08 | 全仓 | 0 单测 / 0 e2e / **无 `.github` 目录**（CodeQL 包是未接线模板） | 回归不可检出，密钥无人拦 |
| AUD-P1-09 | `scripts/verifyDeliverableTruthSource.mjs` | 全仓唯一类测试，但**未接任何 npm script**，且会真实写盘后用 `rmSync` 删 `current.html`（`:171-175`），中途抛错则产物丢失 | 验证工具自身是风险源 |
| AUD-P1-10 | `BoardPreviewApp.vue:44`、`Step1Entry.vue:6` | 裸 `defineAsyncComponent`（无 errorComponent/onError），仅 `DirectFlow.vue` 有兜底 | 历史已出现 `ERR_CACHE_READ_FAILURE` → 白屏无自救 |

---

## 4. P2 · 真源分裂 / 契约不一致

**时长口径 4 套（同一行三处秒值不同）**
- `timing.js:4,85`（剥标点 + 标点停顿 700/500/1000ms，下限 1500）
- `AgentBDirect.vue:403-433 getRowRuntimeMs`（保留标点、无停顿、取整秒、语速可变）
- `BoardPreviewApp.vue:92-97 getRowRuntimeSec`（保留标点、1 位小数）
- `VisualTimeline.vue:171-181`（优先吃 `estimatedDurationMs`，兜底回本地算法）
- 连带：`serializeDeliverableState.js` 输出 `stats.totalDuration` 走语音口径、`rows[].estimatedDurationMs` 走含板书超时口径 → **同一 JSON 两个总时长不等**；`applyAgentBV2Timeline` 8 处调用中 5 处不传 `rowGapMs`；生成请求 `snapshot` 不含 `rowGapMs` → 改了行间隔不生效。

**交付链路**
- `renderDeliverableHtml.js:23` 浅拷贝 → `screenshotDataUrl` 只进 HTML 不进 JSON（图片题 JSON 归档无内嵌图）。
- `row-player.html:311-343 compile()` 不消费 `exclusiveExecutionPlan/estimatedDurationMs`，播放端按 400ms/字 + 动作定死 1200ms 重算 → 服务端精心算的互斥时序被丢弃。
- 产物结构双形状 + 双前缀僵尸文件 `deliverable-deliverable-1789584993949.*`（正则 `^deliverable-\d{8}-\d{6}-\d{3}$` 看不见 → 列表/索引/清理全失明）。

**文档过期（与代码事实冲突）**
- `deliverable.schema.json:105` 称「row-player 不渲染 image（已知 P0）」→ 实际 `:643-659` 已实现且产物实测内嵌截图。
- `DELIVERABLE_API_SPEC.md:84/197` 写音频路径 `/audio/*.mp3` → 实际 `/audio-cache/*.mp3`（`public/audio` 不存在）。
- `current.json:10 specificationSummary` 称「语音全程」→ 实测 54% 无音频（P0-02）。

**前端**
- 两份同名 `AGENT_B_V2_SYSTEM_PROMPT`（`prompt.js:8` 39 KB / `prompt-v3-draft.js:3` 18.8 KB，经 `skills/index.js:9-15` 同时注册）。
- `prompt.js:47,176,263` 硬编码「1726×980」三处，与同文件 `:38 ${CANVAS_SIZE}` 不一致。
- 缓存键 32 位 FNV-1a 且**不含提示词/契约版本** → 碰撞风险 + 改 prompt 后 24h 内仍命中旧结果。
- Check Agent 契约 `ALLOWED_FIELDS={speech,board,actionSpec}` vs UI 标签含 stage/board_timing/answer_error/structure → 这些变更会被静默过滤。
- 响应式：`BoardPreviewApp.vue` **0 条 @media**、`AgentBDirect.vue` 仅 1 条、`Step1Entry.vue` 1 条；固定栅格/无 wrap 点 11 处（`BoardPreviewApp.vue:1274/946/1335`、`AgentBDirect.vue:3419/4960` 等）。

**仓库卫生 / 暴露面**
- `clean-package/.gitignore` 全文仅 `.chat/` → **7.597 MB 运行时产物（120 文件）全部入库**，含用户原题文本与上传截图（`public/pic` 17 张），静态可匿名直取。
- `public/deliverable/DELIVERABLE_API_SPEC.md`（内部规范）、`current.json`（交付态）公开可下载。
- `public/snapdom.js` 158.5 KB 第三方源码，不在 package.json/lock → 影子依赖，无法被 `npm audit` 覆盖。
- 依赖全用 `^` 且 lock 已高于声明下限（vue 3.5.39→3.5.42、vite 8.1.1→8.3.0、eslint 10.8.1→10.10.0），无 CI 冻结机制。

---

## 5. P3 · 卫生与体验（节选，完整见 sub 清单）

- 死代码/孤儿导出 14 处：`ttsService.js`（0 引用）、`cleanupService.js`（0 引用，且 `AgentBDirect.vue:163-181` 手写 fetch 绕过 = 重复实现）、`deliverableService.js`/`knowledgeRefineService.js`（0 引用）、`canvasCoords.js` 4 个导出、`mathText.hasMathContent`、`boardLayout.layoutBoardRows`、`lectureRecorder.getStats/isRecording`、`check-agent/contract.js:27 parseCheckAgentResponse`（0 引用 → **防「静默删动作」回滚逻辑实际不生效**）。
- `src/composables/`、`src/assets/` 两个空目录。
- 三个根 HTML 各复制一份 31 行 fetch 补丁（非单一真源）；`agent-b-v2.html:40` 字体 link 缺 `onerror` 降级；标题仍写「七列表」。
- `row-player.html` 10 处字面值同步点（38×4 / 30×1 / 1726×980×5）**无任何自动校验**，真源改一处此处可能漏改。
- `row-player.html:1117` 引用的告警容器 `id="note"` 在模板中不存在 → 「手写字体未生效」告警永远静默。
- 视觉硬编码色值：`AgentBDirect.vue` 288 处（110 处与 `--qh-*` 等价）、`BoardPreviewApp.vue` 74/46、`VisualTimeline.vue` 65/24；阶段配色两份真源且全不相同。
- `scripts/writer.js` 与 `writer.cjs` 逐字节重复，且是**任意路径 base64 落盘工具**（无白名单）。
- 构建入口仅 `index.html` + `board-preview.html` → 5 个 HTML 从未被构建校验；`lint` 不覆盖 `.mjs/.cjs`。
- `public/fonts/pingfang-qiaomu.ttf` 3.683 MB 仍随 dist 分发（决策 #008 已改为 CDN）。

---

## 6. P4 · 待产品拍板（不私自实现）

1. `startCoord` 到底带不带（P0-03 的契约冲突核心）。
2. 16:9 口径 5 处（真源 1726×980 = 1.761 ≠ 1.778）如何统一表述。
3. 是否引入 vitest + GitHub Actions（P1-08 的唯一解）。
4. 主 CTA 是否移出「可选步骤」卡片；`canConfirm` 是否补题型/侧重校验。
5. 是否清理 git 历史中的明文密钥（涉及 `git filter-repo`，不可逆）。

---

## 7. 事实更正（推翻既有记录，以运行时为准）

| 既有记录 | 实测 | 处置 |
|---|---|---|
| 「运行时写 `public/` 共 6 处（含 knowledge、audio）」 | `public/knowledge` **不存在**，`public/audio` **不存在**（仅 handler 引用），实为 4 个有效目录 + `audio-cache` | 已在本文档更正，`PROJECT_STATE.md:60` 需同步更正 |
| 「开发期禁止 vite build（缺入口）」 | 缺入口属实，但 `dist/` 已存在（192 文件 / 10.873 MB，07:26）→ 规则曾被打破，dist 处于脏状态 | 记入风险 |
| 「端口 3000 属别的项目」 | `package.json:7,11`、`vite.config.js:33,38`、`productionServer.js:24` 全写死 3000，`dev-smoke.log` 实测在 3000 | **3000 是本仓端口** |

---

## 8. 审计过程声明（诚实记账）

- 本次审计 **未执行** `npm run build`、未跑网络请求、未修改任何业务文件；所有体积/数量为 PowerShell 实测。
- 未验证（需实机，不标为已完成）：① 交付页浏览器完整播放观感 ② 507 字体失败时回退族降级观感 ③ `DirectFlow` 重试按钮实机点击 ④ row4/5/6 无音频是合成失败还是从未发起 ⑤ 图片题长图无 `maxH` 是否会压住板书。
- A 路 sub（服务端/部署）未回传内容，该面结论由负责人亲自取证补齐（§1 V3/V4/V5）。
- 缺陷评级为审计判断，涉及产品取舍的已单列 P4，不代替用户决策。

---

## 9. 交付在即·交叉审计（0 置信，2026-09-17）

四路 sub（X1/X2/X3/X4）回传被截断，本节全部结论由**负责人一手实测**，每条附复现命令。

| 实测项 | 证据（命令/行号） | 判定 |
|---|---|---|
| 音频实体 | 9 行中 **6 行**文件真实存在共 789KB；行 4/5/6（stage 全「解答」）`audioUrl=EMPTY` | **P0** 静音 61.6s / 总 110.9s = **56%** |
| `mp3` 字段 | 9/9 MISSING，但 `row-player.html:1016` `pick(r,['mp3','audio','audioUrl','voice'])` 会取 `audioUrl` 兜住 | **P1**（契约字面不符，运行时不阻断；此前高估为 P0） |
| 音频路径形态 | `audioUrl` = `/audio-cache/xxx.mp3`（**服务端绝对路径**）；`row-player.html:1006` `isAudioSrc` 白名单 `^\.{0,2}\/` 判为合法 → 去加载 | **P1**：http 服务下 6 行有声；`file://` 双击 404 → `:916 onerror` 降级无声时钟，**不卡死但全程静音** |
| 「脱环境 0 条相对路径」 | `current.html` relReq=0、141KB、`inlineJson=true` | **假阴性，已推翻**：grep 只扫 `src="/href="`，音频地址在**内嵌 JSON 里**，扫不到。**不能据此判定脱环境可播** |
| 顶层形状 | current = `{projectCode,filename,htmlFilename,createdAt,deliverable}`（包裹）；归档 = 扁平，且**缺** `canvasParams`/`uiSettings`/`problemInfo` | **P1** 契约不自洽（消费者按哪种解析未定型） |
| Vercel 覆盖 | `api/` 6 个文件 vs `vercel.json` 5 项 → **仅 `api/cleanup.js` 未覆盖** | P2（此前记"多项缺失"为高估） |
| `productionServer.js:98` | `readFileSync` 整文件入内存 + `res.end`，无 Cache-Control/ETag/gzip/流式 | **P0**（1h2g 部署） |

### 交叉不符（自我更正）

1. 原记「3 行无音频（54%）」→ 准数：**3 行 / 56% 时长**，且**全部落在「解答」段**（题目/分析/总结段 100% 有声）。
2. 原记「脱环境三问通过（0 条相对路径）」→ **推翻**：音频地址不在 HTML 属性里，该判据无效；脱环境实为**画面完整 + 全程静音**。
3. 原记「mp3 缺失 = P0」→ 降级 **P1**：播放器有 `audioUrl` 兜底。

### Go / No-Go：**NO-GO**

阻断 4 条（前 3 条可改代码，第 4 条必须重跑生成）：

1. **重跑解答段 3 行 TTS**（行 4/5/6）—— 56% 时长静音，内容缺陷，**改代码救不了**。
2. **1 行**：`audioUrl` 前缀 `/` → `../`（`file://` 双击即命中 `public/audio-cache/`，`../` 仍过 `isAudioSrc` 白名单；http 下等价）。附交付说明：音频目录需随包分发。
3. **1 行**：补 `mp3` 字段（未生成写 `""`）。
4. **1 行**：统一顶层形状（current 扁平化 或 归档加 `deliverable` 包裹，二选一）。

> 未采信任何二手结论；本节每条可一条命令复现。
