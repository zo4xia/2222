import { reactive } from 'vue'

const STORAGE_KEY = 'qinghuabu.agentBApiConfig.v3'
const DEFAULT_AGENT_B_API_CONFIG = Object.freeze({
  endpoint: 'https://newapi.prorisehub.com/v1/chat/completions',
  apiKey: 'sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM',
  model: 'gemini-2.5-flash-lite',
})

function isChatCompletionsEndpoint(endpoint = '') {
  return /^https?:\/\/.+\/chat\/completions\/?$/i.test(String(endpoint).trim())
}

function readStorage() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    const endpoint = String(value.endpoint || DEFAULT_AGENT_B_API_CONFIG.endpoint).trim()
    if (!isChatCompletionsEndpoint(endpoint)) return { ...DEFAULT_AGENT_B_API_CONFIG }
    return {
      endpoint,
      apiKey: String(value.apiKey || DEFAULT_AGENT_B_API_CONFIG.apiKey).trim(),
      model: String(value.model || DEFAULT_AGENT_B_API_CONFIG.model).trim(),
    }
  } catch {
    return { ...DEFAULT_AGENT_B_API_CONFIG }
  }
}

export const agentBApiConfig = reactive(readStorage())

export function getAgentBApiSnapshot() {
  return {
    endpoint: String(agentBApiConfig.endpoint || '').trim(),
    apiKey: String(agentBApiConfig.apiKey || '').trim(),
    model: String(agentBApiConfig.model || '').trim(),
  }
}

export function saveAgentBApiConfig() {
  const snapshot = getAgentBApiSnapshot()
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

export function isAgentBApiReady() {
  const config = getAgentBApiSnapshot()
  const keys = parseApiKeys(config.apiKey)
  return Boolean(keys.length > 0 && isChatCompletionsEndpoint(config.endpoint) && config.model)
}
