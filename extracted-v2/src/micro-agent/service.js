/**
 * @qh-core LANE=FRONT POINT=MICRO_AGENT 小 agent 前端服务
 *
 * 调用 /api/micro-agent/refine 接口，处理用户对话微调指令
 */

import { api } from '../services/apiClient.js'
import { userApiConfig } from '../lib/userApiConfig.js'

/**
 * 发送对话微调指令
 * @param {string} message - 用户自然语言指令
 * @param {Object} deliverable - 当前 deliverable（含 rows）
 * @returns {Promise<Object>} { ok, reply, intent, applied, patch? }
 */
export async function refineWithMicroAgent(message, deliverable) {
  const apiConfig = userApiConfig.value || userApiConfig
  return await api.microAgent.refine({
    message,
    deliverable,
    apiKey: apiConfig.apiKey,
    endpoint: apiConfig.endpoint,
    model: apiConfig.model,
  })
}

/**
 * 应用 patch 到 deliverable
 * @param {Object} deliverable - 原 deliverable
 * @param {Object} patch - { rowIndex, changes }
 * @returns {Object} 新 deliverable
 */
export function applyPatch(deliverable, patch) {
  if (!patch || !patch.changes || typeof patch.rowIndex !== 'number') {
    return deliverable
  }
  const newDeliverable = JSON.parse(JSON.stringify(deliverable))
  const row = newDeliverable.rows?.[patch.rowIndex]
  if (!row) return newDeliverable

  for (const [path, value] of Object.entries(patch.changes)) {
    setByPath(row, path, value)
  }
  return newDeliverable
}

/**
 * 按路径设置对象属性
 * 支持 'board.fontSize' / 'actionSpec[0].style.colorId' 等
 */
function setByPath(obj, path, value) {
  const parts = path.match(/[^.\[\]]+/g)
  if (!parts) return
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = current[key]
    if (next === null || typeof next !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[parts[parts.length - 1]] = value
}

export default { refineWithMicroAgent, applyPatch }
