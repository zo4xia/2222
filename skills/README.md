# Skills 沉淀总索引

> *"不是把规则总结得更好看，而是把它压成另一个模型还能调用的结构。"*

本目录把 **音画动作板书布局与控制** 的工程技巧蒸馏为 7 个可独立调用的 skill pack。前 5 个是上游产出端（Agent B 写 deliverable JSON）的硬约束蒸馏；后 2 个是下游渲染端落地与浏览器侧观察。每个 skill 都遵循 `front-matter + 蒸馏合同 + 真相源 + 关键技巧 + 反模式 + 快速参考` 结构，可被 Agent B / 渲染层 / Check Agent 独立取用。

---

## 7 个 Skill 速览

### 上游产出端（Agent B 写 deliverable JSON 的硬约束）

| # | Skill | 用途 | 核心硬约束 |
|---|---|---|---|
| 1 | [board-zone-layout](./board-zone-layout/SKILL.md) | 画布四区布局与坐标控制 | 画布 1726×980，0—100% 原点左上，不出画布=硬约束，越界邻区=软约束 |
| 2 | [handwriting-font-policy](./handwriting-font-policy/SKILL.md) | 板书手写字体加载与层级锁定 | L3 板书层独占手写体，L1 题目层永久印刷体，ZeoSeven CSS + crossOrigin |
| 3 | [hand-action-control](./hand-action-control/SKILL.md) | 手部动作互斥调度与工具白名单 | teacher-hand-exclusive 互斥，3 个注册工具，时长由程序算 Agent 不得填 |
| 4 | [speech-board-timing](./speech-board-timing/SKILL.md) | 口播语速与板书书写时间节奏 | 160 cpm，400ms/字 + 抖动，B 不输出时间，口播发音硬规范 |
| 5 | [field-char-escape-filter](./field-char-escape-filter/SKILL.md) | 板书字段字符转义与规范化 | 车同轨·书同文 superFilter 10 步流水线，`&amp;` 最后解，`$` 绝不字面落板，除号转 `\frac`，ESC DOM 最后闸 |

### 下游渲染端与浏览器侧（落地上游约束）

| # | Skill | 用途 | 核心硬约束 |
|---|---|---|---|
| 6 | [board-lecture-player](./board-lecture-player/SKILL.md) | 把 deliverable JSON 渲染成单文件 HTML 讲学页 | **真实音频唯一时长真相源**（160 cpm 估算列黑名单），零 keyword 同步，board v3.0 零坐标 + occupancy map 自动排版，一期动作 circle+underline，验证四件套 |
| 7 | [blingbling小眼睛](./blingbling小眼睛/SKILL.md) | 浏览器侧轻量 DOM 观察子技能 | DOM-first 不是 screenshot-first，结构化页面（表单/后台/文档）先于自动化；输出 compact JSON 观察，建议下一步安全动作 |

---

## 沉淀来源

```
源码:
  src/utils/boardLayout.js          → board-zone-layout
  src/utils/canvasCoords.js         → board-zone-layout
  src/services/boardMathPolicy.js   → board-zone-layout

  src/board-tools/boardTypography.js     → handwriting-font-policy
  src/board-tools/boardTypography.css    → handwriting-font-policy
  https://fonts.zeoseven.com/items/490/   → handwriting-font-policy (栗壳坚坚体)

  src/board-tools/handActionScheduler.js → hand-action-control
  src/board-tools/boardToolCatalog.js    → hand-action-control
  src/board-tools/roughNotationTool.js   → hand-action-control
  src/board-tools/roughDrawingTool.js     → hand-action-control
  src/agent-b-v2/timing.js (timeline)     → hand-action-control

  src/agent-b-v2/timing.js (speech)  → speech-board-timing
  src/services/speechTiming.js       → speech-board-timing

  public/lite-player.html §5c normalizeBoardLine / visualLen / readBrace  → field-char-escape-filter
  public/lite-player.html §5c tokenizeLine                                → field-char-escape-filter
  public/lite-player.html §6 esc                                          → field-char-escape-filter
  src/utils/superFilter.js (镜像)                                          → field-char-escape-filter
```

---

## 7 个 Skill 的协同关系

```
                    handoff JSON (唯一真相源)
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
  canvasParams       boardPlan          stageRatioSuggestion
  coordinateSpec    zoneAnchors         suggestedGrade
  coordinateMode    screenshotUrl       essence
        │                 │                 │
        ↓                 ↓                 ↓
┌─────────────────────────────────────────────────────────────┐
│ 1. board-zone-layout                                          │
│    画布 1726×980, 四区坐标, 竖版/横版自适应, 越界容错          │
└─────────────────────────────────────────────────────────────┘
        │                                       │
        ↓                                       ↓
┌──────────────────────────┐    ┌─────────────────────────────┐
│ 2. handwriting-font-policy│    │ 3. hand-action-control       │
│    L1 印刷体 / L3 手写体    │    │    3 工具白名单, 互斥队列      │
│    ZeoSeven CSS 嵌入       │    │    时长由程序算              │
└──────────────────────────┘    └─────────────────────────────┘
        │                                       │
        └───────────────┬───────────────────────┘
                        ↓
        ┌────────────────────────────────────────────┐
        │ 4. speech-board-timing                       │
        │    160 cpm 口播 + 400ms/字 板书 + Row 时间线  │
        │    口播发音硬规范 (分数/符号/小数)              │
        └────────────────────────────────────────────┘
                        ↓
                  Agent B 五字段执行表 (deliverable JSON)
                  (speech / board / actionSpec / ...)
                        ↓
        ┌────────────────────────────────────────────┐
        │ 5. field-char-escape-filter                  │
        │    车同轨·书同文 superFilter 10 步流水线       │
        │    LaTeX 损伤修复 + HTML 实体解码 + 缺字降级    │
        │    LaTeX→Unicode + 除号转 \frac + ESC 闸     │
        └────────────────────────────────────────────┘
                        ↓
                  渲染层 + TTS + 真画布
                        ↓
        ┌────────────────────────────────────────────┐
        │ 6. board-lecture-player (下游渲染端)           │
        │    真实音频时钟 + occupancy map 自动排版      │
        │    一期动作 circle+underline + 验证四件套       │
        └────────────────────────────────────────────┘
                        ↓
                  单文件 HTML 讲学页 (?audit=1 自报布局)
                        ↓
        ┌────────────────────────────────────────────┐
        │ 7. blingbling小眼睛 (浏览器侧观察)             │
        │    DOM-first 轻量观察，输出 compact JSON      │
        │    验证四件套第 4 条辅助（先于自动化）          │
        └────────────────────────────────────────────┘
```

---

## 调用约定

### Agent B 写五字段执行表时

1. **先读 board-zone-layout** → 锁定画布基准与四区坐标，知道每区落点
2. **再读 handwriting-font-policy** → 知道 L3 板书层可用 5 种手写体，题目层不能动
3. **再读 hand-action-control** → 写 actionSpec 时只用 3 个工具，不填时长
4. **再读 speech-board-timing** → 写口播时遵守发音硬规范，不填 duration
5. **最后读 field-char-escape-filter** → 知道自己写的 `\frac` `×` `$` 等符号在下游会被清洗，避免叠加双清洗
6. **产出后跑 board-lecture-player 的 validate_contract.js** → 校验 rows.json 是否满足三条非协商修订（真实音频/零 keyword/board v3.0 零坐标）

### 渲染层执行时（参考 board-lecture-player 的 12 条硬规矩）

1. **board-zone-layout** → 按 boardPlan 落区，自然段落排版
2. **handwriting-font-policy** → `ensureHandwritingFont(fontId)` 双保险加载
3. **hand-action-control** → `createBoardToolRuntime` + scheduler.enqueue 串行执行
4. **speech-board-timing** → `applyAgentBV2Timeline` 估算总时长，**但下游真相源是真实音频 audio.duration，估算只用于无音频时占位**
5. **field-char-escape-filter** → `toBoardLines` + `normalizeBoardLine` 10 步清洗后落 canvas；`esc()` 最后闸落 DOM 字幕
6. **board-lecture-player** → 用 occupancy map 自动感知布局（无坐标），音频时钟驱动音画同步，验证四件套复核
7. **blingbling小眼睛** → 浏览器侧 DOM 观察先于自动化，输出 compact JSON 给主 agent 决策

### Check Agent 校验时

1. **board-zone-layout** → 板书越界检查（硬约束不出画布 / 软约束不严重叠字）
2. **handwriting-font-policy** → 层级越权检查（手写体不得用于 L1 题目层）
3. **hand-action-control** → 工具白名单校验 + 时长覆盖校验（Agent 不得填 durationMs）
4. **speech-board-timing** → 口播发音校验（分数/符号/小数）
5. **field-char-escape-filter** → 字段是否含字面 `$` `\left` `\right` 控制字符；`&amp;` 是否漏解；`\frac` 是否被吃成 `rac`/`frac`；除号是否写了 `÷` 或平铺 `a/b`
6. **board-lecture-player** → 跑 `validate_contract.js`（机器执行三条修订：坐标退场/零 keyword/真实音频）+ `verify_layout_report.js`（浏览器实测复核：自报 vs 真实偏差 ≤0.3%、rect 两两重叠、溢出画布、字号降级）
7. **blingbling小眼睛** → 用 DOM 观察代替肉眼复核结构化页面（验证四件套第 4 条辅助眼睛）

---

## 字段冲突解决优先级

| 场景 | 优先级 |
|---|---|
| 画布尺寸 | `handoff.canvasParams` > `board-zone-layout` 默认值 |
| 四区坐标 | `handoff.boardPlan` + `zoneAnchors` > 默认 BOARD_LAYOUT |
| 字体选择 | 用户 localStorage > `handwriting-font-policy` 默认 `qiaomu-local` |
| 动作时长 | 程序计算 > Agent 填写（Agent 填了直接拒） |
| 口播时长 | 程序估算 (160cpm + 标点) > TTS 真实回填 > Agent 填写 |
| 坐标格式 | `coordinateMode`（单独传入） > 固定百分比 |

---

## 与现有 board-speech-rules skill 的关系

- **board-speech-rules v3.1** 是已有的大 skill，覆盖板书格式 + 口播稿规则 + 动作工具规范 + 输出 schema 的全集
- 前 5 个新 skill 是 **从工程实现侧** 再次蒸馏，把 board-speech-rules 里描述性的规则落地为可执行的代码模式
- 两者**互补**：board-speech-rules 是 Agent B 的"写什么"规则集，前 5 个新 skill 是"怎么写/怎么校验"的工程实现手册
- **第 6 个 board-lecture-player** 是下游渲染端，把前 5 个上游约束在单文件 HTML 播放器里落地，并加了三条非协商修订（真实音频/零 keyword/board v3.0）
- **第 7 个 blingbling小眼睛** 是浏览器侧轻量 DOM 观察子技能，为验证四件套第 4 条提供结构化观察，先于重型浏览器自动化
- 可被 board-speech-rules 引用：在 board-speech-rules 的相关章节加 `→ 详见 skills/<skill-name>/SKILL.md` 链接

---

## 文件结构

```
skills/
├── README.md                          ← 本文件（总索引）
├── board-speech-rules/                 ← 已有 v3.1 大 skill（不动）
│   ├── SKILL.md
│   └── meta.json
├── board-zone-layout/                  ← 新 skill 1
│   ├── SKILL.md
│   └── meta.json
├── handwriting-font-policy/            ← 新 skill 2
│   ├── SKILL.md
│   └── meta.json
├── hand-action-control/                ← 新 skill 3
│   ├── SKILL.md
│   └── meta.json
├── speech-board-timing/                ← 新 skill 4
│   ├── SKILL.md
│   └── meta.json
├── field-char-escape-filter/           ← 新 skill 5（上游产出端）
│   ├── SKILL.md
│   └── meta.json
├── board-lecture-player/               ← skill 6（下游渲染端 + 验证脚本）
│   ├── SKILL.md
│   ├── references/
│   │   ├── contract-upstream.md        产出端契约：三条修订 + row 字段表 + board v3.0
│   │   └── render-downstream.md        渲染端：音频时钟 + occupancy map + 坑表
│   ├── scripts/
│   │   ├── validate_contract.js        校验音频/坐标/keyword/动作/语速合理性
│   │   └── verify_layout_report.js     解析 dump-dom 四项布局检测
│   └── assets/sample-rows.json         合法样例
├── blingbling小眼睛/                    ← skill 7（浏览器侧 DOM 观察）
│   ├── SKILL.md
│   ├── _user_meta.json
│   ├── references/
│   │   ├── demo-page.html
│   │   └── page-state-v1.md
│   └── scripts/observe-page.mjs        零依赖 node，URL/文件/stdin → compact JSON
├── demo.html                           ← 已有
└── fish-tts-proxy.py                   ← 已有
```

---

## 版本与演进

- **当前版本**：前 5 个 skill v1.0.0 / board-lecture-player v2.0 / blingbling小眼睛 v1.0.0
- **创建日期**：2026-09-19
- **源码版本**：基于当前项目 `src/board-tools/*` + `src/agent-b-v2/timing.js` + `src/services/speechTiming.js` + `src/utils/{boardLayout,canvasCoords}.js` + `public/lite-player.html`
- **升级触发**：源码关键常量变更（如 CANVAS_W 改尺寸、MIN_HAND_LIFT_GAP_MS 调整、语速变化）→ 升对应 skill 版本号
- **置信度**：前 5 个 skill `high`（直接从已运行代码蒸馏）/ board-lecture-player v2.0 来自夏夏拍板 + projectCode 实测 / blingbling小眼睛 v1.0 是成熟浏览器观察子技能
