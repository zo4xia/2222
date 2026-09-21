# 已知问题与规避

## 🔴 高优先级（影响功能正确性）

### P0-1：canvasParams 循环引用导致生成失败
- **状态**：✅ 已修复（2026-08-21）
- **文件**：`src/agent-b-v2/AgentBDirect.vue` L416-417
- **现象**：点击生成按钮报 `Converting circular structure to JSON --> ReactiveEffect`
- **根因**：`canvasParams` 是 `ref({...})`，但代码直接展开 `{ ...canvasParams }`（展开 ref 对象本身，含 Vue 内部 ReactiveEffect）
- **修复**：改为 `{ ...canvasParams.value }`，同时 `canvasParams.rowGapMs` → `canvasParams.value.rowGapMs`
- **验证**：构建通过，代码审查确认所有 script 中的 canvasParams 使用都带 `.value`

### P0-2：B 输出解析过于严格，格式偏差就整表 422
- **状态**：❌ 未修复
- **文件**：`server/agentBV2Handler.js:76`、`src/agent-b-v2/contract.js:71`
- **现象**：模型多回 `notes`、旧 `答语`、第六字段，或动作工具稍有偏差，整表回 422
- **影响**：可用的讲题稿会因程序格式问题被丢掉，违背"最小引导、最大兼容"
- **修复方向**：五字段继续作为画布载体，但服务端宽容提取 rows；忽略旧字段；不确定动作降级为 []；保留可用口播和板书

### P0-3：修缮 API 一调就写文件，前端以为点应用才写
- **状态**：❌ 未修复
- **文件**：`server/knowledgeRefineHandler.js`、`src/agent-b-v2/AgentBDirect.vue`
- **现象**：前端以为点"应用"才写文件，后端 API 一调就直接 overwriteCurrentHandoff
- **影响**：用户点"保留原文"是假的——刷新就是修缮后的内容
- **已有还原接口**：`POST /api/knowledge/revert`（从 `.original.json` 备份还原）
- **修复方案**：A. 后端只算不写，新增 `/api/knowledge/apply`，前端点"应用"才真正写 / B. 前端"保留原文"时调还原

---

## 🟠 中优先级（数据不一致 / 潜在 bug）

### P1-1：两套参数体系并存，没有归一化
- **状态**：❌ 未修复
- **描述**：handoff.canvasParams（数据层，唯一真相源）和 UI canvasParams ref（显示层）两套参数各走各的路，没有映射关系
- **决策方向**：以 handoff 为唯一真相源，UI 层的 canvasParams ref 要么删掉，要么只作为 handoff 的镜像
- **影响**：用户在 UI 上改了参数，渲染时用的还是 handoff 里的旧值，改了不生效；导出文件和实际渲染不一致
- **涉及字段**：题目字号（fontSize.question.px vs topicFontSize）、题目字体、题目行高、坐标系统（coordinateSystem vs coordinateMode）、四区坐标（boardPlan vs zones 死代码）

### P1-2：区域命名不一致：question vs topic
- **状态**：❌ 未修复（zoneAnchors 已统一，boardPlan 仍存在）
- **描述**：数据层题目区叫 `question`，UI 层叫 `topic`，两套命名没有归一化函数
- **涉及文件**：
  - 数据层（question）：boardLayout.js、stepHandoff.js、prompt.js、roughDrawingTool.js、textTargetRegistry.js
  - UI 层（topic）：AgentBDirect.vue（zones / labels）
  - 兼容层：BoardContentLayer.vue L29 只有存在性判断，不做转换

### P1-3：zones 是死代码
- **状态**：❌ 未修复
- **文件**：`src/agent-b-v2/AgentBDirect.vue` L135-141
- **描述**：`canvasParams.zones` 定义了 4 个区的坐标，但模板和 script 里都不引用
- **证据**：全局搜索 `zones.` 在模板和 script 中 0 引用（只有定义处）
- **影响**：导出时把死值写出去，误导下游；占地方干扰阅读

### P1-4：导出与渲染不一致
- **状态**：❌ 未修复
- **文件**：`src/lib/speechMarkdown.js`
- **描述**：导出的要素表读 UI canvasParams 的值（topicFontSize/zones 死值），但实际渲染用的是 handoff.boardPlan 和 handoff.canvasParams 的值
- **影响**：导出文件和实际画面对不上，下游拿导出文件生成的视频和实际画布不一致

### P1-5：handoff 白名单大量冗余字段同时发给模型
- **状态**：❌ 未修复
- **描述**：handoff 白名单 18 个字段里，大量重叠/冗余/无效字段同时发给模型：
  - 坐标相关 6 套：boardPlan + zoneAnchors + coordinateSpec + topicLayout + canvasParams.coordinateSystem + canvasParams.zones(死)
  - 布局相关 3 套：boardPlan + suggestedLayout + topicLayout
  - 画布参数 2 套：handoff.canvasParams + body.canvasParams(UI)
- **影响**：模型收到这么多重叠信息，容易困惑

### P1-6：relatedKnowledge 数据结构不统一
- **状态**：❌ 未修复
- **现象**：A 侧写对象数组（带"编号""知识点"等中文键），修缮输出字符串数组
- **当前状态**：AgentBDirect 已双兼容；Step1Entry 展示未双兼容

### P1-7：duration 全链路清理
- **状态**：✅ 已完成（2026-08-21）
- **描述**：B 模型不再输出 duration 时间字段，时间由下游动态计算
- **决策**：时间不预计算，estimatedStartMs/EndMs 保留在渲染内部（timing.js），不导出不显示
- **行标识**：改用 `stage-第N行` 格式
- **已清理文件（8 个）**：contract.js / prompt.js / timing.js / AgentBDirect.vue / speechMarkdown.js / checkAgentHandler.js / liyongle-elementary/output-format.js / liyongle-elementary/examples.js
- **未清理（记录在案）**：prompt-v3-draft.js（草稿）、proxySelfCheck.js（自测脚本）、board-rules.js（动作级 durationMs 合理保留）

---

## 🟡 低优先级（代码质量 / 维护性）

### P2-1：handoff.canvasParams 大多数字段是描述性文本
- **状态**：❌ 未处理
- **文件**：`src/services/stepHandoff.js`
- **描述**：boardSpeed、actionSpeed、lineHeightFormula、canvasSize.origin、canvasSize.unit、coordinateSystem 都是字符串描述，代码里不用
- **实际被渲染代码用到的字段只有**：`fontSize.question.px`（1 个，占 24 个字段的 4%）

### P2-2：fontSize 12 个子字段只用了 1 个
- **状态**：❌ 未处理
- **描述**：handoff.fontSize 下 4 个区 × 3 字段（px/family/color）= 12 个字段，渲染只用到 `question.px` 一个

### P2-3：lineHeight.others 是字符串不是数字
- **状态**：❌ 未处理
- **文件**：`src/services/stepHandoff.js` L154
- **描述**：`lineHeight.others` 值是描述文字不是数字，代码没法直接用

### P2-4：导出的 Markdown 不是可直接交给 TTS 的口播稿
- **状态**：❌ 未修复
- **文件**：`src/lib/speechMarkdown.js:2`
- **现象**：导出包含 `# 口播稿`、题目、模型、导出时间等元数据
- **影响**：第三方 TTS 会把元数据一起读出来
- **修复方向**：只按当前行顺序导出 speech，行间空一行，原样保留口播毛料

### P2-5：自检脚本仍断言旧导出格式
- **状态**：❌ 未修复
- **文件**：`server/proxySelfCheck.js:227`
- **现象**：自检仍要求 Markdown 含 `# 口播稿`

### P2-6：题型配比建议 Descriptions span 错配
- **状态**：✅ 已修复
- **现象**：ant-design 警告 "Sum of column span in a line not match column"
- **修复**："对应题型/知识点" span 从 2 改为 1

### P2-7：checkStatus failed_fallback 弹窗显示错误
- **状态**：✅ 已修复
- **现象**：failed_fallback 时 checkChanges 是空数组，弹窗显示 "未发现需要润色的内容"（成功状态），用户以为 Check 成功了
- **修复**：加 `checkFailedFallback` ref，弹窗根据状态显示不同内容

---

## ✅ 已修复（历史问题）

| # | 问题 | 修复时间 | 文件 |
|---|------|---------|------|
| 1 | canvasParams 循环引用 | 2026-08-21 | AgentBDirect.vue L416-417 |
| 2 | eslint server/ 目录 no-undef | 2026-08-21 | eslint.config.js |
| 3 | handoff 写失败不阻断 | 之前 | Step1Entry.vue |
| 4 | board 双兼容（v1.0 string / v2.0 object） | 之前 | contract.js + check-agent/contract.js |
| 5 | duration 全链路清理 | 2026-08-21 | 8 个文件（见 P1-7） |
| 6 | zoneAnchors key 命名统一（topic→question） | 2026-08-21 | stepHandoff.js |
| 7 | URL 重复拼接 | 2026-08-17 | server/http.js |
| 8 | checkStatus 弹窗显示错误 | 2026-08-21 | AgentBDirect.vue |
| 9 | Descriptions span 错配 | 2026-08-22 | AgentBDirect.vue |
| 10 | check-agent duration 残留 + contract.js 死代码 | 2026-08-24 | server/checkAgentHandler.js + src/check-agent/contract.js（已删除） |

---

## 📋 待确认事项

1. P1-1 参数归一化：UI 参数要不要和 handoff 对齐？还是保留两套？
2. P1-2 命名统一：统一用 question 还是 topic？
3. P1-3 zones 死代码：删掉还是接入渲染？
4. P1-4 导出对齐：导出用 handoff 的值还是 UI 的值？
5. P1-5 handoff 白名单精简：要不要去掉冗余字段？
6. P2 低优先级：要不要一起整理？

---

## 上游 API 兼容问题

### Agnes API JSON 输出合法性
- **现象**：Agnes 模型的 `response_format: json_object` 不会强制输出合法 JSON，可能在字符串内写未转义的英文双引号导致解析失败
- **规避**：依赖 `prompt.js` 里的 JSON 合法性约束 + `contract.js` 的 parse 容错
- **状态**：当前可接受，未做额外处理

### 本地开发服务器端口
- **现象**：默认 5173 端口可能被占用
- **规避**：启动时自动递增端口，或在 `vite.config.js` 里指定固定端口
