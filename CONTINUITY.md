# 项目连续性记录

> 最后更新：2026-08-19
> 用途：跨会话接力棒，记录用户诉求、当前状态、已知问题、下一步。新 agent 接手先读这个。

---

## 一、用户核心诉求（按优先级）

### 1. handoff 必须有实体文件存档
- **写文件时机**：用户点击「确定进入生成表」按钮时（confirmStep1），生成 handoff 的 json 文件
- 每次 Step1 confirm 时，写 `public/handoff/handoff-YYYYMMDD-HHMMSS-SSS.json`
- 同时写 `public/handoff/current.json` 指针，记录当前活跃文件名
- B 进入时从 `GET /api/handoff` 读当前文件，不依赖内存传递
- 修缮层只改当前文件，文件名不变
- **完整顺序**：①用户点「规划四标签+网格」→ 截图 → 存 screenshotUrl 到本地变量；②用户点「确定进入生成表」→ buildStep1Handoff（把 screenshotUrl 写进去）→ POST /api/handoff → 存文件 + 写 current.json → emit 进入 B 页
- **当前状态：后端 handoffStoreHandler.js 完整，前端 Step1 confirmStep1 没调 POST /api/handoff → 链路断裂**

### 2. 截图必须有（用户已确认5遍，正确设计如下）

**硬约束（绝对不动）**：
- 画布布局落坐逻辑
- 预览效果
- 原图贴入画布的判断逻辑（看图题不能用文本描述的，专门设计的，是对的）

**Step1 完整流程**：
1. 用户输入文本 / 上传图 → 识别出文本
2. 看图解答题（不能用文本描述的）→ 原图贴入画布（判断逻辑不动）
3. 先落座题目排版
4. 用户觉得满意 → 点击「规划四标签+网格」按钮
5. 点击后自动把建议的排版区域标签都规划好（画布出现网格+四标签+0-100刻度）
6. **这时候截图**（点击「规划四标签+网格」之后，画布有网格线和四角标时）

**截图设计**：
- 截图工具：snapdom（已在 index.html 引入 `<script defer src="https://unpkg.com/@zumer/snapdom/dist/snapdom.js"></script>`）
- 截图时机：点击「规划四标签+网格」之后，画布上有网格线和四个角标的时候
- 截图目标：`.board-viewport` dom 元素
- snapdom 用法：`const canvas = await snapdom.toCanvas(el, { scale:1, dpr:1, backgroundColor:'#ffffff' }); const dataUrl = canvas.toDataURL('image/png');`

**snapdom 代码调用示例**：
```javascript
// 全局对象 snapdom（index.html 已引入 script 标签）
// 1. 截 .board-viewport 元素
const el = document.querySelector('.board-viewport');
const canvas = await snapdom.toCanvas(el, {
  scale: 1,
  dpr: 1,
  backgroundColor: '#ffffff'
});
const dataUrl = canvas.toDataURL('image/png');

// 2. 转 base64（去掉 data:image/png;base64, 前缀）
const base64 = dataUrl.split(',')[1];

// 3. 调后端 POST /api/screenshot
const res = await fetch('/api/screenshot', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageBase64: base64 })
});
const { urlPath } = await res.json();
// urlPath = "/pic/shot-时间戳.png"

// 4. 存到本地变量，等 confirmStep1 时写进 handoff.screenshotUrl
// screenshotUrl 不发给 B，只在本地 handoff 文件里存档
```
- 存 `public/pic/shot-YYYYMMDD-HHMMSS-SSS.png`，大小 <50KB
- handoff 里存 `screenshotUrl: "/pic/shot-xxx.png"`
- 截图不发给 B（B 图片传输冻结），但本地存档可查
- **screenshotUrl 设计意图**：不直接发给 B，但存在 handoff 文件里作为本地存档凭证。万一 B 遇到看图的奇葩题目，可以通过这个地址找到题目原文截图，有个地方回看。相当于给 B 留了一个"应急回看入口"，虽然不主动传，但需要时能找到。

**当前状态**：
- 后端 screenshotStoreHandler.js 完整
- snapdom 已引入 index.html
- 前端整个截图链路被 `/* */` 注释冻结了（captureHandoffPreview、cacheGridPreview、previewCaptureRef 全被注释）→ 实际不触发
- 原来的设计是存浏览器 Cache API（`qinghuabu-grid-preview-v1`），不是 public/pic/ 文件。两套是不同的东西，需要改成 snapdom → POST /api/screenshot → public/pic/

### 3. 知识点修缮按钮
- **按钮文案**：「优化确认」（用户2026-08-19拍板）
- **位置**：B 页面参数表右上方（不是 Step1）
- **触发**：手工点击，用户觉得表内容差就点
- **更新方式**：点击后直接调用修缮API，成功后覆写文件，B页面因为动态读取所以表格内容自动更新（不需要弹窗里再点"应用修缮"）
- **发送内容**（轻量设计）：handoff 文件地址 + 提示词说明 + A 的 API 凭证（userApiConfig）
- 不需要把整个 handoff JSON 内容传给 API，传文件路径就行，后端自己读
- 知识库文件地址不需要前端传：handoff 文件里已有 `knowledgeBasePath` 字段，后端读 handoff 就能拿到
- 后端读 handoff 文件 + 知识库文件 → LLM 修缮知识点字段 → 原地覆写当前文件
- 修缮字段：relatedKnowledge、knowledgeAnalysis.teachingFocus、knowledgeAnalysis.keyFormulaList、knowledgeAnalysis.formulaHints（新增，提醒B在分析区写公式）、commonMistakes
- 其他字段原样保留，不动
- 第一次修缮前备份 `.original.json`，还原时读备份覆盖
- API 复用 A 的配置（userApiConfig）
- **API 返回内容**：`{ ok, model, filename, handoff: 修缮后的完整JSON, usage }`，前端直接用 `response.handoff` 更新参数表显示，不需要再发 GET
- 还原 API 返回：`{ ok, filename, handoff: 原始JSON, reverted: true }`
- **容错处理（保险方案）**：
  1. 从上游返回文本里提取 JSON（正则匹配 `{...}` 或 ```json ... ```），不要求上游返回纯 JSON
  2. **字段对比覆盖**：提取的 JSON 和原 handoff 做字段级 merge，只覆盖知识点相关字段（relatedKnowledge、teachingFocus、keyFormulaList、formulaHints、commonMistakes），其他字段保持原样
  3. 即使上游返回缺字段/多字段/格式不对，都不会破坏原 handoff
  4. 提取失败才降级：返回原内容 + 友好提示"AI 这次没返回标准格式，已保留原内容，可重试"，不返回 502 错误
- **前端弹窗样式**：参考 Check Agent 润色结果弹窗（居中弹窗、标题栏、内容区、底部操作按钮）
  - 修缮成功：显示修缮了哪些字段 + "保留原内容"/"应用修缮"按钮
  - 修缮失败：显示"AI 这次没返回标准格式，已保留原内容，可重试" + "确定"按钮
- **当前状态：后端 knowledgeRefineHandler.js + prompt 完整，前端没有按钮、没有 refineKnowledge 函数 → 未接入**

### 4. 共同原则
- 不动 A（Agent A 识别逻辑）
- 不动 B（AgentBDirect.vue 零改动）
- 单独写文件，解耦
- API 复用 A 的配置（userApiConfig，getUserApiSnapshot()）
- 偷偷修缮，B 完全无感

---

## 二、项目核心设计（已确认的真相）

### 三层 Agent 解耦
- **A（识别）**：多模态，识图+题型+知识点+布局。用 userApiConfig。
- **B（生成）**：纯文本，四环教学法+口播毛料+板书动作。用 agentBApiConfig（独立 v2 key）。
- **C（检查）**：纯文本润色，温度0.2，只改 speech/board/actionSpec，保留行数顺序。用 checkAgentApiConfig（独立）。
- 三者配置完全独立，可用不同模型/供应商/成本。

### handoff 实体文件解耦（用户的核心设计）
- A 写文件 → 修缮层改文件 → B 读文件，三者不直接依赖
- 每次生成独立文件带时间戳，可回溯历史
- current.json 指针解决"当前活跃版本"
- 可手动编辑 JSON，B 读到的就是修改后的
- **B 页面参数表动态抓取**：Agent B 输入交接台（第2步）的参数表内容（题目类型/板书侧重/四区布局参数/建议年级/知识关联点/教学重点/关键公式等）应该从 handoff JSON 文件动态读取字段，不是硬编码，不是内存传递

### 画布四层叠层
- L1 底图层：canvas.png（甲方画布 1726×980）
- L2 内容层：BoardContentLayer（题目/标签/区域/网格，唯一渲染边界）
- L3 播放层：rough-drawing SVG + annotation DOM + playback slot
- L4 画笔层：用户画笔（边界保留，交互未实现）

### 时间线
- 160字/分（小学老师自然语速，不是新闻联播250字/分）
- 1.5s 行间隔（给孩子消化）
- 阶段内局部时间（表格显示，每阶段从0开始）+ 全局绝对时间（渲染用，连续累计）
- 长停顿靠 B 拆成独立 row 获得，不写 TTS 控制标签

### 知识双轨检索
- **知识库文件**：`K:\4\doc\knowledge-a.compact.json`（247条知识点，compact 格式）
  - 结构：`_meta`（source/sha256/rows/keys映射）+ `rows` 数组
  - 每条字段：`i`(id) / `g`(学段) / `s`(系列) / `t`(类型) / `k`(知识点) / `q`(经典样题) / `e`(考点) / `p`(策略方法数组) / `x`(讲解要点) / `n`(总结归纳) / `m`(易错点数组)
- 服务端 Top-K（server/agentAKnowledge.js）：A 识别时注入，n-gram 匹配 knowledge-a.compact.json，LLM 选 knowledgeId，服务端 hydrate 回填完整记录
- 前端本地 n-gram（src/services/agentAKnowledge.js）：Step1"查询知识关联点"按钮用，浏览器里匹配同一个 JSON
- 两者互补

### B prompt 是核心教学资产
- 469行，AGENTS.md 反复强调"禁止为省 token 删减"
- skill 模块化（liyongle-elementary/ 分7个文件：persona/four-rings/speech-rules/board-rules/coordinate-rules/output-format/examples）
- 当前默认 skill = liyongle-elementary

### B 图片传输冻结
- handoff 只传15个文本字段（HANDOFF_TEXT_FIELDS 白名单，在 server/agentBV2Handler.js 第15行），不传原图/Base64/画布快照
- 图片留在本地存档，需要时可查，但不进入 B 推理
- 成本控制 + 质量聚焦

### handoff 完整字段定义（src/services/stepHandoff.js buildStep1Handoff）

**发给 B 的白名单（15个）**：
| 字段 | 类型 | 说明 |
|---|---|---|
| handoffVersion | number | 版本号，固定 1 |
| problemText | string | 题目文本 |
| problemType | string/null | 题型（如"应用题"） |
| boardFocus | string/null | 板书侧重（如"关系理解"） |
| relatedKnowledge | array/null | 关联知识点数组（深拷贝） |
| knowledgeAnalysis | object/null | 知识点分析（含 coreKnowledge/teachingFocus/keyFormulaList 等，深拷贝） |
| suggestedGrade | string | 建议年级（从 input 或 knowledgeAnalysis.suggestedGrade 提取） |
| uncertainItems | array | 不确定项数组 |
| suggestedLayout | string/null | 建议布局（left_right/top_bottom） |
| imageKind | string | 图片类型（has_diagram/text_only） |
| keepOriginal | boolean | 是否保留原图 |
| coordinateSpec | object | 坐标规范（coordinateSystem/format/example，百分比坐标 0-100 原点左上） |
| zoneAnchors | object/null | 区域锚点（topic/analysis/solution/summary 的 label 和起手坐标，从 boardPlan+topicLayout 提取） |
| topicLayout | object/null | 题目布局（圆角2位小数） |
| boardPlan | object/null | 板书规划（各区域坐标和标签，圆角2位小数） |

**不发给 B 的额外字段（4个）**：
| 字段 | 类型 | 说明 |
|---|---|---|
| confirmedAt | string | ISO 时间戳（确认时间） |
| showGrid | boolean | 是否显示网格 |
| agentPageName | string | Agent 页面名称 |
| agentCapability | string | Agent 能力描述 |

**用户要求新增但代码里还没有的**：
| 字段 | 类型 | 说明 |
|---|---|---|
| screenshotUrl | string | 截图地址（"/pic/shot-时间戳.png"），不发给 B，只在本地 handoff 文件里存档 |
| knowledgeBasePath | string | 知识库文件地址（"doc/knowledge-a.compact.json"），不发给 B，只在本地 handoff 文件里存档；修缮 API 后端读 handoff 就能拿到，不需要前端传 |

**防摸鱼设计（agent 会摸鱼，双重保险）**：
1. buildStep1Handoff 里加显眼注释：标注 screenshotUrl/knowledgeBasePath 是本地存档字段，不发给 B
2. HANDOFF_TEXT_FIELDS 旁边加显眼注释：列出不发给 B 的字段清单（screenshotUrl/knowledgeBasePath/confirmedAt/showGrid/agentPageName/agentCapability）
3. 运行时过滤（已有）：normalizeAgentBPromptHandoff 只返回白名单字段，其他自动过滤
4. 加断言校验：agentBV2Handler.js 里校验，发给 B 的 handoff 若包含 screenshotUrl/knowledgeBasePath 就报错

### Check Agent 不阻断
- C 格式异常时返回原 rows + changes=[]，静默降级
- A/B 是必要主链，C 是可选后处理

---

## 三、当前已知问题 / 未接入项

### 后端写好了前端没接入（3项，最高优先级）
| 功能 | 后端 | 前端 | 影响 |
|---|---|---|---|
| handoff 实体文件存档 | ✅ | ❌ confirmStep1 直接 emit，没写文件 | DirectFlow 从 /api/handoff 读但文件不存在 → 报错 |
| 知识点修缮按钮 | ✅ | ❌ 没按钮没函数 | 用户无法手动修缮 |
| 截图存档 | ✅ | ❌ 整个链路被注释冻结 | 题目不截图，handoff 无 screenshotUrl |

### 其他
- prompt.js 历史：之前被覆盖成48行残缺版，后从 git 恢复。当前469行完整。
- V3 草稿：prompt-v3-draft.js + skills/prompt-v3-draft/ 历史遗留，未启用。
- boardTypography：手写字体配置被注释，等独立播放器。
- L4 用户画笔层：只保留边界，交互未实现。
- 模板里 ref="previewCaptureRef" 还在（第775行），但 ref 变量被注释了 = 死引用。

---

## 四、API 清单（全部后端已实现）

| API | 方法 | 前端调用方 | 触发条件 | 状态 |
|---|---|---|---|---|
| /api/recognition/problem | POST | Step1Entry | 上传图片自动/点击识别 | ✅ 已接入 |
| /api/agent-b-v2/generate | POST | AgentBDirect | 点击生成 | ✅ 已接入 |
| /api/check-agent/check | POST | AgentBDirect | 点击 Check Agent | ✅ 已接入 |
| /api/handoff | GET | DirectFlow | 进入 B 页 | ✅ 已接入 |
| /api/handoff | POST | Step1Entry | confirmStep1 | ❌ 未接入 |
| /api/handoff/list | GET | （未接入） | 列出历史存档 | ❌ 未接入 |
| /api/knowledge/refine | POST | Step1Entry | 点击优化知识点 | ❌ 未接入 |
| /api/knowledge/revert | POST | Step1Entry | 点击还原 | ❌ 未接入 |
| /api/screenshot | POST | Step1Entry | 截图存档 | ❌ 未接入 |

---

## 五、下一步（等用户指示）

用户说"我说一个你记一个，不要抢节奏"。当前在记录阶段，不动代码。

待用户确认后，按顺序接入：
1. Step1 confirmStep1 写 handoff 文件（POST /api/handoff）
2. 截图存档（snapdom 截图 → POST /api/screenshot → handoff 加 screenshotUrl）
3. 知识点修缮按钮 + 还原按钮

---

## 六、用户情绪记录（2026-08-19）

用户非常生气，原因：
- 很早以前就要求 handoff 实体文件 + 截图存档
- 之前的 agent 声称"完成了""验证通过了"，但实际后端写了前端没接，功能跑不通
- 截图链路整个被注释冻结，用户不知道
- 用户原话："我很早以前就说了我要有截图，我要有截图 我handoff必须有文件，结果agent全在骗我"

处理原则：
- 不找借口，承认问题
- 不抢节奏，用户说一个记一个
- 动手前必须用户明确确认
- 验证必须真实跑通，不能只看构建通过

---

## 七、用户工程原则（入场必背，违反=抢跑）

### core 原则
1. **极简但完整**：每个字都有价值，无冗余
2. **AI友好**：用 Claude Code 等工具最易理解的语言；设计前先去 GitHub 找成熟框架/模板/模块，严格禁止手搓；什么都没有或都不好才自己写
3. **严谨代码膨胀**：能复用的公共 CSS/模块/函数务必做好公共引用管理，禁止重复复制
4. **能用图就不要一堆 md**：两张图——①系统全景设计规划图（功能表，每个节点带关键词信息）②施工进展图（做了哪些/还剩哪些/下一步/前面怎么来的，对话中对应埋点做好锚点）。不要每次全量上下文！先增量阅读！上下文=图+变更tree（可逆向还原）
5. **任何修改必须记录变更树**，没落下痕迹=没做
6. **没有验证过的代码不要说好了**，绝不臆断，以代码实际为真相
7. **标准工业化**：应用尽用，优先成熟框架代码，禁止盲目手搓（手搓=后期团队无法交接+高维护成本）
8. **禁止过度设计/自我造词**：字段/参数/定义/出参入参必须清晰可溯源
9. **缓存+增量阅读+(图+tree替代上下文)**
10. **一个问题错误超过5次马上停下**，逆向思考倒推断裂点（第一性原理+剃刀+系统性+贝叶斯），搞不定喊用户

### 代码工作行为准则
- **先规划再执行**：开发前输出层级分明的开发结构（一级功能板块→二级功能模块→三级具体子功能），标注关键字段参数，完成一个模块立即校准
- **脱稿工作制**：彻底摆脱对话历史依赖，信息资产化
- **三个必维护记录文件**：
  - `PROJECT_STATE.md` — 唯一实时真相（基本信息/已确认设计决策/已验证边界/当前代码状态/已知坑/下一步接力棒）
  - `ENGINEERING_LOG.md` — 每完成一个工作单元即刻追加，完全自包含不依赖上下文（背景/思路/执行步骤/代码变更/发现确认/验证结果/接力棒）
  - `DECISIONS.md` — 不仅记录做了什么，更讲清为什么这么做（问题/考虑的方案/最终决策/理由/风险/验证/后续影响）
- **三阶段自检**：开发前（具体痛点是什么/最简单解决方法）→ 开发中（代码是否只解决当前问题/是否存在未使用函数类）→ 开发后（是否解决最初痛点/维护成本是否降低）

### 标准化工作流（五阶段二十一黄金步骤）
- 🔍 阶段一 勘探准备：技术栈识别→文档六维度研读→基础环境止血→可复用资源初筛
- 📊 阶段二 深度诊断：目录4层遍历职责标注→业务逻辑三层扫描（文件/函数/业务）→六维度评估→逆向推导需求校准
- 🏗️ 阶段三 骨架施工：页面四类梳理→CDN五原则+占位→结构固化边界确认
- 🔌 阶段四 管线铺设：黄金三角API优先→非核心API分批→统一数据交互规则→数据流解耦校验
- 🎨 阶段五 精装验收：数据驱动UI→本地化合规→自动化修复性能→全流程冒烟→规范固化→最终交付

---

## 八、需求规格说明书（2026-08-19 整理）

**文件位置**：`K:\4\doc\需求规格说明书-handoff实体化与知识点修缮.md`

**包含内容**：
1. 真实目标 — handoff 从内存传递变文件实体化 + 知识点手动修缮入口
2. 必要条件 — 3条（handoff实体文件/截图存档/知识点可修缮）
3. 功能清单 — 6个功能（handoff存档/截图存档/知识点修缮按钮/新增字段/防摸鱼设计/B页面动态抓取）
4. 不做清单 — 8条YAGNI
5. 业务流程序列图 — 完整mermaid时序图
6. 数据字典 — handoff完整21字段（15白名单+6本地存档）
7. API清单 — 9个API含接入状态
8. 用户故事 — 4个US含Given-When-Then验收标准
9. 待确认项 — 5个需要用户拍板的问题
10. 变更记录

**整理工具**：pm-requirement-sharpening-stone（需求磨刀石）+ ba-master（BA大师）

---

## 九、板书速度与输出模板（2026-08-20 用户明确要求，一字不丢）

### 9.1 速度规则

- **板书速度：1 秒 2 个汉字**（手写字体书写速度）
- **动作速度：差不多同样速度**（rough-line/rough-arrow/rough-notation 的绘制速度和板书书写速度一致）

### 9.2 画布参数（起手坐标计算依据，必须给 Agent B）

| 参数 | 值 | 说明 |
|---|---|---|
| 画布尺寸 | **1726 × 980 px** | 固定，不读取用户填写的其他画布尺寸，也不允许改写 |
| 坐标原点 | 左上角 (0,0) | X 向右，Y 向下，所有坐标用百分比 0-100 |
| 题目区字号 | 30px | Segoe UI / PingFang SC / Microsoft YaHei（印刷体） |
| 题目区行高 | 1.65 | |
| 分析区字号 | 约35px（题目的1.2~1.5倍） | LikeJianJianTi（手写尖尖体），红色 |
| 解答区字号 | 约35px（题目的1.2~1.5倍） | LikeJianJianTi（手写尖尖体），黑色 |
| 总结区字号 | 约35px（题目的1.2~1.5倍） | LikeJianJianTi（手写尖尖体），黑色 |
| 其他区行高 | 自然换行 | 渲染层加微小随机抖动营造手写感，B 按正常行高估算 |

**行高规则**（用于计算起手坐标的 y 增量）：按当前字号**自然换行**，不预置固定行高数值；渲染层会对每行行高做微小随机抖动营造手写感，B 按正常行高估算坐标，不需要自己叠加抖动。

### 9.3 输出模板（用户指定格式）

**每行结构**：
`  `
【stage】-【row数组】-【预估time】 | 【口播稿】| 【起手坐标】-【板书内容】| 【起手坐标/此处说不清楚可以看情况】-【工具】-【做什么】
`  `

**动作的时间节点**：
`  `
【时间节点 - 本row开始的多少秒】
`  `
即 triggerAt 格式：+00:00:08，表示本行 row 开始播放后第几秒起笔。

**板书起手坐标格式**：
`  `
board 内容前标注 [x%, y%]
例：[10%, 45%] 总人数 = 8 × 行数
`  `
读题阶段 board 为空，不需要坐标。

### 9.4 已更新到 prompt.js

- 第2节「直播参数配置」：加入板书速度1秒2字、动作速度同速、画布尺寸固定、板书字号行高表、行高估算公式
- 第5节「板书原则」：起手坐标规则已有
- 第14节「输出格式」：JSON合同不变，模板作为参考格式

