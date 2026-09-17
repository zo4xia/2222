# Agent B 控件责任表

| 什么控件 | 干什么的 | 负责什么 | 不负责什么 | 影响关系 | 来源依据、受什么影响 | 参数字段 | 对应的前端 | 控件名称 | 是否唯一 |
|---|---|---|---|---|---|---|---|---|---|
| Agent B 系统提示 | 约束模型生成教学脚本 | 角色、教学方法、五字段输出意图、动作字段语义 | 不校验 JSON，不执行动作，不拼接外部 MD/CSV | 影响 Agent B 原始输出质量 | 来源 `prompt.js`；受五字段合同和板书工具能力影响 | `duration`、`stage`、`speech`、`board`、`actionSpec` | 无独立组件 | `AGENT_B_V2_SYSTEM_PROMPT` | 是 |
| Agent A handoff 请求适配器 | 把 Agent A 交接转换为 Agent B 请求 | 发送 handoff、API 配置和生成参数 | 不定义教学规则，不修改模型返回行，不执行动作 | 影响 Agent B 上游输入与 token 用量 | 来源 Agent A handoff；受 `/api/agent-b-v2/generate` 接口影响 | `handoff`、`temperature`、`endpoint`、`model`、`apiKey` | `AgentBDirect.vue` | `generateAgentBV2Rows` | 是 |
| 五字段合同规范化器 | 把模型输出收敛为稳定行合同 | 补齐 `actionSpec`；为缺失 `cueText` 推导动作标签；保留五字段边界 | 不改写 `speech`，不判断教学质量，不执行动作 | 影响服务端响应、Check Agent 和前端行数据 | 来源五字段合同；受板书动作 schema 影响 | `rows[]`、`actionSpec[]`、`cueText` | 无独立组件 | `normalizeAgentBV2BoardCells` | 是 |
| 五字段合同校验器 | 拒绝结构或动作本身无效的数据 | 校验字段、阶段、首行、动作 schema、全表唯一 `order` | 不要求 `cueText` 是 `speech` 子串，不检查教学风格 | 影响生成是否被接受及错误提示 | 来源 `AGENT_B_V2_COLUMNS`、`AGENT_B_V2_STAGES`、板书工具目录 | `rows`、`allowTimedDuration`、`problemType` | 错误显示在 `AgentBDirect.vue` | `validateAgentBV2Rows` | 是 |
| 动作触发标签 | 给动作提供稳定的人类可读标识 | 描述/标识动作；缺省时由合同层从动作内容推导 | 不承担口播，不控制动作执行时机，不要求逐字出现在 `speech` | 影响动作列表展示和调试可读性 | 来源模型 `cueText` 或 `action.content`、`target.exactText`、`capabilityGap.need`、`tool` | `cueText` | `AgentBDirect.vue` 动作弹层 | `actionSpec[].cueText` | 每个动作一个，可重复文本 |
| 口播字段 | 保存可直接朗读的正文 | 教学口播与 TTS 文本 | 不承担动作主键，不包含界面按钮文案 | 影响时间轴、语音导出和学生听感 | 来源 Agent B；受教学提示和 TTS 规则影响 | `speech` | `AgentBDirect.vue` 口播列 | `rows[].speech` | 每行一个 |
| 板书动作运行时 | 校验并执行实际板书工具动作 | 按 `entry.action` 准备、排队、执行和清理动作 | 不读取 `speech`，不依赖 `cueText` 执行动作，不生成教学内容 | 影响真画布上的动作结果 | 来源 `boardToolCatalog.js`；受注册工具和 action schema 影响 | `action.tool`、`action.order` 及工具参数 | 真画布/板书预览组件 | `createBoardToolRuntime` | 是 |
| Agent B 行编辑表 | 展示和编辑五字段结果 | 编辑 `stage`、`speech`、`board`；展示动作；插入删除行 | 不校验模型原始 JSON，不执行上游生成规则，不把 `cueText` 写回 `speech` | 影响用户最终可编辑数据和 Check 输入 | 来源合同通过后的 `rows`；受时间轴和 Check 状态影响 | `rows`、`columns`、`actionSpec` | `AgentBDirect.vue` | `AgentBDirect` | 是 |
| Check Agent 适配器 | 检查用户当前五字段 | 仅提交当前五字段；限制可修改字段；合并检查结果 | 不追溯 Agent A/B 生成过程，不改变行数、顺序、`duration`、`stage` | 影响检查后的 `speech`、`board`、`actionSpec` | 来源用户当前 rows；受 Check 合同与检查文档影响 | `currentRows`、`changes` | `AgentBDirect.vue` Check 控件 | `handleCheckAgentRequest` | 是 |

## 固定边界

1. `speech` 是口播正文；`cueText` 是动作标签，二者不建立字面包含关系。
2. 动作能否执行只由 `entry.action` 和板书工具 schema 决定。
3. `cueText` 缺失时由五字段合同规范化器推导，不把整表打回模型。
4. 前端只消费合同通过后的 rows，不重复实现合同校验。
5. Agent B 上游系统提示只使用 `prompt.js`；业务输入只使用 Agent A handoff，不额外注入 MD/CSV。
