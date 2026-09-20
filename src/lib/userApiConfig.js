/* @qh-core LANE=SHARED POINT=USER_API_CONFIG
 * 用户自提供的 API Key / Endpoint / Model 统一管理
 * ------------------------------------------------------------------
 * 设计目标：
 *   - 不再读取服务端 .env 中的密钥；密钥由用户在前端填写。
 *   - 项目内所有调用 LLM 的入口（识别、Agent B）
 *     共用同一份用户配置，避免散落在各 localStorage key 里。
 *   - 通过 reactive 单例 + storage 事件，实现多页面/多标签同步。
 *
 * 暴露能力：
 *   - userApiConfig           : reactive 配置对象（直接 v-model 绑定）
 *   - loadUserApiConfig()     : 重新从 localStorage 读取（一般无需手动调用）
 *   - saveUserApiConfig(next?) : 持久化当前配置，并广播同步事件
 *   - clearUserApiConfig()    : 清空（用于“退出登录/换号”场景）
 *   - getUserApiSnapshot()    : 返回纯对象快照，用于 fetch body
 *
 * 兼容字段：
 *   - 调用 /api/* 时统一传 apiKey/endpoint/model 三件套
 */

import { reactive } from 'vue'

const STORAGE_KEY = 'qinghuabu.userApiConfig.v2'
const EVENT_NAME = 'qinghuabu:user-api-config-change'

/**
 * 默认测试配置 — 免费测试 API，用户可直接试用，也可在前端覆盖。
 */
export const DEFAULT_USER_API_CONFIG = Object.freeze({
  endpoint: 'https://newapi.prorisehub.com/v1/chat/completions',
  apiKey: 'sk-Wy5cJ9xD0ZnQKGGon0pzuhcGibe29LJArmItW4bwnzPBQJiM',
  model: 'gemini-2.5-flash-lite',
})

export function parseApiKeys(apiKeyInput) {
  if (!apiKeyInput) return []
  return String(apiKeyInput)
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

/**
 * 推荐示例值 — 仅用于 UI placeholder，不参与实际逻辑。
 * 推荐使用支持 OpenAI 标准多模态接口（image_url / input_audio / video_url）的模型。
 */
export const USER_API_PLACEHOLDERS = Object.freeze({
  endpoint: DEFAULT_USER_API_CONFIG.endpoint,
  model: DEFAULT_USER_API_CONFIG.model,
  apiKey: 'sk-...（支持多个密钥，用英文逗号,隔开轮询）',
})

function isChatCompletionsEndpoint(endpoint = '') {
  return /^https?:\/\/.+\/chat\/completions\/?$/i.test(String(endpoint).trim())
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : '',
    }
  } catch {
    return null
  }
}

function sanitize(value = {}) {
  const stored = readStorage() || {}
  // 优先级：显式传入 > localStorage 已存值 > 免费测试默认值。
  const endpoint = String(value?.endpoint || stored.endpoint || DEFAULT_USER_API_CONFIG.endpoint).trim()
  if (!isChatCompletionsEndpoint(endpoint)) return { ...DEFAULT_USER_API_CONFIG }
  return {
    endpoint,
    apiKey: String(value?.apiKey || stored.apiKey || DEFAULT_USER_API_CONFIG.apiKey).trim(),
    model: String(value?.model || stored.model || DEFAULT_USER_API_CONFIG.model).trim(),
  }
}

/** 全局唯一响应式配置实例；任何组件 import 都会拿到同一个对象 */
export const userApiConfig = reactive(sanitize())

/** 持久化当前 reactive 配置；若传入 next 则先合并再保存 */
export function saveUserApiConfig(next = null) {
  if (next && typeof next === 'object') {
    if (typeof next.endpoint === 'string') userApiConfig.endpoint = next.endpoint.trim()
    if (typeof next.apiKey === 'string') userApiConfig.apiKey = next.apiKey.trim()
    if (typeof next.model === 'string') userApiConfig.model = next.model.trim()
  }
  const snapshot = getUserApiSnapshot()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: snapshot }))
  return snapshot
}

/** 强制从 localStorage 重新同步到 reactive 对象 */
export function loadUserApiConfig() {
  const next = sanitize()
  userApiConfig.endpoint = next.endpoint
  userApiConfig.apiKey = next.apiKey
  userApiConfig.model = next.model
  return userApiConfig
}

/** 清空密钥等敏感字段（保留 endpoint/model 便于下次输入） */
export function clearUserApiConfig({ keepEndpoint = true, keepModel = true } = {}) {
  userApiConfig.apiKey = ''
  if (!keepEndpoint) userApiConfig.endpoint = ''
  if (!keepModel) userApiConfig.model = ''
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: getUserApiSnapshot() }))
}

/** 返回纯对象快照，用于 fetch body */
export function getUserApiSnapshot() {
  return {
    endpoint: String(userApiConfig.endpoint || '').trim(),
    apiKey: String(userApiConfig.apiKey || '').trim(),
    model: String(userApiConfig.model || '').trim(),
  }
}

/** 用于校验“是否已配置好可调用上游” */
export function isUserApiReady() {
  const snap = getUserApiSnapshot()
  return Boolean(
    snap.apiKey
    && isChatCompletionsEndpoint(snap.endpoint)
    && snap.model,
  )
}

/**
 * 监听跨标签/同标签的配置变化，自动同步到 reactive 对象。
 * 返回一个取消监听的函数。
 */
export function subscribeUserApiConfig(handler) {
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) {
      loadUserApiConfig()
      handler?.(getUserApiSnapshot())
    }
  }
  const onCustom = (event) => {
    handler?.(event?.detail || getUserApiSnapshot())
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(EVENT_NAME, onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(EVENT_NAME, onCustom)
  }
}

// 启动时同步一次（防止 reactive 默认值与 localStorage 不一致）
loadUserApiConfig()
