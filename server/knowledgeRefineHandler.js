/* 知识点修缮 API — 独立模块，不动 Agent A 和 Agent B 的核心逻辑
   读写 public/handoff/ 活档（current.json 指针 + handoff-*.json 实体）
   ★ R8-① A 方案（先对比确认再落盘）：refine 只出提案不落盘，
     用户在对比弹窗点「应用修缮」→ POST /apply 才写入活档；点「保留原文」活档零改动，
     B（信前端态）与 Check（信活档）永不分叉 */

import { KNOWLEDGE_REFINE_SYSTEM_PROMPT } from '../src/agent-b-v2/knowledgeRefinePrompt.js'
import { readCurrentHandoff, overwriteCurrentHandoff } from './handoffStoreHandler.js'
import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
  getChatMessageText,
} from './http.js'


// ponytail: JSON 解析唯一真源已抽到 src/lib/parseLLMJson.js
import { parseLLMJson } from '../src/lib/parseLLMJson.js'

// 从文本中提取 JSON（支持纯 JSON、```json ... ```、嵌套对象）
function extractJsonFromText(text) {
  return parseLLMJson(text)
}

// 字段级 merge：只覆盖知识点相关字段，其他字段保持原样（防上游乱改）
// ★ 第八轮契约归一 (2026-10-13)：commonMistakes 唯一真位置 = knowledgeAnalysis.commonMistakes
// （与 buildStep1Handoff 生产端、B/Check 消费端同位；旧顶层 merge 会造出幽灵字段且真值滞留旧档）
const REFINE_TOP_FIELDS = ['relatedKnowledge']
const REFINE_NESTED_FIELDS = ['teachingFocus', 'keyFormulaList', 'formulaHints', 'commonMistakes']

function mergeKnowledgeFields(original, refined) {
  if (!refined || typeof refined !== 'object') return original
  const merged = { ...original }
  for (const field of REFINE_TOP_FIELDS) {
    if (refined[field] !== undefined) merged[field] = refined[field]
  }
  if (refined.knowledgeAnalysis && typeof refined.knowledgeAnalysis === 'object') {
    merged.knowledgeAnalysis = { ...(original.knowledgeAnalysis || {}) }
    for (const field of REFINE_NESTED_FIELDS) {
      if (refined.knowledgeAnalysis[field] !== undefined) {
        merged.knowledgeAnalysis[field] = refined.knowledgeAnalysis[field]
      }
    }
  }
  return merged
}

// 原始快照机制已随 R8-① A 方案移除：refine 不再中途落盘，"保留原文"名副其实无需回滚；
// 旧 saveOriginalBackup/hasOriginalBackup/loadOriginalBackup（含死分支 revert 的唯一读方）全部失去存在理由
export async function handleKnowledgeRefineRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  // 中间件注册在 /api/knowledge/，req.url 前缀已去掉
  if (path !== '/refine' && path !== '/apply') return false
  if (req.method !== 'POST') return false

  // ★ R8-① A 方案：旧 /revert 分支整链移除——原条件比较的是剥前缀前的全路径（恒假，
  // POST /api/knowledge/revert 实际会错误掉进 refine 分支调上游覆写存档），且零 UI 消费方，
  // "保留原文"语义改由"确认前不落盘"直接保证，无需事后回滚

  // POST /api/knowledge/apply — 用户确认后才落盘（★ R8-① A 方案新增）
  if (path === '/apply') {
    try {
      const body = await readJsonBody(req)
      const proposal = body?.handoff
      if (!proposal || typeof proposal !== 'object') {
        return sendJson(req, res, 400, { ok: false, error: '缺少修缮提案 handoff' })
      }
      const current = readCurrentHandoff()
      if (!current?.handoff || typeof current.handoff !== 'object') {
        return sendJson(req, res, 400, { ok: false, error: '没有找到 handoff 存档，请先生成' })
      }
      // 防御性重合并：以当前活档为基底、白名单只放行知识字段——提案过期（如期间用户重新确认过 Step1）
      // 也不会把别环修缮（配比/排版/画布参数）一并卷回旧值；merge 结果由 overwriteCurrentHandoff 内部补全
      const merged = mergeKnowledgeFields(current.handoff, proposal)
      const filename = overwriteCurrentHandoff(merged)
      return sendJson(req, res, 200, { ok: true, filename, handoff: merged })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  // POST /api/knowledge/refine — 修缮知识点
  try {
    const body = await readJsonBody(req)
    let credentials
    try {
      credentials = resolveUserCredentials(body)
    } catch (error) {
      return sendJson(req, res, 400, {
        ok: false,
        error: error.message,
      })
    }

    // 从当前活跃的实体文件读 handoff，不依赖前端传
    const current = readCurrentHandoff()
    const handoff = current?.handoff
    if (!handoff || typeof handoff !== 'object') {
      return sendJson(req, res, 400, {
        ok: false,
        error: '没有找到 handoff 存档，请先生成',
      })
    }

    const userContent = [
      {
        type: 'text',
        text: `【输入 handoff】\n${JSON.stringify(handoff, null, 2)}\n\n请修缮其中的知识点相关字段，其他字段原样保留。输出完整的 JSON。`,
      },
    ]

    const { response, data } = await requestChatCompletion({
      ...credentials,
      timeoutMs: 60000,
      // ★ 2026-10-14 快速失败：超时重试只会把等待翻倍（60s×2 起，多 key 轮询更久）——
      // 期间平台网关若切断连接，客户端会对着 HTML 错误页炸出裸 JSON 解析报错
      // （夏夏实测"点优化确认出现 json 报错"）。对齐识别链 Task 30 的单次快速失败
      // 哲学：refine 是轻调用，慢上游不值得等第二程；总时长 ≤ 61s，客户端 100s 超时覆盖。
      retryOnAbort: false,
      body: {
        temperature: Number(body.temperature ?? 0.3),
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: KNOWLEDGE_REFINE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      },
    })

    if (!response.ok) {
      // ★ 2026-10-13：上游异常不再透传 502 弹崩前端（对齐 checkAgentHandler 的降级模式）
      // 保留原 handoff 返回 200，"优化确认"按钮永远可用；特征识别 Gemini 原生协议直通型中转站
      const upstreamMessage = data?.error?.message || data?.message || `上游失败 ${response.status}`
      const protocolMismatch = /Unknown name .{0,2}(messages|response_format|stream|temperature).{0,2}/i.test(String(upstreamMessage))
      return sendJson(req, res, 200, {
        ok: true,
        model: credentials.model,
        filename: current.filename,
        handoff,
        refineOk: false,
        usage: null,
        warning: protocolMismatch
          ? '上游中转站该模型为 Gemini 原生协议直通，不认 OpenAI 格式字段；已保留原知识库，请换有协议转换的接口地址或模型后重试'
          : `上游模型接口返回 ${response.status}（${upstreamMessage}），已保留原知识库，可重试`,
      })
    }

    const text = getChatMessageText(data?.choices?.[0]?.message)
    // 容错：从文本中提取 JSON（支持纯 JSON、```json ... ```、嵌套 handoff 字段）
    let refinedHandoff = extractJsonFromText(text)
    if (refinedHandoff?.handoff && typeof refinedHandoff.handoff === 'object') {
      refinedHandoff = refinedHandoff.handoff
    }
    // 字段级 merge：只覆盖知识点相关字段，其他字段保持原样（防上游乱改）
    // 提取失败则降级：返回原 handoff + 友好提示，不返回 502
    const mergedHandoff = mergeKnowledgeFields(handoff, refinedHandoff)
    const refineOk = Boolean(refinedHandoff)

    // ★ R8-① A 方案：refine 阶段不落盘——只出提案（mergedHandoff），存档仍为原文；
    // 旧"先落盘后弹确认"会把"保留原文"变成安慰剂（B 走前端旧值、Check 走活档新值，两环分叉）

    return sendJson(req, res, 200, {
      ok: true,
      model: credentials.model,
      filename: current.filename,
      handoff: mergedHandoff,
      usage: data?.usage || null,
      refineOk,
      ...(refineOk ? {} : { warning: 'AI 这次没返回标准格式，已保留原内容，可重试' }),
    })
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : 500
    return sendJson(req, res, status, {
      ok: false,
      error: error?.name === 'AbortError' ? '上游超时（60 秒）' : error?.message || String(error),
    })
  }
}

export function knowledgeRefinePlugin() {
  return {
    name: 'knowledge-refine-proxy',
    configureServer(server) {
      server.middlewares.use('/api/knowledge/', (req, res, next) => {
        Promise.resolve(handleKnowledgeRefineRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
