# 领地 A：Agent B 核心契约白皮书

> 状态：【已清洗，0置信复核通过】
> 责任范围：大模型提示词构造、输入提取、输出原始 JSON 格式
但是全部代码里面可能还是有东西，需要搜索关键词，看看哪些还在关系

## 1. 输入真相源
Agent B 只认 `handoff`：
- `boardPlan`：四区 `question`, `analysis`, `solution`, `summary` 的参考范围 `{x, y, w, h}`。
- `coordinateMode`：输出格式唯一决定者 (`percentage` 或 `pixel`)。
- `canvasParams`：画布基准。

## 2. 输出 JSON 契约规范
```json
{
  "rows": [
    {
      "stage": "题目|分析|解答|总结",
      "speech": "可直接朗读给TTS的纯文字口播稿",
      "board": {
        "startDelay": 1.5,
        "content": "板书LaTeX或文字"  ##注意事项：mei
      },
      "actionSpec": []
    }
  ]
}
```

> **2026-09-14 契约收口（以代码为准）**：`board` 只有 `content` + `startDelay` 两个字段，**不输出 `startCoord` 起手坐标**。
> - 证据 1（提示词）：`src/agent-b-v2/prompt.js` 5.1 与 1.4 明确「不输出或计算板书起手坐标，排版由渲染层负责」。
> - 证据 2（契约）：`contract.js` 的 `normalizeBoard()` 只返回 `{content, startDelay}`，即便模型夹带 `startCoord` 也会被剥离。
> - 证据 3（产物）：最新 `public/board-result/board-result-20260914-215611-056.json` 的 rows.board 仅含 content/startDelay，全文无 `startCoord`。

## 3. 蛀虫排查警戒线（发现下列行为立即判定为违规）
- ❌ **蛀虫行为 1**：让 B 输出 `durationMs`、`gapAfterMs` 等具体耗时（应由下游算）。
- ❌ **蛀虫行为 2**：板书写口播谐音，或者口播写 LaTeX 命令（例如语音读 `\frac`）。
- ❌ **蛀虫行为 3**：让动作与板书同时播放（必须单手串行，先写后动）。
- ❌ **蛀虫行为 4**：让 B 自行去算随机像素抖动或旋转度数（属于渲染层）。
- ❌ **蛀虫行为 5（2026-09-14 新增）**：让 B 输出板书起手坐标 `startCoord` / 固定行高 / 固定行距 / 横向错位规则 —— 排版属领地 E，B 只写「写什么」和「何时落笔（`startDelay`）」。`coordinateMode` 只约束 `actionSpec` 的 start/end。
