/**
 * @qh-core LANE=SHARED POINT=STORE_CLIENT 统一 localStorage 封装
 *
 * 替代项目里 8+ 处分散的 localStorage.setItem/getItem 调用
 * 解决 BoardContentLayer.vue 与 Step1Entry.vue 的双写竞争问题
 * 提供 reactive 响应式状态 + 跨 tab 同步
 */

import { ref, watch } from 'vue'

// localStorage key 集中管理
export const STORAGE_KEYS = {
  USER_API_CONFIG: 'qinghuabu.userApiConfig.v2',
  AGENT_B_API_CONFIG: 'qinghuabu.agentBApiConfig.v3',
  CHECK_AGENT_API_CONFIG: 'qinghuabu.checkAgentApiConfig.v3',
  STEP1_AGENT_CONFIG: 'qinghuabu.step1.agentConfig',
  PROBLEM_TEXT: 'qinghuabu.problemText',          // ⚠️ 唯一写入方：Step1Entry
  TOPIC_LAYOUT: 'qinghuabu.topicLayout',          // ⚠️ 唯一写入方：Step1Entry
  CUSTOM_TOPIC_LAYOUT: 'qinghuabu.customTopicLayout',
  LIVE_BOARD_PREVIEW: 'qinghuabu.live-board-preview',
  B_CACHE_PREFIX: 'b-gen:',                        // B 生成 24h 缓存（动态 key）
  DELIVERABLE_SNAPSHOT: 'agent-b-deliverable',
}

/**
 * 安全读取 localStorage（含 JSON 解析容错）
 */
export function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null || raw === undefined) return fallback
    return JSON.parse(raw)
  } catch (err) {
    console.warn('[storeClient] readStorage 解析失败:', key, err?.message)
    return fallback
  }
}

/**
 * 安全写入 localStorage
 */
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.warn('[storeClient] writeStorage 写入失败:', key, err?.message)
    return false
  }
}

/**
 * 删除 localStorage 项
 */
export function removeStorage(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (err) {
    console.warn('[storeClient] removeStorage 删除失败:', key, err?.message)
    return false
  }
}

/**
 * 创建响应式 storage ref
 * 写入会自动同步到 localStorage，跨 tab 通过 storage 事件同步
 */
export function useStorageRef(key, defaultValue = null) {
  const state = ref(readStorage(key, defaultValue))

  watch(state, (newVal) => {
    if (newVal === null || newVal === undefined) {
      removeStorage(key)
    } else {
      writeStorage(key, newVal)
    }
  }, { deep: true })

  // 跨 tab 同步
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        try {
          state.value = e.newValue ? JSON.parse(e.newValue) : defaultValue
        } catch {
          state.value = defaultValue
        }
      }
    })
  }

  return state
}

/**
 * B 生成缓存（带过期时间 24h）
 */
export const B_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function bCacheGet(cacheKey) {
  const fullKey = STORAGE_KEYS.B_CACHE_PREFIX + cacheKey
  const cached = readStorage(fullKey, null)
  if (!cached) return null
  if (cached.timestamp && Date.now() - cached.timestamp > B_CACHE_TTL_MS) {
    removeStorage(fullKey)
    return null
  }
  return cached.value
}

export function bCacheSet(cacheKey, value) {
  const fullKey = STORAGE_KEYS.B_CACHE_PREFIX + cacheKey
  writeStorage(fullKey, { value, timestamp: Date.now() })
}

export function bCacheClear() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEYS.B_CACHE_PREFIX))
  keys.forEach(k => removeStorage(k))
}

export default {
  STORAGE_KEYS,
  readStorage,
  writeStorage,
  removeStorage,
  useStorageRef,
  bCacheGet,
  bCacheSet,
  bCacheClear,
}
