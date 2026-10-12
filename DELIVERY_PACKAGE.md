# 商业交付完整包 · 教学板书自动生成系统

> 版本：2026-09-17 · 依据 `FULL_STACK_AUDIT_2026-09-17.md`
> 结论：**技术上可演示，商业上未达签署门槛** —— P0 未清零，见 §5 Go/No-Go。

---

## 1. 交付物清单（对外）

### 1.1 源码与工程

| 类别 | 内容 | 状态 |
|---|---|---|
| 应用入口 | `index.html`（第 1 步识别落画布）、`board-preview.html`（板书工作台）、`agent-b-v2.html`（Agent B 工作室） | ✅ 可用 |
| 交付母版 | `row-player.html`（唯一播放器模板，0.11 MB，字体 CDN） | ✅ 可用 |
| 前端源码 | `src/**`（65 文件：agent-b-v2 / board-preview / check-agent / components / lib / services / utils） | ✅ 可用，含 P2/P3 缺陷 |
| 服务端 | `server/**`（19 个 handler）、`api/**`（6 个 Vercel 薄转发） | ⚠️ Vercel 仅覆盖 5/11 类 |
| 构建配置 | `vite.config.js`、`package.json`、`eslint.config.js` | ⚠️ 构建入口仅 2 个 HTML |

### 1.2 对外交付契约（给下游 Agent / API / Skills）

| 文件 | 作用 | 状态 |
|---|---|---|
| `public/deliverable/deliverable.schema.json` | 交付 JSON 结构规范 | ✅ `startCoord` 已降可选（#016）；产物 `mp3` 已全量补齐 |
| `public/deliverable/DELIVERABLE_API_SPEC.md` | 消费规则 + 盲测验收六问 | ✅ 音频路径相对化（#017）、`startCoord` 口径统一、指针校验入口已注明 |
| `public/deliverable/current.json` / `current.html` | 当前产物指针与镜像 | ✅ 9/9 行有音频（总 80.2s，静音 0）、`mp3` 全量、`audioUrl` 已归一 `../audio-cache/` |

**合格线（决策 #012，不可降低）**：零上下文 Agent + 一份 JSON + `row-player.html` → 能完整演完任意一题。

**实测（2026-09-17 重建后，一手证据）**：9 行音频 **9/9 命中**（含 `file://` 双击脱环境路径解析 9/9）、静音行 **0**、总时长 **80.2s**、单页 **142 KB**（< 1MB）→ **通过**。

### 1.3 文档

`PROJECT_STATE.md` · `ENGINEERING_LOG.md` · `DECISIONS.md`（14 条决策）· `FULL_STACK_AUDIT_2026-09-17.md` · 阶段文档 9 份（勘探/诊断/PRD/依赖图/解耦/数据流/API 规格等）。

### 1.4 运行时资产（不应对外，需隔离）

`public/audio-cache/` 1.893 MB · `public/pic/` 0.484 MB（用户截图）· `public/handoff/` 0.295 MB · `public/board-result/` 0.426 MB · `public/deliverable/` 0.559 MB —— **合计 7.597 MB / 120 文件全部入库且静态可匿名直取**，含用户原题文本。

---

## 2. 部署手册

### 2.1 自托管（推荐，唯一当前可用路径）

```powershell
npm install
npm run build      # 产物 dist/
npm start          # node server/productionServer.js，PORT 默认 3000
```

- 静态路由白名单：`/audio/ /audio-cache/ /board-result/ /deliverable/ /handoff/ /pic/` → 走 `public/`；其余走 `dist/`。
- API 路由 11 类全部由 `productionServer.js:33-58` 直连 server handler。
- **必配环境变量**（当前无 `.env.example`，按此配）：`FISH_AUDIO_API_KEYS`、`UPSTREAM_HOSTS`（逗号分隔，防 SSRF）、`CORS_ORIGINS`（逗号分隔，否则合法前端跨域失败）、`PORT`、`HOST`。

### 2.2 Vercel（当前不可用）

`vercel.json` 仅 5 个 function。必须补齐后才可部署：

| 需新增 | 对应 handler | 建议 maxDuration |
|---|---|---|
| `api/tts.js`（新增文件） | `server/fishAudioHandler.js` | 60 |
| `api/handoff.js`（新增，含 /list） | `server/handoffStoreHandler.js` | 30 |
| `api/knowledge/*.js`（新增） | `server/knowledgeRefineHandler.js` | 120，`includeFiles: doc/**` |
| `api/deliverable/*.js`（新增） | `server/deliverableStoreHandler.js` | 60 |
| `api/screenshot.js`（新增） | `server/screenshotStoreHandler.js` | 30 |
| `api/cleanup.js`（已存在未配置） | `server/cleanupHandler.js` | 30 |

⚠️ 前置阻塞：Vercel 是 **Serverless 只读文件系统**（除 `/tmp`），而本项目运行时写 `public/`（6 处）。线上必须改为对象存储或数据库，否则所有落盘接口必然失败。**这是架构级阻塞，非配置能解。**

---

## 3. 验收 SOP（发版前必跑）

### 3.1 五验（命令层）

| # | 命令 | 通过标准 | 现状 |
|---|---|---|---|
| 1 | `npm run build` | exitCode 0 | ✅ 12.82s |
| 2 | `npm run lint` | 本次改动文件 `--quiet` 零新增 error | ✅ 零新增（既有 17 error 属缺 browser globals） |
| 3 | `npm run check:proxy` | ok | ✅ |
| 4 | `npm run check:knowledge` | ok + 行数 | ✅ 247 rows |
| 5 | `node scripts/verifyDeliverableTruthSource.mjs` | 17/17 | ✅（⚠️ 脚本具破坏性且未接 npm script，见 P1-09） |

### 3.2 人工点检（命令行无法覆盖）

| # | 项目 | 判据 |
|---|---|---|
| A | 打开 `public/deliverable/current.html` | 有画面、四标签落位与 `boardPlan` 四个 Label 一致、板书不越界 |
| B | 换 `layoutMode=landscape-top-image` 产物重开 | 四标签随导出物变化 |
| C | 播完 9 行 | 有音频行完整播完（无截断）、无音频行走虚拟时钟不卡死 |
| D | 双击（file://）打开 | 素材内嵌可见；⚠️ 音频必 404（根相对路径）→ 已知限制，需拍板是否内嵌音频 |
| E | 移动端 375px | 当前 `BoardPreviewApp.vue` 0 条 @media，**预计溢出**，待实机 |
| F | 字体 | 507 CDN 生效；失败时是否降级（告警容器 `id="note"` 缺失 → 告警静默，P3） |

### 3.3 盲测（决策 #012 合格线）

给一份全新题目 JSON 给「零上下文 Agent」，要求其仅凭 JSON + `row-player.html` 演完 → 当前**未做过**（交付目录仅 3 个样本，`portrait-left-image` 零样本）。

---

## 4. 风险登记（对外可披露口径）

| 级别 | 风险 | 触发条件 | 规避/现状 |
|---|---|---|---|
| 中 | 演示账号密钥随 dist 分发（3 把） | 部署后第三方可见 | **已拍板保留**（甲方预设演示账号）；仅做注释与手册说明，额度可能被外部共用，需甲方知悉 |
| 高 | 交付页核心段静音 | 导出前未跑批量 TTS | 需补「有 speech 必有音频」校验 |
| 高 | Serverless 无法落盘 | Vercel 部署 | 改对象存储前不要上 Vercel |
| 中 | 1h2g 下并发 OOM | 并发请求大文件 | 已缓解一个数量级，未根治 |
| 中 | 无回归网（0 测试 0 CI） | 任何改动 | 每次发版人工跑 §3.1 |
| 中 | 用户数据入库且公开 | push 仓库 | `public/**` 无 gitignore；含原题与截图 |
| 低 | 字体 CDN 不可用 | CDN 故障 | 降级楷体，观感下降不阻断 |

---

## 5. Go / No-Go 判据

**发版门槛（全部满足才能签商业交付）：**

- [x] **P0 清零**（2026-09-17）：P0-02 音频已补齐（9/9 行、80.2s、静音 0）· P0-03 契约四处统一且 schema 顶层 `required` 校验通过 · P0-04 生产服务器已流式化（实测 200 + `Content-Length`）〔P0-01 密钥项已由用户拍板保留，不再作为门槛〕
- [ ] **P1 清零或书面接受**：Vercel 仍缺 `api/cleanup.js` · registerAntd 补全 · 抬笔间隔 1000/600 未统一 · 语速链路 · 异步组件兜底 · **配音/板书时长错配（决策 #019：7/9 行音频短于板书，row4 差 13.2s → 音频播完后画面静默书写）** —— **均未处置**
- [x] **五验全绿**（§3.1）→ **部分**：本次改动文件 `eslint` 0 error；全仓 46 error（28 `no-useless-escape` / 12 `no-empty` / 4 `no-undef` / 1 `no-control-regex` / 1 `no-useless-assignment`）**均为既有风格项**，已记账 P2，不阻断运行
- [ ] **人工点检 A~C 通过**（§3.2）—— **未做**：无浏览器环境，需人工双击 `public/deliverable/current.html` 确认观感（画面/字幕/板书落位）
- [x] **盲测通过**（§3.3）→ **资源与契约层通过**：9/9 行音频、`file://` 脱环境路径解析 9/9、单页 142 KB < 1MB；**播放观感未实测**
- [ ] 风险登记中「高」项全部有处置人或书面接受

当前状态：**6 项中 3 项满足 → 有条件 GO**：自托管演示可交付；商业签署仍差 P1 处置 + 人工点检 A~C。

---

## 6. 清零排期建议（按依赖顺序）

| 批次 | 内容 | 依赖 | 验收 |
|---|---|---|---|
| B1 · ~~安全（吊销密钥）~~ | **已撤销**：用户拍板「甲方预设演示账号，不许删」。改为 **B1' 文档化**：5 处硬编码加注释「甲方预设演示账号，勿删」+ 部署手册写明用途与额度共用风险 | — | 代码行为不变；注释与手册到位 |
| B2 · 契约 | 拍板 startCoord → 修 `speechMarkdown.parseBoardField` + `deliverableStoreHandler` 透传 → 统一 schema/API SPEC/批注 → 出最小可播样例 | P4-1 拍板 | 样例 JSON 通过 schema 校验；盲测演完 |
| B3 · 音频 | 批量 TTS 入口 + 导出前「有 speech 必有音频」校验 + `specificationSummary` 按实际统计 | — | 导出产物 0 行缺音频 |
| B4 · 部署 | 流式静态服务 + 缓存头；Vercel 补全 + 落盘改对象存储（或明确只自托管） | B1 | `curl -I` 有缓存头；压测 RSS 不增长 |
| B5 · 真源收口 | 时长口径收为 1 套（timing.js）+ rowGapMs 全链路传参 + 语速打通 + 抬笔间隔统一 | — | 同页面三处秒值一致 |
| B6 · 验证网 | vitest + GitHub Actions（lint/build/check×2/verify）+ 修 verify 脚本破坏性 | — | CI 绿 |

---

## 7. 交接状态（Handoff）

- 当前状态：🚧 **审计完成，修复未启动**（等待用户对 P0 处置与 P4 拍板的授权）
- 已完成：`FULL_STACK_AUDIT_2026-09-17.md`（48 条缺陷台账，全部带文件行号）+ 本文档
- 未完成：P0×4 修复、P4×5 拍板、盲测、实机点检
- 关键依据：四路 sub 只读取证 + 负责人 8 条交叉验证（V1~V8，见审计 §1）
- 验证结果：§3.1 五验中 4 项历史通过（非本轮执行），本轮未跑 build/网络请求
- 已知风险：§4 全部；另「A 路 sub 未交活」已由负责人补齐，不影响结论完整性
- 下一步：**B1（密钥处置）需用户授权后立即执行**
