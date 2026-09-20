# 工具串联指南（开工必读）

## 四件武器

| 工具 | 干什么 | 何时用 |
|---|---|---|
| codegraph | 扫代码结构+调用链+源码 | 改代码前必用，替代Glob+Grep+Read |
| Knowledge Graph Memory | 实体+关系图谱，经验固化 | 关键决策/设计/坑点立刻写 |
| context-mode | 压缩大输出，索引知识库 | 输出超200token压缩，大文档先索引 |
| session-forge | 会话记忆，决策/死胡同/检查点 | 每3-5次调用存检查点 |

## 串联流程

```
新会话 → 读Knowledge Graph Memory → 读session-forge → codegraph扫代码 → 改代码 → 决策写图谱 → 大输出压缩 → 检查点 → 结束标记完成
```

## 用法

**codegraph**：`mcp__codegraph__codegraph_explore`，参数 query/projectPath(K:\4)/maxFiles

**Knowledge Graph Memory**：
- 建实体：`mcp__knowledge_graph_memo__create_entities`
- 建关系：`mcp__knowledge_graph_memo__create_relations`
- 加观察：`mcp__knowledge_graph_memo__add_observations`
- 读图谱：`mcp__knowledge_graph_memo__read_graph`
- 搜节点：`mcp__knowledge_graph_memo__search_nodes`

**context-mode**：`mcp__context_mode__ctx_index` / `ctx_search` / `ctx_execute` / `ctx_batch_execute`

**session-forge**：
- 检查点：`mcp__session_forge__session_checkpoint`
- 决策：`mcp__session_forge__decision_record`
- 死胡同：`mcp__session_forge__dead_end_record`
- 恢复：`mcp__session_forge__full_context_recall`

## 铁律

1. 改代码前必codegraph，不猜
2. 关键决策立刻写图谱，好记性不如烂笔头
3. 大输出超200token必压缩，错误全留前3后2
4. 每3-5次调用存检查点，防崩溃丢进度
5. 新会话先读图谱+检查点，不靠对话记忆
6. caveman+headroom全程开启，降噪省token
