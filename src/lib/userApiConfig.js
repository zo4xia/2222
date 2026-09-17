/* @qh-core LANE=SHARED POINT=USER_API_CONFIG
 * 用户自提供的 API Key / Endpoint / Model 统一管理（已通过通用工厂收口）
 */
import { createApiConfigStore } from "./apiConfigStoreFactory.js"

export const DEFAULT_USER_API_CONFIG = Object.freeze({
  endpoint: "https://newapi.prorisehub.com/v1/chat/completions",
  apiKey: "sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM",
  model: "gemini-2.5-flash-lite",
})

export const USER_API_PLACEHOLDERS = Object.freeze({
  endpoint: DEFAULT_USER_API_CONFIG.endpoint,
  model: DEFAULT_USER_API_CONFIG.model,
  apiKey: "sk-...（支持多个密钥，用英文逗号,隔开轮询）",
})

const store = createApiConfigStore({
  storageKey: "qinghuabu.userApiConfig.v2",
  defaultConfig: DEFAULT_USER_API_CONFIG,
  eventName: "qinghuabu:user-api-config-change",
})

export const userApiConfig = store.config
export const parseApiKeys = store.parseApiKeys
export const loadUserApiConfig = store.loadConfig
export const saveUserApiConfig = store.saveConfig
export const clearUserApiConfig = store.clearConfig
export const getUserApiSnapshot = store.getSnapshot
export const isUserApiReady = store.isReady
export const subscribeUserApiConfig = store.subscribe
