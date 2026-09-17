const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function applyCors(req, res) {
  const origin = String(req.headers?.origin || '').trim()
  const allowedOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  for (const [key, value] of Object.entries(JSON_HEADERS)) res.setHeader(key, value)
}

export function sendJson(req, res, statusCode, payload) {
  applyCors(req, res)
  res.statusCode = statusCode
  res.end(JSON.stringify(payload))
}

export function isOptions(req, res) {
  if (req.method !== 'OPTIONS') return false
  sendJson(req, res, 204, {})
  return true
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export function getChatMessageText(message) {
  if (typeof message?.content === 'string') return message.content
  if (!Array.isArray(message?.content)) return ''
  return message.content.map((item) => item?.text || '').join('')
}

let globalKeyRoundRobinCounter = 0

export function parseApiKeys(apiKeyInput) {
  if (!apiKeyInput) return []
  return String(apiKeyInput)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

export function maskApiKey(key) {
  const str = String(key || '').trim()
  if (str.length <= 8) return '***'
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

export function resolveUserCredentials(body) {
  const apiKeyRaw = String(body?.apiKey || '').trim()
  const endpoint = String(body?.endpoint || '').trim()
  const model = String(body?.model || '').trim()
  if (!apiKeyRaw) throw Object.assign(new Error('缺少 apiKey：请在前端「Agent 配置」里填写用户自己的 API Key（支持多个以英文逗号,隔开轮询）'), { code: 'MISSING_API_KEY' })
  if (!endpoint) throw Object.assign(new Error('缺少 endpoint：请在前端「Agent 配置」里填写完整接口 URL'), { code: 'MISSING_ENDPOINT' })
  if (!model) throw Object.assign(new Error('缺少 model：请在前端「Agent 配置」里填写支持多模态的模型名'), { code: 'MISSING_MODEL' })

  const apiKeys = parseApiKeys(apiKeyRaw)
  if (apiKeys.length === 0) {
    throw Object.assign(new Error('apiKey 无效：未提取到有效密钥'), { code: 'INVALID_API_KEY' })
  }

  let url
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('Endpoint 不是合法 URL')
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Endpoint 只支持 http/https')
  const allowedHosts = String(process.env.UPSTREAM_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  if (allowedHosts.length && !allowedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('Endpoint 域名不在 UPSTREAM_HOSTS 白名单')
  }

  const selectedApiKey = apiKeys[(globalKeyRoundRobinCounter++) % apiKeys.length]
  return { apiKey: selectedApiKey, apiKeys, endpoint, model }
}

function calculateRetryDelay(response, hasMultipleKeys = false, defaultMs = 2000) {
  const retryAfterHeader = response?.headers?.get?.('retry-after')
  if (retryAfterHeader) {
    const sec = parseInt(retryAfterHeader, 10)
    if (Number.isFinite(sec) && sec > 0) return sec * 1000
  }
  // 如果有多个备用 Key 轮询，换 Key 时的惩罚延迟更短（400ms~800ms），迅速恢复请求
  if (hasMultipleKeys) {
    return 400 + Math.floor(Math.random() * 400)
  }
  // 单 Key 遭遇 429 限流时拉大退避
  const status = response?.status
  if (status === 429) return defaultMs + 1000 + Math.floor(Math.random() * 500)
  return defaultMs + Math.floor(Math.random() * 400)
}

export async function requestChatCompletion({ endpoint, apiKey, apiKeys, model, body, timeoutMs = 300000 }) {
  const keys = (Array.isArray(apiKeys) && apiKeys.length > 0) ? apiKeys : parseApiKeys(apiKey)
  if (keys.length === 0) keys.push(apiKey)

  const startIndex = (globalKeyRoundRobinCounter++) % keys.length
  // 最大重试次数：至少重试 2 次；如果有多个 key 则保证每个 key 至少能轮询尝试一次（上限 4 次）
  const maxAttempts = Math.min(Math.max(keys.length, 2), 4)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentKey = keys[(startIndex + attempt) % keys.length]
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ model, ...body }),
      })
      const raw = await response.text()
      let data
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = { raw }
      }
      // 401（Key失效/欠费）、403、408、429（限流）以及 5xx 服务端异常可触发换 Key 重试
      const retryable = response.status === 401 || response.status === 403 || response.status === 408 || response.status === 429 || response.status >= 500
      if (attempt < maxAttempts - 1 && retryable) {
        const delayMs = calculateRetryDelay(response, keys.length > 1, 2000)
        const nextKey = keys[(startIndex + attempt + 1) % keys.length]
        console.warn(`[requestChatCompletion] Key (${maskApiKey(currentKey)}) 遇到 HTTP ${response.status}，准备切换至下一个 Key (${maskApiKey(nextKey)})，等待 ${delayMs}ms 间隔后重试 (第 ${attempt + 1}/${maxAttempts} 次)...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      return { response, data, usedApiKey: currentKey }
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error
      const delayMs = keys.length > 1 ? 500 : 2000
      const nextKey = keys[(startIndex + attempt + 1) % keys.length]
      console.warn(`[requestChatCompletion] Key (${maskApiKey(currentKey)}) 请求网络异常(${error?.message})，准备切换 Key (${maskApiKey(nextKey)})，等待 ${delayMs}ms 重试...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

export async function requestAnthropicMessage({ endpoint, apiKey, apiKeys, model, body, timeoutMs = 300000 }) {
  const keys = (Array.isArray(apiKeys) && apiKeys.length > 0) ? apiKeys : parseApiKeys(apiKey)
  if (keys.length === 0) keys.push(apiKey)

  const startIndex = (globalKeyRoundRobinCounter++) % keys.length
  const maxAttempts = Math.min(Math.max(keys.length, 2), 4)

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentKey = keys[(startIndex + attempt) % keys.length]
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': currentKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({ model, ...body }),
      })
      const raw = await response.text()
      let data
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = { raw }
      }
      const retryable = response.status === 401 || response.status === 403 || response.status === 408 || response.status === 429 || response.status >= 500
      if (attempt < maxAttempts - 1 && retryable) {
        const delayMs = calculateRetryDelay(response, keys.length > 1, 2000)
        const nextKey = keys[(startIndex + attempt + 1) % keys.length]
        console.warn(`[requestAnthropicMessage] Key (${maskApiKey(currentKey)}) 遇到 HTTP ${response.status}，准备切换至 Key (${maskApiKey(nextKey)})，等待 ${delayMs}ms 间隔后重试...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        continue
      }
      return { response, data, usedApiKey: currentKey }
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error
      const delayMs = keys.length > 1 ? 500 : 2000
      const nextKey = keys[(startIndex + attempt + 1) % keys.length]
      console.warn(`[requestAnthropicMessage] Key (${maskApiKey(currentKey)}) 网络异常(${error?.message})，准备切换 Key (${maskApiKey(nextKey)})，等待 ${delayMs}ms 重试...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

