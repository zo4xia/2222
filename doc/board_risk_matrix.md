# 板书子系统 · 风险矩阵（阶段一交付物 2/3）

> 基于真实代码读取（verified code is truth）。每条风险附「证据位置」与「影响面」。
> 评级：P0 阻断主链 / P1 功能残缺 / P2 技术债 / P3 优化。

## 一、风险矩阵

| ID | 风险 | 证据（真实代码） | 影响 | 评级 | 建议（待夏夏确认后执行） |
|---|---|---|---|---|---|
| **R1** | rough-notation 仅 question 区可运行，analysis/solution/summary 区圈画/下划线必崩 | `BoardContentLayer.vue:551` 仅 `data-board-region="question"`；`RealBoardPreview.vue:44` `querySelector([data-board-region="${region}"])`；`textTargetRegistry.js:116` `requireElement(resolveRegion(region))` 找不到即抛「找不到标记区域」 | Agent B 对分析/解答/总结区做文本标记 → 运行时抛错降级为 no-op，孩子看不到重点标注 | **P1** | 在 `BoardContentLayer` 给 analysis/solution/summary 三区补 `data-board-region` 打标；或让 `resolveRegion` 回退到 `boardPlan` 区域 bounds |
| **R2** | draw 意图工具是执行空壳（注册+校验但 `execute` 为空） | `boardToolCatalog.js:86-95` 给 `DRAW_INTENT_TOOL_ID` 返回 `{ execute: () => {}, remove: () => {} }`；真实几何绘制由 `roughDrawingTool` 的 rough-line/rough-arrow 承担 | `draw` 工具在运行时什么都不画，Agent B 若误用则静默无输出；与 rough-drawing 能力重叠，属死重 | **P2** | 要么接上 draw 的真实执行（复用 roughDrawingTool），要么从 catalog/validate 移除，避免误导 Agent B |
| **R3** | L4 用户画笔层未实现 | `RealBoardPreview.vue:181` 仅 `<div class="board-layer-l4" aria-hidden="true" />`，注释「交互由下一步 Agent C 实现」 | 当前板书不可由用户手绘/擦除，仅 Agent B 单向播放 | **P3** | 属已声明的后续能力，不在本次范围；记录以备 Agent C 接入 |
| **R4** | 手写字体范围断言约束与板书区不一致 | `boardTypography.js:47` `assertHandwritingScope` 仅放行 `analysis/solution/summary`，question 单列；但 rough-notation 默认可标 question（R1 区） | 字体策略层与标记层对 question 区的语义存在张力，扩展标记区时易踩坑 | **P2** | 统一「哪些 region 允许手写/标记」的单一事实源，消除 boardTypography 与 roughNotation 的分裂 |
| **R5** | 时序全程序控制、seed 确定性，但无失败重放/断点续播 | `boardToolTiming.js` + `handActionScheduler.js` 串行互斥，无持久化播放进度 | 播放中途异常无法从断点恢复，长板书易整体失败 | **P2** | 调度器补订阅态持久化或步骤级 try/catch 隔离，单步失败不阻断后续 |

## 二、止血优先级（三板斧）

1. **立即止血（P1）**：R1 —— 不修则 analysis/solution/summary 三区文本标记全废，是真实功能残缺，优先级最高。
2. **下一轮清理（P2）**：R2（draw 死重）、R4（字体/标记语义分裂）、R5（无断点续播）—— 不影响主链但积累技术债。
3. **规划中（P3）**：R3（L4 用户画笔）—— 已声明归属 Agent C，本次不动。

## 三、跨模块耦合热点

- `resolveRegion` 是 R1 的单点故障源：被 `RealBoardPreview`、`textTargetRegistry`、`roughNotationTool` 三处共用，改一处需同步三处契约。
- `boardPlan` 区域坐标（stepHandoff/boardLayout）是 rough-drawing 的唯一 bounds 真相，与渲染层 `data-board-region` 是两套平行的区域表达（DOM 属性 vs 坐标对象），R1 正是两套表达未对齐所致。
