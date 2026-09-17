# 施工图与全局锚点索引 (Xiaxia Anchor Marking)

> **施工索引与回归入口，不是第二真相**。字段业务规则与合同以 `src/services/stepHandoff.js`、`src/agent-b-v2/contract.js` 及代码运行时为准。

## 一、主链路图谱与全局可搜索 ID

```mermaid
flowchart TD
    subgraph S1["第 1 步：题目贴题与识别 (Step 1)"]
        U1["🔌 题文/题图输入<br/>Step1Entry.vue<br/>ID: qh-a-input-001"] --> A1["⚡ 视觉/文本题型识别<br/>POST /api/recognition/problem<br/>ID: qh-a-recognize-001"]
        A1 --> P1["💾 题目四区骨架与布局规划<br/>buildStep1Handoff<br/>ID: qh-a-confirm-001"]
    end

    subgraph S2["第 2 步：Agent B 生成与契约收口 (Step 2)"]
        P1 --> B1["⚡ 五字段行生成<br/>POST /api/agent-b-v2/generate<br/>ID: qh-b-generate-001"]
        B1 --> E1["💾 五字段响应式编辑 rows<br/>AgentBDirect.vue<br/>ID: qh-b-edit-001"]
        E1 --> C1["⚡ 可选后置 Check Agent C<br/>POST /api/check-agent/check<br/>ID: qh-c-check-001"]
    end

    subgraph S3["第 3 步：板书工具与渲染层 (Step 3)"]
        E1 --> R1["📦 统一动作提取与规范化<br/>normalizeActionSpecItem<br/>ID: qh-act-norm-001"]
        R1 --> T1["⚡ 文本锚点定位与高亮<br/>roughNotationTool<br/>ID: qh-tool-notation-001"]
        R1 --> D1["⚡ 几何线条与图形绘制<br/>roughDrawingTool<br/>ID: qh-tool-draw-001"]
        T1 & D1 --> Sched["🔄 拟人单手串行调度器<br/>handActionScheduler<br/>ID: qh-sched-serial-001"]
        Sched --> View["🎨 真画布分层渲染 L1-L4<br/>RealBoardPreview.vue<br/>ID: qh-board-render-001"]
    end
```

## 二、标准锚点对照表 (7层归属)

| 锚点 ID | 归属层级 | 接入类型 | 触发与代码文件 | 数据与接口绑定 | 边界与防崩兜底策略 |
|---|---|---|---|---|---|
| `qh-a-input-001` | event | `🔌` | `src/components/Step1Entry.vue` | 输入框 `problemText`、图片粘贴 | 图片读取异常时提供空态提示 |
| `qh-a-recognize-001` | api | `⚡` | `src/services/recognitionClient.js` | `POST /api/recognition/problem` | 模型识别异常自动回退纯文本流程 |
| `qh-a-confirm-001` | truth | `💾` | `src/services/stepHandoff.js` | `buildStep1Handoff` 产物 | 统一字号(30/35)、1726×980 唯一真源 |
| `qh-b-generate-001` | api | `⚡` | `src/agent-b-v2/service.js` | `POST /api/agent-b-v2/generate` | 纯文本 handoff 过滤传输，防超限 |
| `qh-b-edit-001` | state | `💾` | `src/agent-b-v2/AgentBDirect.vue` | 响应式 `rows` 五字段表 | 用户实时编辑作为最终交付真相 |
| `qh-c-check-001` | api | `⚡` | `src/check-agent/service.js` | `POST /api/check-agent/check` | 可选双眼，失败不破坏 A/B 结果 |
| `qh-act-norm-001` | state | `📦` | `src/components/RealBoardPreview.vue` | `actionSpec` 提取与归一化 | 过滤无效项与 capabilityGap |
| `qh-tool-notation-001` | ui | `⚡` | `src/board-tools/roughNotationTool.js` | `underline`, `circle`, `box` | 找不到目标文字时安全降级，不中断 |
| `qh-tool-draw-001` | ui | `⚡` | `src/board-tools/roughDrawingTool.js` | `rough-line`, `rough-arrow`, `draw` | 兼容 draw 意图并安全转换为真实绘制 |
| `qh-sched-serial-001` | event | `🔄` | `src/board-tools/handActionScheduler.js` | 单手串行、抬笔间隔、断点调度 | 隔离单步崩溃，保证后置动作平滑执行 |
| `qh-board-render-001` | ui | `🎨` | `src/components/RealBoardPreview.vue` | L1 底图、L2 固定四区、L3 生成层 | 1726×980 等比缩放，坐标防溢出 |
| `qh-cdn-loader-001` | risk | `⚠️` | `src/utils/cdnLoader.js` | 双 CDN 加载 + 超时熔断 | 远程资源失败回退系统楷体，防挂起 |
| `qh-loop-verify-001` | verify | `🔐` | `PROJECT_STATE.md` | `npm run check:proxy` 与实时热更 | 保证主链路纯净无阻断 |

## 三、锚点类型统计 (Xiaxia Anchor Stats)

- `⚡` API 与工具接入点：5 处
- `💾` 数据绑定与状态：3 处
- `🔌` 用户交互与事件：1 处
- `🔄` 实时与时序调度：1 处
- `📦` 数据转换与适配：1 处
- `🎨` 动态视图渲染：1 处
- `⚠️` 容错熔断与降级：1 处
- `🔐` 最小验证与红线：1 处
- **总计可搜索锚点**：14 处
