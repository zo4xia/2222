# Ponytail Debt Ledger

> 按 ponytail-debt SKILL 方法论收集的 `ponytail:` 标记清单
> Task ID = 8 · 2026-09-19

## 扫描结果

```bash
grep -rnE '(#|//|/\*) ?ponytail:' . 2>/dev/null
```

## 标记清单

| 位置 | 标记内容 | 天花板 | 升级路径 |
|---|---|---|---|
| `src/agent-b-v2/timing.js:11` | `// ponytail: 唯一字数算法真源 — UI 显示与 timing 计算都 import 这个，消除"剥/不剥标点"分叉` | 无（这是真源标记，不是延迟项） | — |
| `src/agent-b-v2/timing.js:28` | `// ponytail: 唯一口播时长估算 — UI 与 timing 共用，统一含 1500ms 下限 + 标点停顿` | 同上 | — |
| `src/agent-b-v2/AgentBDirect.vue:392` | `// ponytail: 唯一字数+时长真源来自 timing.js (countCharacters 剥标点 + estimateSpeechDurationMs 含 1500ms 下限 + 标点停顿)` | 同上 | — |

## 延迟项（marked for later，尚未标 `ponytail:`）

按 L1/L2/L3 报告，以下为本次审计识别但**未在本轮 P0 修复范围**的延迟项，建议下次重构时执行：

| 优先级 | 位置 | 动作 | 收益 |
|---|---|---|---|
| P1 | `src/agent-b-v2/AgentBDirect.vue` 整体 5372 行 | 拆分为 10 子组件 + 7 composables + 1 css | -4872 行迁移 |
| P1 | `src/agent-b-v2/prompt-v3-draft.js` | 在 /tmp 历史快照残留，与 active prompt.js 重叠 65% | -490 行（仅 /tmp） |
| ✅ | 全项目 6 处手搓 JSON parser | 抽 `src/lib/parseLLMJson.js` | Task 9 已落地 |
| ✅ | `src/agent-b-v2/AgentBDirect.vue` 死 CSS 7 处 | 删除 | Task 9 已落地 |
| P2 | `katex` / `rough-notation` / `roughjs` 3 deps | 手搓原生替代（小学数学场景） | -3 deps |
| ✅ | `parseBoard` × 4 变体去重 | 归并 `contract.js#normalizeBoard` | Task 10 已落地 |
| P2 | `computeRowGroupTimeline` 三大分支抽 helper | `appendAction/appendBoard` | -60 行 |
| ✅ | FNV-1a hash ×2 | 抽 `board-tools/stableHash.js` | Task 10 已落地 |

## 净收益累计

```
本轮 P0 修复 (Task 8 + Task 9):
  Task 8 (ponytail 审计 + 字数 bug):
    - 修字数统计 bug (UI vs timing 分叉) — 真源统一到 timing.js
    - 删 dead code: LoadingOutlined / BOARD_MARK_COLORS / ROUGH_DRAWING_COLORS import + stageAccentColors / stageTagColors / openLitePlayer 函数
    净: -23 行 + 修一个真 bug

  Task 9 (模块化拆分):
    - P0-1: 创建 src/lib/parseLLMJson.js 唯一 JSON parser
    - P0-2: 6 处手搓 parser (contract / check-agent / 4 server handler) 全部 import parseLLMJson, 删本地实现
    - P0-3: 删 7 处死 CSS (-79 行), 补回 1 处误删 (+4 行)
    - P0-4: 拆 2 个 composables (useBCache -57 行 / useApiSpecDrawer -41 行)
    净: -183 行 (5372 → 5189)

  合计本轮: -206 行 + 修一个真 bug + 创建 1 个共享 util + 2 个 composables

  Task 10 (最简优先, 5 项 P2):
    - P2-a: 抽 stableHash.js 合并 FNV-1a ×2 (textTargetRegistry + roughDrawingTool)
    - P2-b: parseBoard ×4 变体去重 (AgentBDirect + speechMarkdown + RealBoardPreview → normalizeBoard)
    - P2-c: setLayoutPreset 4 分支 → 表驱动
    - P2-d: estimateActionDuration 嵌套 if → 表驱动
    - P2-e: onRowDrop 4 分支 → 三元链
    净: -23 行 + 消除手搓重复 + 4 处 shrink

  合计 (Task 8 + 9 + 10):
    AgentBDirect.vue: 5372 → 5166 行 (-206 行, -3.8%)
    新增模块: parseLLMJson.js + stableHash.js + 2 composables
    6 处 JSON parser + 2 处 FNV hash + 4 处 parseBoard 全部去重
    4 处多分支简化为表驱动/三元链

后续 P1+P2 延迟项 (未做):
  - 拆 10 子组件 + 5 composables (高风险, 单独排期)
  - 替换 3 deps (katex/rough-notation/roughjs)
  - computeRowGroupTimeline 三大分支抽 helper
  net: -~5100 lines, -3 deps possible.
```

## 本轮已落地（Task 9 完成项）

| 项 | 文件 | 状态 |
|---|---|---|
| P0-1 唯一 JSON parser | `src/lib/parseLLMJson.js` (88 行) + `scripts/test-parseLLMJson.mjs` (16 用例全过) | ✅ |
| P0-2 替换 6 处本地实现 | `src/agent-b-v2/contract.js` / `src/check-agent/contract.js` / `server/{recognitionHandler,knowledgeRefineHandler,checkAgentHandler,agentBV2Handler}.js` | ✅ |
| P0-3 删 7 处死 CSS + 补回 1 处误删 | `src/agent-b-v2/AgentBDirect.vue` (-79 行 + 补 4 行) | ✅ |
| P0-4a 拆 useBCache | `src/agent-b-v2/composables/useBCache.js` (66 行) | ✅ |
| P0-4b 拆 useApiSpecDrawer | `src/agent-b-v2/composables/useApiSpecDrawer.js` (62 行) | ✅ |

## 验证全过（Task 9 P0-5）

- ✅ parseLLMJson 16/16 用例通过
- ✅ timing 字数 bug 修复验证（UI vs timing 已统一）
- ✅ skillViolations 11/11 通过
- ✅ board-lecture-player validate_contract PASS
- ✅ agent-browser 主页挂载 19535 / 无运行时错误 / 无 console error / title 正确
- ✅ 黄金路径：题目输入按钮存在 (disabled 状态等输入)
