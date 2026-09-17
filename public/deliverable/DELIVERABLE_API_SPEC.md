# 教学课件与音画微课交付物 API 规范（v2.0.0）

> 校验契约：`/deliverable/deliverable.schema.json`
> 消费对象：三方 API 接入方、下游课件/画布 Agent（自行安装配套 skills 后按本规范消费）
> 验收标准（盲测线）：**只给一个 deliverable JSON，Agent 能否顺利生成教学板。能 = 合格；不能 = 不合格。**
>
> **合格 = 一个零上下文 Agent 拿到这份 JSON + `row-player.html` 模板，就能把任意一道题的板书完整、正确地演出来。**
> 换位自检：如果我只拿到这一个 JSON、别的什么都不知道，我缺什么就演不出来？缺的那些，就是必须输出的参数。

## 一、五条核心消费规则

1. **每个 row 是一组独立的原子播放单元**，row 之间顺序衔接。
2. **speech 语音贯穿全程**：每 row 的口播从 `startOffsetMs=0` 持续到 row 结束。
3. **板书（board）与动作（actionSpec）在时间上绝对互斥**：一维时间线上没有交集，动作只插在板书前后的时间缝隙里（单手操作模型）。
4. **动作时长严格定量 1~2 秒**，语义上是口播句子中的标点停顿。
5. **直接消费每个 row 的 `exclusiveExecutionPlan` 数组**，按 `startOffsetMs` 依次触发（`plan` 为其兼容别名）。

## 二、顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `projectCode` | `YYYYMMDD-HHMMSS-SSS` | 项目编码（服务端唯一真源生成）；归档文件 = `deliverable-<projectCode>.json/.html` |
| `problemText` | string | 题目全文 |
| `sourceImageUrl` / `keepOriginal` | string / bool | 原题图片与是否贴入题目区（图片题） |
| `topicLayout` / `boardPlan` | object | Agent A 画布落座布局与四区坐标锚点 |
| `screenshotUrl` | string | 原题截图持久资产地址 |
| `specAnnotation` | string | 画布规格批注：1726×980、比例、题目/板书字号、四区坐标区间、越界与手稿风格 |
| `meta` | object | problemType / boardFocus / gradeLevel / knowledgeTitle / canvasSize |
| `stats` / `checkInfo` | object | 统计与 Check Agent 校对信息 |
| `canvasParams` | object | **handoff 画布参数（唯一真相源，动态读取）**：画布尺寸/坐标体系/四区字号字体颜色/行高/板书与动作速度。详见「二之二」 |
| `uiSettings` | object | **B 页面 UI 可调参数**：坐标计算方式、题目字号/字体/行高、行间隔、音频播放速度策略。详见「二之二」 |
| `problemInfo` | object | **题目全量信息与环节配比**：截图地址、题型、关联知识点、教学重点、关键公式清单、区域锚点、环节配比占比。详见「二之二」 |

## 二之二、下载物唯一真相源块（2026-09-17 新增）

> 口径：**导出物严格以 handoff 文件动态读取的参数作为唯一真相源**，禁止下游另写一套默认值。
> 注入方：`AgentBDirect.vue` 的 `serializeCurrentDeliverableState()` → `serializeDeliverableState()` 根节点；
> 服务端 `writeDeliverableFile()` 原样透传写盘（缺失显式置 `null`，保证结构稳定），`current.json` 指针内的 `deliverable` 即同一份对象。

### 1. `canvasParams`（handoff 画布参数，真相源）
| 参数 | 标准结构 |
|---|---|
| 画布尺寸 | `canvasSize` = 1726 × 980 px（原点左上，X 向右 Y 向下） |
| 坐标体系 | `coordinateSystem` = 百分比坐标 0-100 |
| 题目区 | `fontSize.question`：30px / 微软雅黑（印刷体）/ 黑色；`lineHeight.question` = 1.65 |
| 分析区 | `fontSize.analysis`：38px / 手写尖尖体（`fontSource.handwriting.family`）/ 红色 |
| 解答区 | `fontSize.solution`：38px / 手写尖尖体 / 黑色 |
| 总结区 | `fontSize.summary`：38px / 手写尖尖体 / 黑色 |
| 板书渲染速度 | `boardSpeed` = 1 秒约 2~3 个汉字，每行 ±10% 轻微抖动 |
| 动作速度 | `actionSpeed` = 与板书同量级（rough-line / rough-arrow / rough-notation 绘制速度） |

> 字号真源 = `src/services/stepHandoff.js` 的 `BOARD_FONT_SIZE`（2026-09-17 拍板 38px）；历史 handoff 文件里的旧值属该题目的历史真相，不做静默改写。

### 2. `uiSettings`（B 页面可调参数）
| 参数 | 说明 |
|---|---|
| `coordinateMode` | 坐标计算方式 = `percentage`（百分比） |
| `questionFontSize` / `questionFontFamily` / `questionLineHeight` | 题目字号 30px / 印刷体 / 行高 1.65 |
| `rowGapMs` | 行间隔时长（默认 1500ms） |
| `speechSpeed` | 音频播放速度策略：**有音频 URL → 按自然播放时间**（`audioDurationMs` 毫秒真源，秒制 `duration = ms/1000`）；**无音频 → 按 160 字/分估算兜底**（虚拟时钟推进，不卡死） |

### 3. `problemInfo`（题目全量信息与环节配比）
| 项目 | 说明 |
|---|---|
| `screenshotUrl` | 题目截图地址（第一步截图 `/pic/*.jpg`；图片题导出时另内嵌 `screenshotDataUrl`） |
| `problemType` / `boardFocus` / `imageKind` / `gradeLevel` | 题型 / 板书侧重 / 图片类型 / 年级 |
| `relatedKnowledge[]` | 关联知识点清单 |
| `knowledgeAnalysis.coreKnowledge[]` | 关键公式清单取 `formula`（另有 `knowledgePoint` / `examinationPoint` / `strategy`） |
| `essence` | 教学重点 |
| `zoneAnchors` | 四区动态锚点：`labelStartCoord`（标签起点）+ `regionStartCoord`（区域起点） |
| `stageRatio.suggestedRatio` | 环节配比占比：`analysis` / `solution` / `summary` / `introAndClosing`（开收场） |

### 4. 规范说明段落（Markdown 导出）
- 唯一生成函数 = `buildStandardExplainParamsSection(meta)`（`src/lib/speechMarkdown.js`）。
- **完整要素表 MD 与分镜表 MD 必须都调用它**，禁止各自拼一套参数表（第二套真相 = bug）。
- 段落固定四节：① handoff 画布参数（真相源）② handoff 四区布局 + 动态锚点 ③ UI 可调参数 ④ 题目全量信息与环节配比。

## 三、row 字段（核心）

| 字段 | 说明 |
|---|---|
| `stage` | 阶段名（题目/分析/解答/总结…） |
| `speech` | 口播稿全文（保留口语毛料，仅清错误转义） |
| `audioUrl` | 本地持久化音频地址（`/audio/*.mp3`）；空串=未生成，按估算时长走无声时钟 |
| `audioDurationMs` | 真实音频时长（毫秒，时长第一真源）；null=未合成 |
| `duration` | 秒。`audioDurationMs/1000` > 估算（160字/分）> 板书动作最晚结束时间 |
| `board.content` / `board.lines` | 板书全文 / 按行数组（已过车同轨清洗：一行一个、写完一个再写一个） |
| `board.triggerKeyword` 或 `board.startDelay` | 落笔触发方式：念到关键词落笔，或语音起手延迟 N 秒（二选一） |
| `actionSpec[]` | 画布动作规格（圈画/擦除等），每个 1~2 秒 |
| `exclusiveExecutionPlan[]` | 单手互斥时序计划，按 `startOffsetMs` 升序 |
| `timingPolicy` | 恒为 `speech-full-board-action-mutually-exclusive` |

## 四、exclusiveExecutionPlan 元素

`type` 三种：`speech`（role=narration_full，带 text）、`board`（role=writing，带 content/lines/triggerKeyword）、`action`（role=punctuation_pause，带 index/action）。公共字段：`startOffsetMs` / `durationMs` / `endOffsetMs`。

## 五、时长与音频规则

- 时长真源优先级：`audioDurationMs`（毫秒）> `duration`（秒）> 语速估算（160字/分）> 板书动作最晚结束时间。
- 音频必须完整播放（以 `ended` 事件为准），禁止估算截断；地址失效时降级为虚拟时钟继续推进，不卡死。
- 空串 `audioUrl` = "待生成"，不得伪造时长。

## 六、交付物形态

| 产物 | 说明 |
|---|---|
| `deliverable-<projectCode>.json` | 本规范定义的规格 JSON（盲测输入） |
| `deliverable-<projectCode>.html` | 与 JSON 配对的自包含单页（row-player 模板 + 注入 `window.__INITIAL_DELIVERABLE__`），离线双击即播 |
| `current.json` / `current.html` | 当前活跃产物**指针**与镜像；指针内 `deliverable` = 与实体 JSON 完全相同的对象（含 `canvasParams` / `uiSettings` / `problemInfo`）。⚠️ 按 `deliverable.schema.json` 校验时，**入口是实体 JSON 或 `current.json.deliverable`**——指针顶层只有 `projectCode` / `filename` / `htmlFilename` / `createdAt` / `deliverable` 五个键，直接校验指针顶层会失败 |
| `完整要素表.md` / `分镜表.md` | 由 `buildStandardExplainParamsSection` 生成的规范说明段落 + 行明细（两份共用同一说明函数） |

## 七、盲测合格标准：JSON 里到底必须有什么

判定口径：**零上下文 Agent + 本 JSON + `row-player.html`**，能演出任意一道题 = 合格。
按"演不出来的就必填"倒推，分三层。

### 7.1 第一层：题目层（没有它，板上一片空白）

| 必带 | 字段 | 演不出会怎样 |
|---|---|---|
| ✔ | `problemText` | 题目原文一打开就该印在板上（30px 印刷体、行高 1.65、考卷式）。缺 = 无题可讲、圈画动作全部落空 |
| ✔ | `boardPlan.canvas{w:1726,h:980}` | 画布锁定尺寸，缺则百分比坐标换算基准不稳 |
| ✔ | `boardPlan.layoutMode` | `portrait` / `portrait-left-image` / `landscape-top-image`。四区与标签坐标随它变，缺 = 落座模式无从判断 |
| ✔ | `boardPlan.question` | 题目原文落座区（x/y/w + fontSize）。缺 = 题文默认落点，容易压住板书 |
| ✔ | `boardPlan.analysis` / `solution` / `summary` | **四区范围**：板书该写在哪、边界在哪。缺 = 板书越界或压字 |
| ✔ | `boardPlan.topicLabel` / `analysisLabel` / `solutionLabel` / `summaryLabel` | **stage 贴纸定位（决策 #010）**：四枚标签落点唯一真源，直接照搬导出物，禁止写死、禁止用板书内容反推。缺 = 标签错位 = 书写区看着就错 |
| 图片题 | `boardPlan.image` + `screenshotDataUrl`（内嵌）/ `screenshotUrl`（url） | ✅ 已通（2026-09-17）：**复用第一步截图**，导出时内嵌 base64，交付页按 `boardPlan.image` 落座渲染。**画不画的判据 = `boardPlan.image` 有没有图位**；文本题目没有图位 → 只把 url 带出去，绝不往板上贴截图 |

> 一句话：**四区范围 + 四个 stage 标签坐标，就是"本题目参数信息"，必须整块照搬导出物，缺一不可。**

### 7.2 第二层：row 层（每一行讲什么、写在哪）

| 必带 | 字段 | 说明 |
|---|---|---|
| ✔ | `stage` | 只能 `题目/分析/解答/总结`。决定落区、贴哪枚标签、分析区红笔其余黑笔；取别的值 → 标签不显示 |
| ✔ | `speech` | 口播稿 = 字幕 = 无音频时的时长估算来源 |
| ✔ | `board.content` | 板书写什么，一行一个（`\n` 或数组均可）；题目行写空串 |
| ○ | `board.startCoord` | **（可选，2026-09-17 拍板降为可选）**落笔起点 `"[x%, y%]"`。**不写也能演**：缺省时渲染层自动落在本 stage 区左上角(+2%,+4%)，四区照样板开；写了则优先采用。上游 Agent B 提示词明令不输出起手坐标，故常规产物此字段缺省。见 7.4 |
| ✔ | `board.startDelay` 或 `board.triggerKeyword` | 落笔时机（二选一） |
| ✔ | `duration`（秒）或 `audioDurationMs`（毫秒） | 时长。真源优先级 `audioDurationMs > duration > 语速估算(160字/分) > 板书动作最晚结束时间` |
| ✔ | `mp3` | 配音地址，未生成写 `""` → 自动走无声虚拟时钟，不卡死。归一顺序 `mp3 > audio > audioUrl > voice` |
| ○ | `actionSpec[]` | 一期只支持 `rough-notation` 的 `circle` / `underline`，`target.exactText` 必须是已写出的文字（题目原文或本行板书），否则该动作被跳过 |

### 7.3 第三层：验收六问（人工点检清单）

1. 双击 HTML 有画面（底图/贴纸内嵌 base64，无本地相对路径请求）。
2. 题目原文一打开就印在 `boardPlan.question` 位置。
3. 四枚 stage 标签落点与 JSON 的四个 Label **完全一致**（换一份 `layoutMode` 的产物再验一次，落点必须跟着变）。
4. 各段板书落在自己 stage 的区内，不越界、不叠在一起。
5. 有音频时完整播完（`ended` 驱动）；无音频时虚拟时钟顺滑推进，不卡首行。
6. 特殊符号已按超级过滤器降级：乘写 `x`、除写 `\frac{}{}`、平方立方写 `²³`、`∵∴` 写中文（否则豆腐块）。

### 7.4 阻断项台账

| 问题 | 证据 | 状态 |
|---|---|---|
| `board.startCoord` 未被消费 | `compile()` 组 board 计划项时未传 `coord`；`drawWriting` 读 `task.coord` → 退化默认 `{x:8,y:44}`，所有板书叠一处 | ✅ **已修（2026-09-17）**：新增 `resolveBoardCoord`，`compile()` 带上 `coord`；`normRow` 保留 `startCoord`；`drawWriting` 兼容字符串/对象坐标。三层回退：`board.startCoord` > `boardPlan[stage 区]` 左上角(+2%,+4%) > 模板常量，与 `resolveTagAnchor` 对齐。**2026-09-17 拍板：该字段降为「可选」** —— 常规产物缺省，靠第二层（区左上角）即可把四区板书排开，不再视为阻断项 |
| ~~图片题无图~~ | `normData` 只取 4 个顶层字段，图片零消费 | ✅ **已修（2026-09-17）**：`server/renderDeliverableHtml.js` 新增 `inlineProblemImage`（有 `boardPlan.image` 才内嵌第一步截图为 `screenshotDataUrl`）；`row-player.html` 新增 `normData.problemImage` + `setProblemImage` + `drawProblemImage`（落座真源 `boardPlan.image`，限高保比例）。实测：图片题交付页 139KB 含图，文本题 105KB 只带 url |
| ~~板书字号三处不一致~~ | 真源 `stepHandoff.js` 35px / `row-player.html` 写死 42px / 记忆记 1.5 倍 | ✅ **已统一 38px（2026-09-17 拍板，35 与 42 折中）**：真源 `BOARD_FONT_SIZE = 38`（`superFilter` 自动同步）；`row-player.html` 的 `size` / `fonts.load` / `measureText` 四处 42 → 38，注释标注与真源同步点 |
| ~~导出物丢 `startCoord`~~ | `serializeDeliverableState.js` 的 board 只写 `content`/`startDelay`，`parseBoard` 不透传 | ⭕ **不再阻断（2026-09-17 拍板降为可选）**：口径统一为「有则透传、无则缺省」。`AgentBDirect.vue` 的本地 `parseBoard` 与 `serializeDeliverableState.js` **已支持透传**；但服务端链路当前仍不产出该字段（`speechMarkdown.js:250-263 parseBoardField` 不透传 + `deliverableStoreHandler.js:167-173` 重建 board 时丢弃）——因已定为可选，缺失不再影响演出，仅作已知现状记录 |

### 7.5 最小可播 JSON（盲测样例骨架）

> **`startCoord` 为可选字段**：下方样例中出现的 `"startCoord": "..."` 可整段删除，删除后板书自动落在本 stage 区左上角(+2%,+4%)，四区照样板开。

```json
{
  "apiSpecVersion": "2.0.0",
  "projectCode": "20260917-044037-387",
  "problemText": "题目原文，一打开就印在板上",
  "boardPlan": {
    "canvas": { "w": 1726, "h": 980 },
    "layoutMode": "portrait",
    "topicBottomPct": 30,
    "question":  { "x": 6,    "y": 13.2, "w": 44, "h": 22, "fontSize": 30 },
    "analysis":  { "x": 6,    "y": 41,   "w": 44, "h": 48 },
    "solution":  { "x": 54,   "y": 14,   "w": 40, "h": 44 },
    "summary":   { "x": 54,   "y": 69.5, "w": 40, "h": 22 },
    "topicLabel":    { "x": 5.7,  "y": 6.6 },
    "analysisLabel": { "x": 5.7,  "y": 34.5 },
    "solutionLabel": { "x": 53.7, "y": 6.6 },
    "summaryLabel":  { "x": 53.7, "y": 62 }
  },
  "rows": [
    {
      "stage": "题目",
      "speech": "口播稿，也是字幕",
      "mp3": "",
      "duration": 17.8,
      "board": { "startCoord": "[6%, 12%]", "startDelay": 0, "content": "" },
      "actionSpec": [
        { "tool": "rough-notation", "action": "circle",
          "target": { "exactText": "9", "occurrence": 1 } }
      ]
    },
    {
      "stage": "分析",
      "speech": "……",
      "mp3": "/audio/audio-xxxx.mp3",
      "audioDurationMs": 14600,
      "duration": 14.6,
      "board": { "startCoord": "[8%, 44%]", "startDelay": 1.8, "content": "第一行\n第二行" },
      "actionSpec": []
    }
  ]
}
```
