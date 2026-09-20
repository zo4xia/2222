# 教学板书 · 小学数学讲题视频生成工作台

> 基于 LLM 的小学数学题识别 → 分步口播 + 板书动作生成 → 音画微课演播 → 交付物导出的全链工作台。

## 项目介绍

### 这是什么
一个将小学数学题从"文字/图片输入"到"AI 讲题视频生成"的完整工作台：
1. **Step1 贴题识别** — Agent A 用多模态 LLM 识别题目、落坐四区画布、匹配知识点
2. **Step2 五字段生成** — Agent B 根据题型/年级/知识配比生成分步口播稿 + 板书内容 + 动作指令
3. **Step3 校验润色** — Check Agent C 对口播和板书做语义/节奏/发音润色
4. **Step4 演播录制** — row-player 单文件播放器渲染音画微课、录制导出
5. **Step5 导出交付** — 口播稿 MD / 画布分镜总表 / 下游 API 参数 / 完整规格 JSON

### 完整功能
- 📝 题目识别（文本/图片/混合）+ 自动落坐 1726×980 四区画布
- 🎙️ 分步口播稿生成（160 cpm 语速 + 标点停顿 + 发音硬规范）
- 🎨 板书内容生成（达芬奇手稿毛料感 + superFilter 10 步过滤 + LaTeX 渲染）
- ⚡ 动作指令生成（rough-notation 圈划 + 单手串行 + 1-2s 标点停顿）
- 🎬 演播单页播放器（真实音频驱动 + 手写体渲染 + 录制导出）
- 📤 多格式导出（口播稿 MD / 分镜总表 / JSON / 下游 API 规范）
- 🛡️ 7 个 skill 沉淀（5 上游约束 + 2 下游落地，含可交互 demo）

## 技术栈

| 层 | 技术 |
|---|---|
| 前端框架 | Vue 3.5.39 (Composition API + `<script setup>`) |
| 构建工具 | Vite 8.3.0 (dev server + production build) |
| UI 组件库 | Ant Design Vue 4.2.6 |
| 图标库 | @ant-design/icons-vue 7.0.1 |
| 数学渲染 | KaTeX 0.18.4 |
| 手绘动画 | rough-notation 0.5.1 + roughjs 4.6.6 |
| 手写字体 | ZeoSeven FontsAPI (平方乔木体 / 栗壳坚坚体 / 平方韶华等 5 种) |
| 后端代理 | Vite server middleware (9 个 API handler) |
| 生产部署 | Node.js productionServer (独立 HTTP) / Vercel serverless (5 个 api/ thin wrapper) |
| 测试 | Node.js assert/strict (4 套测试 + 1 套冒烟) |

## 架构模式

```
用户输入题目/图片
    ↓
Step1Entry (Agent A)
  → POST /api/recognition/problem → 上游 LLM 识别
  → 落坐 boardPlan + 四区坐标 + screenshotUrl
  → POST /api/handoff → 写 handoff-*.json + current.json
    ↓
AgentBDirect (Agent B)
  → GET /api/handoff → 读 handoff JSON (唯一真相源)
  → POST /api/agent-b-v2/generate → 上游 LLM 生成五字段
  → contract.js 解析归一 (normalizeBoard / parseLLMJson / 弃用字段检测)
  → timing.js 计算 1D 单手串行时间线 (160cpm + 标点停顿 + 动作量化)
  → superFilter 10 步过滤 (LaTeX→Unicode / 缺字降级 / 除号→\frac)
  → B 页画布预览 RealBoardPreview (板书文字 + 动作 SVG)
    ↓
Check Agent C (可选)
  → POST /api/check-agent/check → 上游 LLM 润色
  → auditRowsBySkills 5 技能红线校验 (不阻断, 进 changes 报告)
  → POST /api/check-agent/apply → 写回 handoff
    ↓
演播录制
  → openHanddrawPlayer → /row-player.html?deliverable=Blob URL
  → row-player normData/normRow 消费 deliverable JSON
  → Canvas 1726×980 渲染 + 手写体 + 音画同步 + 录制
    ↓
导出交付
  → 口播稿 MD / 画布分镜总表 MD / 完整规格 JSON / 下游 API 规范
  → POST /api/deliverable → renderDeliverableHtml (注入 __INITIAL_DELIVERABLE__)
```

## 快速开始

### 环境要求
- Node.js 18+ (推荐 24)
- bun 或 npm

### 一键启动
```bash
# 安装依赖
npm install

# 开发模式 (Vite dev server, 端口 3000)
npm run dev

# 生产模式 (独立 Node HTTP 服务器)
npm run start

# 构建
npm run build
```

### 配置 Agent API
1. 进入 Step1 页面
2. 点击「Agent 配置」按钮
3. 填写上游 LLM 的 API Key / Endpoint / Model
4. Agent A / B / C 三个 agent 配置完全独立

### 生成讲题视频
1. 在 Step1 输入题目文本或上传图片
2. 点击「识别并贴上画布」
3. 点击「确定进入生成表」进入 Step2
4. 点击「生成五字段」
5. （可选）点击「ASR 优化」+「Check Agent」
6. 点击「演播录制」打开播放器
7. 点击「导出」选择需要的格式

## 部署指南

### 本地部署
```bash
npm install
npm run dev    # 开发: http://localhost:3000
npm run build  # 构建: dist/
npm run start  # 生产: node server/productionServer.js
```

### Vercel 部署
项目已含 `vercel.json`，5 个 serverless 函数在 `api/` 目录。直接连接 GitHub 仓库部署即可。

### 容器化部署
```dockerfile
FROM node:24-slim
WORKDIR /app
COPY package.json bun.lock ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "server/productionServer.js"]
```

## 测试

```bash
# 全部测试
node scripts/run-all-tests.mjs

# 单独跑
node scripts/test-parseLLMJson.mjs        # 16 用例
node scripts/test-timing-fix.mjs            # 5 用例
node scripts/test-timing-computeRowGroup.mjs  # 7 用例 + 6 不变量
node scripts/smoke-test-skills.mjs          # 11 用例
node skills/board-lecture-player/scripts/validate_contract.cjs assets/sample-rows.json
```

## 项目结构

```
├── src/
│   ├── agent-b-v2/          Agent B 核心 (prompt/contract/timing/service/composables)
│   ├── board-tools/         板书工具 (rough-notation/drawing/scheduler/stableHash)
│   ├── check-agent/         Check Agent C (contract/skillViolations/asrPolish)
│   ├── components/          Vue 组件 (Step1Entry/BoardContentLayer/RealBoardPreview等)
│   ├── lib/                 公共库 (parseLLMJson/agentBApiConfig/dualStore等)
│   ├── services/            业务服务 (stepHandoff/recognitionClient/agentAKnowledge)
│   └── utils/               工具 (superFilter/boardLayout/canvasCoords/mathText)
├── server/                   Vite server middleware (9 个 API handler)
├── api/                      Vercel serverless (5 个 thin wrapper)
├── public/
│   ├── skills-hub/           7 个 skill 可交互 demo + integration-guide
│   ├── canvas.png            画布底图 1726×980
│   └── fonts/                本地字体
├── skills/                   7 个 skill 沉淀 (SKILL.md + meta.json)
├── truth/                    真相基线 (00-TRUTH-BASE + 5 领地分章)
├── doc/                      教学文档 + 知识库
├── scripts/                  测试脚本
├── row-player.html           单文件播放器 (133KB, 含 superFilter)
├── PONYTAIL_DEBT.md          技术债追踪
├── SYSTEM_MAP.md             系统全景图
├── CONSTRUCTION_LOG.md       施工进展图
└── DIAGNOSIS_REPORT.md       问题摸底报告
```

## 核心约束 (truth/)

| 领地 | 约束 |
|---|---|
| A (Agent B) | board 只输出 {content, startDelay}，不输出 startCoord |
| B (Contract) | parseLLMJson 唯一真源，6 处合并为 1 |
| C (Actions) | underline + circle 两个核心兜底，锚定 exactText |
| E (Render) | 微抖动/微倾斜是渲染层职责，B 不算 |

## 常见问题

### 画布预览里板书显示 LaTeX 源代码
板书文字在渲染前会过 superFilter 10 步清洗（`\frac` → 上下分数、`×` → `x`、`$` 删除等）。如果看到 LaTeX 源码，检查 `superFilter.js` 是否正常 import。

### 演播按钮打开的是空白页
检查 URL 是否指向 `/row-player.html`（根目录），不是 `/deliverable/row-player.html`（不存在）。数据通过 Blob URL 的 `?deliverable=` 参数传递。

### 动作（圈划）不显示
检查 `BOARD_MARK_COLORS` / `ROUGH_DRAWING_COLORS` 是否正确 import（Task 12 修复过误删问题）。

### duration 值异常（时长膨胀 1000 倍）
serialize 的 `duration` 统一为秒（不是毫秒），row-player 合同也是秒。

## 许可证
私有项目，版权所有。
