# 教学课件与音画微课交付物 JSON 输出规范说明文档 (Deliverable API Specification v2.0)

> **文档性质**：本文档为青花布工作台面向所有**下游小 Agent**（包括：PPT 课件生成 Agent、数字人教学视频合成 Agent、Canvas 互动微课播放器、剪辑渲染引擎等）的**权威交付物接口协议规范**。  
> **设计核心原则**：**数据解耦、音画独立、单手串行互斥、坐标四区分离、动作即标点停顿**。

---

## 目录 (Table of Contents)

1. [系统定位与消费场景](#一-系统定位与消费场景-scenarios)
2. [每个 Row 组数据结构详解 (Data Dictionary)](#二-每个-row-组数据结构详解-data-dictionary)
3. [单手互斥时序定义与时间戳铁律 (Timeline & Mutual Exclusion)](#三-单手互斥时序定义与时间戳铁律-timeline--mutual-exclusion)
4. [四区黑板空间坐标体系 (Board 4-Zone Coordinate System)](#四-四区黑板空间坐标体系-board-4-zone-coordinate-system)
5. [动作指令集规范 (ActionSpec Catalog)](#五-动作指令集规范-actionspec-catalog)
6. [下游 Agent A 实战：如何解析数据制作 PPT 课件 (PPT Generation Guide)](#六-下游-agent-a-实战如何解析数据制作-ppt-课件-ppt-generation-guide)
7. [下游 Agent B 实战：如何解析数据制作教学视频 (Video Generation Guide)](#七-下游-agent-b-实战如何解析数据制作教学视频-video-generation-guide)
8. [完整交付物 JSON 实例 (Full Sample JSON)](#八-完整交付物-json-实例-full-sample-json)
9. [常见排障与答疑 (FAQ)](#九-常见排障与答疑-faq)

---

## 一、 系统定位与消费场景 (Scenarios)

青花布工作台负责微课教研核心思考过程（题目识别、儿童认知分解、四区板书规划、口播生成与 Check 质检）。生成的最终结果以标准 JSON 形式输出并持久化保存。

```
+--------------------------+
|   青花布工作台 (Agent B/C)  |
+--------------------------+
             |
             v 输出标准交付物 (deliverable-*.json)
+-------------------------------------------------------------+
|             标准化数据结构 (Rows + ExclusivePlan)              |
+-------------------------------------------------------------+
       |                                              |
       v                                              v
+-----------------------------+        +------------------------------+
|   PPT 课件生成 Agent (小 Agent) |        |   教学视频/Canvas 渲染 Agent   |
| - 自动生成 .pptx 幻灯片       |        | - 基于毫秒时间轴驱动音画同步    |
| - 板书映射为文本框与图元      |        | - 单手串行执行手写板书与手绘圈画 |
| - 口播自动注入演讲者备注(Notes)|        | - 最终导出 MP4 视频或 Web 课件  |
+-----------------------------+        +------------------------------+
```

---

## 二、 交付物根级字段与说明参数 (Root & Specification Metadata)

整个交付物 JSON 包含两层：**根级说明参数（全局唯一真相源）** 与 **Row 组列表（原子执行单元）**。

> **真相源声明**：布局参数从 handoff 文件动态读取（Agent A 根据题目实时判断），为唯一真相源。

### 2.1 根级核心说明参数数据字典

| 字段名 | 类型 | 必填 | 语义与规范说明 |
| :--- | :--- | :--- | :--- |
| `canvasParams` | `object` | 是 | **handoff 画布参数（唯一真相源）**。包含画布 1726×980 尺寸、坐标系统、四区分区字号、字体、颜色、行高及渲染速率参数。 |
| `boardPlan` | `object` | 是 | **四区布局坐标计划（真相源）**。题目区、分析区、解答区、总结区四大区域的左%、上%、宽%、高%锚点定义。 |
| `uiSettings` | `object` | 是 | **UI 可调参数（B 页面设置）**。坐标计算方式、题目字号、题目字体与音频播放/预估速度策略。 |
| `problemInfo` | `object` | 是 | **题目全量信息与环节配比**。含题目截图地址、题型、关联知识点、教学重点、关键公式清单、区域锚点及环节配比占比（分析、解答、总结、开收场）。 |
| `projectCode` | `string` | 是 | 唯一项目流水编码（全链路追溯）。 |
| `problemText` | `string` | 是 | 题目完整纯文本内容。 |
| `screenshotUrl`| `string` | 否 | 题目截图网络地址或相对静态资源路径。 |
| `stats` | `object` | 是 | 全局宏观统计：包含预估总时长、总字数、步骤数、动作总数等。 |
| `rows` | `array` | 是 | **Row 组原子单元列表**（详见 2.2 节）。 |

---

### 2.2 handoff 画布参数（真相源）

| 参数 | 值 |
| --- | --- |
| 画布宽度 | 1726px |
| 画布高度 | 980px |
| 坐标系统 | 百分比坐标 0-100 |
| 题目区字号 | 30px |
| 题目区字体 | `微软雅黑（印刷体，30px）` |
| 题目区颜色 | 黑色 |
| 分析区字号 | 35px |
| 分析区字体 | `LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）` |
| 分析区颜色 | 红色 |
| 解答区字号 | 35px |
| 解答区字体 | `LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）` |
| 解答区颜色 | 黑色 |
| 总结区字号 | 35px |
| 总结区字体 | `LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）` |
| 总结区颜色 | 黑色 |
| 题目区行高 | 1.65 |
| 其他区行高 | 自然换行即可；渲染层会对行高做微小随机抖动营造手写感，B 按正常行高估算坐标，不需要自己叠加抖动 |
| 板书速度 | 下游渲染参数：1秒约2~3个汉字，每行±10%轻微抖动（B 不需要处理速度细节） |
| 动作速度 | 差不多同样速度（rough-line/rough-arrow/rough-notation绘制速度） |

#### handoff 四区布局（真相源基准）

| 区域 | 左% | 上% | 宽% | 高% |
| --- | ---: | ---: | ---: | ---: |
| 题目区 | 6 | 13.32 | 40.32 | （自适应） |
| 分析区 | 6 | 40.62 | 44 | 54.38 |
| 解答区 | 54 | 14 | 40 | 44 |
| 总结区 | 54 | 69.5 | 40 | 22 |

---

### 2.3 UI 可调参数（B 页面设置）

| 参数 | 值 |
| --- | --- |
| 坐标计算方式 | 百分比 |
| 题目字号（UI） | 30px |
| 题目字体（UI） | `"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` |
| 音频速度 | （若有音频url的，以音频自然播放时间为时间，一组一组自然播放即可，如果没有音频url信息的，用填充演示数据占位，）速度计算 160字/分 |

---

### 2.4 题目信息与环节配比 (problemInfo)

- **题目截图地址 (`screenshotUrl`)**：题目高清截屏地址（网络 URL 或相对静态资源路径）。
- **题型 (`problemType`)**：例如“计算确定类”、“概念辨析类”、“几何应用题”等。
- **关联知识点 (`relatedKnowledge`)**：核心知识点名称数组。
- **教学重点 (`teachingFocus`)**：针对儿童理解障碍点的重点提示。
- **关键公式清单 (`keyFormulaList`)**：本题需运用的解题数学公式。
- **区域锚点 (`zoneAnchors`)**：四区黑板各区域百分比锚点。
- **内容占比环节配比占比**：
  - 分析：%
  - 解答：%
  - 总结：%
  - 开收场：%

---

## 三、 每个 Row 组数据结构详解 (Data Dictionary)

整个教学微课由若干个有序的 **Row 组**（`rows` 数组）构成。每个 Row 组是一个自包含的**教学逻辑与音画播放原子单元**。

### 3.1 Row 根级字段定义

| 字段名 | 类型 | 必填 | 默认值 | 语义与规范说明 |
| :--- | :--- | :--- | :--- | :--- |
| `stage` | `string` | 是 | - | **教学阶段**。枚举值仅限：`"题目"` \| `"分析"` \| `"解答"` \| `"总结"`。必须严格保持这四个阶段的正序流转，不可跳跃或使用同义词。 |
| `speech` | `string` | 是 | - | **纯净口播文本**。由 TTS 引擎朗读或渲染为视频字幕。基线语速为 **160 汉字/分钟**。所有阿拉伯数字均已转换为中文汉字读音（如“八列”而非“8列”）。**严禁包含任何形如 `[pause]` 的 TTS 标签**，依靠中文逗号/句号实现自然行内呼吸停顿。 |
| `duration` | `number` | 是 | - | 本 Row 建议的时长（秒），为整数或保留一位小数。 |
| `estimatedDurationMs` | `number` | 是 | - | 本 Row 组全流程（语音朗读、板书书写、动作手势）经系统编译出的**精确毫秒总时长**。下游播放器可依据此数值安排 Row 切换。 |
| `audioUrl` | `string` | 否 | `""` | 若系统已合成独立音频文件，此字段存放音频相对路径（如 `/audio/audio-0.mp3`）。有值时下游播放器应直接加载播放。 |
| `board` | `object` | 是 | `{}` | **板书定义对象**。描述在黑板上书写的内容、起始坐标以及起笔延迟（详见 2.2 节）。若本行无需板书，对象字段可为空。 |
| `actionSpec` | `array` | 是 | `[]` | **手势动作指令数组**。描述在黑板或题目上画下划线、圈画、高亮、箭头的指令（详见 2.3 节）。 |
| `exclusiveExecutionPlan` | `array` | 是 | `[]` | **【强烈推荐消费】开箱即用的单手互斥时序执行计划**。已由系统将语音、动作、板书的时间线完成串行编译，下游小 Agent 可直接无脑顺序遍历触发（详见第 3 章）。 |

---

### 2.2 `board` (板书对象) 详细规范

`board` 对象描述在黑板画布上的手写板书行为。

```json
{
  "startCoord": "[8%, 43%]",
  "content": "8列 → 人数是8的倍数",
  "startDelay": 1.2
}
```

- **`startCoord` (落笔起始坐标)**：
  - 格式一（推荐百分比）：`"[x%, y%]"`，例如 `"[8%, 43%]"`。表示以黑板画布左上角为原点 `(0, 0)`，X 轴向右偏移画布宽度的 8%，Y 轴向下偏移画布高度的 43%。
  - 格式二（绝对像素）：`"[x, y]"`，例如 `"[138, 421]"`。直接对应设计基准画布（如 1726×980）的像素值。
- **`content` (板书文本内容)**：
  - 手写板书的字面内容，支持换行符 `\n`。如果包含数学算式（如 `3 × 8 = 24`），以标准纯文本表达。
- **`startDelay` (起笔延迟，秒)**：
  - 相对于当前 Row 开始播放时刻的延迟秒数。例如 `1.2` 表示口播开始朗读 1.2 秒后才开始落笔书写。
- **板书书写时长计算规范**：
  - 汉字书写速度基准：每个字符耗时约 **220ms ~ 280ms**。
  - 最低起步时长：不低于 **1200ms**；单次板书最长不超过 **8000ms**。
  - 公式：`writingDurationMs = Math.min(8000, Math.max(1200, charCount * 240))`。

---

### 2.3 `actionSpec` (动作指令集) 详细规范

`actionSpec` 是一个数组，每个元素表示一个视觉强化动作（工具：`rough.js` 或 `rough-notation`）。

```json
[
  {
    "tool": "rough-notation",
    "action": "underline",
    "target": {
      "region": "question",
      "exactText": "8列的长方形队列",
      "occurrence": 1
    }
  }
]
```

- **`tool` (工具类型)**：
  - `"rough-notation"`：文字/区域标记，支持文本精确定位修饰。
  - `"rough-line"`：手绘直线图元。
  - `"rough-arrow"`：手绘方向指示箭头。
  - `"rough-box"` / `"rough-circle"`：基于几何坐标手绘矩形框或圆。
- **`action` (具体动作类别)**：
  - `"underline"`（下划线，红色）、`"highlight"`（荧光笔涂抹，亮黄半透明）、`"circle"`（手绘红圈）、`"box"`（手绘红框）、`"strike-through"`（删除线）。
- **`target` (目标定位选择器)**：
  - `region`：目标所在的四区黑板区域（`question` \| `analysis` \| `solution` \| `summary`）。
  - `exactText`：需要划线或圈画的**完整精确子串**。
  - `occurrence`：若同一文本出现多次，指定匹配第几个（从 1 开始）。

---

## 三、 单手互斥时序定义与时间戳铁律 (Timeline & Mutual Exclusion)

这是本交付物最核心的物理与时序铁律，所有下游 Agent 必须严格遵守：

### 3.1 物理世界核心约束：单手互斥 (Single-Hand Mutual Exclusion)

> **铁律**：真实微课教学中，老师**只有一只手**拿着粉笔或触控笔在黑板前授课。老师绝对不可能在同一时刻既在右边板书写字，又在左边给题目画下划线！

- **数学交集绝对为空**：
  设板书书写时间区间为 $[T_{\text{board\_start}}, T_{\text{board\_end}}]$，动作执行时间区间为 $[T_{\text{action\_start}}, T_{\text{action\_end}}]$，则：
  $$[T_{\text{board\_start}}, T_{\text{board\_end}}] \cap [T_{\text{action\_start}}, T_{\text{action\_end}}] = \emptyset$$
- **换手与移位缓冲 (Hand-Lift Gap)**：
  动作与板书发生切换时，必须保留至少 **400ms ~ 600ms** 的抬笔与手部位移时间。

### 3.2 动作时长定量为 1~2 秒：本质是「视觉标点停顿」

- 动作时长极其固定且确定（如同物理时钟）：
  - `underline`（画下划线）：**1.2 秒 (1200ms)**
  - `highlight`（涂荧光高亮）：**1.4 秒 (1400ms)**
  - `circle` / `box`（圈画关键词）：**1.5 秒 (1500ms)**
  - `rough-line` / `rough-arrow`（画线/画箭头）：**1.0 ~ 1.2 秒 (1000~1200ms)**
- **认知规律**：动作不是独立的冗长动画，而是口播语流中的**视觉逗号**。当老师念完一个关键名词（如“8列的长方形队列”），稍作停顿并在黑板上顺势划出下划线，随即移笔至下方开始书写板书。

### 3.3 互斥时序执行计划 (`exclusiveExecutionPlan`) 字段字典

为了减轻下游 Agent 的时序计算负担，系统在输出 JSON 时已自动完成严格的时序互斥编排：

```json
[
  {
    "type": "speech",
    "role": "narration_full",
    "startOffsetMs": 0,
    "durationMs": 14200,
    "endOffsetMs": 14200,
    "text": "同学们好，我们看第一句话：8列的长方形队列..."
  },
  {
    "type": "action",
    "role": "punctuation_pause",
    "startOffsetMs": 1200,
    "durationMs": 1200,
    "endOffsetMs": 2400,
    "action": {
      "tool": "rough-notation",
      "action": "underline",
      "target": { "region": "question", "exactText": "8列的长方形队列", "occurrence": 1 }
    }
  },
  {
    "type": "board",
    "role": "writing",
    "startOffsetMs": 3000,
    "durationMs": 4500,
    "endOffsetMs": 7500,
    "content": "8列 → 人数是8的倍数",
    "coord": "[8%, 43%]"
  }
]
```

- **`type: "speech"` (持续语音通道)**：
  - 角色 `narration_full`：从 `0ms` 开始贯穿整个 Row，提供稳定的教学背景语流。
- **`type: "action"` (动作通道)**：
  - 角色 `punctuation_pause`：在特定时间点（如 `1200ms`）开始，持续 `1200ms`，于 `2400ms` 结束。
- **手部换位缓冲**：`2400ms` 至 `3000ms`（空闲 600ms），老师手部移向板书区。
- **`type: "board"` (板书书写通道)**：
  - 角色 `writing`：在 `3000ms` 开始落笔，持续书写 `4500ms`，于 `7500ms` 书写完毕。
- **互斥验证**：动作区间 `[1200, 2400]` 与板书区间 `[3000, 7500]` 没有任何交集！

---

## 四、 四区黑板空间坐标体系 (Board 4-Zone Coordinate System)

黑板画布被严格划分为四个专属教学功能区，防止图元与文字互相覆盖：

```
+------------------------------------+------------------------------------+
|  【题目区 question】                |  【解答区 solution】                |
|  - 题文文字排版、原题插图           |  - 正式算式、推导过程、答句         |
|  - 坐标建议：X: 5%~8%, Y: 10%~14%    |  - 坐标建议：X: 52%~55%, Y: 12%~16% |
|  - 宽度占约 42%~45%                |  - 宽度占约 42%~45%                |
+------------------------------------+------------------------------------+
|  【分析区 analysis】                |  【总结区 summary】                 |
|  - 几何画图、数量关系线段图、草稿   |  - 规律提炼、一句话通法模型         |
|  - 坐标建议：X: 5%~8%, Y: 40%~45%    |  - 坐标建议：X: 52%~55%, Y: 68%~72% |
|  - 宽度占约 42%~45%                |  - 宽度占约 42%~45%                |
+------------------------------------+------------------------------------+
```

### 坐标换算公式（给下游渲染器/PPT Agent）

设输出分辨率宽度为 $W$，高度为 $H$（标准 16:9 画布为 $1920 \times 1080$ 或 $1726 \times 980$）：

- **百分比转像素**：
  若 `startCoord = "[px%, py%]"`：
  $$X = W \times \frac{px}{100}, \quad Y = H \times \frac{py}{100}$$
- **像素基准等比缩放**：
  若输入绝对坐标对应基准画布尺寸 $(W_{\text{base}}, H_{\text{base}})$：
  $$X = X_{\text{base}} \times \frac{W}{W_{\text{base}}}, \quad Y = Y_{\text{base}} \times \frac{H}{H_{\text{base}}}$$

---

## 五、 动作指令集规范 (ActionSpec Catalog)

下游 Agent 应支持以下 7 种核心黑板动作及其渲染映射：

| 动作标识 | 耗时标准 | 视觉样式表现 | PPT 动画映射建议 |
| :--- | :--- | :--- | :--- |
| `underline` | 1.2s | 手绘鲜红色下划线，轻微波浪手作感 | 擦除（Wipe）动画，方向自左向右 |
| `highlight` | 1.4s | 半透明亮黄色手绘矩形色块覆盖文字 | 强调（Transparency/Color）或进入淡出 |
| `circle` | 1.5s | 手绘红色闭合椭圆圈出关键词 | 轮廓（Wheel）或缩放绘制动画 |
| `box` | 1.5s | 手绘红色矩形方框包围关键条件 | 轮廓擦除或缩放动画 |
| `strike-through` | 1.1s | 手绘深灰色中划线横穿文字 | 横向擦除动画 |
| `rough-line` | 1.0s | 两点间手绘直线（粗糙度 1.5） | 线段自起点向终点擦除延伸 |
| `rough-arrow` | 1.2s | 带箭头的指向线，指示因果/步骤转移 | 箭头自起点向终点延伸 |

---

## 六、 下游 Agent A 实战：如何解析数据制作 PPT 课件 (PPT Generation Guide)

下游的小 Agent 如果负责生成 PowerPoint 演示文稿（`.pptx` 文件），请遵循以下映射法则：

### 6.1 页面与动画映射逻辑

- **模式 1：一 Row 一幻灯片（适合分步详细精讲模式）**：
  - 每个 `row` 直接对应一页 PPT 幻灯片。
  - 幻灯片标题标注对应的 `stage`（如“题目研读”、“思路分析”、“列式解答”、“总结反思”）。
- **模式 2：一 Stage 一幻灯片，Row 为动画步骤（标准课件模式，强烈推荐）**：
  - 全篇课件共 4 页大幻灯片（分别对应 4 个 stage）。
  - 同一 stage 下的多个 Row 映射为该页幻灯片内的**进阶动画步骤 (Animation Sequences)**。

### 6.2 PPT 关键元素映射表

| 交付物 JSON 字段 | PPT 对应元素 | Python (`python-pptx`) 属性 | Node.js (`pptxgenjs`) 属性 |
| :--- | :--- | :--- | :--- |
| `stage` | 幻灯片顶部标题 / 分类页签 | `slide.shapes.title.text` | `slide.addText(stage, { isHeader: true })` |
| `board.content` | 黑板区域文本框 | `slide.shapes.add_textbox(x, y, w, h)` | `slide.addText(content, { x, y, w, h, fontFace: 'KaiTi' })` |
| `board.startCoord` | 文本框左上角位置定位 | `Inches(x / 96)` | `{ x: `${px}%`, y: `${py}%` }` |
| `actionSpec` | 强调形状（下划线/矩形框） | `slide.shapes.add_shape(MSO_SHAPE.RECTANGLE)` | `slide.addShape(pptx.shapes.RECTANGLE, ...)` |
| `speech` | **演讲者备注 (Speaker Notes)** | `slide.notes_slide.notes_text_frame.text = speech` | `slide.addNotes(speech)` |

### 6.3 PPT Agent 消费代码模板 (Node.js pptxgenjs)

```javascript
import pptxgen from "pptxgenjs";

export async function generatePptFromDeliverable(deliverableData) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';

  for (const [index, row] of deliverableData.rows.entries()) {
    const slide = pres.addSlide();

    // 1. 顶部标题区标注 stage
    slide.addText(`步骤 ${index + 1} · 【${row.stage}】`, {
      x: 0.5, y: 0.3, w: 9, h: 0.5,
      fontSize: 16, bold: true, color: '333333'
    });

    // 2. 板书内容转换为黑板卡片内的文本框
    if (row.board?.content) {
      // 解析 startCoord，例如 "[8%, 43%]"
      const match = String(row.board.startCoord || '').match(/\[(\d+(?:\.\d+)?)%?,\s*(\d+(?:\.\d+)?)%?\]/);
      const xPercent = match ? parseFloat(match[1]) / 100 : 0.08;
      const yPercent = match ? parseFloat(match[2]) / 100 : 0.40;

      slide.addText(row.board.content, {
        x: xPercent * 10,
        y: yPercent * 5.625,
        w: 4.5,
        h: 2.0,
        fontSize: 18,
        fontFace: '楷体',
        color: '1E293B',
        fill: { color: 'F8FAFC' },
        line: { color: 'CBD5E1', width: 1 }
      });
    }

    // 3. 将口播语音注入到演讲者备注（Notes）中，供教师放映时提词
    if (row.speech) {
      slide.addNotes(`【本页口播】：\n${row.speech}\n\n建议时长：${row.duration} 秒`);
    }
  }

  await pres.writeFile({ fileName: `课件_${deliverableData.projectCode}.pptx` });
}
```

---

## 七、 下游 Agent B 实战：如何解析数据制作教学视频 (Video Generation Guide)

下游的小 Agent 如果负责生成互动 Canvas 微课或渲染 MP4 视频，请使用毫秒主时钟驱动：

### 7.1 核心播放调度代码 (JavaScript Canvas 驱动)

```javascript
// 播放单个 Row 组的标准实现
export async function playRowGroup(row, canvasEngine, audioElement) {
  return new Promise(async (resolve) => {
    // 1. 如果有预先合成的音频，直接对齐播放；否则调用 TTS 口播
    if (row.audioUrl && audioElement) {
      audioElement.src = row.audioUrl;
      audioElement.play();
    } else {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(row.speech));
    }

    // 2. 依次调度互斥执行计划 (exclusiveExecutionPlan)
    const plan = row.exclusiveExecutionPlan || [];
    const timers = [];

    for (const task of plan) {
      if (task.type === 'action') {
        const timer = setTimeout(() => {
          canvasEngine.renderPunctuationAction(task.action, task.durationMs);
        }, task.startOffsetMs);
        timers.push(timer);
      } else if (task.type === 'board') {
        const timer = setTimeout(() => {
          canvasEngine.renderHandwriting(task.content, task.coord, task.durationMs);
        }, task.startOffsetMs);
        timers.push(timer);
      }
    }

    // 3. 在本 Row 组预估总时长到达后，完成当前步骤
    setTimeout(() => {
      resolve();
    }, row.estimatedDurationMs || (row.duration * 1000));
  });
}
```

---

## 八、 完整交付物 JSON 实例 (Full Sample JSON)

```json
{
  "apiSpecVersion": "2.0.0",
  "projectCode": "20260911-183000-001",
  "problemText": "学校举行团体操表演，三年级学生排成8列的长方形队列，每列人数相同。如果从每一列中各抽出2人，剩下的总人数正好等于原来6列的人数。原来一共有多少名学生参加表演？",
  "boardPlan": {
    "canvas": { "w": 1726, "h": 980 },
    "question": { "x": 6.0, "y": 12.0, "w": 42.0, "h": 26.0 },
    "analysis": { "x": 6.0, "y": 42.0, "w": 42.0, "h": 50.0 },
    "solution": { "x": 52.0, "y": 14.0, "w": 42.0, "h": 46.0 },
    "summary": { "x": 52.0, "y": 68.0, "w": 42.0, "h": 24.0 }
  },
  "rows": [
    {
      "stage": "题目",
      "duration": 14,
      "speech": "同学们好，今天我们来看这道团体操表演题。先看题目第一句：三年级学生排成八列的长方形队列，每列人数相同。",
      "board": {
        "startCoord": "[8%, 44%]",
        "content": "8列长方形队伍\n每列人数相同",
        "startDelay": 2.8
      },
      "actionSpec": [
        {
          "tool": "rough-notation",
          "action": "underline",
          "target": { "region": "question", "exactText": "排成8列的长方形队列", "occurrence": 1 }
        }
      ],
      "estimatedDurationMs": 14000,
      "exclusiveExecutionPlan": [
        {
          "type": "speech",
          "role": "narration_full",
          "startOffsetMs": 0,
          "durationMs": 14000,
          "endOffsetMs": 14000,
          "text": "同学们好，今天我们来看这道团体操表演题。先看题目第一句：三年级学生排成八列的长方形队列，每列人数相同。"
        },
        {
          "type": "action",
          "role": "punctuation_pause",
          "startOffsetMs": 1000,
          "durationMs": 1200,
          "endOffsetMs": 2200,
          "action": {
            "tool": "rough-notation",
            "action": "underline",
            "target": { "region": "question", "exactText": "排成8列的长方形队列", "occurrence": 1 }
          }
        },
        {
          "type": "board",
          "role": "writing",
          "startOffsetMs": 2800,
          "durationMs": 4800,
          "endOffsetMs": 7600,
          "content": "8列长方形队伍\n每列人数相同",
          "coord": "[8%, 44%]"
        }
      ]
    },
    {
      "stage": "分析",
      "duration": 18,
      "speech": "注意关键变化：从每一列抽出两个人，八列一共抽出了多少人呢？八乘二等于十六人。而剩下的总人数正好等于原来六列的人数。这说明什么？说明抽出来的这十六人，正好等于两列的人数！",
      "board": {
        "startCoord": "[8%, 58%]",
        "content": "抽走总数：8 × 2 = 16 (人)\n8列 - 6列 = 2列\n2列人数 = 16人",
        "startDelay": 3.0
      },
      "actionSpec": [
        {
          "tool": "rough-notation",
          "action": "box",
          "target": { "region": "question", "exactText": "剩下的总人数正好等于原来6列的人数", "occurrence": 1 }
        }
      ],
      "estimatedDurationMs": 18000,
      "exclusiveExecutionPlan": [
        {
          "type": "speech",
          "role": "narration_full",
          "startOffsetMs": 0,
          "durationMs": 18000,
          "endOffsetMs": 18000,
          "text": "注意关键变化：从每一列抽出两个人，八列一共抽出了多少人呢？八乘二等于十六人。而剩下的总人数正好等于原来六列的人数。这说明什么？说明抽出来的这十六人，正好等于两列的人数！"
        },
        {
          "type": "action",
          "role": "punctuation_pause",
          "startOffsetMs": 1000,
          "durationMs": 1500,
          "endOffsetMs": 2500,
          "action": {
            "tool": "rough-notation",
            "action": "box",
            "target": { "region": "question", "exactText": "剩下的总人数正好等于原来6列的人数", "occurrence": 1 }
          }
        },
        {
          "type": "board",
          "role": "writing",
          "startOffsetMs": 3100,
          "durationMs": 6200,
          "endOffsetMs": 9300,
          "content": "抽走总数：8 × 2 = 16 (人)\n8列 - 6列 = 2列\n2列人数 = 16人",
          "coord": "[8%, 58%]"
        }
      ]
    },
    {
      "stage": "解答",
      "duration": 15,
      "speech": "现在我们来写出完整的解答过程。先求每列人数：十六除以二等于八人；再求原来总人数：八乘八等于六十四人。答：原来一共有六十四名学生参加表演。",
      "board": {
        "startCoord": "[54%, 18%]",
        "content": "解：\n① 抽走总人数：8 × 2 = 16 (人)\n② 原来每列人数：16 ÷ (8 - 6) = 8 (人)\n③ 原来总人数：8 × 8 = 64 (人)\n答：原来一共有 64 名学生参加表演。",
        "startDelay": 2.0
      },
      "actionSpec": [],
      "estimatedDurationMs": 15000,
      "exclusiveExecutionPlan": [
        {
          "type": "speech",
          "role": "narration_full",
          "startOffsetMs": 0,
          "durationMs": 15000,
          "endOffsetMs": 15000,
          "text": "现在我们来写出完整的解答过程。先求每列人数：十六除以二等于八人；再求原来总人数：八乘八等于六十四人。答：原来一共有六十四名学生参加表演。"
        },
        {
          "type": "board",
          "role": "writing",
          "startOffsetMs": 2000,
          "durationMs": 8000,
          "endOffsetMs": 10000,
          "content": "解：\n① 抽走总人数：8 × 2 = 16 (人)\n② 原来每列人数：16 ÷ (8 - 6) = 8 (人)\n③ 原来总人数：8 × 8 = 64 (人)\n答：原来一共有 64 名学生参加表演。",
          "coord": "[54%, 18%]"
        }
      ]
    },
    {
      "stage": "总结",
      "duration": 10,
      "speech": "总结这道题的破题核心：抓住变化量与列数的对应关系。少的人数正好补齐减少的列数，这就是著名的差额对应法。",
      "board": {
        "startCoord": "[54%, 72%]",
        "content": "【通法归纳】\n差额对应法：减少的总数量 对应 减少的列数",
        "startDelay": 1.5
      },
      "actionSpec": [
        {
          "tool": "rough-notation",
          "action": "highlight",
          "target": { "region": "summary", "exactText": "差额对应法", "occurrence": 1 }
        }
      ],
      "estimatedDurationMs": 10000,
      "exclusiveExecutionPlan": [
        {
          "type": "speech",
          "role": "narration_full",
          "startOffsetMs": 0,
          "durationMs": 10000,
          "endOffsetMs": 10000,
          "text": "总结这道题的破题核心：抓住变化量与列数的对应关系。少的人数正好补齐减少的列数，这就是著名的差额对应法。"
        },
        {
          "type": "board",
          "role": "writing",
          "startOffsetMs": 1500,
          "durationMs": 4200,
          "endOffsetMs": 5700,
          "content": "【通法归纳】\n差额对应法：减少的总数量 对应 减少的列数",
          "coord": "[54%, 72%]"
        },
        {
          "type": "action",
          "role": "punctuation_pause",
          "startOffsetMs": 6300,
          "durationMs": 1400,
          "endOffsetMs": 7700,
          "action": {
            "tool": "rough-notation",
            "action": "highlight",
            "target": { "region": "summary", "exactText": "差额对应法", "occurrence": 1 }
          }
        }
      ]
    }
  ]
}
```

---

## 九、 常见排障与答疑 (FAQ)

1. **Q: 制作 PPT 时，板书文本折行很长导致超出幻灯片边界怎么办？**  
   - **A**: 系统在四区规划时已将宽度约束在黑板的 $40\% \sim 44\%$ 范围内。下游 PPT Agent 生成文本框时，建议设置 `wordWrap: true`，并将宽度固定为幻灯片宽度的 $42\%$，字体大小自适应设为 16pt~20pt，即可保证排版美观。
2. **Q: 下游渲染微课视频时，为什么板书起笔一定要延迟（`startDelay`）？**  
   - **A**: 避免“话还没开始讲，板书就写出来了”的穿帮体验。`startDelay` 确保口播讲完前导代词后，手部才自然移动落笔。
3. **Q: 为什么不能直接并发执行动作和板书？**  
   - **A**: 现实中单人授课只有一只手。并发执行会导致观众视觉焦点分散，造成严重的认知负荷超载。本规范的单手互斥性是儿童认知心理学的关键要求。
4. **Q: `audioUrl` 为空时如何处理？**  
   - **A**: 说明当前仅导出了结构化微课脚本，尚未批量调用本地 TTS。此时下游 Agent 可直接拿 `speech` 文本调用任何标准 TTS 接口（如 Edge TTS、Azure Speech、Fish Audio 等）或让数字人直接朗读。
