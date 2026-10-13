import { reactive } from 'vue'

const STORAGE_KEY = 'qinghuabu.checkAgentApiConfig.v4'

// ★ Task 18 env 统一化：预设从 env 注入（vite define 桥），Check 模型走专用变量
// AI_CHECK_MODEL，未设时回退 AI_API_MODEL，再回退内置默认；
// 优先级：UI 填写（localStorage）> env 预设 > 内置默认；未设时行为与历史版本一致
const PRESET_ENDPOINT = import.meta.env.AI_API_ENDPOINT
const PRESET_API_KEY = import.meta.env.AI_API_KEY
const PRESET_MODEL = import.meta.env.AI_CHECK_MODEL || import.meta.env.AI_API_MODEL

const DEFAULT_CHECK_AGENT_API_CONFIG = Object.freeze({
  endpoint: PRESET_ENDPOINT || 'https://www.loomex.space/v1/chat/completions',
  apiKey: PRESET_API_KEY || 'sk-eVlHvx23VVyNGqSytiEC3YiJ1QaZnh5RZq1NOJ1EljrE4M3z',
  model: PRESET_MODEL || 'gemini-2.5-flash-lite',
})

function isChatCompletionsEndpoint(endpoint = '') {
  return /^https?:\/\/.+\/chat\/completions\/?$/i.test(String(endpoint).trim())
}

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const endpoint = String(value.endpoint || DEFAULT_CHECK_AGENT_API_CONFIG.endpoint).trim()
    if (!isChatCompletionsEndpoint(endpoint)) return { ...DEFAULT_CHECK_AGENT_API_CONFIG }
    return {
      endpoint,
      apiKey: String(value.apiKey || DEFAULT_CHECK_AGENT_API_CONFIG.apiKey).trim(),
      model: String(value.model || DEFAULT_CHECK_AGENT_API_CONFIG.model).trim(),
    }
  } catch {
    return { ...DEFAULT_CHECK_AGENT_API_CONFIG }
  }
}

export const checkAgentApiConfig = reactive(readStorage())

export function getCheckAgentApiSnapshot() {
  return {
    endpoint: String(checkAgentApiConfig.endpoint || '').trim(),
    apiKey: String(checkAgentApiConfig.apiKey || '').trim(),
    model: String(checkAgentApiConfig.model || '').trim(),
  }
}

export function saveCheckAgentApiConfig() {
  const snapshot = getCheckAgentApiSnapshot()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  return snapshot
}

export function parseApiKeys(apiKeyInput) {
  if (!apiKeyInput) return []
  return String(apiKeyInput)
    .split(/[,，]/)   // ★ Task 20: 全角"，"兼容（粘贴场景整串废 key 防护）
    .map((k) => k.trim())
    .filter(Boolean)
}

export function isCheckAgentApiReady() {
  const config = getCheckAgentApiSnapshot()
  const keys = parseApiKeys(config.apiKey)
  return Boolean(keys.length > 0 && isChatCompletionsEndpoint(config.endpoint) && config.model)
}
