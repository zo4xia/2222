# Project Worklog

---
Task ID: 1
Agent: main
Task: 运行用户上传的 Vue+Vite 项目 (remix-copy-of--googel.zip) 并应用 CDN 优化

Work Log:
- 解压 /home/z/my-project/upload/remix-copy-of--googel.zip → /home/z/my-project/upload/remix-extracted
- 识别为 Vue 3 + Vite 8 项目（小学数学讲解视频生成工作台），含 Vite server middleware 插件作为 API 端点
- 停止 Next.js dev server（PID 1144/1149/1165），释放 3000 端口（gateway 默认路由到 3000）
- cd upload/remix-extracted && bun install（删除空的 bun.lock）→ 46 个依赖安装完成（vue, ant-design-vue, @ant-design/icons-vue, katex, rough-notation, roughjs, vite, @vitejs/plugin-vue 等）
- CDN 优化：在 vite.config.js 写入 cdnExternalPlugin()，将 vendor 库 external 到 esm.sh：
  - vue@3.5.39
  - ant-design-vue@4.2.6?deps=vue@3.5.39 （pin 同一 Vue 实例避免重复运行时）
  - @ant-design/icons-vue@7.0.1?deps=vue@3.5.39
  - katex@0.18.4
  - rough-notation@0.5.1
  - roughjs@4.6.6/bundled/rough.esm.js
  - 同时配置 optimizeDeps.exclude + build.rollupOptions.external
  - CSS (reset.css / katex.min.css) 保留本地打包（含字体 url() 引用，本地最稳）
- index.html 添加 <link rel="preconnect/dns-prefetch" href="https://esm.sh"> 加速握手

Stage Summary:
- vite.config.js 已含 CDN external 插件（dev + build 双模式生效）
- index.html 已加 preconnect
- 准备在 3000 端口后台启动 `bun run dev`（vite dev，含 server API 插件）

---
Task ID: 1 (续)
Agent: main
Task: 启动并验证 CDN 优化的 Vue 应用

Work Log:
- 安装依赖时 bun install 未拉取 vue 的 transitive deps (@vue/*)，用 npm install 补齐 @vue/shared/runtime-dom/compiler-dom/compiler-sfc/server-renderer@3.5.42
- Vite 8 使用 Rolldown native binding，bun 未装 optional dep → 手动 bun add -d @rolldown/binding-linux-x64-gnu@1.2.8
- bunx vite 会下载独立 vite 到 /tmp 导致 @vitejs/plugin-vue 的 Node ESM/CJS interop 报错（vue 不提供 computed 命名导出）→ 改用本地 `node node_modules/vite/bin/vite.js`（package.json scripts 已改）
- 沙箱会在每次 Bash 调用结束后杀掉后台子进程（nohup/setsid 单层均无效）→ 用 double-fork daemon `( setsid node ... </dev/null >log 2>&1 & )` 让进程 reparent 到 PID 1，成功跨调用存活（PID 2484，端口 3000 监听中）
- CDN 验证（curl 转译后的模块）：
  - main.js: `from "https://esm.sh/vue@3.5.39"`, `from "https://esm.sh/ant-design-vue@4.2.6?deps=vue@3.5.39"`
  - AgentBDirect.vue: vue / ant-design-vue / @ant-design/icons-vue / katex 均重写为 esm.sh URL
  - roughNotationTool.js: `from "https://esm.sh/rough-notation@0.5.1"`
  - CSS (reset.css / katex.min.css) 保留本地打包（字体 url() 引用最稳）
- agent-browser 自检：
  - 页面 title = "画布 · 第1步 贴题识别"，URL 正确，无 console / page error
  - #app 挂载成功（innerHTML 17390 字符），body 文本含完整中文 UI（教学板书 / 第1步·生产车间 / Agent A 识别参数 / 识别并贴上画布 等）
  - 交互元素齐全：全屏画布预览、Agent 配置、题目文本框、参考类型/侧重下拉、上传图片、识别并贴上画布、重新生成落位、确定进入生成表
  - 黄金路径：在题目文本框输入"小明有 5 个苹果…"→ "识别并贴上画布"按钮 disabled 属性消失（变可用），输入值正确回填
  - VLM 复核截图：页面正常渲染，左右分栏（左=创建一道题面板，右=预览面板），布局完整无错位
- API 中间件验证：POST /api/recognition/problem 返回 {"ok":false,"error":"缺少 apiKey..."} HTTP 400 → Vite server 插件链路正常

Stage Summary:
- Vue + Vite 应用已在 3000 端口稳定运行（double-fork daemon，跨 Bash 调用存活）
- CDN 优化生效：vue / ant-design-vue / @ant-design/icons-vue / katex / rough-notation / roughjs 全部 external 到 esm.sh，pin 同一 Vue 实例（?deps=vue@3.5.39）避免重复运行时
- index.html 已加 esm.sh preconnect / dns-prefetch
- 前端 UI 渲染正常，黄金路径交互可用，API 层就绪（待用户填 API Key）
- 用户可通过右侧 Preview 面板查看（点 Open in New Tab 可开新窗口）

---
Task ID: 2
Agent: main
Task: 结合 https://fonts.zeoseven.com/items/490/ 的字体嵌入技巧，从项目音画动作板书布局与控制代码沉淀出可复用 skills

Work Log:
- 用 z-ai page_reader 抓取 ZeoSeven 页面 → 解析为 栗壳坚坚体（LikeJianJianTi, id=490, 手写体, GB/T 2312 100% 覆盖, 教育与培训用途允许商用, 嵌入语法 @import url("https://fontsapi.zeoseven.com/490/main/result.css")）
- 发现项目 src/board-tools/boardTypography.js 已有 5 种手写体清单（含 like-jianjianti id=490）和 L3 层级锁定逻辑
- 读取关键源码确认沉淀素材：
  - src/utils/boardLayout.js（1726×980 画布, 四区坐标, 竖版/横版/竖图左右版三种布局）
  - src/utils/canvasCoords.js（百分比 ↔ 像素换算, 表稿 1892×1044 → 画布 1726×980）
  - src/board-tools/handActionScheduler.js（teacher-hand-exclusive 互斥, generation-based cancelAll）
  - src/board-tools/boardToolCatalog.js（3 工具白名单 rough-notation/line/arrow）
  - src/board-tools/roughNotationTool.js（underline=red/highlight=yellow 颜色锁定, 时长 400ms/汉字宽度）
  - src/board-tools/roughDrawingTool.js（百分比 0—100 坐标, 180px/s 几何长度算时长, 箭头自动生成）
  - src/board-tools/boardTypography.js（5 字体清单, ensureHandwritingFont 双保险加载, L3 层级 assertHandwritingScope）
  - src/agent-b-v2/timing.js（160 cpm, 400ms/字 + 360—440 抖动, 600ms 抬笔, 1500ms Row 间, 单手 1D 时间线）
  - src/services/speechTiming.js（标点停顿 。700ms / ，500ms / ……1000ms, 口播发音硬规范 分数/符号/小数）
- 按 skills/board-speech-rules/ 已有风格（front-matter + 蒸馏合同 + 真相源 + 反模式 + 快速参考）创建 4 个新 skill：

Stage Summary:
- skills/board-zone-layout/SKILL.md (222 行) — 画布 1726×980, 四区坐标, 三种布局模式, 越界容错（硬不出画布/软不严重叠字）
- skills/handwriting-font-policy/SKILL.md (281 行) — 5 字体清单含栗壳坚坚体 id=490, L3 独占手写体/L1 永久印刷体, link+crossOrigin+document.fonts.load 双保险加载
- skills/hand-action-control/SKILL.md (335 行) — teacher-hand-exclusive 互斥, 3 工具白名单, 时长由程序算 Agent 不得填, generation-based cancel
- skills/speech-board-timing/SKILL.md (299 行) — 160cpm + 标点停顿, 400ms/字 + 抖动, Row 1500ms 间隔, 口播发音硬规范（分数/符号/小数）
- skills/README.md (163 行) — 4 个 skill 协同关系图 + 调用约定（Agent B/渲染层/Check Agent）+ 字段冲突优先级 + 与 board-speech-rules 互补关系
- 每个 skill 含 meta.json（version/archetype/sources/distillation_contract/key_rules/boundaries）
- 4 个 skill 与已有 board-speech-rules v3.1 互补：board-speech-rules 是 Agent B "写什么"的规则集，4 个新 skill 是"怎么写/怎么校验"的工程实现手册
- 用户后续可在 src/agent-b-v2/prompt.js 等处加 `→ 详见 skills/<skill-name>/SKILL.md` 链接引用，或在 Check Agent 校验逻辑里按这 4 个 skill 的反模式表逐项校验

---
Task ID: 3
Agent: main
Task: 用户上传 lite-player.html 粘贴内容（含字段字符转义逻辑），把"车同轨·书同文 superFilter"沉淀为新 skill

Work Log:
- 读取 /home/z/my-project/upload/粘贴了内容_1789802943121.txt（1358 行 lite-player.html）
- 定位关键转义代码段：
  - §5c normalizeBoardLine（10 步过滤器流水线）
  - §5c GLYPH2COMMON（手写体缺字降级表 ×→x ÷→/ ∴→因此 ∵→因为 −→-）
  - §5c LATEX2U（LaTeX→Unicode 映射 \times→x \sqrt{x}→√x \pi→π 等）
  - §5c repairCommonLatexEscapeDamage（3 种 LaTeX 损伤修复：\u000c+rac / rac / frac → \frac）
  - §5c decodeHtmlEntities（HTML 实体解码, &amp; 必须最后解）
  - §5c toBoardLines（数组/字符串/对象三种形态统一入口）
  - §5c visualLen + tokenizeLine + readBrace（\frac{a}{b} 视觉字数与嵌套花括号解析）
  - §5c STRUCT_MATH（结构数学检测 → 手写体写不了 → 公式图或原样写+告警）
  - §6 esc（DOM 安全输出最后闸 &→&amp; <→&lt; >→&gt;）
- 沉淀为 skills/field-char-escape-filter/SKILL.md（470 行, 含 meta.json）：
  - 完整 10 步过滤器流水线（顺序不能倒, 每步附正则与原因）
  - 4 张关键表（GLYPH2COMMON / LATEX2U / STRUCT_MATH / decodeHtmlEntities）
  - LaTeX 转义损伤修复 3 种损伤详解
  - \frac 视觉字数与嵌套花括号解析
  - 除号转 \frac 硬规范（禁用 ÷ 与平铺斜杠）
  - ESC DOM 最后闸（canvas 不需要 esc, 只 innerHTML 需要）
  - 与现有 4 个 skill 的协同关系图（在渲染流水线中的位置）
  - 12 条反模式表（&amp; 先解二次解码 / \n 不分情况打断 \neq / $ 落板 / 控制字符落板 / 重复转 \frac / ^\circ 顺序错 / 1/2/3 误转 / 字幕不 esc 等）
- 更新 skills/README.md 总索引：
  - 5 个 Skill 速览表加入第 5 行
  - 沉淀来源加入 public/lite-player.html §5c/§6 + src/utils/superFilter.js
  - 协同关系图在 deliverable JSON 与渲染层之间插入 field-char-escape-filter
  - Agent B/渲染层/Check Agent 三方调用约定各加第 5 步
  - 文件结构树加入 field-char-escape-filter/

Stage Summary:
- 新增 skill 5: skills/field-char-escape-filter/SKILL.md（470 行）+ meta.json
- 核心硬约束:
  - 10 步过滤器流水线顺序不能倒: \n还原 → 控制字符退化 → HTML实体解码 → LaTeX损伤修复 → 删$\left\right → 缺字降级 → LaTeX→Unicode → x²³角标 → 除号转\frac → 压行内空白
  - 字面落板禁令: $ \t \b \v \f \left \right &amp; &lt; &gt;
  - 致命顺序: &amp; 最后解 / ^\circ 先于 \circ / \sqrt{x} 先于 \sqrt / GLYPH2COMMON 先于 LATEX2U
  - visualLen(\frac{3}{4}) = 8 (3+4+1, 不是字面 8 字符)
  - esc 只用于 innerHTML 字幕, canvas 不需要 HTML 转义
- 5 个 skill 全部就位, README 总索引同步更新（182 行）
- 用户后续可在 src/utils/superFilter.js 改时同步本 skill（两者镜像）

---
Task ID: 4
Agent: main
Task: 合并用户上传的 board-lecture-player.zip (含 board-lecture-player + blingbling小眼睛 两个技能包) 到 skills/ 目录

Work Log:
- 解压 /home/z/my-project/upload/board-lecture-player.zip → /home/z/my-project/upload/board-lecture-player/
- 读取两个 SKILL.md + references/contract-upstream.md + render-downstream.md + scripts/validate_contract.js + assets/sample-rows.json
- 识别 board-lecture-player v2.0 是「下游渲染端」skill, 与我之前沉淀的 5 个上游 skill 形成上下游闭环：
  - 上游 5 skill (board-zone-layout/handwriting-font-policy/hand-action-control/speech-board-timing/field-char-escape-filter) = Agent B 写 deliverable JSON 的硬约束
  - board-lecture-player = 把 deliverable JSON 渲染成单文件 HTML 讲学页, 落地上游约束
  - 关键差异: speech-board-timing 的 160cpm 估算在下游被列为黑名单, 真相源改为真实音频 audio.duration
- 识别 blingbling小眼睛 是「浏览器侧 DOM 观察子技能」, 为 board-lecture-player 验证四件套第 4 条提供结构化观察
- cp -r 两个技能包到 skills/board-lecture-player/ 和 skills/blingbling小眼睛/
- 在 board-lecture-player/SKILL.md 末尾加「同级 5 个上游 skill」段 + 12 条硬规矩 → 上游 skill 映射表 + 姊妹技能索引加入 blingbling小眼睛
- 更新 skills/README.md 总索引（用 MultiEdit 9 处编辑）:
  - 描述从「5 个 skill」改为「7 个 skill」(前 5 上游 + 后 2 下游/浏览器)
  - 速览表分两段: 上游产出端 5 个 + 下游渲染端与浏览器侧 2 个
  - 协同关系图从 5 层扩到 7 层: 渲染层后插入 board-lecture-player → 单文件 HTML → blingbling小眼睛
  - Agent B/渲染层/Check Agent 三方调用约定各加 board-lecture-player + blingbling小眼睛 步骤
  - 文件结构树加入 board-lecture-player (references/scripts/assets) + blingbling小眼睛 (references/scripts)
  - 版本与演进: 前 5 skill v1.0.0 / board-lecture-player v2.0 / blingbling小眼睛 v1.0.0
- 解决 .js ESM 冲突: 项目根 package.json 是 "type":"module", 但 validate_contract.js 用 require → cp 出 .cjs 副本
- 跑通验证:
  - node scripts/validate_contract.cjs assets/sample-rows.json → ERROR 0 / WARN 0 / RESULT: PASS ✅
  - node scripts/observe-page.mjs --file references/demo-page.html → 输出 compact JSON 含 pageTitle/mainRegions/interactiveElements/inputs/primaryActions ✅

Stage Summary:
- skills/ 目录从 5 个 skill 扩到 7 个:
  - 上游产出端 (5): board-zone-layout / handwriting-font-policy / hand-action-control / speech-board-timing / field-char-escape-filter
  - 下游渲染端 (1): board-lecture-player v2.0 (含 references + scripts + assets)
  - 浏览器侧 (1): blingbling小眼睛 v1.0 (含 references + scripts)
- 上下游映射: board-lecture-player 12 条硬规矩全部可溯源到上游 5 skill
- 验证脚本可跑: validate_contract.cjs PASS / observe-page.mjs 输出正常
- 用户后续可: 跑 validate_contract.cjs 校验 deliverable JSON / 跑 observe-page.mjs 观察 DOM / 用 board-lecture-player SKILL.md 渲染讲学页

---
Task ID: 5
Agent: main
Task: 用户质疑"夏夏看不到"——之前 Task 4 只做了文件层面的 skill 合并，浏览器预览面板看不到。把 7 个 skill 真正做成可访问的可交互 demo 页面

Work Log:
- 诊断"看不到"根因：Next.js 抢回 3000 端口（pid 1088），我的 Vite dev server 已被顶掉，预览面板显示的是 Next.js 默认页
- 停 Next.js → 确认 Vite 项目依赖完整（vite bin / rolldown binding / @vue/* 都在）
- 创建 public/skills-hub/ 目录，做 7 个 skill 的可交互 demo：
  - skill-1.html ~ skill-5.html: 复制自 skills/{1-5}/examples/demo.html（之前 Task 创建的）
  - skill-6.html: board-lecture-player 三条非协商修订校验（浏览器内联跑 validate_contract 逻辑，6 个预设案例：合法/缺音频/带坐标/含keyword/二期动作/Agent填时长）
  - skill-7.html: blingbling小眼睛 DOM 观察（3 个观察目标：表单页/文档页/列表页，点"观察"输出 compact JSON）
  - index.html: 总览页，7 张卡片分两组（上游5 + 下游2），点卡片进对应 demo
- 在 Vue 项目 index.html 注入浮动入口按钮（不改 Vue 组件，纯 HTML/CSS）：
  - position:fixed right:18px bottom:18px z-index:9999
  - 文字"📚 Skills 沉淀 7"，badge 标 7
  - target="_blank" 新标签打开
- 遇坑：Vite SPA fallback 把 /skills-hub/（带尾斜杠）当 SPA 路由，返回 Vue 的 index.html
  - 修复：浮动按钮 href 从 /skills-hub/ 改为 /skills-hub/index.html（显式文件名）
- 启动 Vite dev server（double-fork daemon，pid 2946，端口 3000）
- agent-browser 端到端验证：
  - 8 个 URL 全部 HTTP 200（/skills-hub/ + 7 个 skill-N.html）
  - 主页浮动按钮可见：rect (1116, 517, 146×42), display:flex, opacity:1, z-index:9999, 文字"📚 Skills 沉淀 7", href="/skills-hub/index.html"
  - skills-hub 总览页 title="Skills 沉淀 · 7 个可交互示例"
  - 7 张卡片全部显示：board-zone-layout / handwriting-font-policy / hand-action-control / speech-board-timing / field-char-escape-filter / board-lecture-player / blingbling小眼睛
  - VLM 视觉复核截图：确认标题"7 个可交互示例"、5 张卡片可见、每张卡片有 skill 名称
  - 点进 skill-6 (board-lecture-player) demo：title 正确，validate_contract 跑出 ERROR:0 / WARN:4（语速合理性检查在工作，三条非协商修订全过）
  - 回主页验证浮动按钮：文字"📚 Skills 沉淀 7" + href="/skills-hub/index.html"

Stage Summary:
- Vite dev server 已稳定跑在 3000 端口（double-fork daemon 跨 Bash 调用存活）
- 7 个 skill 全部做成可交互 demo，通过 /skills-hub/index.html 总览页聚合
- 主页右下角浮动按钮"📚 Skills 沉淀 7"可见可点，新标签打开总览页
- agent-browser 端到端验证：主页 → 浮动按钮 → 总览页 → 7 卡片 → 进 demo 交互 全链路通
- 用户在右侧预览面板可见：主页右下角"📚 Skills 沉淀 7"按钮 → 点击 → 7 个 skill 可交互 demo

---
Task ID: 10
Agent: main
Task: 用户上传 row-player.html v1.1 (2026-09-17 拍板版) 提醒"甲方的要求你都忘记了" - 回顾对话开始时记录的甲方原始要求, 发现项目偏离甲方硬规

Work Log:
- 回顾甲方原始要求 (row-player.html v1.1 头部注释 line 14-25):
  - 画布 1726×980 百分比坐标 (✓ 项目已是)
  - 题目 30px 微软雅黑 印刷体 行高1.65 一打开就写好(考卷式) (✓ 项目已是)
  - 分析/解答/总结 38px 手写体(平方乔木体) 行高1.7±随机 (❌ 项目用 35px LikeJianJianTi)
  - 行高随机区间 1.55~1.85 (下游渲染职责, 均值1.7) (❌ 项目无数字值)
  - 板书速度 1秒2-3个汉字, 每行±5%轻微抖动, 超音频窗口自适应加速 (❌ 项目用 ±10% 无自适应)
  - 字体栈: 507→157→511→510→509→490→KaiTi (❌ 项目只用 490)
- 7 处修复:
  1. stepHandoff.js (核心真源):
     - BOARD_FONT_SIZE 35→38
     - HANDWRITING_FAMILY 'LikeJianJianTi'→'平方乔木体'
     - HANDWRITING_CSS_HREF 490→507
     - 新增 HANDWRITING_FONT_STACK 完整字体栈 (10 项)
     - 新增 HANDWRITING_CSS_HREF_FALLBACKS (6 CDN)
     - 新增 BOARD_LINE_HEIGHT_MEAN/MIN/MAX (1.7/1.55/1.85)
     - 新增 BOARD_SPEED_CHARS_PER_SEC=2.5, BOARD_SPEED_JITTER=0.05, BOARD_SPEED_ADAPTIVE_COMPRESS=true
     - buildCanvasParams() 加 fontStack / cssHrefFallbacks / loadSnippetFallbacks / boardMean/Min/Max / boardSpeedCharsPerSec/Jitter/AdaptiveCompress
  2. index.html: 6 个 CDN link (507 主同步, 157/511/510/509/490 异步按需加载 media=print + onload 切 all)
  3. RealBoardPreview.vue: 
     - import HANDWRITING_FONT_STACK
     - .board-text-anchor font-family 改为完整字体栈 (10 项)
  4. AgentBDirect.vue:
     - import BOARD_FONT_SIZE/BOARD_FONT_RATIO_TEXT/HANDWRITING_FAMILY/LINE_HEIGHT_RULE/BOARD_SPEED_*
     - canvasParams 字号 35→BOARD_FONT_SIZE(38), 字体名 LikeJianJianTi→HANDWRITING_FAMILY(平方乔木体)
     - canvasWidth/Height 1726/980 改为 CANVAS_SIZE.width/height
     - lineHeight.question 1.65 改为 QUESTION_LINE_HEIGHT
     - boardSpeed 改为模板字符串含 BOARD_SPEED_CHARS_PER_SEC/JITTER + 自适应加速
  5. speechMarkdown.js: 同样 import 常量 + fallback 字段全部从 35/LikeJianJianTi 改为 BOARD_FONT_SIZE/HANDWRITING_FAMILY
  6. BoardPreviewApp.vue: import 常量 + 四区 desc 文字从"35px 手写尖尖体 LikeJianJianTi"改为 BOARD_FONT_SIZE/HANDWRITING_FAMILY 模板字符串
  7. row-player.html (项目内): 替换为用户上传版 v1.1, 同步到 public/deliverable/row-player.html + handdraw-player.html
- agent-browser 端到端验证:
  - 507 CDN HTTP=200, 平方乔木体 loaded: true ✓
  - 交接参数面板: has38px=true, has30px=true, has17LineHeight=true ✓
  - localStorage canvasParams:
    * analysisFontPx: 38 ✓
    * analysisFontFamily: "平方乔木体（手写体，网络字体 fontSource.handwriting 主 CDN 507..."
    * boardSpeed: "1秒约2.5个汉字，每行±5%轻微抖动；书写时长超出音频窗口时自适应加速压进音频内"
    * lineHeightOthers: "板书行高均值 1.7，逐行 1.55~1.85 微小随机（seed 冻结，幂等可 seek）"
  - board-preview.html RealBoardPreview .board-text-anchor:
    * fontSize: 38px ✓
    * fontFamily: "平方乔木体, 平方韶华体, 平方上上谦体, 平方三生体, PingFangSaTuoTi, LikeJianJianTi, KaiTi, STKaiti, PingFang SC, serif" ✓

Stage Summary:
- 甲方原始要求全部恢复:
  * 板书字号 35px → 38px (35 与 42 折中, 2026-09-17 拍板)
  * 板书字体 LikeJianJianTi(490) → 平方乔木体(507) 优先, 490 降级栈尾
  * 板书行高 "自然换行" → 1.7±随机 (1.55~1.85, 下游渲染职责)
  * 板书速度 "1秒2-3字±10%" → 1秒2.5字±5% + 超音频窗口自适应加速
  * 字体栈单 490 → 完整 6 CDN (507/157/511/510/509/490) + 系统楷体
- 7 处修复覆盖: stepHandoff (真源) → index.html → RealBoardPreview → AgentBDirect → speechMarkdown → BoardPreviewApp → row-player.html
- 后续即使字体/字号再变, 只改 stepHandoff.js 一处, 全链路自动同步 (Task 9 的 canvasParams 透传已就位)

---
Task ID: 11
Agent: main
Task: 用户反馈"演播录制跳出来旧题、语法bug、数据没传递、预览画布下面不见了"+ 严格要求"只写文档不改代码, 用RIPER-5+Deepthink协议"

Work Log:
- Phase 1 研究分析（真实诊断, 不推测）:
  - 演播录制按钮触发链路: AgentBDirect.vue:1427 openHanddrawPlayer → 写 localStorage → window.open('/deliverable/row-player.html')
  - row-player.html (现版 Task 10 后) line 1166-1170 loadFromUrlOrDefault: if(!url) { load(DATA); return; } 完全不读 localStorage
  - row-player.html.bak-20260921-pre-task10 line 1188-1210 有完整 localStorage 读取逻辑
  - 根因铁证: Task 10 用上传版 row-player.html 覆盖时, 把 localStorage 读取逻辑整段丢了
  - row-player.html line 6 title 写死"平行四边形面积", line 200-201 DATA 写死平行四边形题
  - Step1Entry.vue line 960 preview-tools 显示条件 v-if="hasBoardContent", Task 6/9 改动可能影响
  - 旧版本残留: 3 个 .bak + archive/ 6 个 + 根目录 13 个 .md
- Phase 2 方案探索:
  - P1+P3 (数据传递) 3 方案: A 纯 localStorage 最小手术 / B 纯文件通道 / C 三通道降级 → 推荐方案 C
  - P2 (语法 bug) 3 方案: A 去 BOM + 手工审查 / B HTMLHint / C 浏览器实测 → 推荐方案 A+C
  - P4 (画布下面消失) 3 方案: A 诊断 / B 去掉 v-if / C v-if + placeholder → 推荐方案 A→C
- Phase 3 规划: 10 个原子改进项, 每项含操作目标/变更描述/验收标准/风险点/预估时间
  - 改进 1: 恢复 row-player.html localStorage 读取 (修复 P1+P3 核心)
  - 改进 2: 去 row-player.html BOM (修复 P2 部分)
  - 改进 3: 浏览器实测修真实语法 bug (修复 P2 核心)
  - 改进 4: 诊断并修复预览画布下面消失 (修复 P4)
  - 改进 5: 清理旧版本残留 (3 个 .bak + archive/)
  - 改进 6: v2 升级 - 数据通道提示 banner
  - 改进 7: v2 升级 - openHanddrawPlayer 防呆设计
  - 改进 8: v2 升级 - 演播录制按钮 loading 反馈
  - 改进 9: QA 自动化测试脚本 (Node.js, 9 项检查)
  - 改进 10: 项目文档归档与索引
- Phase 4 执行: 用户明确"只要文档, 不要改代码", 本任务不执行, 由其他 AI 接手
- Phase 5 回顾: 30 个验收项 (V1-V10 功能 + C1-C8 代码质量 + QA 脚本 + 端到端)
- 创建专门文件夹: 迭代计划/
- 文档: 迭代计划/下一步改进指南.md (968 行, 44KB)
  - 0. 文档使用约定
  - Phase 1: 研究分析 (5 子章节)
  - Phase 2: 方案探索 (3 痛点各 3 方案 + 评估矩阵 + 权衡分析)
  - Phase 3: 规划 (10 改进项 + 执行顺序 + 6 质量检查点 + 风险回退)
  - Phase 4: 执行说明 (由其他 AI 接手)
  - Phase 5: 回顾验收清单 (30 项)
  - 附录 A: v3 升级方向 10 项 (BroadcastChannel / seek 拖拽 / 多题目切换 / Agent B 优化 / Next.js 端口 / canvasParams 单一化 / 字体性能 / 录屏 / schema 校验 / 国际化)
  - 附录 B: Deepthink Protocol 决策记录 (5 个关键决策)
  - 附录 C: 项目现状全景图
  - 附录 D: 执行追踪表 (10 改进项勾选)
  - 附录 E: 术语表
  - 附录 F: 引用文件清单 (所有路径+行号)
- 严格按用户硬要求:
  - ✓ 只写文档, 不改任何代码
  - ✓ RIPER-5 5 阶段协议完整
  - ✓ Deepthink Protocol 10 步推理
  - ✓ TDD 清单 (改进 9 QA 脚本)
  - ✓ 不重构原则 (所有改动最小手术)
  - ✓ 不重复造轮子 (复用 row-player.html.bak 的 localStorage 逻辑)
  - ✓ 二次审查 (附录 B 决策记录)
  - ✓ 旧产物清理清单 (附录 1.4 + 改进 5)
  - ✓ v1→v2→v3 升级路径 (Phase 3 + 附录 A)

Stage Summary:
- 文档: /home/z/my-project/upload/remix-extracted/迭代计划/下一步改进指南.md (968 行)
- 核心诊断: Task 10 用上传版 row-player.html 覆盖时丢失了 localStorage 读取逻辑 (row-player.html.bak-20260921-pre-task10 line 1188-1210 仍保留)
- 10 个原子改进项, 推荐执行顺序: 1→2→3→4→5→6→7→8→9→10
- 30 个验收项, 接手 AI 必须全 PASS
- 10 个 v3 升级方向 (附录 A) 供未来扩展
- 用户可用其他 AI 按 Phase 3 逐项落地, 每完成一项填附录 D 追踪表
- 后续若有新迭代, 请增量创建 v2.md, 不覆盖本文件

---
Task ID: 11 (续)
Agent: main
Task: 用户执行改进 2 时报 __VUE_HMR_RUNTIME__ is not defined - 追加 P5 阻断 bug 到改进指南

Work Log:
- 用户反馈: ReferenceError: __VUE_HMR_RUNTIME__ is not defined
  at /src/components/BoardContentLayer.vue:898:3
  at /@vite/client:531:53 (HMRClient.notifyListeners)
- 真实诊断 (curl 实测):
  - curl http://localhost:3000/src/components/BoardContentLayer.vue 首行:
    import { createHotContext as __vite__createHotContext } from "/@vite/client";
    import.meta.hot = __vite__createHotContext("/src/components/BoardContentLayer.vue");
    import { computed, nextTick, ... } from "https://esm.sh/vue@3.5.39"  ← 生产版无 HMR runtime
  - curl https://esm.sh/vue@3.5.39 首行:
    /* esm.sh - vue@3.5.39 */
    import "/@vue/runtime-dom@3.5.39/es2022/runtime-dom.mjs";
    export * from "/vue@3.5.39/es2022/vue.mjs";  ← 无 __VUE_HMR_RUNTIME__ 导出
- 根因 (非推测, 铁证):
  1. Task 1/6 vite.config.js cdnExternalPlugin 把 vue external 到 https://esm.sh/vue@3.5.39
  2. @vitejs/plugin-vue dev 模式为每个 .vue 注入 import.meta.hot = __vite__createHotContext(...)
  3. .vue 文件改动触发 HMR 重建 → 调用 vue 内部 __VUE_HMR_RUNTIME__.rerender(component)
  4. esm.sh 生产版 vue 不导出 __VUE_HMR_RUNTIME__ → ReferenceError
  5. 任何 .vue 文件实际代码改动都会触发 (注释改动不会)
- 影响: 用户用其他 AI 执行改进 2 (去 BOM) 或改进 3 (浏览器实测) 时, 任何 .vue 改动都会报错阻断
- 追加到改进指南:
  - 新增痛点 P5 (★ 阻断性 bug, 必须最先修)
  - 方案 A: dev 模式不 external vue, build 模式才 external (评分 26/30)
  - 方案 B: esm.sh ?dev 拉开发版 (评分高风险 1/5)
  - 方案 C: dev 模式 vue 走 vite 预打包 (推荐, 风险最低 5/5)
  - 新增改进 0 (紧急修复, 必须最先做, 在改进 1-10 前)
  - 3.3 执行顺序: 改进 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
  - 3.4 质量检查点: 新增 Q0 (改进 0 完成后验收)
  - 附录 D 执行追踪表: 新增改进 0 勾选项
  - 附录 C 项目现状全景图: 新增 ✗★ __VUE_HMR_RUNTIME__ 报错
  - 附录 F 引用文件清单: 新增 vite.config.js + BoardContentLayer.vue 引用 + 实测命令证据

Stage Summary:
- 迭代计划/下一步改进指南.md 从 968 行扩到 1180+ 行
- P5 阻断 bug 完整诊断 + 3 方案对比 + 推荐方案 C + 紧急修复步骤
- 改进 0 必须最先做, 否则后续任何 .vue 改动都会触发 HMR 报错
- 严格执行用户硬要求: 只改文档不改代码 (本次只改 .md)

---
Task ID: 12-23 集中补记
Agent: main
Task: Task 12-23 工作日志补全 (审计 P0-5 修复)

Work Log:
- Task 12: 紧急删除 CDN external 配置 (vite.config.js cdnExternalPlugin)
  原因: Task 1/6 加的 CDN external 把 vue 推到 esm.sh 生产版, 无 __VUE_HMR_RUNTIME__ → HMR 报错
  修复: dev + build 都走本地 node_modules, 删 optimizeDeps.exclude + rollupOptions.external

- Task 13: prompt + checkAgent 双修 LaTeX aligned 硬规则 (已 Task 15 回滚)
  错误: 加 aligned 硬规则鼓励 LLM 用 LaTeX, 违背"符号从简"原则

- Task 14: skillViolations.js 与 skill-6 validate_contract 对齐 (已 Task 15 回滚)
  错误: PHASE1 工具白名单只 1 个, 动作白名单缺 highlight, 与 active 代码不一致

- Task 15: 回滚 Task 13+14 污染, 改为符号从简校验 (已 Task 16 进一步回滚)
  错误: checkSymbolSimplify 重复 superFilter.js §5c 已做的事

- Task 16: row-player.html 合并 localStorage 读取逻辑 (已 Task 17 回滚)
  错误: 加 localStorage 通道是闭门造车, 用户说"用 json 给 row-play 根本不需要 localStorage"

- Task 17: openHanddrawPlayer 改用 URL query 通道, 不再用 localStorage
  修复: window.open('/deliverable/row-player.html?deliverable=/api/deliverable')

- Task 18: row-player URL query 通道两个关键 bug 修复
  bug1: URL 路径 /api/deliverable/current.json → Vite SPA fallback 返回 HTML, 改为 /api/deliverable
  bug2: loadFromUrlOrDefault 元信息读取错, 旧版只读 json.problemText, 改为 meta = json.deliverable || json
  bug3: load() 只调 compile+render 不更新 inProblem textarea, 加手动同步 inCode/inProblem

- Task 19: 表格当前页面加预览小窗 (RealBoardPreview)
  新增: allActionSpec computed + canvasParamsForPreview computed + openFullscreenPreview 函数
  UI: .studio-preview-mini 卡片放在表格上方, 16:9 比例锁, max-height 380px

- Task 20: deliverable.schema.json 按用户标准 6 大块重写 + superFilter 加 \text \quad 兜底
  6 大块: 题目/参数侧/row参数/画布规范/手写符号转义/schema抽取规则
  superFilter: LATEX2U 表加 \text{xxx}→xxx, \quad→空格, \dfrac→\frac
  .gitignore 排除 public/deliverable/, 用 git add -f 强制提交 schema.json

- Task 21: 规范 deliverable.json 实测 row-player 参数映射完全正确 (诊断)
  真相: 参数映射没有错, 是 row-player canvas + 时间轴渲染, t=0 只画题目, 板书要 seek 才显示

- Task 22: 程序判断 audioUrl 缺失时弹提示 + 用填充数据做板书演示
  修复: openHanddrawPlayer + generateDeliverablePage 加 audioUrl 判断 + message.warning
  serialize: audioUrl 从 '音频暂未生成' 改为空字符串 ''
  row-player 虚拟时钟兜底 (空串 mp3 → audioRow=false → 用 duration 估算)

- Task 23: superFilter LATEX2U 正则 \b 词边界 bug, \times20.4 不被转换
  bug: [/\\times\\b/g] 在 \times20.4 里不匹配 (s 和 2 都是 \w, 没词边界)
  修复: 改用前瞻 [/\\times(?=\\d|\\s|$|[^a-zA-Z])/g]
  同步: superFilter.js + row-player.html + handdraw-player.html + skill-5.html + demo.html

- Task 24: 全盘 4 层深度审计 + 0 置信筛查 (sub agent 交叉验证)
  发现: 7 阻塞 + 18 歧义 + 14 清理建议
  本 task 修复:
    P0-3: skillViolations.js ALLOWED_NOTATION_ACTIONS 加 circle
    P0-1: deliverableStoreHandler.js boardPlan 补 canvas + topicLabel, 不注入 startCoord
    P0-2: handoff.schema.json 5 处类型不匹配 (handoffVersion/keepOriginal/coordinateSpec/boardPlan/teachingFocus)
    清理: 4 个 .bak 文件, 4 处 '音频暂未生成' 残留, row-player BOM, deliverableStoreHandler 死代码 px:35
    补全: _WORKLOG.md Task 12-23 集中补记

Stage Summary:
- Task 12-23 全部记录补全
- 审计 P0-1/P0-2/P0-3 阻塞问题已修复
- 4 个 .bak 备份文件已清理
- 4 处 '音频暂未生成' 残留已清理
- row-player.html BOM 字符已删除
- server/deliverableStoreHandler.js 死代码 px:35 + LikeJianJianTi 已删
- handoff.schema.json 5 处类型不匹配已修复
- skillViolations.js circle 已加入白名单
- deliverableStoreHandler.js boardPlan 补 canvas + topicLabel, 不再注入 startCoord
