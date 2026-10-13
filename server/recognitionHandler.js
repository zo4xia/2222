import { createHash } from 'node:crypto'
import { buildRecognitionPrompt } from './recognitionPrompt.js'
import {
  formatAgentAKnowledge,
  hydrateAgentAKnowledge,
  selectAgentAKnowledge,
} from './agentAKnowledge.js'
import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
} from './http.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 100
const recognitionCache = new Map()

function cacheKey(body, credentials, knowledgeBase) {
  return createHash('sha256').update(JSON.stringify({
    problemText: String(body.problemText || '').trim(),
    imageDataUrl: body.imageDataUrl || '',
    endpoint: credentials.endpoint,
    model: credentials.model,
    apiKey: credentials.apiKey,
    knowledge: knowledgeBase?._meta?.sha256 || '',
  })).digest('hex')
}

function readCache(key) {
  const entry = recognitionCache.get(key)
  if (!entry || entry.expiresAt <= Date.now()) {
    recognitionCache.delete(key)
    return null
  }
  recognitionCache.delete(key)
  recognitionCache.set(key, entry)
  return entry.value
}

function writeCache(key, value) {
  recognitionCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  if (recognitionCache.size > CACHE_MAX_ENTRIES) {
    recognitionCache.delete(recognitionCache.keys().next().value)
  }
}

// ponytail: JSON 解析唯一真源已抽到 src/lib/parseLLMJson.js
import { parseLLMJson } from '../src/lib/parseLLMJson.js'

function parseJsonCandidate(text) {
  const parsed = parseLLMJson(text)
  if (parsed) return parsed
  // 降级：完全解析不出 JSON 时，把整段文本当 problemText 返回（避免上层整段抛错）
  const candidate = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  return { problemText: candidate }
}

export async function handleRecognitionRequest(req, res, knowledge = {}) {
  if (isOptions(req, res)) return true
  if (req.method !== 'POST') return false

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

    if (!body.imageDataUrl && !String(body.problemText || '').trim()) {
      return sendJson(req, res, 400, { ok: false, error: '需要图片或题文' })
    }

    const key = cacheKey(body, credentials, knowledge.knowledgeBase)
    const cached = readCache(key)
    if (cached) return sendJson(req, res, 200, { ...cached, cached: true })

    const knowledgeSelection = selectAgentAKnowledge(
      knowledge.knowledgeBase,
      body.problemText,
    )
    const knowledgeContext = formatAgentAKnowledge(knowledgeSelection)
    const content = [
      { type: 'text', text: buildRecognitionPrompt({ knowledgeContext }) },
    ]
    if (String(body.problemText || '').trim()) {
      content.push({ type: 'text', text: `用户已有题文（可校正）：\n${String(body.problemText).trim()}` })
    }
    if (body.imageDataUrl) content.push({ type: 'image_url', image_url: { url: body.imageDataUrl } })

    const { response, data } = await requestChatCompletion({
      ...credentials,
      // ★ 60→110 秒（2026-10-13 夏夏实测"第一步一直卡"根因）：这是全链最重的一次多模态调用
      //   （图片+知识库上下文+全量 JSON 输出），视觉模型常见 60-180 秒；旧 60 秒对慢模型必杀
      //   ——每次都是转圈两分钟后 504，永远走不完第一步。110s 单次尝试在 Vercel maxDuration 120s
      //   函数预算内可完成；超时不重试（慢上游重试=再白等一程，只拖长转圈时间）。
      timeoutMs: 110000,
      retryOnAbort: false,
      body: {
        temperature: 0.3,
        messages: [{ role: 'user', content }],
      },
    })
    if (!response.ok) {
      return sendJson(req, res, response.status, {
        ok: false,
        error: data?.error?.message || data?.message || `上游识别失败 ${response.status}`,
        detail: data,
      })
    }

    const message = data?.choices?.[0]?.message || {}
    const text = message.content || message.reasoning_content || ''
    const result = hydrateAgentAKnowledge(parseJsonCandidate(text), knowledge.knowledgeBase)
    const payload = {
      ok: true,
      model: credentials.model,
      rawText: text,
      result,
      cached: false,
      knowledgeRetrieval: {
        mode: knowledgeSelection.mode,
        candidates: knowledgeSelection.rows.length,
        promptChars: knowledgeContext.length,
      },
    }
    writeCache(key, payload)
    return sendJson(req, res, 200, payload)
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : 500
    return sendJson(req, res, status, {
      ok: false,
      error: error?.name === 'AbortError'
        ? '识别上游请求超时（单次 110 秒）——模型响应太慢或网络不通：请换更快的视觉模型或稍后重试'
        : error?.message || String(error),
    })
  }
}

export function createRecognitionProxyPlugin(knowledge) {
  return {
    name: 'step1-recognition-proxy',
    configureServer(server) {
      server.middlewares.use('/api/recognition/problem', (req, res, next) => {
        Promise.resolve(handleRecognitionRequest(req, res, knowledge)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
