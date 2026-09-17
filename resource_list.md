# 可复用资源清单 (Reusable Resource List)

> 本清单严格依据 `reuse-first-guard` 与 `refactor-discovery` 原则建立，严禁重复手搓已有功能。

## 1. 公共 UI 与展示组件
| 组件路径 | 导出名 | 功能描述 | 复用场景 |
| :--- | :--- | :--- | :--- |
| `src/components/QhPageHeader.vue` | `QhPageHeader` | 清华附小标准顶部导航与品牌栏 | 全局页面顶部统一展示 |
| `src/components/BoardContentLayer.vue` | `BoardContentLayer` | 板书层四区渲染（题目区、分析区、解题区、总结区）与手绘执行 | 播放器、实时预览、导出画布 |
| `src/components/VisualTimeline.vue` | `VisualTimeline` | 交互式阶段时间轴（含分段色彩、播放指示、耗时计算） | 步骤时间轴展现、进度控制 |
| `src/components/ProcessLoadingModal.vue` | `ProcessLoadingModal` | 优雅步骤加载进度弹窗（带阶段描述与动效） | Agent A/B 生成时的全屏/模态加载 |
| `src/components/GlobalPulseLoading.vue` | `GlobalPulseLoading` | 悬浮呼吸脉冲加载提示组件 | 后台异步处理状态指示 |
| `src/components/RealBoardPreview.vue` | `RealBoardPreview` | 缩略/响应式真实板书视口预览 | 侧边栏预览、快速定位 |

## 2. 视觉与绘图工具库 (board-tools)
| 模块路径 | 导出名 | 功能描述 | 复用场景 |
| :--- | :--- | :--- | :--- |
| `src/board-tools/roughDrawingTool.js` | `RoughDrawingTool` | 基于 Rough.js 封装的手绘图形/箭头/下划线/方框渲染器 | 题目条件标注、几何图形绘制 |
| `src/board-tools/roughNotationTool.js` | `RoughNotationTool` | 基于 Rough Notation 封装的文本手绘高亮/圈注/波浪线 | 口播同步关键词视觉强调 |
| `src/board-tools/handActionScheduler.js` | `HandActionScheduler` | 手写动作时序调度器（支持 delay/duration 精准执行） | 板书与口播严格同步触发 |
| `src/board-tools/textTargetRegistry.js` | `TextTargetRegistry` | 文本 DOM 元素与关键词坐标注册索引表 | 板书高亮准确定位对应文字 |

## 3. 数学与 ASR 口播转换工具 (lib & utils)
| 模块路径 | 导出名 | 功能描述 | 复用场景 |
| :--- | :--- | :--- | :--- |
| `src/lib/mathAsrConverter.js` | `mathToAsrSpeech` | 将公式/算式/数字转换为自然口播汉字（如 "8+5" -> "八加五"） | 口播文本导出、TTS 朗读、Check Agent |
| `src/utils/mathText.js` | `renderKaTeX`, `formatFormula` | KaTeX 公式解析与轻量占位排版 | 板书 LaTeX 公式直接呈现 |
| `src/lib/speechMarkdown.js` | `exportSpeechMarkdown` | 将五字段执行表一键导出为 TTS 标准纯净口播稿 | 导出 Markdown、第三方配音接入 |
| `src/agent-b-v2/timing.js` | `applyAgentBV2Timeline` | 160字/分 + 1.5s 行间隔动态时间线排布算法 | 时间线估算、分段渲染 |
| `src/utils/superFilter.js` | `filterProblemContent` | 题目文本清洗、多余标记去除与安全转义 | 题目输入前置处理 |
| `src/utils/canvasCoords.js` | `percentToPixel`, `fitCanvas` | 百分比坐标与视口真实像素映射算法 | 响应式画布缩放适配 |

## 4. 配置中心与存储服务 (lib & services)
| 模块路径 | 导出名 | 功能描述 | 复用场景 |
| :--- | :--- | :--- | :--- |
| `src/lib/userApiConfig.js` | `userApiConfig`, `saveUserApiConfig` | 响应式 API 配置单例（支持多标签同步与本地持久化） | 全局大模型 Endpoint/Key 管理 |
| `src/lib/agentBApiConfig.js` | `agentBApiConfig`, `isAgentBApiReady` | Agent B 独立模型配置单例 | Agent B 独立调用凭证 |
| `src/lib/checkAgentApiConfig.js` | `checkAgentApiConfig` | Check Agent 独立模型配置单例 | Check Agent 独立调用凭证 |
| `src/services/stepHandoff.js` | `loadHandoff`, `saveHandoff` | A->B Handoff 状态流转服务 | 跨步骤数据传递与回溯 |
| `src/services/globalLoading.js` | `showGlobalLoading`, `hideGlobalLoading` | 全局响应式 Loading 状态管理 | 异步请求全屏拦截提示 |

## 5. 服务端通用中枢 (server)
| 模块路径 | 导出名 | 功能描述 | 复用场景 |
| :--- | :--- | :--- | :--- |
| `server/http.js` | `sendJson`, `readJsonBody`, `requestChatCompletion` | 统一 HTTP 响应封装、CORS、Upstream 轮询与重试 | 所有后端 Handler |
| `server/deliverableStoreHandler.js` | `handleDeliverableRequest` | 独立离线 HTML 打包与交付物持久化 | 成果分发与离线运行 |
| `server/cleanupHandler.js` | `handleCleanupRequest` | 受控文件清理（保护 current 与核心引用，安全垃圾回收） | 磁盘占用治理 |
| `server/fishAudioHandler.js` | `handleFishAudioRequest` | Fish Audio TTS 代理与音频本地缓存 | 语音合成与单行配音 |
