/**
 * @qh-core LANE=SHARED POINT=API_CLIENT 统一 fetch 封装
 *
 * 替代项目里 14+ 处分散的 fetch 调用，统一超时/错误/重试策略
 * 不动 A/B 主链路业务逻辑，仅做封装层
 */

const DEFAULT_TIMEOUT_MS = 30000  // 默认 30s
const LONG_TIMEOUT_MS = 170000    // 长生成 170s（适配 Vercel 180s maxDuration）

/**
 * 底层 fetch 封装，带超时 + 错误归一化
 */
export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal: externalSignal,
    headers: extraHeaders = {},
  } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort())
  }

  try {
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      signal: controller.signal,
    }
    if (body !== undefined && body !== null) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(path, fetchOptions)
    const contentType = response.headers.get('Content-Type') || ''
    let data
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => ({}))
    } else {
      data = await response.text().catch(() => '')
    }

    if (!response.ok) {
      const err = new Error(
        (data && typeof data === 'object' && (data.error || data.message)) ||
        `HTTP ${response.status}`
      )
      err.code = data?.code
      err.statusCode = response.status
      err.payload = data
      throw err
    }

    return data
  } catch (err) {
    if (err.name === 'AbortError') {
      const timeoutErr = new Error(`请求超时（${timeoutMs}ms）`)
      timeoutErr.code = 'TIMEOUT'
      throw timeoutErr
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * API 调用门面：按业务模块分组
 */
export const api = {
  // 识别
  recognition: {
    problem: (payload) => apiFetch('/api/recognition/problem', {
      method: 'POST', body: payload, timeoutMs: 60000,
    }),
  },

  // Agent B 生成
  agentB: {
    generate: (payload) => apiFetch('/api/agent-b-v2/generate', {
      method: 'POST', body: payload, timeoutMs: LONG_TIMEOUT_MS,
    }),
  },

  // Check Agent
  checkAgent: {
    check: (payload) => apiFetch('/api/check-agent/check', {
      method: 'POST', body: payload, timeoutMs: 30000,
    }),
    apply: (payload) => apiFetch('/api/check-agent/apply', { method: 'POST', body: payload }),
    revert: () => apiFetch('/api/check-agent/revert', { method: 'POST' }),
  },

  // Handoff 存档
  handoff: {
    get: () => apiFetch('/api/handoff'),
    post: (handoff) => apiFetch('/api/handoff', { method: 'POST', body: { handoff } }),
    list: () => apiFetch('/api/handoff/list'),
  },

  // 截图存档
  screenshot: {
    save: (imageBase64) => apiFetch('/api/screenshot', { method: 'POST', body: { imageBase64 } }),
  },

  // 交付物
  deliverable: {
    get: (id) => apiFetch(`/api/deliverable${id ? `?id=${encodeURIComponent(id)}` : ''}`),
    list: () => apiFetch('/api/deliverable/list'),
    post: (deliverable) => apiFetch('/api/deliverable', { method: 'POST', body: { deliverable } }),
    apiSpec: () => apiFetch('/api/deliverable/api-spec'),
    updateSync: (payload) => apiFetch('/api/deliverable/update-sync', { method: 'POST', body: payload }),
    updateLayout: (payload) => apiFetch('/api/deliverable/update-layout', { method: 'POST', body: payload }),
  },

  // 知识点修缮
  knowledge: {
    refine: (payload) => apiFetch('/api/knowledge/refine', {
      method: 'POST', body: payload, timeoutMs: 60000,
    }),
    revert: () => apiFetch('/api/knowledge/revert', { method: 'POST' }),
  },

  // TTS 合成
  tts: {
    info: () => apiFetch('/api/tts/info'),
    synthesize: (payload) => apiFetch('/api/tts/synthesize', { method: 'POST', body: payload }),
    saveLocal: (payload) => apiFetch('/api/tts/save-local', { method: 'POST', body: payload }),
    batch: (payload) => apiFetch('/api/tts/batch', { method: 'POST', body: payload }),
  },

  // 清理
  cleanup: {
    post: () => apiFetch('/api/cleanup', { method: 'POST' }),
  },

  // 健康
  health: {
    get: () => apiFetch('/api/health'),
  },

  // 小 agent 对话微调（新增）
  microAgent: {
    refine: (payload) => apiFetch('/api/micro-agent/refine', {
      method: 'POST', body: payload, timeoutMs: 60000,
    }),
  },
}

export default api
