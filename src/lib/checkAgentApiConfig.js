import { reactive } from 'vue'

const STORAGE_KEY = 'qinghuabu.checkAgentApiConfig.v3'
const DEFAULT_CHECK_AGENT_API_CONFIG = Object.freeze({
  endpoint: 'https://newapi.prorisehub.com/v1/chat/completions',
  apiKey: 'sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM',
  model: 'gemini-3.1-flash-lite',
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
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

export function isCheckAgentApiReady() {
  const config = getCheckAgentApiSnapshot()
  const keys = parseApiKeys(config.apiKey)
  return Boolean(keys.length > 0 && isChatCompletionsEndpoint(config.endpoint) && config.model)
}
