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

function parseJsonCandidate(text) {
  const candidate = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(candidate.slice(start, end + 1)) } catch {}
    }
    return { problemText: candidate }
  }
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
      timeoutMs: 60000,
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
      error: error?.name === 'AbortError' ? '识别上游连续两次请求均超时（单次 60 秒）' : error?.message || String(error),
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
