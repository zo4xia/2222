/**
 * dualStore — localStorage 主存 + IndexedDB 热备 双写工具
 * 消除 AgentBDirect.persistAgentConfig / persistRows 与 service.js 中的重复模式
 */
import { putQhIdbRecord, getQhIdbRecord } from '../lib/simpleIndexedDb.js'

/**
 * 双写：先写 localStorage，再 try/await IDB
 * @param {string} lsKey
 * @param {string} idbKey
 * @param {unknown} data
 * @param {object} idbOptions
 */
export async function dualSave(lsKey, idbKey, data, idbOptions = {}) {
  localStorage.setItem(lsKey, JSON.stringify(data))
  try {
    await putQhIdbRecord(idbKey, data, idbOptions)
  } catch (error) {
    console.warn(`[dualStore] IDB 写入失败 key=${idbKey}`, error)
  }
}

/**
 * 双读：优先 IDB，失败或无值时降级 localStorage
 * @param {string} lsKey
 * @param {string} idbKey
 * @param {(raw: unknown) => T} normalize
 * @param {object} idbOptions
 * @returns {Promise<T | null>}
 */
export async function dualLoad(lsKey, idbKey, normalize = (x) => x, idbOptions = {}) {
  try {
    const record = await getQhIdbRecord(idbKey, idbOptions)
    if (record?.value != null) return normalize(record.value)
  } catch (error) {
    console.warn(`[dualStore] IDB 读取失败 key=${idbKey}，降级 localStorage`, error)
  }
  try {
    const raw = localStorage.getItem(lsKey)
    return raw ? normalize(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/**
 * 仅写 localStorage（无 IDB 备份需求时）
 */
export function lsSave(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

/**
 * 仅读 localStorage
 * @template T
 * @param {string} key
 * @param {(raw: unknown) => T} normalize
 * @param {T} fallback
 */
export function lsLoad(key, normalize = (x) => x, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? normalize(JSON.parse(raw)) : fallback
  } catch {
    return fallback
  }
}
