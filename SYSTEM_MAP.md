# 系统全景设计规划图

> 五阶段接管 · 阶段一产出 · 2026-09-19
> 节点带关键词 · 用图替代上下文

## 一、双项目并存格局

```
┌───────────────────────────────────────────────────────────────────┐
│  沙箱 /home/z/my-project/                                          │
│                                                                   │
│  ┌─────────────────────────────┐   ┌──────────────────────────┐  │
│  │ Next.js 16 项目（沙箱默认）   │   │ Vue+Vite 项目             │  │
│  │ /home/z/my-project/          │   │ /upload/remix-extracted/  │  │
│  │ 端口 3000 (pid 1124)         │   │ 端口 3000 (被顶掉)         │  │
│  │ 5 个 skill 沉淀 + worklog     │   │ 7 个 skill 沉淀 + demos    │  │
│  │ 未见业务用途                  │   │ 小学数学讲题视频工作台      │  │
│  └─────────────────────────────┘   └──────────────────────────┘  │
│                              ↓                                    │
│                  gateway :81 → Caddyfile                          │
│                  默认路由 → 3000                                  │
└───────────────────────────────────────────────────────────────────┘
```

## 二、Vue 项目主链（核心业务流）

```
                    handoff JSON (唯一真相源)
                          │
                          ↓
        ┌─────────────────────────────────────────┐
        │  Step1 贴题/识别 (src/components/Step1Entry.vue) │
        │   - 文本/图片输入 → POST /api/recognition      │
        │   - server/recognitionHandler.js → 上游 LLM    │
        │   - 落坐 boardPlan + screenshotUrl              │
        └─────────────────────────────────────────┘
                          │ 用户点"确定进入生成表"
                          ↓
        ┌─────────────────────────────────────────┐
        │  AgentBDirect (src/agent-b-v2/AgentBDirect.vue) │
        │   - 读 handoff → POST /api/agent-b-v2/generate │
        │   - server/agentBV2Handler.js → 上游 LLM        │
        │   - contract.js 解析五字段 rows                  │
        │   - timing.js 算 Row 时间线                      │
        └─────────────────────────────────────────┘
                          │
                          ↓
        ┌─────────────────────────────────────────┐
        │  画布渲染 (src/board-tools/* + components) │
        │   - handActionScheduler 互斥队列              │
        │   - roughNotationTool 圈划                    │
        │   - roughDrawingTool 画线/箭头                │
        │   - BoardContentLayer 落 canvas               │
        └─────────────────────────────────────────┘
                          │ 可选
                          ↓
        ┌─────────────────────────────────────────┐
        │  Check Agent (src/check-agent/*)            │
        │   - POST /api/check-agent/check              │
        │   - server/checkAgentHandler.js              │
        │   - 润色 → POST /api/check-agent/apply        │
        └─────────────────────────────────────────┘
```

## 三、7 个 skill 沉淀分布

```
skills/  (= upload/remix-extracted/skills/)
├── 【上游产出端 5 个 - 已蒸馏 SKILL.md + examples/demo】
│   ├── 1 board-zone-layout         四区坐标 1726×980
│   ├── 2 handwriting-font-policy   5 字体 + L3 锁定
│   ├── 3 hand-action-control       3 工具白名单 + 互斥
│   ├── 4 speech-board-timing       160cpm + 400ms/字
│   └── 5 field-char-escape-filter  superFilter 10 步
│
├── 【下游渲染端 + 浏览器侧 2 个 - 已合并】
│   ├── 6 board-lecture-player      真实音频时钟 + occupancy map
│   │   + scripts/validate_contract.cjs (可跑 PASS)
│   └── 7 blingbling小眼睛          DOM-first 观察
│       + scripts/observe-page.mjs (可跑)
│
└── 【可交互 demo 已就绪】
    public/skills-hub/
    ├── index.html (总览 7 卡片)
    └── skill-1.html ~ skill-7.html (各 skill 交互 demo)

    主页入口: index.html 注入浮动按钮 #skills-fab
    → href="/skills-hub/index.html" target="_blank"
```

## 四、关键约束（六维文档提炼）

```
真相源: handoff JSON (Agent A 产出, 唯一)
模型定位: Agent B = 参数换算器, 不是答案生成器
时间: B 不输出时间字段, 下游动态算 (DECISIONS.md 2026-08-21)
坐标: coordinateMode 决定 percentage/pixel
API: A/B/C 三 agent 配置独立, 互不影响
教学资产: prompt.js / speech-board-guide.md 禁随意删减
稳定边界: A/B 主链不重构不搬动不替换
```

## 五、已知问题（KNOWN_ISSUES.md 提炼）

```
🔴 P0 未修复:
  - P0-2 B 输出解析过严, 格式偏差整表 422
  - P0-3 修缮 API 一调就写文件, 前端以为点应用才写

🟡 P2 未处理:
  - P2-1 canvasParams 24 字段只用 1 个 (4%)
  - P2-2 fontSize 12 子字段只用 1 个
  - P2-3 lineHeight.others 是字符串不是数字
  - P2-4 导出 Markdown 含元数据, TTS 会读出来
  - P2-5 自检脚本仍断言旧导出格式

✅ 已修复 10 项 (canvasParams 循环引用 / eslint / handoff 写失败 / ...)
```

## 六、规模与复用资源

```
代码规模: src/ 14883 行 (JS + Vue)
文档规模: 12 份 .md (AGENTS/ARCHITECTURE/PROJECT_STATE/DECISIONS/...)
Skills: 7 个 (5 上游 + 2 下游)
Demo: 7 个可交互 HTML (skills-hub/)
脚本: validate_contract.cjs / observe-page.mjs / proxySelfCheck.js / agentAKnowledgeSelfCheck.js
依赖: vue@3.5.39 / ant-design-vue@4.2.6 / katex / rough-notation / roughjs
CDN: esm.sh external (vite.config.js cdnExternalPlugin)
```
