---
name: handwriting-font-policy
description: "板书手写字体加载与层级锁定技巧蒸馏。基于 ZeoSeven FontsAPI 的 remote-css 字体嵌入（栗壳坚坚体 id=490 / 平方韶华 id=157 / 上上签 id=511 / 三生 id=510），L3 板书层独占手写体，题目层永久禁用印刷体（不可改题文/字体/位置/尺寸），link rel=stylesheet + crossOrigin=anonymous + document.fonts.load 双保险加载，localStorage 持久化字体偏好。用于 Agent B 字体选择策略 / 渲染层字体加载 / Check Agent 校验层级越权。"
version: "1.0.0"
archetype: workflow
trigger: "选择板书字体/加载 ZeoSeven 远程字体/校验字体层级越权/手写体与印刷体分层/字体懒加载"
---

# 板书手写字体加载与层级锁定

> **⚠ 时代勘误（2026-10-13 对齐，第五轮更新）**：本 skill 蒸馏自 boardTypography.js 时代，该文件已移除（经仓史复核从未存在）；配套 `src/board-tools/boardTypography.css`（@font-face 死链 /fonts/pingfang-qiaomu.ttf + family "Qinghuabu Qiaomu" 零消费）已于第五轮连根砍除，两个 vite 入口 import 同步移除。原"本地 TTF qiaomu-local + localStorage 偏好"方案**从未接线**（localStorage key 零消费者）。现行真源 = `src/services/stepHandoff.js` 的 `HANDWRITING_FAMILY / HANDWRITING_FONT_STACK / HANDWRITING_CSS_HREF(_FALLBACKS)` 常量：**主字体=平方乔木体（ZeoSeven CDN 507 remote-css）**，栗壳坚坚体(490)为降级栈第 6 位。层级锁定原则（L1 印刷体/L3 手写体）仍活，现行校验位置=`src/check-agent/skillViolations.js`。本文 ZeoSeven 加载方法与授权条款仍有效。

> *"第1步已确认题目是不可变资产；禁止改题文、题目字体、题目位置或尺寸。手写体只活在 L3 板书层。"*

## 蒸馏合同

`Distill [板书手写字体加载与层级锁定] as a [workflow] pack so it can help with [Agent B 字体选择策略 / 渲染层字体加载 / Check Agent 校验层级越权], using [src/services/stepHandoff.js (HANDWRITING_* 真源常量) + https://fontsapi.zeoseven.com/507/ (平方乔木体·现行主字体)], while respecting [L3 板书层独占手写体 / 题目层永久印刷体 / 教育与培训用途允许商用 / 字体不可改名再分发].`

---

## 一、字体清单（已验证可用）

### 1.1 默认字体表

与 `stepHandoff.js` 的 `HANDWRITING_FONT_STACK` 同序降级栈（CDN href 一一对应）：

| 序 | label（=真源 family 名） | source | href / path | 地位 |
|---|---|---|---|---|
| 1 | 平方乔木体 | `remote-css` | `https://fontsapi.zeoseven.com/507/main/result.css` | **主字体（现行）** |
| 2 | 平方韶华体 | `remote-css` | `https://fontsapi.zeoseven.com/157/main/result.css` | 降级 |
| 3 | 平方上上谦体 | `remote-css` | `https://fontsapi.zeoseven.com/511/main/result.css` | 降级 |
| 4 | 平方三生体 | `remote-css` | `https://fontsapi.zeoseven.com/510/main/result.css` | 降级 |
| 5 | 平方韶拓体（PingFangSaTuoTi） | `remote-css` | `https://fontsapi.zeoseven.com/509/main/result.css` | 降级 |
| 6 | 栗壳坚坚体（LikeJianJianTi） | `remote-css` | `https://fontsapi.zeoseven.com/490/main/result.css` | 降级（原主字体） |
| — | KaiTi / STKaiti / PingFang SC / serif | 系统 | — | 栈尾系统兜底 |

> 历史注：旧表的 `qiaomu-local`（`/fonts/pingfang-qiaomu.ttf` 本地 TTF）路径在仓库中不存在，且 family 名 `Qinghuabu Qiaomu` 不在真源 fontStack——已删除该行。

### 1.2 栗壳坚坚体（id=490）详情

> 用户原始引用页面：https://fonts.zeoseven.com/items/490/

- **字重**：1 种（normal）
- **字符覆盖**：GB/T 2312 简体中文 100% (6763/6763)，阿拉伯数字 100%，基本拉丁字母 100%
- **类型**：Script / 手写体
- **设计**：栗壳字库 (lifont.cn)，2024-08 启动，2025-02 上线，半年手写扫描→填充→切片→人工二次校对
- **授权**：自定义条款 `sE72NftE`
  - ✅ 商业使用允许（UI 字体、海报字体）
  - ✅ 嵌入与集成允许（结合自有工程/产品/软件公开发布）
  - ✅ **教育与培训允许**（盈利性教学中分析字体字形设计）
  - ✅ 非盈利性使用允许
  - ✅ 再分发允许（非直接盈利、非权威发行渠道、附带协议副本、不删除版权声明）
  - ‼️ 商标注册禁止（不使用字体保留名称前提下）
  - ⁉️ 修改与衍生待释明（衍生版本不使用字体保留名称前提下）

### 1.3 嵌入语法（CSS / HTML）

```css
@import url("https://fontsapi.zeoseven.com/490/main/result.css");

body {
  font-family: "LikeJianJianTi";
  font-weight: normal;
}
```

HTML 方式（推荐渲染层用，便于 `crossOrigin` 与懒加载控制）：
```html
<link rel="stylesheet" href="https://fontsapi.zeoseven.com/490/main/result.css" crossorigin="anonymous" />
```

---

## 二、层级锁定（核心策略）

### 2.1 三层架构

| 层 | 名称 | 字体类型 | 可改字体？ | 可改题文？ |
|---|---|---|---|---|
| L1 | 题目层（question） | **印刷体永久**（微软雅黑 Microsoft YaHei 主，PingFang SC 降级；字体宪法 v2 夏夏拍板） | ❌ 永久禁止 | ❌ 永久禁止 |
| L2 | 标签层（topicLabel / analysisLabel / solutionLabel / summaryLabel） | 印刷体（UI 默认） | ❌ 系统固定 | ❌ |
| **L3** | **板书层（analysis / solution / summary 的 board 内容）** | **手写体（默认平方乔木体 507；备选平方韶华体 157 → 511→510→509→490 自动降级）** | ✅ 用户可切换（v2.1 下拉 2 选 1：乔木/韶华；随档 uiSettings.handwritingFontChoice） | ❌ 不涉及题文 |
| L4 | 用户透明层（手写体浮层、注释） | — | — | — |

### 2.2 层级越权校验（时代注：函数已移除）

> `assertHandwritingScope` 原实现于 `src/board-tools/boardTypography.js`，该文件已移除。现行层级校验在 `src/check-agent/skillViolations.js`（question 区手写越权软提示 + 读题行 board.content 应为空）。以下为时代档案快照：

```js
assertHandwritingScope({ layer: 'L3', region: 'analysis' })
// → 校验通过

assertHandwritingScope({ layer: 'L1', region: 'question' })
// → throw '手写字体只允许用于 L3 板书层'

assertHandwritingScope({ layer: 'L3', region: 'question' })
// → throw '手写字体只允许用于分析、解答、总结板书；题目层永久禁止'
```

### 2.3 字体风格 fallback 链

```js
fontFamily: HANDWRITING_FONT_STACK  // stepHandoff.js 真源: "平方乔木体","平方韶华体","平方上上谦体","平方三生体","PingFangSaTuoTi","LikeJianJianTi",KaiTi,STKaiti,"PingFang SC",serif
```

> 必须保留栈尾 `KaiTi / STKaiti / serif` fallback，远程字体加载失败时逐级降级，保持手写感不断。渲染层实参考 `src/components/RealBoardPreview.vue`（与真源逐项一致的受控平行定义）。

---

## 三、字体加载策略（双保险懒加载）

### 3.1 流程图

```
用户切换字体 (fontId)
    ↓
getHandwritingFont(fontId) → 查 HANDWRITING_FONTS 表
    ↓
source === 'local' (TTF) ──────────────┐
                                       ├──→ document.fonts.load(`16px "${family}"`)
source === 'remote-css' (ZeoSeven)      │
    ↓                                  │
确保 <link rel=stylesheet> 已挂载      │
    ↓                                  │
link.sheet 存在? ── no ──→ await load event
    ↓ yes                              │
    └──────────────────────────────────┘
                                       ↓
                              字体就绪，可渲染
```

### 3.2 实现代码（已验证）

```js
export async function ensureHandwritingFont(fontId) {
  const font = getHandwritingFont(fontId)
  if (!font) throw new Error(`未知板书字体: ${fontId || '空'}`)

  if (font.source === 'remote-css') {
    const linkId = `board-font-${font.id}`
    let link = document.getElementById(linkId)
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      link.href = font.href
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }
    if (!link.sheet) {
      await new Promise((resolve, reject) => {
        link.addEventListener('load', resolve, { once: true })
        link.addEventListener('error', () =>
          reject(new Error(`板书字体加载失败: ${font.label}`)), { once: true })
      })
    }
  }
  // 双保险：CSS @font-face 已挂载，再显式触发 FontFace 加载
  await document.fonts?.load?.(`16px "${font.family}"`)
  return font
}
```

### 3.3 关键技巧

1. **`link.id = board-font-${font.id}`**：去重，同一字体只挂一个 `<link>`，避免重复请求
2. **`link.crossOrigin = 'anonymous'`**：ZeoSeven CDN 支持 CORS，crossOrigin 让字体走 CORS 通道，避免被 tainted canvas 拒绝（截图导出关键）
3. **`link.sheet` 判定**：link 已加载则 `link.sheet` 非空，跳过 await，提速
4. **`document.fonts.load(16px family)` 双保险**：CSS @font-face 仅声明，真正加载由 FontFace API 触发；调 `load` 强制把字体字形拉到内存
5. **Promise + `{ once: true }`**：避免多次切换字体时累积多个监听器

---

## 四、字体偏好持久化（方案档案·未接线）

> **时代注**：本节方案（`qinghuabu.boardTypography.v1`）从未接线，全仓零消费者。现行用户态切换走 v2.1 通道：B 工作台下拉（localStorage `agent-b-font-choice` 跨会话记忆）→ 交付物 `uiSettings.handwritingFontChoice` 随档走 → 各渲染端 `resolveHandwritingFont` 派生（见 7.1），与本节历史方案无继承关系。

### 4.1 localStorage 存储

```js
const STORAGE_KEY = 'qinghuabu.boardTypography.v1'

loadBoardTypographyConfig()
// → { fontId: 'like-jianjianti' }  (无效 id 回退到 DEFAULT_HANDWRITING_FONT_ID)

saveBoardTypographyConfig({ fontId: 'like-jianjianti' })
// → localStorage.setItem(STORAGE_KEY, JSON.stringify({ fontId }))
```

### 4.2 默认字体（现行）

主字体 = `HANDWRITING_FAMILY = '平方乔木体'`（ZeoSeven CDN 507 remote-css，`link rel=stylesheet` + onload 模式加载，不阻塞首屏）

---

## 五、Agent B 字体选择策略（policy）

### 5.1 getAgentBoardTypographyPolicy(fontId)

```js
{
  kind: 'board-environment-not-tool',
  selectedHandwritingFont: { id, label, family },
  allowed: { layer: 'L3', regions: ['analysis', 'solution', 'summary'] },
  forbidden: {
    layers: ['L1', 'L2', 'L4'],
    regions: ['question'],
    rule: '第1步已确认题目是不可变资产；禁止改题文、题目字体、题目位置或尺寸'
  }
}
```

### 5.2 Agent B 不得做的事

| 禁止 | 原因 |
|---|---|
| 改 question 区字体 | L1 永久印刷体 |
| 改 question 区文字 | 第1步已锁定题文 |
| 改 question 区字号 | 题目字号由 handoff.canvasParams 固定 |
| 在 L4 用手写体 | L4 用户透明层不进字体队列 |
| 自造字体名 | 只能从 HANDWRITING_FONTS 表里选 |
| 改字体保留名称 | 栗壳坚坚体授权要求衍生版本不使用保留名称 |

### 5.3 Agent B 应该做的事

| 应该 | 说明 |
|---|---|
| 用 `getHandwritingStyle(fontId)` 获取 fontFamily | 统一入口，强制带 fallback 链 |
| 在 board 内容里用 `[xxx]` 包裹手写体 | 渲染层识别应用 L3 字体 |
| 缺字体信息时返回 `[]` | 不编造字体名，告知 Check Agent 缺口 |

---

## 六、本地 TTF 字体（时代档案·路径已死）

> **时代注**：`/public/fonts/pingfang-qiaomu.ttf` 在仓库中从未存在，`public/fonts/` 整目录已于第四轮移除（误放的外部工具文件），本地 TTF 方案从未落地。现行全部走 ZeoSeven remote-css。以下为 @font-face 写法档案（若将来真加本地字体可参考）：

```css
@font-face {
  font-family: "Qinghuabu Qiaomu";
  src: url("/fonts/pingfang-qiaomu.ttf") format("truetype");
  font-style: normal;
  font-weight: normal;
  font-display: swap;
}
```

> `font-display: swap` 关键：避免本地字体（已 304 缓存）阻塞首屏，先显示 fallback 楷体，字体就绪后无缝切换。

---

## 七、与 handoff JSON 的对接

### 7.1 handoff 携带 fontSource（现行事实）

`handoff.canvasParams.fontSource.handwriting` 携带真源字体配置（family / choice / fontStack / cssHref / cssHrefFallbacks / loadSnippet），由 `buildCanvasParams(fontChoice)` 从 stepHandoff 常量生成。

**v2.1（2026-10-15）用户态切换器已接线**：B 工作台演播室面板有「✍ 板书字体」下拉（2 选 1：平方乔木体默认 / 平方韶华体）。选择值全链路唯一键 = 交付物 `uiSettings.handwritingFontChoice`（数据键，随档走），所有消费端（row-player 双胞胎 / RealBoardPreview / 服务端归一）用 `resolveHandwritingFont(choice)` / `handwritingFontSourceFor(choice)` 从 stepHandoff 真源派生，手写字体栈字面量全库仍禁止。旧档无此键一律兑底 qiaomu 默认态。

备选态（shaohua）栈序：157 韶华 → 511 上上谦 → 510 三生 → 509 韶拓 → 490 栗坚 → 楷体（选了韶华就不含乔木 507）。

### 7.2 字号基准与字体协同

| 区域 | 字体类型 | 字号 | 行高 |
|---|---|---|---|
| 题目区 | 印刷体（微软雅黑） | ~30px（handoff.canvasParams.QUESTION_FONT_SIZE） | 自然（无强制规范） |
| 分析区 | **手写体（平方乔木体 507 主）** | ~38px（题目 1.2~1.5 倍） | 自然（无强制规范） |
| 解答区 | **手写体** | ~38px | 自然（无强制规范） |
| 总结区 | **手写体** | ~38px | 自然（无强制规范） |

> ★ 字体宪法 v2（2026-10-15 夏夏拍板）：行高 = 自然行高（CSS normal / 字体度量），不设强制行高规范；
> 旧 ~1.65 / ~1.7（渲染 1.55—1.85 微抖）已全库废止；B 估算垂直跨度用 字号×1.2（LINE_HEIGHT_ESTIMATE_RATIO）。

---

## 八、反模式与失败模式

| 反模式 | 现象 | 修正 |
|---|---|---|
| 用手写体写题目 | question 区被改成手写体 | `src/check-agent/skillViolations.js` 软提示（原 boardTypography.js 硬断言已随文件移除） |
| 改字体保留名 | 把 `LikeJianJianTi` 改名 `MyFont` | 授权条款禁止（保留名以真源 fontStack 为准） |
| 不带 fallback | remote-css 加载失败时整段空白 | 必须保留 `KaiTi, STKaiti, cursive` fallback |
| 不 crossOrigin | canvas 截图时字体被 tainted 拒绝 | `link.crossOrigin = 'anonymous'` |
| 重复挂 link | 每次切换都 appendChild | `link.id` 去重 + `link.sheet` 判定跳过 await |
| 不触发 FontFace.load | CSS @font-face 已挂但字形未拉 | `await document.fonts.load(16px family)` 双保险 |
| 首屏闪白 | 本地 TTF 阻塞渲染 | `font-display: swap`，先 fallback 后切换 |

---

## 九、快速参考

```
主字体: 平方乔木体 (ZeoSeven CDN 507 remote-css, stepHandoff.js HANDWRITING_FAMILY)
降级栈: 507 → 157 → 511 → 510 → 509(PingFangSaTuoTi) → 490(LikeJianJianTi) → KaiTi/STKaiti/serif
层级: L1 题目层=印刷体(永久) / L3 板书层=手写体(栈内降级; v2.1 用户可下拉 2 选 1, 选择随档走)
切换: uiSettings.handwritingFontChoice(qiaomu|shaohua) → resolveHandwritingFont 派生 (shaohua 态栈不含 507)
加载: link rel=stylesheet + onload=stylesheet + 多 CDN 降级 (真源 loadSnippet)
fallback: HANDWRITING_FONT_STACK (真源常量, 勿手抄)
授权: 教育与培训允许 ✅ / 修改衍生待释明 / 不改字体保留名
持久化: 工作台下拉 localStorage agent-b-font-choice (v2.1)；旧 qinghuabu.boardTypography.v1 方案仍为档案未接线
```
