---
name: board-lecture-player
description: 把 handoff/deliverable JSON（Agent B 口播+板书产物）渲染成「真实音频驱动 + 自动感知布局 + 手绘动作」的 standalone HTML 讲学页，做到写字跟着念、内容多了自动找空位排版。当用户给出讲题 JSON 与分镜表要做播放页，或遇到音画同步、按字数估算时长、板书坐标与自动排版、装不下压字溢出、keyword 锚点、rough-notation 圈划动作时使用。适用于数学讲题视频与口播板书播放页。
agent_created: true
---

# board-lecture-player — 口播板书讲学 HTML 播放器
blingbling小眼睛 结合这个skills 能看到效果；
把 Agent B 产出的 deliverable JSON（口播 speech + 板书 board + 动作 actionSpec，按 row 分原子单元）渲染成单文件 HTML：**真实音频时钟**驱动、**零坐标自动排版**、rough.js 手绘动作，沿一维时间轴同步。

## ★ 三条非协商修订（2026-09-18 夏夏拍板，优先级最高）

违反任意一条即视为做错：

| # | 规矩 | 反面（黑名单） |
|---|---|---|
| 1 | **真实音频是唯一时长真相源** | ❌ 禁止 `speech.length/160*60` 之类**按字数估算时长**。假时钟会把口癖、停顿、换气全丢掉，且错位无规律无法校准。缺 mp3/audioBase64 = **规格冲突**，显式报错停下，**不许静默降级成估算** |
| 2 | **零 keyword** | ❌ 合同里**没有 keyword 字段**（历史上加过又被改没了）。渲染端**不得依赖**任何关键词/anchor 字段做同步 |
| 3 | **board 零坐标** | ❌ `board` 不带 x/y/startCoord。位置由渲染层按区域**自动感知排版**，上游只说「属于哪个区」 |

> 第 1 条是夏夏反复纠错过多次的点：要的是**真实音频**，不是按字数算出来的假时长。

## 输入契约速览

```
row = { stage, mp3|audioBase64, duration(仅占位), speech, board:{startDelay, region, content}, actionSpec }
```

- `duration` 允许存在但**仅作占位**，渲染时必须被真实音频 duration 覆盖，不得参与排期
- `actionSpec` 一期**只有** `rough-notation` 的 `circle` / `underline`，且必须锚定 `target.exactText`（引用线的 rough-line / rough-arrow 属二期）
- 完整字段表、自检清单 → `references/contract-upstream.md`

## 12 条硬规矩（渲染时必须遵守）

1. handoff JSON 是唯一真相源，参数从 handoff 读真实值，不套示例值。
2. 坐标格式由 `coordinateMode` 决定（percentage/pixel），默认 percentage。
3. **`board` 是 v3.0 对象 `{startDelay, content, region}`，不含坐标。** 旧数据若带 `startCoord`：当作**过时软提示**接受，但仍要以实测容量重新定位，绝不盲信。
4. **行时长由真实音频决定**（`audio.duration`），不是下游算出来的。
5. 板书字号是题目的 1.2~1.5 倍（题目区微软雅黑 1rem，其他区 1.35rem），行间距/字间距轻微抖动。
6. 板书速度别太慢；样式要像手写（逐字位移/旋转抖动、整行轻微倾斜、行距抖动），不要板板正正。
7. 分数用 `\frac{num}{den}` 渲染上下结构；`^2`/`_x` → 上下标；`\begin{aligned}`/`\\`/`&` → 分行/对齐。口播念「分母分之分子」（上游稿已处理）。
8. 字母 x 在复合式里念「艾克斯」（上游稿已写谐音，代码不动）。
9. 动作一期只有 `circle` / `underline`（见 §输入契约），**可操作区域是整个画布**（SVG overlay 覆盖全画布）。
10. 动作排期由音频时钟推导，**不读数据中任何时间字段**（`durationMs`/`startMs`/`triggerAt` 一律忽略或报错）。
11. 板书**坐标退场**：`region` 是软提示，写不下就往外溢写到空白区，弹性调整，绝不溢出画布。
12. 松门槛：格式硬约束，内容软引导，不把题型卡成唯一答案。

## 时间轴模型（音频时钟）

```
row_i: 0 ─── startDelay ────────── writeWindow ──── actionTail ── audio.duration
        （只念不写）        （边念边写，揭示 0→1）    （动作按 order 串行）
```

```js
const t   = audioEl.currentTime;                    // ✅ 唯一时钟
const SEC = audioEl.duration;                       // ✅ 真实时长
const actionTail = actionSpec.length * 1.0;         // 每动作 ≈1s 标点停顿
const writeWin = Math.max(0.8, SEC - board.startDelay - actionTail);
const p = clamp01((t - board.startDelay) / writeWin);
```

- **row 即一组单位：一行 = 一个意群 + 板书，真实音频就在这 row 里 → 天然对齐，**这就是零 keyword 也能同步的原理**
- `writeWin <= 0` → 规格冲突（内容多音频短），报错，**不静默压缩**
- 板书未完成 → 动作不起笔；动作内部按 `order` 串行；row 之间 ~0.6s 呼吸停顿
- 可选精化：`SpeechSynthesisUtterance.onboundary` 拿到字符 index 做词级插值（锦上添花，不是依赖）
- 必备坑：`duration` 未 loadedmetadata 时是 `NaN`；多 row 切音频要先 `pause()` 再换 src；seek 必须同时设置 `audio.currentTime` 并重绘；时钟只读 audio，不用 rAF 累加

详细推导与坑表 → `references/render-downstream.md` §2

## 布局内核：自动感知（occupancy map）

没有坐标就得**自己知道哪里空着**。维护一张已占用矩形表 `{x,y,w,h,rowIdx}`（画布百分比）：

```
① region → 起始区矩形（从 boardPlan 读相对值）
② 区可用宽 = 区宽 − 已占用
③ 真实容器内试排：makeCols() 建真实列 → measureIn(col,items) 在列内量
④ 量不下 → 字号降一档重来（本区多列 + 外溢区**联合评估**，别单点贪心）
⑤ 仍装不下 → 剩下的进 rest → 到相邻区找最大空矩形落位
⑥ 落地后按「块内最小行号」排序打 ①→② 书写顺序徽标
```

### 三条硬规矩（能让错误从系统里消失的那类）

1. **安全底一律按「区 y + 规范 h」推导，禁止手写常量。**
   反例：手写 `SAFE_BOTTOM.solution = 68`，规范实为 `y14 + h44 = 58` → 解答区压到总结区标签，自检仍报 OK。
2. **测量必须在真实落位容器内做：先建列，再在列内量。**
   反例：用 `zoneW/2 - 12` 估算列宽 ≠ flex 实际列宽 → 换行数不同 → 实测高度远超报告值。
3. **装箱算法必须显式返回 `rest`。**
   反例：`segs.length > maxCols` 恒不成立 → 最后一列静默超高。正解：`packColumns()` 返回 `{cols, rest}`。



## 轻量 LaTeX 渲染（renderLine）

子集：`\frac{A}{B}`→上下结构（num/den 各包 char）、`^x`/`^{x}`→sup、`_x`→sub、`\times \div \pm \cdot \Rightarrow \sqrt` 等→符号。每个原子包 `<span class="char">`（opacity 0→1 逐字显现）。`boardLines()` 先去 `\begin{aligned}`/`\end{aligned}`、`\\` 当换行、`&` 丢弃，再 split。

## 实现要点 / 坑

- **同一 HTML 连发多个 Edit 会静默漏改**（约每两个漏一个）。一次一改、串行，每改一处 grep 校验再继续。
- `ctx.drawImage(img, dx,dy,dw,dh)` **5 参数是「整图缩放」** → 板书缩成微缩图堆在左上角、板书区全空。取子区域必须 **9 参数** `drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)`。
- 手写体是否真生效用 `document.fonts.check()` + 量宽对比（差 ≈20% 说明真生效，回退楷体则约 0）。
- 探针判定红墨用 `r>140&&g<120&&b<120`（红字 r≈220，用 dark 阈值会漏判成 0 墨）。
- rough.js / rough-notation 走 CDN（unpkg）需联网；纯离线把库拷进 `public/lib` 改本地路径。

## 验证四件套（缺一不可）

1. **静态自检**：`node --check` + 数据一致性断言（rows 数 / 动作数 / exactText 命中原文 / 四区坐标齐备）。临时文件在 `finally` 里删，且变量声明在 `try` 外（块级作用域会让 finally 的 unlink 静默失败）。
2. **合同校验脚本**（机器执行三条修订）：
   ```
   node scripts/validate_contract.js rows.json
   ```
3. **纯函数断言**：从模板切片抽无 DOM 依赖的函数（`new Function` 注入），在 node 跑——不丢项 / 段内升序 / 溢出项是最早内容 / 每列不超容量。
4. **浏览器实测复核**（最关键，前三条全过也可能视觉崩）：
5. 配合skills ：blingbling小眼睛 —— 结合这个skills 能看到效果；
   浏览器：6```
   msedge --headless=new --disable-gpu --virtual-time-budget=12000 \
     --dump-dom "file:///.../board-lecture-XXX.html?audit=1" > dom.txt
   node scripts/verify_layout_report.js dom.txt
   ```
   页面需在 `?audit=1` 时注入 `__LAYOUT_REPORT__`（自报）与 `__RECT__`（真实 rect，`getBoundingClientRect()` 换算回百分比）两段 JSON；脚本做**自报 vs 真实偏差（≤0.3%）、rect 两两重叠、溢出画布、字号被迫降级**四项检测。
   - 抓运行时异常：临时注入 `window.onerror`（含 `unhandledrejection`）+ 延迟 ~7s 回写 `<pre id="__PROBE__">`，再 dump-dom 取出。
   - 模型读不了图时，这套 dump-dom 文字报告就是唯一的眼睛。

## 资源索引

```
references/contract-upstream.md     产出端契约：三条修订、row 字段表、board v3.0、一期动作、自检清单
references/render-downstream.md     渲染端实现：音频时钟推导 + occupancy map + 坑表
scripts/validate_contract.js        零依赖 node，校验音频/坐标/keyword/动作/语速合理性
scripts/validate_contract.cjs       .cjs 副本（项目根 package.json 是 type:module 时用这个）
scripts/verify_layout_report.js     零依赖 node，解析 dump-dom，四项布局检测
scripts/verify_layout_report.cjs   .cjs 副本
assets/sample-rows.json             合法样例（跑 validate 应为 ERROR 0 / WARN 0）
```

> **.cjs 副本说明**：本项目根 `package.json` 含 `"type": "module"`，原 `.js` 用 `require` 会被当 ESM 报错。`.cjs` 副本是为在 ESM 项目里直接 `node scripts/validate_contract.cjs` 跑校验。原 `.js` 保留是为对齐上游技能作者的版本号。两份内容完全一致，改一处需同步另一处。

## 同级 5 个上游 skill（本播放器落地它们的硬约束）

本播放器是「下游渲染端」，上游产出端（Agent B 写 deliverable JSON）的硬约束已经在本 skills 目录沉淀为 5 个独立 skill pack。本播放器在实现这些约束时，可直接引用对应 skill 的反模式表与正则：

```
../board-zone-layout/SKILL.md            画布 1726×980 + 四区坐标 + 越界容错（occupancy map 的区矩形来源）
../handwriting-font-policy/SKILL.md       5 种手写体 + L3 层级锁定 + ZeoSeven CSS 嵌入
../hand-action-control/SKILL.md           3 工具白名单 + teacher-hand-exclusive 互斥 + 时长程序算
../speech-board-timing/SKILL.md           160 cpm + 标点停顿 + 板书 400ms/字 + 口播发音硬规范
../field-char-escape-filter/SKILL.md     10 步 superFilter（normalizeBoardLine）+ ESC DOM 最后闸
```

**映射关系**（本播放器的硬规矩 → 上游 skill 来源）：

| 本播放器硬规矩 | 上游 skill 来源 |
|---|---|
| 1. handoff 唯一真相源 | （5 个 skill 共同约束） |
| 2. coordinateMode 决定坐标格式 | board-zone-layout §一 |
| 3. board v3.0 不含坐标（occupancy map 自动排版） | board-zone-layout §四（越界容错） |
| 4. 真实音频唯一时长真相源 | speech-board-timing（**改写**：原 160 cpm 估算在本播放器降级为黑名单，真相源改为 audio.duration） |
| 5. 板书字号 1.2~1.5 倍 + 抖动 | handwriting-font-policy §七 + speech-board-timing §二 |
| 6. 板书手写感（位移/旋转/行倾抖动） | handwriting-font-policy §三 |
| 7. 分数 \frac / ^2 _x / \begin{aligned} | field-char-escape-filter §五 + §六 |
| 8. 字母 x 念艾克斯 | speech-board-timing §五 |
| 9. 动作一期 circle / underline | hand-action-control §二（白名单收口为本播放器的 circle+underline 子集） |
| 10. 动作排期由音频时钟推算（不读 durationMs/startMs/triggerAt） | hand-action-control §一（generation-based cancel）+ speech-board-timing §四 |
| 11. board 坐标退场，写不下外溢到空白区 | board-zone-layout §四（硬约束不出画布 / 软约束不严重叠字） |
| 12. 松门槛：格式硬约束，内容软引导 | （5 个 skill 共同松门槛原则） |

> **关键差异**：speech-board-timing v1.0 里 `160 cpm 估算` 是上游估算口径，**本播放器把它列为黑名单**——下游渲染必须用真实音频 duration。这并不冲突：上游估算用于 B 不输出时间字段，下游用真实音频覆盖。两者是同一时间真相源的两层。

## 姊妹技能

```
~/.workbuddy/skills/layout-truth-check/scripts/check_layout_source.py   # 排版源码四条味道 R1–R4
../blingbling小眼睛/SKILL.md                                              # 浏览器侧 DOM 观察子技能（验证四件套第 4 条辅助）
```

布局相关的通用治理已剥离到该通用技能。**执行顺序**：改布局代码 → 先跑 `check_layout_source.py` 机器扫 → 再跑本页验证四件套 → 用 `blingbling小眼睛` 做浏览器侧 DOM 观察（结构化页面先于自动化）。

---

> **更新时间**：2026-09-19 00:05 GMT+8
> **更新人**：小阿星 ✦（代表夏夏）
> **来源**：v1.3 本体（projectCode 20260917-035129-059 实测）+ Agent B v2 系统提示词 + `truth/territory-C-actions-and-anchors.md` + 2026-09-16/18 row-player 排障
> **本项目定位**：`~/.workbuddy/skills/board-lecture-player/`（本仓库内 `skills/board-lecture-player/`）
> **版本**：v2.0

## 更新记录

| 时间 | 版本 | 更新人 | 变更 |
|---|---|---|---|
| 2026-09-18 04:36 | v1.2 | 小阿星 | 挂 layout-truth-check 姊妹技能索引 |
| 2026-09-18 04:36 | v1.3 | 小阿星 | 新增「溢出分块后必须打书写顺序徽标」 |
| **2026-09-19 00:05** | **v2.0** | **小阿星** | **①真实音频唯一时长真相源，字数/160 估算列黑名单；②零 keyword，同步不依赖关键词字段；③board 零坐标（v3.0），新增 occupancy map 自动感知布局；④硬规矩 3/4/10 与时间轴模型整节据此改写（原「downstream 动态测算」口径废弃）；⑤验证三件套→四件套，新增两个零依赖脚本 + 样例 JSON** |
