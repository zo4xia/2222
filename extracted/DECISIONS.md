# 重要决策

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

