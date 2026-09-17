import { createApiConfigStore } from "./apiConfigStoreFactory.js"

export const DEFAULT_CHECK_AGENT_API_CONFIG = Object.freeze({
  endpoint: "https://newapi.prorisehub.com/v1/chat/completions",
  apiKey: "sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM",
  model: "gemini-3.1-flash-lite",
})

const store = createApiConfigStore({
  storageKey: "qinghuabu.checkAgentApiConfig.v3",
  defaultConfig: DEFAULT_CHECK_AGENT_API_CONFIG,
})

export const checkAgentApiConfig = store.config
export const getCheckAgentApiSnapshot = store.getSnapshot
export const saveCheckAgentApiConfig = store.saveConfig
export const parseApiKeys = store.parseApiKeys
export const isCheckAgentApiReady = store.isReady
