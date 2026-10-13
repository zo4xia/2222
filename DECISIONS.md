# 重要决策

## 2026-10-13 第七轮：契约四方分裂以"用户规格+播放端"为锚 + 乱世重典砍除过期档
- **决策一（circle 契约拍板）**：动作白名单四方分裂（prompt 教三动作/播放端渲染 circle/生成白名单拒/check 报违规/估算无值）时，**锚定顺序 = 用户钦定规格 > 播放端事实 > 生成侧白名单**。夏夏原话#33 钦定 underline+circle 为两大核心兜底，row-player 完整渲染 circle——生成侧（roughNotationTool）、校验侧（skillViolations）、估算侧（timing.js NOTATION_DURATION_MS 1500ms 对齐播放端）三面向其归一。契约真源 = `src/board-tools/boardToolCatalog.js`，文档层一律引用代码真源而非平行叙事档。
- **决策二（lite-player 裁决推翻）**：第四轮"带防护声明的孤儿档案按自声明处置（保留）"本轮推翻——夏夏乱世重典令下，URL 可达的自声明孤儿正是"预览到底是哪个"的困惑源；**git 历史即档案**，工作树不留第二播放器。镜像链从三镜像收敛为双镜像（row-player 真相源 + public 构建镜像），哨兵测试同步（93→92）。
- **决策三（入口归一）**：业务流唯一 HTML 入口 = `index.html`；`agent-b-v2.html`（与主入口挂同一 DirectFlow 的重复入口）退役，vite rollup input 与 Dockerfile COPY 同步摘除；`board-preview.html` 保留（全屏预览按钮直连 vite 入口）。生产验证 /agent-b-v2.html 已 404。
- **决策四（truth 叙事层退役 + 契约文档单一化）**：truth/ 领地叙事与活文档链（PROJECT_STATE/DECISIONS/ENGINEERING_LOG/README）三重复述且引用幽灵路径——平行真相层本身就是"到底信哪个"的坑，整目录退役；api_spec.yaml 零消费者且路径全错，下游契约唯一入口 = `/api/deliverable/api-spec`（DELIVERABLE_API_SPEC.md 链路）；SYSTEM_MAP/RTK/PONYTAIL_DEBT 职责归并（已知问题→PROJECT_STATE，全景图→README，未完债务→PROJECT_STATE 下一步，外部工具说明→删除）。
- **决策五（测试的测试）**：测试脚本自身也按"会污染运行态"审计——test-refine-degrade 原版删 handoff 指针不恢复（跑一次毁用户会话）+ ESM 下 require 被吞（清理从未生效），修复为双备份双恢复；网络型测试（真实上游依赖）不入离线主套件。
- **风险**：circle 接入后 B 产出的圈会真实执行——若 exactText 失配走既有降级（第六轮已保证不炸）；播放端 circle 时序 1500ms 与估算器同值，无音画漂移引入。
- **验证**：validateRoughNotationAction(circle) ok:true；run-all-tests 7/7；smoke 违规语义 fixture 改 box 保持 11/11；build + health + 404 入口复核 + 三对镜像 md5 + 被删名 grep 清零。

## 2026-10-13 降级路径必须自身可执行（防 booby-trap）+ 估算器/执行器常量同源
- **决策一**：容错降级代码（catch 块 / noop 工厂 / fallback 路径）本身必须零依赖未验证假设。boardToolCatalog 三处降级路径引用未导入常量，导致"单步隔离"自身 ReferenceError 炸整批播放——修复方式是降级工厂归一 + prepare() 永不抛错（内部全兜底），并把该行为锁进回归测试（test-board-tool-catalog.mjs 8 用例挂主套件）。
- **决策二**：同名概念单一真源——动作抬笔间隔唯一真源 = `src/board-tools/boardToolTiming.js` 的 `MIN_HAND_LIFT_GAP_MS`（执行器带 throw 守卫=运行时事实）。估算器 `agent-b-v2/timing.js` 的 `HAND_LIFT_GAP_MS` 改 import 派生（600→1000），估算对齐执行；档案层（skills/*/SKILL.md、meta.json、demo 镜像）同步勘误。裁决依据：消费链事实优先——执行器是真正跑的代码，估算器必须预测执行器。
- **决策三（伪冲突拍板）**：row-player `HAND_LIFT_MS=600`（板书行间换行节奏）与 `MIN_HAND_LIFT_GAP_MS=1000`（动作换手硬下限）**量纲不同、互不约束**，原"冲突待拍板"挂账注销；"991/timing.js" 死路径引用清除。
- **测试纪律**：不变量断言不得锁平行值——test-timing-computeRowGroup 不变量 6 原硬编码 600，改为 import 常量追踪真源，防止测试把漂移值认证成"正确答案"。
- **回滚**：单文件级 git revert 即可；估算显示变长（+400ms/动作）是修正不是回归。

## 2026-10-13 死链 CSS 与零消费键的连根判定：属性读取为准 + 死值陷阱全灭
- **决策**：连根砍除三类"活着进 bundle 但内容无效"的乱点——① `src/board-tools/boardTypography.css`（@font-face 指向已被第四轮删除的 `/fonts/pingfang-qiaomu.ttf`，family `Qinghuabu Qiaomu` 全仓渲染代码零引用）连同两个 vite 入口 import；② AgentBDirect.vue 手写 canvasParams 死值块 22 行（fontSize/lineHeight/boardSpeed 等字段全被 `...hcp` 展开覆盖 + canvasWidth/Height 异名键零消费）；③ deliverableStoreHandler.js 的 canvasWidth/Height 死键及其"下游消费的异名键"注释。
- **背景**：夏夏令"先归一化乱七八糟的地方，砍删归一整理统一"。第四轮归一了字面值，但三类结构性乱点漏网：死链 CSS（源头文件已删，CSS 指向虚空）、被展开覆盖的手写副本（Task 5 在 deliverableStoreHandler 修过同款，AgentBDirect 是漏网之鱼）、异名键（Task 5 只换了字面值没查消费，注释还谎称"下游消费"）。
- **关键裁决——属性读取为准**：判定一个 JSON 键是否被消费，唯一证据是 `grep '\.键名'` 属性访问命中，**写入处不算消费**。全仓 `.canvasWidth/.canvasHeight` 属性读取零命中，而 canvasSize.width/height 被 RealBoardPreview/BoardContentLayer/AgentBDirect 三处消费——写入侧自称"下游消费的异名键"不成立，注释与事实不符即按噪音处理。
- **考虑的方案**：A) 保留 canvasWidth/Height 并让下游真消费它（双键并存）；B) 保留死链 CSS 等独立播放器将来接手；C) 属性读取零命中即连根砍（含注释与 import）。
- **最终决策**：C。A 是为死键制造消费者，违反真源唯一（canvasSize 已是唯一键）；B 是"将来可能有用"式挖坑——@font-face family 无人引用时连 404 都不触发，纯静默无效代码骗维护者"有字体能力"；C 符合"噪音不删都是挖坑"。
- **理由**：死值陷阱的三重危害：占位骗人（看起来在配置 fontSize，实际被 ...hcp 全覆盖）、异名键骗人（下游读的是另一个名字）、注释骗人（声称下游消费实际零消费）。三者都在"活着"的假象下掩埋真相。
- **风险**：localStorage 缓存的旧 deliverable JSON 可能仍带 canvasWidth 键——下游读 canvasSize 已有 fallback 常量，无兼容风险；真源 buildCanvasParams 产出完整 canvasParams，序列化数据不受影响。
- **验证**：`.canvasWidth/.canvasHeight` 属性读取全仓零命中；boardTypography/Qinghuabu/pingfang-qiaomu 代码层（src/server/public/api）清零；run-all-tests 6/6 + build 成功 + health 200。
- **关联文件**：`src/main.js`、`src/board-preview/main.js`（import 删除）、`src/agent-b-v2/AgentBDirect.vue`（死值块 + import 瘦身）、`server/deliverableStoreHandler.js`（死键 + 注释）、`public/skills-hub/skill-2.html`（展示镜像对齐）。

## 2026-10-13 画布宪法唯一演绎：真源插值 + 孤儿档案自洽原则
- **决策**：画布渲染参数（尺寸 1726×980 / 字号 30px·38px / 行高 / 平方乔木体 CDN 507 降级栈）以 `src/services/stepHandoff.js` 为唯一真源，数据流与模板文案层字面值全部改 import 插值；CSS 层（aspect-ratio 等）作为受控平行值备案保留。
- **背景**：夏夏令"对齐画布真·唯一演绎定义"。审计发现 boardPlan.canvas 手写 `{w:1726,h:980}` 藏在真源插值区旁（Task 5 漏网）、uiSettings/导出 MD 的 '30px' 字符串字面值、skills 档案整窝旧字体世界观（尖尖体/490 主字体/死路径 TTF/臆造函数引用）。
- **关键裁决——lite-player 回滚**：lite-player.html 自我声明"孤儿文件/非真相源/字体看 stepHandoff/改行为请改 row-player"，其 490 渲染是有防护声明的自洽历史参考。本轮误改（补 507 link + boardFont 改平方乔木体）后识别宪法冲突，git checkout 回滚——**对齐不等于无差别拉平，带防护声明的孤儿档案按其自我声明处置**。
- **理由**：宪法唯一演绎 = 修改一处全局生效。字面值残留是"改了真源没改副本"的漂移温床；但孤儿档案的价值恰恰在于如实保存历史状态，拉平它反而销毁信息且违反其自身声明。
- **风险**：CSS aspect-ratio 与 canvas HTML 属性是平行值（CSS 无法 import JS 常量），真源变更时需手动同步——已在 ENGINEERING_LOG 备案两处位置。
- **验证**：run-all-tests 6/6 + build + health 200；字面值清点（数据流零残留、尖尖体全仓清零）；row-player 与 public 镜像 md5 一致。
- **关联文件**：`src/agent-b-v2/AgentBDirect.vue`、`src/lib/speechMarkdown.js`、`src/board-preview/BoardPreviewApp.vue`、`skills/`（board-speech-rules + handwriting-font-policy 三件 + README）、`row-player.html` + `public/row-player.html`。

## 2026-10-13 孤岛死模块的判定标准：消费链事实 > 注释/文档声称
- **决策**：删除 13 项零消费死模块（canvas 死链簇 4 + 未接线半成品簇 4 + services 假封装簇 5），判定唯一依据是**消费链事实**（跨文件 import/引用计数 + npm scripts 挂载 + vite/HTML 入口 + 施工索引登记四重验证），注释和文档声称的职能一律不作为存活证据。
- **背景**：`docs/canvas-board-text.md` 声称 canvasBoardField.js 是"画布板书唯一入口"，实际板书主链走 contract.js#normalizeBoard + superFilter，该模块代码消费者为零；`dualStore.js` 注释声称"消除 AgentBDirect 重复模式"从未接线；`verifyDeliverableTruthSource.mjs` 头部声称"可复跑"，实跑 SyntaxError（import 了 speechMarkdown.js 不存在的导出）——四份"说谎的注释/文档"是本轮最大共性。
- **考虑的方案**：A) 把半成品接线扶正（工厂真收敛三 config、dualStore 真接进 persist、service 层真替换手写 fetch）；B) 全部保留待将来接线；C) 零消费复核后删除，git 历史可回溯。
- **最终决策**：C。A 属于功能开发不是清理（且三 config 各自实现运行稳定，重排收益低风险高）；B 正是夏夏"噪音不删都是挖坑"反对的——说谎的注释比没有注释更危险，下一个维护者会按声称的职能去信任它们。
- **理由**：写代码时的"计划"若从未接线，留在仓库里只会以三重方式骗人：声称已收敛（实际没收敛）、声称可复跑（实际跑不通）、声称唯一入口（实际零消费）。死模块的正确归宿是 git 历史。
- **风险**：若未来真要做前端 API 层收敛或 IndexedDB 热备，需重新设计而非找回旧半成品——已在 ENGINEERING_LOG 接力棒注明"以消费链现状为准重新设计，勿参考已删半成品"。
- **验证**：孤岛扫描判活三关保护了 proxySelfCheck（check:proxy）、agentAKnowledgeSelfCheck（check:knowledge）、recognitionClient/stepHandoff（最小闭环登记）、board-preview/main.js（vite 入口）均未被误删；run-all-tests 6/6 + build 成功 + health 200。
- **关联文件**：`README.md`（结构图 dualStore→speechMarkdown）、删除清单见 ENGINEERING_LOG 2026-10-13 第三轮条目。

## 2026-10-13 内容源档案与运行时注入的定性分界
- **决策**：`doc/speech-board-guide.md` / `doc/self-check.md` / `doc/建议提示.md` / `doc/起始语-过渡-总结-兜底话术.md` 定性为**内容源档案**（方法已蒸馏进对应 prompt.js，文件作为方法论真源保留）；PROJECT_STATE.md 中"运行时输入""服务端读取并注入"等表述全部修正为真实行为。删除 13 项垃圾与误导文件，自检-必读.md 6 行红线归并入 self-check.md。
- **背景**：运行时扫描发现代码只读 doc/knowledge-a.compact.json，但 PROJECT_STATE.md 4 处声称 speech-board-guide/self-check 参与运行时注入——典型误导文件（文档说谎）。
- **考虑的方案**：A) 实现文档承诺，让 handler 真去读这些 md 注入 prompt；B) 删掉这些 md（视为死文件）；C) 保留文件修正表述（内容源档案模式）。
- **最终决策**：C。验证发现固定开场语、运算符读法、四环特征均已在 prompt 中（内容早已蒸馏）；A 会让 prompt 双源化违反真源唯一原则；B 会丢失方法论真源（建议提示.md 模式已被 AGENTS.md 认证多年）。
- **理由**：真源唯一 + 档案不骗人。运行时行为以代码为准（docReferences.js 只读 compact.json），文档如实记录。
- **风险**：后续维护者若不看修正后的表述，可能误以为改 md 就能改 prompt 行为（实际需同步蒸馏进 prompt）。
- **验证**：server/api/vite 全部 readFile 扫描 + prompt 内容特征比对（开场语/运算符/四环）+ run-all-tests 6/6。
- **关联文件**：`PROJECT_STATE.md`（3 处表述）、`doc/self-check.md`（归一接收方）、删除清单见 ENGINEERING_LOG 2026-10-13 第二轮条目。

## 2026-10-13 根目录文档链收敛为 8 份活文档
- **决策**：仓库根目录 md 从 23 份收敛为 8 份（README / AGENTS / RTK / SYSTEM_MAP / PROJECT_STATE / ENGINEERING_LOG / DECISIONS / PONYTAIL_DEBT），其余 24 项噪音（含 15 份停更或重叠文档、9 项平台/本地残留）零引用复核后物理删除。
- **背景**：夏夏指出根目录有噪音味；审计发现 CHANGELOG 停 09-20、CONTINUITY 停 08-19、CONSTRUCTION_LOG 停 09-19 完结、KNOWN_ISSUES 零命中新特性；backup/ 内 1.1MB tar.gz 直接进 git；metadata.json + .base44/ + docker-compose.base44.yml 为 base44 平台残留；reasonix.toml 为本地 AI 工具权限沉淀（含 Windows 路径）。
- **考虑的方案**：A) 归档到 docs/legacy-md/（迭代计划 L10 原案）；B) 全部保留不动；C) 直接删除，git 历史即档案。
- **最终决策**：C。归档目录只是让噪音换个地方住，与"少即是多"冲突；git 历史天然可回溯，需要找回时 `git revert 38b9777` 即可。
- **理由**：夏夏原则"能用图就不要一堆 md"，上下文 = SYSTEM_MAP 图 + ENGINEERING_LOG 变更树；文档链按依赖分诊——被 AGENTS.md「必维护核心记录」或 README 引用的留，其余停更快照删。
- **风险**：外部有人依赖旧文档路径（如 CONSTRUCTION_LOG.md）会 404；已知问题清单并入 SYSTEM_MAP 第五节，职能无损失。
- **验证**：run-all-tests 6/6；24 个被删名在活文件链引用清零；远程 main HEAD = 38b9777。
- **关联文件**：`.gitignore`（防再生 5 条目）、`README.md`、`AGENTS.md`、`SYSTEM_MAP.md`、`PROJECT_STATE.md`。

## 2026-09-16 录屏交付前置就绪检查与模块完成引导 Modal
- **决策**：在录屏交付按钮（`btn-vue-record`）中增加前置就绪状态检查，针对“题目识别状态”与“TTS 音轨状态”进行实时双重校验。若任意模块未就绪，阻止直接录屏并弹出 Ant Design Modal 展示未就绪模块清单、诊断详情与操作引导。
- **放权设计**：弹窗底部提供“刷新就绪状态”重新探测，同时保留“仍要测试录屏”选项，允许开发者在调试阶段绕过音频/题文强依赖，贯彻“系统放权，不绑死”原则。
- **关联文件**：`src/board-preview/BoardPreviewApp.vue`。

## 2026-09-16 四角标支持可视化拖拽排版与双源兜底
- **决策**：四区角标（题目、分析、解答、总结）升级为具备实时拖拽坐标提示的组件，坐标以百分比形式实时保存至 `qinghuabu.topicLayout` 并向下游/状态树同步；图片采用本地/public 优先、外网稳定图床 onerror 双备用。
- **原因**：满足用户对板书各分区角标位置自由微调的诉求，遵循“系统放权，不绑死”原则；同时满足 CDN 使用原则与资源冗余容错。
- **关联文件**：`src/components/BoardContentLayer.vue`、`server/productionServer.js`、`vite.config.js`。


## 2026-09-13 生产服务采用单进程 Node，public 作为持久化卷
- **决策**：使用 `server/productionServer.js` 作为生产 HTTP 入口，复用已有 server handlers，不复制业务逻辑；由同一进程提供 `dist/` 和 `public/` 下的业务档案。
- **原因**：现有 handoff、deliverable、board-result、音频和截图均直接读写 `public/`，该目录是当前运行真相源。单进程部署能保持现有行为，并要求服务器把整个 `public/` 放到持久化磁盘或容器挂载卷。
- **边界**：不调整 Agent A 上传、识别、图像决策、知识、布局、坐标或 A→B 文本交接逻辑；Vercel Functions 可保留但不作为带持久化档案的主生产形态。

## 2026-09-09 表格每行口播独立语音控制与本地配套存储
- **决策**：在五字段脚本执行表每行口播栏内集成 3 个独立语音控制按钮（手动生成/试听小喇叭、重新生成、保存本地并记录下载 URL），并将音频统一配套存入 `public/audio/` 与 `public/pic/`（与截图同一目录和时间戳命名规范，如 `audio-YYYYMMDD-HHMMSS-ms-stepN.mp3`）。
- **原因**：满足用户针对不同步骤口播单独合成、试听验证与一键归档的需求。保存后将 `audioUrl` 直接写入当前响应式行状态树并在 UI 展示可复制标签与下载按钮，同时纳入导出产物状态，便于后续独立播放器或离线环境直接引用。
- **关联文件**：`server/fishAudioHandler.js`、`src/agent-b-v2/AgentBDirect.vue`

## 2026-08-22 handoff 字段注释注入
- **决策**：在 `server/agentBV2Handler.js` 新增 `HANDOFF_FIELD_NOTES` 注释表，发给模型时每个关键字段前注入 `_xxx_说明` 注释字段
- **原因**：模型读 handoff JSON 时第一眼就看到每个字段的用途，不依赖 prompt 有没有看完；只在发给模型时注入，不写进实体文件（保持实体文件干净）
- **覆盖字段（12 个）**：problemText / problemType / boardFocus / relatedKnowledge / knowledgeAnalysis / boardPlan / zoneAnchors / canvasParams / coordinateSpec / suggestedGrade / suggestedLayout / stageRatioSuggestion / topicLayout

## 2026-08-22 Check Agent 提示词独立
- **决策**：Check Agent 提示词从 handler 内嵌数组抽离为独立文件 `src/check-agent/prompt.js`
- **原因**：与 B/修缮 结构一致，便于维护；同时修复 coordinateMode 不同步、boardPlan 没传但 prompt 说参考的问题
- **配套**：`server/checkAgentHandler.js` 重构，从真相源读 boardPlan/coordinateMode 传给模型

## 2026-08-21 时间不预计算，全部下游动态算
- **决策**：B 模型只输出内容（stage/speech/board/actionSpec），不输出任何时间字段；时间由下游（音频平台/渲染）根据实际参数动态计算
- **原因**：音频实际时长由 TTS 引擎决定、板书时长由书写速度+行高+微随机决定，预估算没有意义；改语速/改书写速度就要重算全局时间线，维护成本高
- **行标识方案**：用 `{stage}-第N行`（如 `分析-第2行`）替代时间列，语义更清晰、更稳定
- **动作时间**：actionSpec 里的时间是相对本行起点的偏移量，不是全局绝对时间；改语速/书写速度不用重算全局
- **下游计算参数**：rowGapMs（行间隔）、speechSpeed（音频语速）、boardSpeed（板书速度）、actionSpeed（动作速度），全部从 handoff 动态取
- **已实施文件**：contract.js / prompt.js / timing.js / AgentBDirect.vue / speechMarkdown.js / checkAgentHandler.js / liyongle-elementary skill

## 2026-08-21 模型定位：参数换算器，不是答案生成器
- **决策**：Agent B 的本质是参数换算器，输入 handoff 真实布局参数 + 教学内容，输出每行板书的起手坐标和动作规格
- **唯一真相源**：handoff 文件，模型只从 handoff.canvasParams / boardPlan / zoneAnchors / coordinateSpec 取值，绝不自己编造或套用示例值
- **严禁**：模型输出任何时间字段、套用 prompt 示例值而不使用 handoff 真实值、自行估算或重排四区布局、两套参数同时发给模型造成混淆

## 2026-08-21 coordinateMode 接通
- **决策**：coordinateMode 单独发给模型（只发这一个字段，不发整套 canvasParams），坐标输出格式由 coordinateMode 决定
- **背景**：coordinateMode 是给下游视频生成器用的，有的要百分比坐标，有的要像素坐标；之前 UI 上能改但模型收不到，改了不生效
- **两种模式**：percentage = 百分比 0-100，pixel = 像素（基于 handoff.canvasParams.canvasSize 换算）
- **同步修正**：prompt.js 坐标规则从"强制百分比，禁止输出像素"改为"按 coordinateMode 输出"；coordinateSpec 字段说明从"必须遵循"改为"作为基准参考"

## 2026-08-21 zoneAnchors 命名统一
- **决策**：zoneAnchors 的 key 从 `topic` → `question`，与 boardPlan 对齐
- **原因**：之前 zoneAnchors key 叫 topic，boardPlan 里题目区叫 question，展示层读 question 拿不到 → 题目区显示"未规划"
- **配套**：题目区数据源从 topicLayout → boardPlan.question；题目区补上 w/h，四区结构完全一致

## 2026-08-17 URL 拼接修复位置
- **决策**：修复放在共享层 `server/http.js` 的两个请求 helper 中，全局生效
- **原因**：所有上游请求都经过这两个 helper，一处修复所有调用方受益，符合根因修复原则；避免在每个业务 handler 里重复加判断
- **边界**：仅增加路径后缀判断，不改动请求头、重试逻辑、超时逻辑、错误处理

## 2026-08-17 Agent B 默认配置升级
- **决策**：storage key 从 v1 升为 v2，默认配置切换为 Agnes API
- **原因**：旧 v1 缓存里的 Claude 配置会污染新默认值，升级 key 可强制使用新配置
- **回滚**：如需恢复旧配置，将 `STORAGE_KEY` 改回 v1 即可

## 2026-08-18 工具与跨环境兼容钉子
- **ESM 配置路径**：`vite.config.js` 不使用 `__dirname` 或 `import.meta.dirname`。前者触发 Vite `configLoader: 'native'` 兼容警告，后者可能在较旧云端 Node 不存在；统一使用 `dirname(fileURLToPath(import.meta.url))` 动态定位配置文件目录，禁止硬编码本机或服务器绝对路径。
- **Vue 语法验证**：不可用 `node --check *.vue`，Node 不认识 `.vue` 扩展会报 `ERR_UNKNOWN_FILE_EXTENSION`；Vue SFC 的真实语法验证以 `npm run build` 为准。
- **Windows 临时路径**：Node 在 Windows 下不要假定 `/tmp` 存在（会解析为如 `K:\tmp`）；临时文件使用 `process.env.TEMP || process.env.TMP`，且不得写入仓库。
- **RTK 与 shell**：`rtk` 可能输出"hook 未安装"提示，不等于命令失败；以退出码及后续明确结果判断。复杂的 shell 内嵌引号/补丁易损，优先 heredoc 或基于 Git 基线生成临时补丁。
- **精确暂存**：混入前序改动的文件，先 `git reset HEAD -- <file>`（只撤暂存，不丢工作区），再从 `git show HEAD:<file>` 构造并 `git apply --cached` 最小补丁；精确暂存完成后检查 `git diff --cached --check`、`git diff --cached -- <file>` 与双状态 `MM`。遇到补丁失败先确认基线上下文和系统临时目录，禁止反复盲试。
- **并行验证**：工具批次中一条命令非零会使同批后续命令被保护性跳过；`git diff` 在工作区有既有改动时可能非零，不能与构建/自检绑在同一批。验证命令和可能非零的状态/差异命令必须分开。
- **构建 warning**：`chunk size warning` 不阻断部署；禁止仅调高 `chunkSizeWarningLimit` 隐藏问题。先用 `defineAsyncComponent(() => import(...))` 把非首屏预览拆为异步 chunk，再根据真实性能数据决定是否继续拆分。

