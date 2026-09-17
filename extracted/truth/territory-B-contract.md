# 领地 B：合同守门人与防御机制
但是全部代码里面可能还是有东西，需要搜索关键词，看看哪些还在关系
> 状态：【已清洗，0置信复核通过】
> 责任范围：`src/agent-b-v2/contract.js`

## 1. 职责边界
不负责创作教学内容，只负责：
1. **输入解析与容错修复**（`parseJsonObject`、`normalizeStage`、`normalizeBoard`）。
2. **历史坐标剥离与 board 归一化**（`normalizeBoard` / `sanitizeRowLayout`）。

## 2. 核心兜底机制
- **历史坐标剥离**：`normalizeBoard()` 只产出 `{content, startDelay}`；v1 字符串里的 `[x%, y%]` 前缀、v2 对象里的 `startCoord` 一律丢弃（**契约层不再產生、也不再校准板书坐标**）。
- **自适应延时补齐**：若模型漏输出 `startDelay`，根据字符量自动合理分配起手秒数。
- **排版不在本层**：起手位置、换行、行距、防重叠由领地 E 渲染层负责；`sanitizeRowLayout()` 只做 board 归一化，不再改写坐标。

> **2026-09-14 契约收口（以代码为准）**：原「垂直防粘连 / 下界限位」坐标算法已下线（`polishBoardSpacing` 空转、`checkAgentHandler` 的 `board_coord` 字段已移出白名单），因为新板书根本不带坐标。

## 3. 蛀虫排查警戒线
- ❌ **蛀虫行为 1**：在合同层暴力丢弃整表（必须容错温和吸附）。
- ❌ **蛀虫行为 2**：合同层硬编码固定像素值而忽略 `coordinateMode`。
