# 下游渲染端实现（渲染器）

> **更新时间**：2026-09-18 23:58 GMT+8
> **更新人**：小阿星 ✦（代表夏夏）
> **来源**：本技能 v1.3 布局三条硬规矩（projectCode 20260917-035129-059 实测）+ 2026-09-16 row-player 排障（drawImage 5 参数误用）+ `truth/territory-C-actions-and-anchors.md`
> **本项目定位**：`board-lecture-player/references/render-downstream.md` — 做播放器的那一侧怎么实现「自动感知布局 + 音画同步」
> **版本**：v2.0（2026-09-18 新增：音频时钟 + occupancy map 自动布局）

---

## 1. 输入

`{rows:[...]}`（契约见 `contract-upstream.md`）。上游**不给坐标、不给 keyword**，只给：

```
row = { stage, mp3|audioBase64, duration(仅占位), speech, board:{startDelay, region, content}, actionSpec }
```

渲染层要补出两样东西：**每一行画在哪里**（§3）、**每一样东西什么时候出现**（§2）。
这两样都必须由渲染层自己算，不能在数据里找现成答案。

---

## 2. 音画同步：音频时钟（零 keyword）

### 2.1 唯一时钟

**播放时钟 = `<audio>.currentTime`，不是 `performance.now()`，不是 requestAnimationFrame 累加，不是字数估算。**

```js
// ✅ 唯一真相
const t = audioEl.currentTime;          // row 内相对秒
const rowSec = audioEl.duration;        // 真实时长

// ❌ 黑名单
const rowSec = speech.length / 160 * 60;   // 假时钟，禁止
const el = performance.now() - t0;         // 会与音频漂移
```

每 row 绑定一个 audio 元素（或共享一个 AudioContext），row 切换时换 src。

### 2.2 row 即同步原子 → 零 keyword 也能同步

Agent B 的纪律是「一行一个意群」。所以 **row 级对齐已经足够自然**：

> 老师在念这句话的同时把这一行写出来 —— 这句话的真实录音就在这里，对齐是天然的，不需要关键词。

row 内的时间切片：

```
0 ─────── startDelay ─────────────── writeWindow ──── actionTail ── rowSec
   （只念不写）      （边念边写，揭示 0→1）      （动作按 order 串行）
```

```js
const start    = board.startDelay;
const actTail  = actionSpec.length * 1.0;              // 每动作 ≈1s 标点停顿
const writeWin = Math.max(0.8, rowSec - start - actTail);
const p = clamp01((t - start) / writeWin);             // 揭示进度 0→1
```

- `writeWin` 必须钳下限（≥0.8s），防短音频把写字压成闪现
- `writeWin <= 0` 属**规格冲突**（内容多、音频短），须显式报错，不许静默压缩成 0

### 2.3 精化（可选，有了更好没有也能用）

若浏览器给出 `SpeechSynthesisUtterance.onboundary`（word boundary），可拿到正在念的字符 index，把 `p` 从线性改为按字符进度插值。**这是锦上添花，不是依赖**——没有 boundary 事件时走 §2.2 线性。

### 2.4 必备坑

| 坑 | 症状 | 正解 |
|---|---|---|
| **元数据未加载就读 duration** | `NaN`，整排时间崩 | `await new Promise(r => audio.addEventListener('loadedmetadata', r, {once:true}))` 或用 `decodeAudioData` 预解全部 row |
| **多 row 共用一个 audio 元素** | 切 row 时旧音频尾部串到新 row | 每 row 独立元素，切换时先 `pause()` 再换 src |
| **seek 后板书不重算** | 拖进度条字还在慢慢写 | seek 必须同时设置 `audio.currentTime` **并**调用重绘（进度是纯函数 `f(t)`，幂等即可） |
| **用 rAF 累加当时钟** | 长视频越跑越飘 | 时钟只读 `audio.currentTime` |
| **自动播放策略拦截** | 无声，画面照走 | 首次交互后 `audio.play()`；被拦截时暂停购物车并提示"点一下开始" |

---

## 3. 自动感知布局：occupancy map

没有坐标，就得**自己知道哪里空着**。核心数据结构是一张**已占用矩形表**：

```js
const occupancy = [];                       // {x,y,w,h, rowIdx}  画布百分比
const overlaps = (a,b) => a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h;
```

### 3.1 排布流程

##         stage先看自己再哪一个区域，区域范围感知。

```
① region → 起始区矩形（从 handoff boardPlan 读，只读 y/h 相对值，绝不手写常量）
② 区可用宽度 = 区宽 − 已占用（查 occupancy）
③ 在真实容器里试排：
     makeCols() 先建真实列 → measureIn(col, items) 在列内量 → 得到真实行数/高度
④ 量不下 → 字号降一档，重来（联合评估本区多列 + 外溢区，别单点贪心）
⑤ 仍装不下 → 剩下的进 rest → 到相邻区找最大空矩形落位
⑥ 全部落地后，按「块内最小行号」排序打 ①→② 书写顺序徽标
```

### 3.2 三条硬规矩（继承 v1.3，仍是能让错误从系统里消失的那类）

1. **安全底一律按「区 y + 规范 h」推导，禁止手写常量**
   反例：手写 `SAFE_BOTTOM.solution = 68`，规范实为 `y14 + h44 = 58` → 解答区压到总结区标签，自检仍报 OK。
2. **测量必须在真实落位容器内做：先建列，再在列内量**
   反例：用 `zoneW/2 - 12` 估算列宽 ≠ flex 实际列宽 → 换行数不同 → 实测高度远超报告值。
3. **装箱算法必须显式返回 `rest`**
   反例：`segs.length > maxCols` 恒不成立 → 最后一列静默超高。
   正解：`packColumns()` 返回 `{cols, rest}`，装不下的**最早内容**进 rest → 回流。

### 3.3 字号：对准 seus cautelas

只盯本区窄列硬塞会把字号压到不可读（实例：被迫 26px）。
把「本区多列 + 外溢区」在同一档字号下**统一评估**，装得下才降级 → 实例中回升到 34px。

**先算容量再排版**：规范要求 38px 但区只给 40% 宽时，容量可能根本不够——属**规格与数据的物理冲突**，摆给用户拍板，不许静默降级了事。

### 3.4 字体必须就绪后再排版

`document.fonts.ready` 在「当前 pending 的加载」完成时 resolve，**手写体那时可能还没被请求**。
必须 `document.fonts.load('38px "字体名"')` + 监听 `loadingdone` 重排（限次）+ 超时兜底；重排前 `resetLayout()`，用 `SHOWN` 集合恢复已显现的板书。

### 3.5 溢出外溢后必须打「书写顺序徽标」

内容「哪里有空塞哪里」之后，**几何位置不再等于讲课顺序**。
实例：推导开头（row 9–20）落在左下空白槽，结尾反而留在主解答区 → 观众不知道从哪儿读起。
判重叠要用 rect 坐标（x 区间是否交叠），**别靠肉眼**——并排列同基线在截图里像连成一行。

---

## 4. 一维时间轴：互斥串行

同一时刻只干一件事，黑板前只有一双手：

```
row_i: [口播 audio] ──┬── startDelay ── [写板书] ── [动作 order1] ── [动作 order2]
                      └── 全程由同一个 audio.currentTime 驱动
row 之间插入 ~0.6s 呼吸停顿（不写字、不动作）
```

- 板书**未完成 → 动作不起笔**
- 动作内部按 `order` 递增，**不得并行**
- 片尾总结 row 常无动作，`actionSpec: []`

---

## 5. 渲染层实现坑

| 坑 | 症状 | 正解 |
|---|---|---|
| `ctx.drawImage(img, dx,dy,dw,dh)` **5 参数** | 板书缩成微缩图堆在左上角，板书区全空 | 5 参数是「整图缩放」；取子区域必须 **9 参数** `drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)` |
| 同一 HTML 连发多个 Edit | 约每两个静默漏改 | 一次一改、串行，每改一处 grep 校验再继续 |
| 老数据带 `startCoord` | 盲信导致压字 | 当**过时软提示**，仍以实测容量重排 |
| 手写体渲染 differ | 变楷体，量宽漂移 20%+ | 见 §3.4；并用 `document.fonts.check()` 实测（不靠 `fonts.ready`） |
| 判断红墨/Normal 误判 | 探针报 0 墨 | 红字 r≈220，用 `r>140&&g<120&&b<120` 判定，别用 dark 阈值 |

---

## 6. 姊妹技能索引

```
~/.workbuddy/skills/layout-truth-check/scripts/check_layout_source.py   # 四条味道 R1–R4，机器扫排版源码
```

**执行顺序**：改布局代码 → 先跑 `check_layout_source.py` → 再跑本技能主文档「验证三件套」。

---

## 更新记录

| 时间 | 版本 | 更新人 | 变更 |
|---|---|---|---|
| 2026-09-18 23:58 | v2.0 | 小阿星 | 新增音频时钟（零 keyword 同步模型）与 occupancy map 自动布局；并继承 v1.3 布局三条硬规矩、顺序徽标、drawImage 9 参数排障记录；挂 layout-truth-check 执行顺序 |
