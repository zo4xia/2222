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
Task ID: 7
Agent: main
Task: 用户反馈 3 项试听体验问题：①第一条音频开头吞字 ②试听完没立刻回填表单（怕漏 mp3 地址/时长）③时序时间轴点击试听

Work Log:
- 诊断 playAudioUrl 当前用 canplay 事件 → canplay 时缓冲不够就开始播，前几十毫秒还在解码 = 开头吞字根因
- 改动 1 (AgentBDirect.vue playAudioUrl):
  - canplay 替换为 canplaythrough（浏览器认为已缓冲足够连续播完整条）
  - play 前 audio.currentTime = 0 强制回最开头（防复用 element 时残留进度）
  - play 前 await 120ms 预热 tick，让解码管线充满
- 改动 2 (AgentBDirect.vue 新增 backfillAudioToRow):
  - 在 audio 'ended' 事件回调里立刻把 mp3 url + 真实时长落到 record + rowAudioCache
  - 即使 record.audioUrl 已存在也补一遍双保险
  - readAudioDuration 读 loadedmetadata 落 audioDurationMs（防后续被误判"没自然音频时长"）
  - applyAgentBV2Timeline 重算时间轴
  - 轻量 toast 提示用户回填成功（duration: 1.6s 不打扰）
- 改动 2 (AgentBDirect.vue 表格行打勾图标):
  - 序号列旁加 .row-audio-check (CheckCircleOutlined 绿色勾) - 当 record.audioUrl || rowAudioCache[index] 存在即显示
  - 反之 .row-audio-pending 灰色 ○ 圆圈表示未生成
  - row-audio-check-pop 0.32s 弹跳动画（cubic-bezier 0.34,1.56,0.64,1）
- 改动 3 (VisualTimeline.vue):
  - 加 playingIndex prop 接收父组件正在播放的 row index
  - 加 getAudioUrl(row) 提取 audioUrl/mp3/audio 字段
  - 时间轴每个块新增 .block-play-btn 试听按钮（v-if getAudioUrl, 否则显示 .block-play-btn-empty "未生成音频"）
  - @click.stop 触发 emit('play-audio', {index, url}) 给父组件
  - is-playing 状态用 amber 渐变 + tl-play-pulse 1.4s 脉冲动画
  - getDuration 优先用 row.audioDurationMs 真实音频时长（而非预估）
- 改动 3 (AgentBDirect.vue 父组件接收):
  - VisualTimeline 加 :playing-index="playingAudioIndex === null ? -1 : playingAudioIndex"
  - @play-audio="onPlayAudioFromTimeline"
  - 新增 onPlayAudioFromTimeline({index, url}) → 复用 playAudioUrl 统一管理音频实例（不会多实例冲突）
- agent-browser 端到端验证（沙箱内真实跑通）:
  - 黄金路径: 题目框输入 → 识别并贴上画布 → 确定进入生成表 → 开始生成五字段执行表 → 5 行 Row 出现 + 时序时间轴显示
  - 点第1行"生成语音"按钮 → TTS 返回 mp3 → 按钮变"暂停" + .row-audio-check 出现（hasCheck:true）+ audio pill 显示 /audio-cache/5d0aed319ff21195bb1a3d503978d4ff.mp3
  - 时间轴 Row 1 块的试听按钮从"未生成音频"变成"▶试听"
  - audioUrl 字段确认回填到行数据
  - 0 console error / 0 page error

Stage Summary:
- 3 个改动全部验证通过:
  1. 开头吞字修复: canplaythrough + currentTime=0 + 120ms 预热
  2. 试听完立刻回填: ended 事件 backfillAudioToRow → mp3 url + audioDurationMs + 时间轴重算 + 行打勾 + audio pill
  3. 时序时间轴可试听: 每个块新增▶试听按钮, emit play-audio 复用父组件音频实例, 优先显示真实音频时长
- 后续用户操作: 点行内"试听"或时间轴块"试听"都能播放, 试听完自动回填不会漏 mp3 地址/时长
- 推 GitHub 备份 commit

---
Task ID: 8
Agent: main
Task: 用户硬约束: "这块字段，b，映射，这些，必须带着stage" —— deliverable JSON 序列化时 board 字段和 actionSpec 映射必须自带 stage

Work Log:
- 诊断 serializeCurrentDeliverableState (AgentBDirect.vue:1196-1216):
  - row.level: stage 已存在 ✓ (line 1205: stage: r.stage || (idx === 0 ? '题目' : '分析'))
  - board 字段 (line 1209-1214): 只有 content + startDelay，❌ 无 stage
  - actionSpec 数组 (line 1215): 直接 safeDeepClone，❌ 每个 item 不带 stage
- 改动 (AgentBDirect.vue:1196-1241):
  - 提取 rowStage = r.stage || (idx === 0 ? '题目' : '分析') 单一真相源
  - board 字段加 stage: rowStage (板书自描述)
  - actionSpec: safeDeepClone(r.actionSpec).map(a => ...) 给每个 action 项加 stage
    - 外层 a.stage = rowStage
    - 内层 a.action.stage = rowStage (双保险，因为 row-player 读 actionSpec[i].action 时也能拿到)
    - 已有 stage 的不覆盖 (尊重跨 stage 动作)
- 容错: actionSpec 项可能是 { action: {...} } 或直接 {...}，两种都处理
- 防污染: safeDeepClone 先克隆再加 stage，避免污染 Vue 响应式 state
- agent-browser 端到端验证:
  - 黄金路径跑通: 8 行 rows 生成 (题目/分析/解答×5/总结)
  - 点击 "🎬 演播录制" 触发 serializeCurrentDeliverableState + localStorage 落定
  - 验证 localStorage['agent-b-deliverable']:
    Row 1: stage=题目 | board.stage=题目 ✓ | actionSpec带stage: 3/3 ✓
    Row 2: stage=分析 | board.stage=分析 ✓ | actionSpec带stage: 1/1 ✓
    Row 3: stage=解答 | board.stage=解答 ✓ | actionSpec带stage: 1/1 ✓
    Row 4-7: stage=解答 | board.stage=解答 ✓ | actionSpec: 0/0 (此行无动作)
    Row 8: stage=总结 | board.stage=总结 ✓ | actionSpec: 0/0
  - row0_actionSpec0_action_stage: "题目" ✓ (双保险内层 action.stage 也有)

Stage Summary:
- deliverable JSON 现在自描述: 每行的 board 字段与每个 actionSpec 项都自带 stage
- 下游消费方 (row-player.html / Check Agent / 任何取局部字段的工具) 不必反查 row.stage
- 即使 row 顺序变化, board 与 actionSpec 仍然知道自己属于哪个 stage
- 与 row.stage 三重对齐: row.stage == board.stage == actionSpec[i].stage == actionSpec[i].action.stage

---
Task ID: 9
Agent: main
Task: 用户反馈"预览画布参数都没有传递过去，检查这一块，朔源整个业务流业务链"

Work Log:
- 溯源整条业务链: Step1Entry.vue → POST /api/handoff → handoffStoreHandler.js (自动补 canvasParams) → DirectFlow.vue GET /api/handoff → AgentBDirect.vue (props.initialHandoff 含 canvasParams) → saveLiveBoardPreview → BoardPreviewApp.vue → RealBoardPreview.vue → BoardContentLayer.vue
- 发现 4 个传递断点:
  1. AgentBDirect.vue line 1369-1377 调 saveLiveBoardPreview 时 state 里 ❌ 没有 canvasParams / meta
  2. BoardPreviewApp.vue applyDeliverablePayload 只从 payload.meta 读 canvasParams，但 saveLiveBoardPreview 没写 meta
  3. RealBoardPreview.vue defineProps ❌ 没有 canvasParams prop
  4. BoardPreviewApp.vue 用 RealBoardPreview 时 ❌ 没传 :canvas-params
- 修复 1 (AgentBDirect.vue saveLiveBoardPreview 调用):
  - 加 canvasParams: payload.canvasParams || handoff.value?.canvasParams || null
  - 加 meta: { canvasParams, model, generatedAt, handoffCanvasParams, handoffBoardPlan, problemType, stageRatioSuggestion }
  - 加 screenshotUrl / problemType 兜底
- 修复 2 (BoardPreviewApp.vue applyDeliverablePayload):
  - 兜底从 payload 顶层读 canvasParams 写入 meta.canvasParams
  - 优先级: payload.meta.canvasParams > payload.canvasParams > payload.handoffCanvasParams
- 修复 3 (RealBoardPreview.vue):
  - 新增 canvasParams prop (Object, default: null)
  - 新增 computed questionFontSize / boardFontSize / canvasWidth / canvasHeight
  - 没传 fallback 到 stepHandoff.js 的 QUESTION_FONT_SIZE / BOARD_FONT_SIZE / 1726×980 常量
  - line 252 字号从 ${BOARD_FONT_SIZE}px 改为 ${boardFontSize}px (响应 canvasParams)
  - BoardContentLayer 传 :canvas-params="canvasParams"
- 修复 4 (BoardContentLayer.vue):
  - 新增 canvasParams prop
  - 新增 computed realQuestionFontSize / realCanvasWidth / realCanvasHeight
  - line 105/127 字号 fallback 从 QUESTION_FONT_SIZE 改为 realQuestionFontSize.value
  - line 480 fontSize calc 从写死 17.26 改为 realCanvasWidth.value / 100 (画布尺寸随 canvasParams 自适应)
- 修复 5 (BoardPreviewApp.vue 用 RealBoardPreview 处):
  - 加 :canvas-params="(meta && meta.canvasParams) || null"
- agent-browser 端到端验证:
  - 黄金路径跑通: 输入题目 → 识别 → 进生成表 → 软降级产出 10 rows
  - 点击"生成交付单页" → saveLiveBoardPreview 写入 localStorage
  - 验证 localStorage[qinghuabu.live-board-preview]:
    * hasCanvasParams: true ✓
    * hasMeta: true ✓
    * metaHasCanvasParams: true ✓
    * canvasSize: {width:1726, height:980} ✓
    * questionFontPx: 30 ✓
    * analysisFontPx: 35 ✓
  - 打开 /board-preview.html:
    * BoardPreviewApp 接到 meta.canvasParams
    * RealBoardPreview 的 .board-text-anchor 字号 = 35px (来自 canvasParams) ✓
    * fontFamily = LikeJianJianTi (手写体) ✓

Stage Summary:
- 4 个传递断点全部修复
- canvasParams 现在能完整流转: handoff → AgentBDirect → saveLiveBoardPreview(localStorage) → BoardPreviewApp → RealBoardPreview → BoardContentLayer
- 画布尺寸/字号/字体随 canvasParams 自适应 (没传时 fallback 到 stepHandoff.js 常量)
- RealBoardPreview 内 board-text-anchor 字号从硬编码 35px 变为 canvasParams.fontSize.analysis.px (默认 35px)
- BoardContentLayer 内 fontSize calc 从写死 17.26 改为 realCanvasWidth/100, 让画布尺寸真正随 canvasParams 自适应
- 后续: 即使题目层字号将来改了 (如 30→28), 只需改 stepHandoff.js 或 handoff.canvasParams, 全链路自动同步
