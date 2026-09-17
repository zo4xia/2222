import { createApiConfigStore } from "./apiConfigStoreFactory.js"

export const DEFAULT_AGENT_B_API_CONFIG = Object.freeze({
  endpoint: "https://newapi.prorisehub.com/v1/chat/completions",
  apiKey: "sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM",
  model: "gemini-2.5-flash-lite",
})

const store = createApiConfigStore({
  storageKey: "qinghuabu.agentBApiConfig.v3",
  defaultConfig: DEFAULT_AGENT_B_API_CONFIG,
})

export const agentBApiConfig = store.config
export const getAgentBApiSnapshot = store.getSnapshot
export const saveAgentBApiConfig = store.saveConfig
export const parseApiKeys = store.parseApiKeys
export const isAgentBApiReady = store.isReady
