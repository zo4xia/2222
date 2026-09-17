/**
 * @qh-core LANE=SERVER POINT=MICRO_AGENT 小 agent 对话微调 handler
 *
 * 用户在 player 页面对话：「第2行的字写大一点」→ 小 agent 解析 → 返回调整建议
 * 复用 userApiConfig（用户要求），不引入第 4 套 API 配置
 *
 * 三种角色：
 * 1. 动作微调（actionSpec 调整）
 * 2. 板书微调（board.content / startDelay 调整）
 * 3. 口播微调（speech 重写）
 */

import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
} from './http.js'

const MICRO_AGENT_SYSTEM_PROMPT = `
你是一个板书微调助手，帮助老师根据自然语言指令调整板书动作、字号、坐标或口播稿。

# 你的职责

用户会给你一个描述，比如：
- "第2行的字写大一点" → 调整 board.fontSize
- "把箭头改成红色" → 调整 actionSpec[].action.style.colorId 为 'red'
- "第3行的口播再讲细一点" → 重新生成 speech
- "下划线改到'12吨'" → 调整 actionSpec[].action.target.exactText

# 输出格式

你必须返回 JSON：
\`\`\`json
{
  "reply": "对用户指令的自然语言确认（一句简短话）",
  "intent": "action_tune | board_tune | speech_tune | unknown",
  "applied": ["已应用的字段说明（数组）"],
  "patch": {
    "rowIndex": 0,
    "changes": {
      "board.fontSize": 36,
      "board.content": "新内容",
      "speech": "新口播",
      "actionSpec[0].style.colorId": "red"
    }
  }
}
\`\`\`

# 规则
1. reply 必须是简短的自然语言确认，比如"好的，第2行字号调到 36 了"
2. intent 三选一，对应动作/板书/口播
3. applied 列出实际改了哪些字段
4. patch.rowIndex 是 0-based 行号
5. patch.changes 是字段路径 → 新值 的映射
6. 如果无法识别用户意图，返回 intent: "unknown" + reply: "我没听懂，能再说一遍吗？"
7. 不要输出 JSON 之外的内容

# 示例
用户: "第2行的字写大一点"
你: {
  "reply": "好的，第2行字号从 35 调到 40 了",
  "intent": "board_tune",
  "applied": ["board.fontSize"],
  "patch": { "rowIndex": 1, "changes": { "board.fontSize": 40 } }
}
`

/**
 * 构建小 agent 的 user prompt
 */
function buildUserMessage(message, deliverable) {
  const rows = deliverable?.rows || []
  const rowsSummary = rows.map((r, i) => {
    return `第${i + 1}行 [${r.stage || ''}] speech=${(r.speech || '').slice(0, 60)} board=${JSON.stringify(r.board || '')} actionSpec=${JSON.stringify(r.actionSpec || [])}`
  }).join('\n')

  return `用户指令: ${message}

当前 rows 摘要：
${rowsSummary}

请按 JSON 格式输出微调建议。`
}

/**
 * 从文本中提取 JSON
 */
function extractJsonFromText(text) {
  if (!text) return null
  try { return JSON.parse(text) } catch { /* continue */ }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch { /* continue */ }
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch { /* fail */ }
  }
  return null
}

/**
 * 处理小 agent 微调请求
 */
export async function handleMicroAgentRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname !== '/refine') return false
  if (req.method !== 'POST') return false

  try {
    const body = await readJsonBody(req)

    // 复用 userApiConfig（用户要求不引入第 4 套配置）
    let credentials
    try {
      credentials = resolveUserCredentials(body)
    } catch (error) {
      return sendJson(req, res, 400, { ok: false, error: error.message })
    }

    const { message, deliverable } = body
    if (!message || typeof message !== 'string') {
      return sendJson(req, res, 400, { ok: false, error: '缺少 message 参数' })
    }

    const userMessage = buildUserMessage(message, deliverable)

    let response
    try {
      response = await requestChatCompletion({
        endpoint: credentials.endpoint,
        apiKey: credentials.apiKey,
        model: credentials.model,
        systemMessage: MICRO_AGENT_SYSTEM_PROMPT,
        userMessage,
        temperature: 0.4,
        timeoutMs: 60000,
        responseFormat: { type: 'json_object' },
      })
    } catch (err) {
      console.warn('[microAgent] 上游调用失败，降级返回默认回复:', err?.message)
      return sendJson(req, res, 200, {
        ok: true,
        reply: '抱歉，小 agent 暂时连不上大模型。请检查 API 配置或稍后重试。',
        intent: 'unknown',
        applied: [],
        degraded: true,
      })
    }

    const content = response?.choices?.[0]?.message?.content || ''
    const parsed = extractJsonFromText(content)

    if (!parsed) {
      return sendJson(req, res, 200, {
        ok: true,
        reply: '我没听懂，能再说一遍吗？',
        intent: 'unknown',
        applied: [],
      })
    }

    return sendJson(req, res, 200, {
      ok: true,
      ...parsed,
      model: credentials.model,
    })
  } catch (error) {
    console.error('[microAgent] handler 异常:', error)
    return sendJson(req, res, 500, {
      ok: false,
      error: error?.message || String(error),
    })
  }
}

/**
 * Vite 插件：注册 /api/micro-agent 路由
 */
export function microAgentPlugin() {
  return {
    name: 'micro-agent-proxy',
    configureServer(server) {
      server.middlewares.use('/api/micro-agent', (req, res, next) => {
        Promise.resolve(handleMicroAgentRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
