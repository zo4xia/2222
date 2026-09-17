# Agent Instructions

Apply on every coding task in this project.

## Startup Requirements

Before project work starts:

> **结果真实性：未实际修改、未落地、未验证的内容，一律算没做。** 不得把定位、计划、推测或“应该可以”表述为完成；必须给出实际文件状态、运行结果和未完成项。

1. Enable `$headroom`.
   - Default output: L2, terse Chinese, no ceremony.
   - Compress machine output over 200 tokens.
   - Preserve all errors, first 3 records, and last 2 records.
   - Store recoverable originals in `.headroom-cache/` when compression occurs.

2. Use `codegraph` first.
   - If `.codegraph/` exists, call `codegraph_explore` before code exploration or edits.
   - Use it for structure, flows, dependencies, callers, and blast radius.
   - If unavailable, say unavailable and fall back to local tools.

3. Enable/use `ib-mcp-cache`.
   - Prefer registered `ib-mcp-cache` / `memory-cache` MCP for reusable project context.
   - Use it before re-deriving prior decisions or long-lived project facts.
   - If MCP is not exposed in current session, say unavailable and continue with available memory/context tools.

4. Use context tools for large reads/search/logs.
   - Keep raw bytes out of conversation.
   - Derive answers in sandbox when output would be large.

5. Keep hooks and RTK on.
   - `hooks = true` must stay enabled in Codex config.
   - `rtk` stays available for compact shell/git/npm/test output.
   - Do not disable tokless/context-mode hooks to gain speed; reduce output and batch commands instead.

## Project Principle

题型千变万化。本项目目标是找到最低兼容适配，不是把题型限制成死规范。没有空间的死规矩和熵增没有区别，都是死的。

产品本质不是提供课后答案，答案到处都有。产品要做的是以孩子上传的具体题目为载体，给出温柔、循序渐进的引导：带孩子看条件、问为什么、调用学过的知识、一步步形成解题直觉。程序应提供最小必要引导和最大兼容性，安静接住口播、板书、动作与时间线；不得用验证、门槛或僵硬输出限制压扁题型、教学过程或孩子的理解路径。

解题只是导线，不是终点。核心是教孩子知识怎样用、思考怎样展开，逐渐建立面对新题时能自己判断、拆解和验证的解题世界观与直觉。

面对的是尚未形成解题起点的孩子：他们可能不知道先看什么条件、不知道条件之间有什么关系，也不知道卡住后怎样继续。标准答案只能给终点，不能替代这段被带着建立的起步过程；因此不能把 B 压成程序化的答案输出或固定步骤清单。

## Engineering Defaults

- `caveman` full: terse Chinese responses; preserve technical precision.
- `headroom` L2: compress machine output over 200 tokens; preserve all errors, first 3, and last 2 records; retain recoverable originals in `.headroom-cache/` when compression occurs.
- `ponytail` full: reuse existing code first; use platform/stdlib before dependencies; make smallest verified change; no speculative abstractions.
- `lean-ctx`: use compressed context tools for exploration, search, file reading, and shell output when available. Fall back to installed project tools when unavailable.

## Work Rules

- Think, simplify, edit surgically, verify.
- Code changes first, teaching second. If user asks to fix/build/change, implement and verify; explain only necessary decisions, risks, or blockers.
- Inspect actual flow before edits.
- Reuse existing helpers/patterns before writing new code.
- Touch only files needed for current request.
- **最小修复铁律**：修单一问题时，只改直接导致该问题的文件。禁止顺手修改 prompt、教学内容、校验规则、UI、项目文档、测试用例等无关文件；所有"优化""重构""降门槛"想法必须单独提出，用户明确确认后再执行。
- Do not remove unrelated dead code unless asked.
- For code tasks, verify proportionally to risk.
- A -> B is required path. Check C is manual, independent, and must not block generation or overwrite newer edits.
- **没有验证过的代码不算做完**：以代码实际运行结果为真相，禁止仅凭读代码就宣称完成；全链路改动必须跑通真实请求验证。

## 项目接手与重构标准流程

### 核心原则（所有重构/新接手任务强制执行）
1. **极简但完整**：少即是多，最大化复用现有资源，做好代码隔离（文件多则用软连接/物理隔离），用最简路径达到目标，严格模块化，禁止代码膨胀。
2. **AI友好**：用结构化可执行语言；设计前先到 GitHub 等可信来源检索成熟框架/模板/可复用模块，严禁手搓，无现成方案才自行实现。
3. **公共资源复用**：可复用的 CSS、模块、函数必须纳入公共引用管理，禁止重复复制。
4. **图优先于文档**：维护系统全景设计图（节点带关键词）和施工进展图；上下文 = 图 + 变更 tree。
5. **变更留痕**：任何修改必须记录变更树，没痕迹等于没做。
6. **验证优先**：没跑过的代码不算好，以实际运行为真相。
7. **标准工业化**：优先成熟框架代码，禁止盲目手搓，避免团队无法交接和高维护成本。
8. **禁止过度设计**：不自我造词，字段/参数/出入参清晰可溯源，没理解透彻不动手。
9. **缓存与增量**：用缓存+增量阅读，图+tree替代大段上下文。
10. **错误熔断**：一个问题错超过5次立刻停下，逆向思考断裂点；主动用多技能/多视角（用户视角、产品经理视角等）找不合理点。

### 五阶段工作流
1. **🔍 勘探准备**：动手前 x-ray 项目至少4层深度，建立立体代码认知（用图谱技能），识别技术栈、六维研读文档、止血三板斧、初筛可复用资源。
2. **📊 深度诊断**：标注目录职责、三层业务扫描、六维度评估、需求校准。
3. **🏗️ 骨架施工**：页面四分类、落实CDN五原则、固化结构解耦。
4. **🔌 管线铺设**：黄金三角API优先接入、非核心API分批接入、统一数据交互规则、校验数据流解耦。
5. **🎨 精装验收**：数据驱动UI改造、本地化合规、自动化修复、冒烟测试、固化规范、最终交付。

### 必维护核心记录
- `PROJECT_STATE.md`：实时真相
- `ENGINEERING_LOG.md`：自包含工作单元
- `DECISIONS.md`：决策溯源、坑点、踩坑经验
- `项目实时架构模块图.md`：上下文、施工路线、todolist、项目节奏反馈，实时更新

## Agent A -> B Handoff

- Do not change existing Agent A upload, recognition, image-type/original-image decision, knowledge, layout, or coordinate logic.
- Handoff 只传文本字段，按 `server/agentBV2Handler.js` 的 `HANDOFF_TEXT_FIELDS` 白名单过滤；不传递原图、网格快照或任何图片。
- Agent B 发送 `src/agent-b-v2/prompt.js` 的 system prompt + handoff 文本；图片传输已冻结，后续如需多模态再独立接入，不得混入 handoff 文本。
- Send available content as-is. Do not add content gates, validation, duplicate preview UI, or new image decisions.

## Teaching Experience Is Primary

- This product is not an answer generator. It turns one uploaded problem into a warm, gradual learning journey: see the condition, ask why, retrieve book knowledge, test a thought, explain the next step, and form solving intuition.
- Competitive strategy is protected content: child-development framing, recursive decomposition, error anticipation, progressive question chains, problem return, opening/closing rituals, ASR rhythm, age adaptation, and their concrete spoken/board examples may only be strengthened or translated into the five fields. Never delete, compress, or replace them with abstract rules to save tokens, simplify code, or satisfy a rigid contract.
- Agent B is a teacher first. Its prompt examples, gentle voice, pauses, questions, error anticipation, four-stage teaching flow, and age-aware guidance are functional teaching content, not prompt noise. Never delete or compress them because they appear long or not directly executable.
- Knowledge callback is a necessary teaching action, not a label: a child may have forgotten multiplication facts, a formula, or the meaning of a quantity. First reconnect the knowledge in the current problem, then guide its use; never assume the child already has a usable solving starting point.
- Grade adaptation is a teaching boundary: 1-2 years need concrete, gentle, short-step support; 4-6 years need reasoning prompts that help them discover a path. Preserve the child-facing intent when mapping content to program fields.
- The five-field table is only an execution carrier. A stage may contain many rows; a row may contain many spoken sentences. Do not force one row per stage or collapse a child’s reasoning process to make the table shorter.
- `speech` 是纯口播文本，直接给第三方 TTS。不使用 `[pause]`、`[excited]`、`[emphasis]` 等 TTS 控制标签；长停顿由 B 拆成独立 row 获得 1.5s row gap，行内停顿靠自然标点。`board` 和 `actionSpec` 是下一画布步的同步源，不混入口播内容。
- Board actions and speech share one fixed timeline: speech cadence, pauses, row gaps, and canvas actions must describe the same teaching moment. Agent B writes teaching content; program timing and later canvas execution make it happen.
- Program compatibility is a translation layer only: map teaching intent to current `duration`, `stage`, `speech`, `board`, and `actionSpec` fields without deleting the intent. Do not introduce unsupported fields, but do not treat their teaching meaning as disposable.
- Canvas stays light: use the existing `rough.js` runtime for hand-drawn lines, arrows, and shapes; use `rough-notation` for text underline, highlight, and marks. Agent B only emits the matching action parameters, while the later canvas layer executes them. Do not add another drawing framework, compatibility layer, or validation gate around these two libraries.

## Current B Prompt Source

- Teaching source is `doc/建议提示.md`. Its long examples and child-development guidance are intentionally retained in `src/agent-b-v2/prompt.js`; never replace them with a shorter “contract-first” prompt.
- Only translate real incompatibilities: seven columns -> current five fields; `notes` teaching intent -> `speech`/`board`; answer wording -> final `解答` row; old `userPayload` wording -> `handoff`.
- `speech` 是导出给第三方 TTS 的纯口播文本，不使用任何 TTS 控制标签；标签不得出现在 `board` 或 `actionSpec` 中。
- `board` and `actionSpec` feed the following canvas stage. They share the same teaching moment as speech, but are never narration.
- Timeline baseline is 160 Chinese characters/minute with 1.5-second row gaps. 长停顿靠拆行获得 row gap，行内靠标点。B 不发明时间戳。
- Prompt may expand a stage into as many rows and sentences as the child needs. Do not collapse reasoning just to shorten a table.
- Current next concern, not a license to redesign: keep one-click exported speech Markdown directly usable by the TTS handoff while preserving the exact speech text.

## Check Agent Role

- B 负责第一次完整生成；Check 是用户主动触发的第二双眼睛，用独立模型分担一次性生成的波动。它不是通过/拦截机制，不能阻断 B 的结果。
- Check 固定保留行数、顺序、`duration`、`stage`。它优先润色 `speech`：守住四环一体和知识 callback，优化自然断句与标点节奏（不输出 TTS 控制标签，长停顿由 B 拆行实现），消除机械/产品说明腔，保住固定开收场和反例黑名单；口播中的全部数字改为中文发音。仅在与口播不一致时才动 `board` 或 `actionSpec`。

@RTK.md

## Notes

- 跨环境工具避坑 **Why:** Windows、严格云端 Node、Git 精确暂存和工具批次的默认行为会制造假失败或漏跑验证；必须依据真实退出码与文件状态定位。 **How to apply:** - ESM 配置路径：不使用 `_…
- tool
