import { getCheckAgentApiSnapshot } from '../lib/checkAgentApiConfig.js'
import { polishRowsASR } from './asrPolish.js'

// 本地即时 ASR 润色
export function polishLocally(rows) {
  return polishRowsASR(rows)
}

// 调用 Check Agent，返回建议结果（不自动应用，带本地 ASR 防超时兜底）
export async function checkAgentRows({ rows, mode } = {}) {
  const userSnap = getCheckAgentApiSnapshot()
  const isApiConfigured = Boolean(
    userSnap.apiKey &&
    userSnap.endpoint &&
    userSnap.model &&
    /^https?:\/\/.+\/chat\/completions\/?$/i.test(userSnap.endpoint)
  )

  // 如果用户选择纯快速 ASR 模式，或者未配置大模型 API，直接在前端秒级完成
  if (mode === 'asr_fast' || !isApiConfigured) {
    const local = polishRowsASR(rows)
    return {
      rows: local.rows,
      changes: local.changes,
      model: 'local-asr-engine',
      usage: null,
      checkStatus: 'local_asr_polished',
      checkError: null,
    }
  }

  const body = {
    endpoint: userSnap.endpoint,
    model: userSnap.model,
    apiKey: userSnap.apiKey,
    mode: mode || 'standard',
  }
  if (Array.isArray(rows) && rows.length) {
    body.currentRows = rows
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 30000)
  let response
  let data
  try {
    response = await fetch('/api/check-agent/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
    data = await response.json().catch(() => ({}))
  } catch (error) {
    // 超时或网络异常时，使用本地 ASR 规范引擎兜底，绝不报错中断
    window.clearTimeout(timeoutId)
    const local = polishRowsASR(rows)
    return {
      rows: local.rows,
      changes: local.changes,
      model: 'local-asr-engine',
      usage: null,
      checkStatus: 'local_asr_polished',
      checkError: null,
    }
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok || !data.ok) {
    // 服务端异常时本地 ASR 兜底
    const local = polishRowsASR(rows)
    return {
      rows: local.rows,
      changes: local.changes,
      model: 'local-asr-engine',
      usage: null,
      checkStatus: 'local_asr_polished',
      checkError: null,
    }
  }

  return {
    rows: data.rows,
    changes: Array.isArray(data.changes) ? data.changes : [],
    model: data.model || userSnap.model,
    usage: data.usage || null,
    checkStatus: data.checkStatus || 'ok',
    checkError: data.checkError || null,
  }
}

// 应用 Check 结果：把修改后的 rows 写回文件
export async function applyCheckResult(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new Error('没有可应用的 rows')
  const response = await fetch('/api/check-agent/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) throw new Error(data.error || `应用失败 ${response.status}`)
  return data
}

// 还原到 Check 之前的版本
export async function revertCheckResult() {
  const response = await fetch('/api/check-agent/revert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.ok) throw new Error(data.error || `还原失败 ${response.status}`)
  return data
}
