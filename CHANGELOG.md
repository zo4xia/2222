# 变更日志

所有版本变更记录。日期格式 YYYY-MM-DD，时区 Asia/Shanghai。

## [1.0.0] - 2026-09-20

### Added — 核心功能
- 小学数学讲题视频生成工作台全链路 (Step1 识别 → Step2 生成 → Step3 校验 → Step4 演播 → Step5 导出)
- Agent A/B/C 三 agent 架构，配置完全独立
- 1726×980 四区画布预览 (question/analysis/solution/summary)
- 7 个 skill 沉淀 (board-zone-layout / handwriting-font-policy / hand-action-control / speech-board-timing / field-char-escape-filter / board-lecture-player / blingbling小眼睛)
- 7 个可交互 demo (public/skills-hub/)
- 标准化模板 (handoff.schema.json / deliverable.schema.json / HANDOFF_API_SPEC.md / DELIVERABLE_API_SPEC.md / integration-guide.html)
- truth/ 真相基线 (00-TRUTH-BASE + 5 领地分章 + 用户原话汇总)
- row-player.html 单文件播放器 (133KB, 含 superFilter + AgentCanvas 控制桥 + URL 参数加载)

### Added — 模块化
- src/lib/parseLLMJson.js — 5 级 JSON 解析唯一真源 (6 处合并)
- src/utils/superFilter.js — 10 步过滤流水线 (LaTeX→Unicode / 缺字降级 / 除号→\frac)
- src/board-tools/stableHash.js — FNV-1a 32-bit hash 唯一真源 (2 处合并)
- src/agent-b-v2/composables/useBCache.js — B 生成缓存 (24h TTL)
- src/agent-b-v2/composables/useApiSpecDrawer.js — 下游 API 规范抽屉
- src/check-agent/skillViolations.js — 5 技能红线校验

### Added — 测试
- test-parseLLMJson.mjs (16 用例)
- test-timing-fix.mjs (5 用例, 字数统计 bug 修复)
- test-timing-computeRowGroup.mjs (7 用例 + 6 不变量, timing 重构)
- smoke-test-skills.mjs (11 用例, 5 技能反模式校验)
- validate_contract.cjs (board-lecture-player 三条非协商修订校验)

### Added — UI/UX
- B 页交接状态进度条独立 (a-steps 6 步, 在交接台卡片外)
- B 页三大卡片 a-tabs 切换 (配比+参数 / 元数据 / 题目分析+知识点)
- B 页画布预览区 (RealBoardPreview, 生成后自动出现)
- 优化确认按钮呼吸小红点 (refine-pulse-dot)
- 三个 tab 头呼吸红点
- 棕色表头 16px (层次感)
- 2 列 descriptions (短行不占整行)
- 参数台默认展开
- 易错点 (commonMistakes) 补回
- 按钮精简 12→5+2 (生成/ASR/Check/演播/导出 + 配置 + 风格)
- 歧义弹窗 (弃用字段检测 → message.warning)
- 静默软提示 (生成失败不直接弹 message.error)

### Changed
- AgentBDirect.vue: 5372 → 5166 行 (-206 行, -3.8%)
- timing.js: 316 → 252 行 (-64 行, 抽 appendBoard + appendActionLoop helper)
- contract.js: normalizeBoard 剥离 startCoord + 弃用字段检测
- renderBoardContent: 接入 superFilter 10 步清洗
- duration: 毫秒 → 秒 (row-player 合同统一)
- openHanddrawPlayer: /deliverable/row-player.html → /row-player.html?deliverable=Blob URL
- renderDeliverableHtml 模板路径: public/deliverable/row-player.html → 根 row-player.html
- check-agent/service.js: 接入 auditRowsBySkills (不阻断, 进 changes 报告)
- parseBoard ×4 变体去重 → contract.js#normalizeBoard 唯一真源
- setLayoutPreset 4 分支 → 表驱动
- estimateActionDuration 嵌套 if → 表驱动
- onRowDrop 4 分支 → 三元链
- 6 处手搓 JSON parser → parseLLMJson.js 唯一真源
- 2 处 FNV-1a hash → stableHash.js 唯一真源

### Fixed
- 画圈失效 (Task 8 误删 BOARD_MARK_COLORS/ROUGH_DRAWING_COLORS import)
- 字数统计 UI vs timing 分叉 (UI 不剥标点 vs timing 剥标点 + 1500ms 下限)
- deliverable/current.json 双重嵌套
- 两份 DELIVERABLE_API_SPEC.md 100% 重复 → 软链接
- row-player.html URL 参数无法传入 (加 loadFromUrlOrDefault + Blob URL 支持)
- superFilter 10 步过滤层完全丢失 (只存在于 row-player.html, 从未接入 Vue src/)
- 演播按钮打开的是 Vue 应用壳 (URL 指向不存在的文件 → Vite SPA 兜底)
- renderBoardContent v-html 不转义不过滤 (注入风险 + LaTeX 源码落板)
- duration 单位合同错 (ms vs 秒 → 时长膨胀 ×1000)
- 7 处死 CSS 清理
- 6 处 dead code 清理 (imports/consts/function)
- cdnLoader.js 197 行整文件无人 import → 删除
- prompt-v3-draft.js 与 active prompt.js 重叠 65% → 仅 /tmp 残留
- 死代码: openLitePlayer 函数 / stageAccentColors / stageTagColors / LoadingOutlined import

### Removed
- lite-player.html (被 row-player.html 取代)
- board-playground.html (归档)
- cdnLoader.js (无人引用)
- 还原按钮 + revertCheck 函数 + import revertCheckResult (用户要求删除)
- 旧"提示词"按钮 (改为风格切换下拉)
- 导出完整要素表 MD (分镜总表已够)
- 生成交付单页独立按钮 (合并到演播)
- 下游 Agent 规范独立按钮 (合并到导出下拉)
