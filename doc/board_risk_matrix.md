# 板书子系统 · 风险矩阵（阶段一交付物 2/3）

> 基于真实代码读取（verified code is truth）。每条风险附「证据位置」与「影响面」。
> 评级：P0 阻断主链 / P1 功能残缺 / P2 技术债 / P3 优化。

## 一、风险矩阵

| ID | 风险 | 证据（真实代码） | 影响 | 评级 | 建议（待夏夏确认后执行） |
|---|---|---|---|---|---|
| **R1** | ~~rough-notation 仅 question 区可运行~~ → **已最小修复（2026-10-13 复核）**：RealBoardPreview.vue L3 层已为 analysis/solution/summary 渲染真实文本锚点（L241-255 `v-for region` + `:data-board-region="region"` + boardTextRows 文本 span），textTargetRegistry 查得到目标 | 遗留：BoardContentLayer.vue:605（L2 唯一渲染边界）仍仅 question 打标，L2/L3 双区表达并行——扩展标记区时仍需同步两套 | Agent B 三区文本标记已可运行；残余为双区表达一致性债 | **P3（降级）** | 后续将 L2 的区域打标一并补齐或收敛为单一区域表达 |
| **R2** | ~~draw 意图工具是执行空壳~~ → **已失效（2026-10-13 复核）**：boardToolCatalog.js L95-99 现挂 `prepareDrawIntentAction(action, { resolveCanvas })`；drawIntentTool.js L99 起有 220+ 行真实 prepare/execute（rough.js 几何绘制） | 无 | 无 | **已关闭** | — |
| **R3** | L4 用户画笔层未实现 | `RealBoardPreview.vue` L4 仅空 div aria-hidden，注释「交互由下一步 Agent C 实现」 | 当前板书不可由用户手绘/擦除，仅 Agent B 单向播放 | **P3** | 属已声明的后续能力，不在本次范围；记录以备 Agent C 接入 |
| **R4** | ~~手写字体范围断言约束与板书区不一致~~ → **已关闭（2026-10-13 复核）**：`boardTypography.js` 从未存在于仓库（臆造引用），`assertHandwritingScope` 全仓零命中；`boardTypography.css`（@font-face 死链 /fonts/pingfang-qiaomu.ttf + family 零消费）已于第五轮连根砍除 | 无 | 无 | **已关闭** | 现行层级校验真源 = `src/check-agent/skillViolations.js` |
| **R6** | draw 意图工具半孤岛：生成侧注册 + 工作台可渲染（prepareDrawIntentAction 220+ 行真实实现），但 prompt.js §5.2 不教（只教工具 1/2/3）、row-player drawAction 无 draw 分支（落入 notation 分支 exactText 失配即跳过）、check skillViolations ALLOWED_TOOLS 无 draw | boardToolCatalog.js 四工具注册 vs prompt.js 三工具教学 vs 播放端零 draw 渲染 | B 永不输出 draw → 注册能力业务流不触达；若模型自造 draw 动作，check 报违规 + 播放端静默跳过 | **P3（新，第七轮）** | 二选一待夏夏拍板：A) prompt 补教 + row-player 实现 draw 渲染（feature 级）；B) catalog 摘除 draw 收敛三工具（反向归一） |
| **R5** | ~~时序全程序控制、seed 确定性，但无失败重放/断点续播~~ → **已最小修复（2026-10-13 第六轮）**：实锤更深病理——boardToolCatalog.prepare() 三处降级路径引用未导入的 MIN_HAND_LIFT_GAP_MS，降级自身 ReferenceError 炸死整批播放（Agent B 自造工具名 / exactText 失配均触发，复现脚本三路径证据）；修复 = 补 import + 降级工厂归一 degradedPlan()（prepare 永不抛）+ RealBoardPreview per-task catch 隔离 + 估算器/执行器常量归一（timing.js HAND_LIFT_GAP_MS 600→真源 1000），回归测试 8 用例挂主套件 | 残余：单步失败已隔离不阻断；全量断点续播（进度持久化+恢复 UI）归后续 feature | 单步隔离落地，估算与执行同源 | **P3（降级）** | 断点续播作为独立 feature 规划（需存储设计与 UI 入口决策） |

## 二、止血优先级（三板斧）

> 2026-10-13 第七轮复核更新：R1/R5 已降 P3，R2/R4 已关闭，**新增 R6（draw 半孤岛，P3 待拍板）**——活跳蚤 = R1 残余/R3/R5 残余/R6 四个 P3，活 P2 清零。另：第七轮已接通 circle 契约全链（生成/校验/估算三白名单 + prompt/播放端对齐），动作标记链路无已知分裂。

1. ~~**立即止血（P1）**：R1~~ → 已最小修复（RealBoardPreview L3 三区真实文本锚点）。
2. ~~**下一轮清理（P2）**：R5~~ → 已最小修复（降级路径防 booby-trap + per-task 隔离 + 估算/执行常量同源；回归测试 scripts/test-board-tool-catalog.mjs 8 用例挂主套件）。
3. **规划中（P3）**：R5 残余（断点续播 feature）、R1 残余（L2/L3 双区表达并行）、R3（L4 用户画笔）、R6（draw 半孤岛方向拍板）—— 已声明归属后续迭代。

## 三、跨模块耦合热点

- `resolveRegion` 是 R1 的单点故障源：被 `RealBoardPreview`、`textTargetRegistry`、`roughNotationTool` 三处共用，改一处需同步三处契约。
- `boardPlan` 区域坐标（stepHandoff/boardLayout）是 rough-drawing 的唯一 bounds 真相，与渲染层 `data-board-region` 是两套平行的区域表达（DOM 属性 vs 坐标对象），R1 正是两套表达未对齐所致。
