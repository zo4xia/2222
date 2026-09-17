# 重要决策记录 (DECISIONS.md)

## 2026-09-17 决策 #001：执行五阶段工业级重构工作流
- **决策内容**：针对 clean-package 全量源码，严格执行五阶段标准化重构工作流（勘探准备 -> 深度诊断 -> 骨架施工 -> 管线铺设 -> 精装验收），每阶段产出完整留痕文件并同步四份核心记录。
- **背景**：项目处于快速迭代后阶段，单文件膨胀（AgentBDirect.vue 达 5200+ 行）、配置多处冗余、自检单测有断言漂移，急需系统性治理与解耦。
- **考虑的方案**：
  1. 方案 A：直接手改单点 bug（缺乏整体架构视角，极易引发回归）。
  2. 方案 B：五阶段标准化重构（先摸底建立基线，再诊断打分，再解耦骨架与铺设管线，最后冒烟验收与规范固化）。
- **最终决策**：选择方案 B。
- **理由**：符合 AGENTS.md 重构核心原则，最大化复用已有成果，确保教学法则与主链路 100% 稳定交付。
- **风险与缓解**：重构周期稍长，但通过每阶段设立硬性校验点（4层扫描、六维打分、耦合点标记、零报错启动）保证零风险交付。
- **验证方式**：每一阶段产出物完整性审查 + npm run check:* 全链路冒烟验证。

## 2026-09-17 决策 #002：教学引导策略与核心 Prompt 保持绝对稳定
- **决策内容**：锁定 src/agent-b-v2/prompt.js 中的清华附小教学法（温柔循序渐进的引导、条件拆解、问为什么、回顾学过知识、形成解题直觉）及四环一体结构，严禁在重构过程中对其做任何压缩或功能性删减。
- **背景**：产品核心价值是教学引导世界观，而非冰冷的标准答案。
- **考虑的方案**：
  1. 方案 A：将 prompt 压缩为简短指令（破坏教学效果，违反产品初心）。
  2. 方案 B：完整保护教学策略，仅对工程载体（TypeScript/Service/UI）进行模块化解耦与重构。
- **最终决策**：选择方案 B。
- **理由**：教学体验第一，工程重构服务于产品体验。
- **验证方式**：生成脚本结构完整度比对与教学用语抽检。

## 2026-09-17 决策 #003：工作根目录 = clean-package，三份记录统一在此维护
- **决策内容**：以 `clean-package/` 作为工程根目录，所有路径、变更树、记录文件（`PROJECT_STATE.md` / `ENGINEERING_LOG.md` / `DECISIONS.md`）均在此目录内维护，不再引用上层目录的同名文件。
- **背景**：仓库上层另有一套同名记录（阶段文档历史），与本目录实际工作脱节，易造成双份真相。
- **铁律**：任何改动必须同步三份记录——`ENGINEERING_LOG.md`（做了什么+验证）、`PROJECT_STATE.md`（当前状态+变更树）、`DECISIONS.md`（为何这么做）。**没落痕迹等于没做。**
- **验证方式**：每轮收工前核对 `git status/diff` 与变更树一致。

## 2026-09-17 决策 #004：三条不可动红线（画布 / 自动落座 / loading）
- **决策内容**：`1726×980` 画布与纸白底色、A 画布自动落座算法（`src/utils/boardLayout.js` + `Step1Entry.vue` + `BoardContentLayer.vue` 测高落位链路）、所有加载态（loading/骨架/遮罩）——**一律禁止改动**。
- **背景**：自动落座是长期试错磨合出的核心资产；用户明确"loading 别改""格局尽量不要一直变动"。
- **理由**：这些是高成本换来的稳定性，美化收益远小于回归风险。
- **边界**：外壳、导航、卡片、按钮、文案、间距、色值 token 可自由优化。
- **验证方式**：改动前后画布尺寸与落位结果目视一致；loading 相关 `:loading` 绑定不出现在 diff 中。

## 2026-09-17 决策 #005：去冗余采用「就近原则」
- **决策内容**：同一状态/动作存在"工具条 + 表头或行内"两套入口时，**保留离作用对象最近的那套，删工具条副本**。
- **背景**：Agent B 工作室折叠列曾有 3 个入口，工具条 3 芯片与表头按钮 100% 同功能（同调 `toggleColumn`），且多占横向空间。
- **理由**：就近入口更可发现、零额外占位；工具条只保留"跨列"的全局预设（标准全景/专注口播/专注板书）。
- **验证方式**：删除后全仓无残留类名，功能回归手测通过，`npm run build` 通过。

## 2026-09-17 决策 #006：板书字体——本地自托管为主，CDN 仅作可选
- **决策内容（2026-09-17 最终拍板，取代上一版「本地自托管为准」）：尽量用 CDN，大陆 CDN 优先；本地字体仅作离线兜底。**
- **用户原话**："尽量用 CDN"、"能用 CDN 的用 CDN，服务器性能不行，别搞死自己"、"字体三个备选都可以"。服务器规格 **1 核 2G**。
- **CDN 取证（2026-09-17 实测 HTTP 200）**：
  - CDN `490` → `font-family: "LikeJianJianTi"`（栗壳坚坚体），85 个 woff2 分片；**应用内当前在用**。
  - CDN `507` → `font-family: "平方乔木体"`，43 个 woff2 分片，`src: local("平方乔木体")` 优先 + `unicode-range` + `font-display:swap`；**与交付页内嵌的本地 `pingfang-qiaomu.ttf` 是同一款字**（`postScriptName: PFqiaomuti`）。
- **三个备选来源**：① 大陆 CDN 分片按需（首选，服务器零负担）② 本地 `public/fonts/`（离线兜底）③ 系统楷体栈（降级）。
- **用户原话**："字体我们有三个备选都可以，且根目录 public 下面就有"、"能用 CDN 的用 CDN…服务器性能不行，别搞死自己"。
- **资产盘点事实（2026-09-17 全仓取证）**：全仓**只有 1 个**手写字体文件 `pingfang-qiaomu.ttf`（3.68 MB），共 3 份副本：
  1. `clean-package/public/fonts/` —— **真源**；
  2. `clean-package/dist/fonts/` —— 构建产物（自动生成，不入变更树）；
  3. 上层 `public/fonts/` —— 旧目录残留，**属脏区，不维护不引用**。
- **理由**：字体文件已在自家 `public/` 下，静态托管单文件 + 长缓存即可，不必引入外部 CDN 依赖与可用性风险；真纠结的是体积，不是来源。
- **保留争议（仍需确认）**：交付页 `row-player.html` 是**单文件离线页**，依赖必须内嵌（当前内嵌后模板约 5.26 MB）。若允许"打开交付页时联网"，可改为外链字体把单文件压回 ~0.5 MB；若必须离线自洽，则维持内嵌。
- **体积优化备选（未执行）**：子集化（只保留常用字 + 数学符号）或转 woff2，可把 3.68 MB 压到数百 KB。
- **验证方式**：应用内页面确认 `PingFangHand` 生效且不发起外部字体请求；交付页离线打开仍为手写体。
- **2026-09-17 补充修订（服务器仅 1 核 2G）**：用户告知演示服务器规格为 **1h2g**。据此调整倾向——
  1. **应用内页面**：优先走**大陆 CDN 分片按需**加载（服务器零负担），本地 `public/fonts/` 仅作兜底；
  2. **交付页 `row-player.html`**：5.26 MB 单文件在 1h2g 上是明确负担，优先**子集化 + 转 woff2**（3.68 MB → 数百 KB 量级）再内嵌，或接受联网外链；
  3. **禁止**让 Node 进程以 `readFileSync` 整文件方式反复吞吐 MB 级字体/模板（见决策 #007）。

## 2026-09-17 决策 #007：1h2g 服务器禁止「整文件进内存」式静态吞吐
- **决策内容**：在 1 核 2G 的演示服务器上，静态大文件（交付页 HTML、字体、音频、图片）必须走**流式传输 + 缓存头**，禁止 `readFileSync` 整文件读入内存后再 `res.end()`。
- **证据（2026-09-17 取证）**：
  1. `server/productionServer.js:98` —— `res.end(readFileSync(filePath))`：每个请求把整个文件读进内存，无流式、无 gzip、无 `Cache-Control`/`ETag`；
  2. `server/renderDeliverableHtml.js:57` —— `readFileSync(playerTemplatePath,'utf-8')`：模板含内嵌 base64 字体，约 5.26 MB，每生成一次交付页就常驻一份大字符串（Node 字符串内存约 2 倍），并发即 OOM 风险。
- **理由**：2G 内存下，单请求 5 MB 尚可，2-3 个并发或叠加音频/图片即触顶；且 V8 默认堆上限远小于 2G。
- **修复方向（未执行，待排期）**：模板内容进程内缓存一次（或 mtime 失效重读）；静态响应改 `createReadStream` + `Content-Length` + `Cache-Control: public, max-age` + 可选 gzip；音频/图片同理。
- **验证方式**：压测（并发 5 请求 5 MB 交付页）观察 RSS 不持续增长；`curl -I` 确认返回缓存头。
- **2026-09-17 晚更新**：交付页字体已改 CDN，模板 5.01 MB → **0.11 MB**，`renderDeliverableHtml.js` 的内存压力随之下降一个数量级（流式改造仍建议保留在排期）。

## 2026-09-17 决策 #008：产物必须脱环境——字体走 CDN，素材内嵌（取代 #006）
- **决策内容**：交付产物（交付页 HTML）**必须脱环境**：字体一律走 CDN，素材一律内嵌 base64，禁止任何相对路径外链。
- **用户原话**："我们这个页面客户是要自己 agent 生成的，我们必须用 CDN"；"还有素材什么的 pic 这些背景，我们是会给外面 api 和 agent 做 skills 的，产物必须脱环境自己网页能用"。
- **推翻 #006 的部分**：#006 认为"交付页必须离线自洽 → 依赖必须内嵌"。现明确**客户是联网用 Agent 生成后打开**，离线自洽不再是硬要求，5 MB 单文件才是硬伤（1h2g + 传输 + Agent 处理成本）。
- **官方接入方式（fonts.zeoseven.com 取证）**：一行 CSS 即可，CSS 内含分片 `@font-face`（按需加载 + `local()` 优先 + `unicode-range` + `font-display:swap`）：
  - 平方乔木体：`<link rel="stylesheet" href="https://fontsapi.zeoseven.com/507/main/result.css">` → `font-family:"平方乔木体"`
  - 栗壳坚坚体：`https://fontsapi.zeoseven.com/490/main/result.css` → `font-family:"LikeJianJianTi"`
  - **不要自己写 `@font-face` 指向 ttf**（既不分片也不带 unicode-range）。
- **素材规则**：底图/贴纸/背景等**必须内嵌 data URI**（现状 `ASSET` 常量 webp 已符合）；相对路径（如 `public/fonts/pingfang-qiaomu.ttf`、`./pic/*.png`）一律违规 —— 离开项目目录即 404，外部 Agent 拿到就是坏产物。
- **已执行（2026-09-17）**：
  1. `row-player.html`：删内嵌 base64 段（5,149,880 字符）→ 引 CDN 507；`HAND_FONT` 与 `document.fonts.load` 同步为平方乔木体（保留 `PingFangHand`/楷体兜底）。
  2. `设计灵感卡片-row-player.html`：删 `@font-face{...pingfang-qiaomu.ttf}` → CDN 507。
  3. `public/deliverable/current.html`、`deliverable-deliverable-1789584993949.html`：5.03 MB → 0.12 MB。
- **体积结果**：交付页 5.01 MB → **0.11 MB**；产物 5.03 MB → **0.12 MB**；外链仅 CDN 一条，无 base64 字体残留。
- **链路事实**：产物 = `AgentBDirect.vue:1366`「row-player 模板 + 注入 JSON」→ 改模板即改产物；历史产物需单独回溯处理。
- **验收三问**：① 双击打开有画面（素材内嵌）② 本地相对路径请求 0 条 ③ 体积 < 1 MB。

## 2026-09-17 决策 #010：stage 标签定位唯一真相源 = 导出物 boardPlan 的四个 Label
- **决策内容**：交付页四个 stage 贴纸标签的位置（含题目标签）**必须在装载时直接读取导出物 `boardPlan` 的 `topicLabel / analysisLabel / solutionLabel / summaryLabel`**，禁止用板书内容坐标反推，禁止模板写死常量。
- **背景（用户原话）**：「四区 stage 定位就是标签定位……不然你的书写区域就是错的」。
- **理由**：Label 坐标由 `src/utils/boardLayout.js` 按 `layoutMode`（竖图/横图/左图）算出来并写进导出物，随题目排版变化（实测横图模式 44.39% vs 竖图默认 34.5%）；写死或用内容锚反推会让标签与甲方四区落座脱钩，书写区看着就错位。
- **回退顺序（唯一）**：Label 定位 > 该区左上角 > 模板常量（`row-player.html` 的 `resolveTagAnchor`）。
- **验证方式**：换一份不同 `layoutMode` 的导出物，四标签落点应随导出物变化；空 `boardPlan` 不崩。

## 2026-09-17 决策 #011：Agent B 返回格式不对 → 软提示模型自行修缮，不直接报错结束
- **决策内容**：合同校验失败时**先把具体错误回灌给模型让它重出一次**（话术按错误类型对症 + 附上一次坏输出尾部），仍失败才走「尽力提取已闭合 rows 的软降级」，最后才是 422 报错；前端对合同类错误只发 warning 软提示并保留原内容。
- **背景（用户原话）**：「Agent B 返回内容格式不对的时候，不要马上报错结束，而是软提示模型错误，它修缮对的给我们」。
- **理由**：大模型偶发截断/夹带 fence 属可自愈错误，回灌错误比直接失败成功率更高；用户可见层面也应是软提示而非红字报错。
- **边界**：`MAX_RETRIES` 保持 1，不擅自放大上游开销；网络/鉴权/超时等非合同错误不重试，按原路径返回。
- **验证方式**：四类错误样例分诊正确（已静态验证）；真实上游联调待跑。

## 2026-09-17 决策 #009：板书特殊符号用常见字符自己凑（用户指示，待实现）
- **决策内容**：手写字体字库覆盖不全，缺的符号**用常见字符排版凑**，不硬写生僻符号（会渲染成豆腐块）。
- **规则**：乘号 → 英文字母 `x`；除号 → **分数写法**（分子 / 横线 / 分母上下排），不用 `÷`；上下带点的符号（∵ ∴ 一类）→ 用**英文句点 `.` + 短横 `-`** 上下排凑。
- **落地位置（唯一真源）**：`src/utils/superFilter.js`（"车同轨书同文"超级过滤器）+ `row-player.html` 渲染侧；不得各处各写一份。
- **状态**：已记录，**尚未实现**。

## 2026-09-17 决策 #012：输出物合格标准 = 盲测线（零上下文 Agent 凭一份 JSON 演得出任意题）
- **用户原话**："输出物合格标准：随便没有上下文的 agent 就凭你给的这个 json，能够完整完美用我们的播放模板 row-player 生成不同题目的板书。换位自己如果什么都不知道，一份 json，那里面要有什么？那就是要输出的参数了"；"直接照搬输出物……输出物必须带的本题目参数信息，里面就有四区范围……务必要带 stage 的参数"；字体"jianjian 和乔木都可以"。
- **判定口径**：零上下文 Agent + 本 JSON + `row-player.html` 能演完整 = 合格；演不出 = 不合格。**倒推法：演不出来的就必填。**
- **必带三层**：
  1. 题目层：`problemText` + `boardPlan`（`canvas 1726×980`、`layoutMode`、四区 `question/analysis/solution/summary`、**四个 Label** `topicLabel/analysisLabel/solutionLabel/summaryLabel`、`image`）。**四区范围 + 四个 stage 标签坐标 = 本题目参数信息，整块照搬导出物**。
  2. row 层：`stage`（四值）/`speech`/`board.content`/`board.startCoord`/`board.startDelay|triggerKeyword`/`duration|audioDurationMs`/`mp3`（未生成写 `""`）/ 可选 `actionSpec[]`（一期仅 circle、underline，`exactText` 须为已写出文字）。
  3. 验收六问：有画面 / 题文一打开就印在 `boardPlan.question` / 四标签与导出物四个 Label 完全一致（换 layoutMode 须跟着变）/ 板书各落本区不叠不越界 / 有音频完整播完、无音频虚拟时钟不卡 / 符号已降级（x、\frac、²³、中文因为所以）。
- **字体**：不进 JSON，由模板侧决定；CDN 490（栗壳坚坚体 `LikeJianJianTi`）与 507（平方乔木体）**都可用**，当前模板用 507。
- **落地**：`public/deliverable/deliverable.schema.json`（boardPlan 升必填 + 结构定义 + stage 四值 enum + startCoord）+ `public/deliverable/DELIVERABLE_API_SPEC.md` 第七节（含最小可播 JSON 骨架）。**不新建第二份规范**。
- **阻断项 #1 已修（2026-09-17 晚，用户拍板）**：`row-player.html` 的 `compile()` 原未把 `coord` 传进 board 计划项 → 板书落点恒为默认 `{x:8,y:44}`。现新增 `resolveBoardCoord`（三层回退：`board.startCoord` > `boardPlan[stage 区]` 左上角 +2%/+4% > 模板常量），`compile()` 带 `coord`，`normRow` 保留 `startCoord`，`drawWriting` 兼容字符串/对象。与 `resolveTagAnchor` 同源同构。**板书落点真源 = 导出物（startCoord 优先），不再由模板写死。**
- **仍挂账**：图片题断链（P0，未修）；板书字号三处不一致（待拍板）。
- **验证方式**：`node --check` 通过 + `resolveBoardCoord`/`normRow` 四场景实测通过（落点随 layoutMode 变化）；**浏览器人工点检未做**（row-player 不进 build），需换两份不同 `layoutMode` 产物目视确认验收六问。

## 2026-09-17 决策 #013：图片题 = 复用第一步截图；板书字号拍板 38px
- **用户原话**："图片题断链（P0，未修）复用第一步的截图发出去，文本题目只要发图 url、板书字号三处不一致（待拍板）。38 号折中吧"。
- **图片题（P0 → 已修）**：
  1. 图源 = **第一步截图**（`Step1Entry` 截 `.board-viewport` 存 `/pic/*.jpg`），**不另找图、不重上传**。
  2. **画不画的唯一判据 = `boardPlan.image` 有没有图位**（自动落座真源，与四个 Label 同源）。图片题有图位 → 画；文本题目无图位 → **只把 `screenshotUrl` 带出去**（溯源/下游用），**绝不往板上贴截图压板书**。判据单一，不新造"是不是图片题"的第二套概念（不读 `meta.problemType`，避免两套真相）。
  3. 交付页脱环境：图片题导出时由 `renderDeliverableHtml.js` 内嵌为 `screenshotDataUrl`（base64），离线双击即有图；外链/`data:`/文件不存在/读失败一律跳过并 warn，不抛错。
- **板书字号 = 38px**（35 与 42 折中）：真源 `stepHandoff.BOARD_FONT_SIZE = 38`；`row-player.html` 4 处 42 → 38。**⚠ row-player 是离线单文件不能 import，字面值与真源必须成对修改**，已在模板注释写明同步点。
- **顺带补（新发现，非用户点名）**：导出物序列化原本**丢 `startCoord`/`triggerKeyword`**（`parseBoard` 不透传、序列化只写 content/startDelay）→ 昨晚修的下游落点链路在上游就断了，只能回退到区左上角。已补齐，否则决策 #012 的合格标准空转。
- **验证**：`npm run build` 通过；图片题产页 139KB 含图 / 文本题 105KB 只带 url；`normData` 字段归一实测通过；schema 合法。**图片落座观感未点检**（需真实图片题产物目视）。

## 2026-09-17 决策 #015：商业交付门槛 = P0 清零 + 五验全绿 + 盲测通过（军工级审计结论）

- **决策内容**：2026-09-17 全栈审计（四路 sub + 负责人 8 条交叉验证）判定当前 **NO-GO**；商业交付签署门槛固化为：`FULL_STACK_AUDIT` 中 **P0 全部清零** + **五验全绿**（build / lint 零新增 / check:proxy / check:knowledge / verifyDeliverableTruthSource）+ **人工点检 A~C 通过** + **盲测通过**（决策 #012）+ 高风险项有处置人或书面接受。缺任一即为 NO-GO。
- **背景**：审计共 48 条缺陷（P0×4 / P1×10 / P2×17 / P3×12 / P4×5）。P0 为：① 硬编码密钥 5 处且已进 `dist` 产物 ② 产物 3 行（解答段 54%）无音频 ③ 交付契约不自洽（盲测线不过）④ `productionServer.js:98` 整文件吞吐（1h2g）。
- **考虑的方案**：
  1. 方案 A：先交付后补票（静音产物一旦外发不可逆，且违反「不做终局动作」）。
  2. 方案 B：先出审计 + 交付包，P0 清零后再签（审计只读取证，不阻断现有演示）。
- **最终决策**：方案 B。
- **2026-09-17 补丁（用户拍板，推翻原 P0-01，永久红线）**：`server/fishAudioHandler.js:13-14` 的 sk-fish 与 `src/lib/{user,agentB,checkAgent}ApiConfig.js` 的 sk-Wy5cJ9 是**甲方预设演示账号**，硬编码是产品决策。**不得删除、不得吊销、不得改读 env、不得清 git 历史**（用户已重复强调多次，禁止再提此建议）。仅做 P3 文档化：5 处加注释「甲方预设演示账号，勿删」+ 部署手册写明额度共用风险。P0 由 4 条降为 3 条。
- **处置批次（依赖关系）**：B1' 密钥文档化（仅注释 + 手册，不动行为）→ B2 契约（**须先拍板 startCoord** → 修透传 → 统一 schema/API SPEC/产物/批注 → 出最小可播样例）→ B3 批量 TTS + 「有 speech 必有音频」校验 → B4 流式静态服务 + 部署口径（Vercel 或明确只自托管）→ B5 时长真源收口 → B6 vitest + CI。
- **架构级阻塞**：Vercel 是 Serverless 只读文件系统，而本项目运行时写 `public/`（4 目录）→ **改对象存储前不要上 Vercel**，配置补全不能解决落盘问题。
- **验证方式**：见 `DELIVERY_PACKAGE.md` §3 验收 SOP 与 §5 Go/No-Go 勾选表；每批次结束重跑五验并回填勾选状态。
- **风险与缓解**：审计本身未跑 build/网络请求/实机点检，缺陷评级为审计判断，产品取舍项已单列 P4 不代替用户决策；未验证项已在审计 §8 诚实记账。

## 2026-09-17 决策 #016：`board.startCoord` 降为「可选」（用户拍板）

- **决策内容**：`board.startCoord`（行级板书落笔起点 `"[x%, y%]"`）由**必带降为可选**。缺省时渲染层按 `boardPlan` 该 stage 区左上角 **(+2%, +4%)** 自动落座 —— 回退链已能把四区板书排开，**不带也能演**。
- **拍板依据（用户原话）**：「回退链（按 boardPlan 区左上角 +2%/+4%）已经能把四区板书排开——不带也能演，降为可选」。
- **为什么这是对的**：提示词侧本来就禁止输出。`src/agent-b-v2/prompt.js:47/71/72/75/176/179/245/263/271/320/344` 与 `src/check-agent/prompt.js:9/200` 全部明令「四区坐标区间已给定，**不再提起手坐标**，不输出/计算 startCoord、行高、行距」。产物批注真源 `src/utils/superFilter.js:323` 也是同一口径。**真正标成必填的只有契约两侧**（schema + API SPEC）—— 是契约写错了，不是提示词错了。
- **已统一口径（5 处，只改文字不改行为）**：① `public/deliverable/deliverable.schema.json:157` description「★盲测必填」→「○ 可选」+ 缺省回退说明 ② `DELIVERABLE_API_SPEC.md:138` 表格 ✔ → ○ ③ `DELIVERABLE_API_SPEC.md:157/:160` 阻断项补记「降为可选 / 不再阻断」+ 7.5 样例加注「可整段删除」 ④ `row-player.html:143` 帮助表「照写」→「可选，不写也行」 ⑤ `superFilter.js:323` 批注 + `serializeDeliverableState.js:43` / `AgentBDirect.vue:296` 注释「必带」→「可选透传」。
- **未改（现状如实记录）**：服务端 `deliverableStoreHandler.js:167-173` 重建 board 仍会丢弃 startCoord，`speechMarkdown.js:250-263 parseBoardField` 仍不透传 → 降为可选后不阻断，转 P2 待办。
- **验证**：`node` 校验 `deliverable.schema.json` 可 JSON.parse 且含「可选」标记 ✅；`npx eslint --quiet`（superFilter.js / serializeDeliverableState.js / AgentBDirect.vue）→ 仅 `AgentBDirect.vue:1390 navigator` 既有 error，**零新增** ✅。
- **遗留待办**：`row-player.html` 是模板真源，已改的 `public/deliverable/current.html` 等产物**未重生成**（铁律：改模板 ≠ 改产物），需重建产物后才能实机点检。

## 2026-09-17 决策 #017：音频不内嵌 base64，改「相对路径 `../`」求解脱环境（负责人拍板）

- **问题**：交付页 `current.html` 内嵌 JSON 的 `audioUrl` 是 `/audio-cache/xxx.mp3`（服务端绝对路径）。http 服务下 6 行有声；`file://` 双击 → 404 → `row-player.html:916 onerror` 降级**无声时钟**（不卡死，但全程静音）。
- **否决方案**：内嵌 base64。实测 6 行音频 **789KB** → base64 膨胀约 1.05MB，**破「体积 < 1MB」门槛**，且行 4/5/6 本就无音频，内嵌也补不齐 → 收益不全、代价确定。**不做**。
- **采纳方案（1 行）**：写入时把前缀 `/` 归一为 `../`。`public/deliverable/current.html` 下 `../audio-cache/` 在两种协议下都命中同一目录；`row-player.html:1006` 白名单 `^\.{0,2}\/` 天然接受 `../`。体积不变、零依赖。
- **代价（诚实记账）**：音频目录（789KB）必须**随包分发**；只发单个 HTML 仍静音。写进交付说明，不算缺陷。
- **验证方式**：双击 `current.html` → 应 6 行有声 / 3 行（解答段）静音；grep 路径前缀应为 `../audio-cache/`。
- **前置依赖**：本决策**不解决**解答段 3 行无音频 —— 那是内容生成问题（Go/No-Go 阻断第 1 条），必须重跑 TTS。

## 2026-09-17 决策 #018：托管执行「清零 P0 并出交付」（用户全权授权）

- **授权**：用户「可以，托管给你，务必能正确稳定，出交付」→ 负责人直接执行，不再逐项请示。
- **改动清单（5 处代码 + 1 处配置 + 1 个脚本）**：
  1. `server/renderDeliverableHtml.js` 新增导出 `normalizeDeliverableAssetPaths()`（**单一实现**）：`audioUrl`/`mp3` 的 `/audio-cache/` → `../audio-cache/`；`mp3` 未生成写 `""`。JSON 写盘与 HTML 渲染两条出口共用，禁止另起一套。
  2. `server/deliverableStoreHandler.js:198` payload 归一包装 + import。
  3. `server/productionServer.js:2,90-107`：`readFileSync` 整文件吞吐 → `createReadStream().pipe(res)` + `Content-Length`（P0-04，1h2g OOM 面）。
  4. `server/screenshotStoreHandler.js:5`：补 `readFileSync` import —— **既有真 bug**（用了没引，运行时 ReferenceError）。
  5. `src/board-preview/BoardPreviewApp.vue:29`：补 `saveLiveBoardPreview` import —— **既有真 bug**（同类 ReferenceError 史上第 4 次）。
  6. `eslint.config.js`：补 `scripts/**` 的 Node 全局 + `navigator/performance/MediaRecorder/CropTarget`（消除误报，避免掩盖真 bug）。
  7. 新增 `scripts/backfillDeliverableAudio.mjs`（`--check` 自校验时长算法 / 默认补音频并重建产物）。
- **音频补齐**：解答段 row4/5/6 调 Fish Audio 合成，得 8.5s / 9.0s / 13.4s（预估原为 22.2/17.1/22.3，实测远低于预估）。产物经 `writeDeliverableFile()` 整体重建 → `deliverable-20260917-083945-499.json`。
- **实测证据（一手）**：9 行音频 **9/9 存在**、静音 **0**、总时长 **80.2s**；`file://` 脱环境路径解析 **9/9 命中**；单页 **142 KB**（<1MB）；内嵌相对音频 18 处 / 绝对 0 处；schema 顶层 `required` 校验**全通过**；生产服务器实测 html 200 + `Content-Length` 145466、audio 200 `audio/mpeg`、404 正常；真源脚本 17/17；本次改动文件 eslint 0。
- **时长算法自选校验**：`--check` 对既有 6 行比对解析值 vs 记录值 → **误差 0.0%**（全 128kbps CBR），故 CBR 首帧估算可用（已标 `ponytail:` 注释，VBR 场景需换精确解析）。
- **诚实记账（未做/未清零）**：① P1 全部未处置（Vercel 缺 `api/cleanup.js`、registerAntd、抬笔间隔 1000/600、语速链路、异步兜底）② **人工点检 A~C 未做**（无浏览器，需人工双击 `current.html` 确认观感）③ 全仓 eslint 46 error 均为**既有风格项**（28 `no-useless-escape` / 12 `no-empty` / 4 `no-undef` …），未逐条修，记 P2。
- **结论**：**有条件 GO** —— P0 全清零，自托管演示可交付；商业签署仍差 P1 处置 + 人工点检。

## 2026-09-17 决策 #019：有真实音频时**强制重算**行排程（0 置信核查抓出）

- **触发**：托管交付后拉小跟班 0 置信核查（回传被截断，由负责人自证）→ 发现补音频后 7/9 行 `exclusiveExecutionPlan` 的 speech 段仍是**语速预估**（row4 预估 15.7s vs 真实音频 **8.46s**）。
- **根因**：`deliverableStoreHandler.js`（原 174-175）`row.estimatedDurationMs || computed…` / `row.exclusiveExecutionPlan || computed…` —— **只要 row 自带旧值就永不重算**。补音频只更新了 `audioDurationMs`，排程没跟着动。
- **修复（8 行，无新逻辑）**：把 `measuredAudioDurationMs` / `hasMeasuredAudio` 提前，**有真实音频时一律取 `computed`**。`computeRowGroupTimeline()` 内部以 `row.audioDurationMs` 为语音时长真源（`src/agent-b-v2/timing.js:81-86`），重算即自动对齐，不另写缩放逻辑。
- **验证**：重建产物后逐行比对 → `exclusiveExecutionPlan` speech 段 **9/9 == `audioDurationMs`** ✅（`deliverable-20260917-085948-492.json`）。
- **重要澄清（避免把 P1 误判成 P0）**：`row-player.html:320-338` **自己按 `board.content` 现算 plan，根本不读 `exclusiveExecutionPlan`**，且 `:337-338` 有兜底 `if(maxEnd>dur) dur=maxEnd` → **板书不会被音频截断**。所以上一版担心的「板书写不完就切行」**不成立**，不是 P0。
- **遗留（P1，内容侧，代码改不了）**：实测 7/9 行**音频短于板书排程**（row4 差 **13.2s**、row2 差 3.2s、row6 差 2.4s、row8 差 2.3s…）→ 观感是「音频播完后画面继续静默书写」。要根治只能重录更长配音或精简该行板书行数，**不属本次代码范围**，已记账。