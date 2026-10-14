/**
 * safeJsonFetch.js — 客户端 fetch + JSON 响应的安全封装（唯一真源）
 * ------------------------------------------------------------------
 * ★ 2026-10-14 由来（夏夏实测"agentB 点优化确认出现 json 报错"）：
 *   全 App 客户端 fetch 里，AgentBDirect 的 refine/apply 是仅剩的两个裸
 *   `await resp.json()`——一旦平台网关超时切断/代理吐 HTML 错误页/连接中途断，
 *   resp.json() 直接炸 SyntaxError("Unexpected token '<'...")，用户看到的就是
 *   一条裸 JSON 解析报错。B 生成(service.js)、Check(check-agent/service.js)、
 *   识别(recognitionClient.js) 都早已守卫，唯独 refine/apply 裸奔。
 *
 *   本模块把 Step1Entry 组件内已验证的 safeFetchJson 升格为共享真源：
 *   - 非 JSON 响应（2xx 或错误页）→ 友好错误文案 + HTTP 状态，绝不抛 SyntaxError
 *   - JSON 体损坏（连接中途断）→ 同上兜底
 *   - timeoutMs 超时 → AbortController + 可读超时文案（防无限挂死）
 *   - retries 重试（5xx/404/429/网络异常，带退避）
 *
 * 返回约定：成功 → 服务端 JSON 对象原样返回（调用方按 data.ok 分支）；
 *           失败 → { ok:false, error:'人类可读原因' }。永不 throw。
 */

const DEFAULT_TIMEOUT_MS = 0 // 0 = 不设客户端超时（调用方按需传）

export async function safeJsonFetch(url, options = {}, config = {}) {
  const {
    retries = 0,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    label = '请求',
    fetchFn = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null,
  } = config
  if (!fetchFn) return { ok: false, error: `${label}：当前环境不支持 fetch` }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = timeoutMs > 0 ? new AbortController() : null
    const timerId = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null
    try {
      const resp = await fetchFn(url, controller ? { ...options, signal: controller.signal } : options)
      const contentType = resp.headers?.get?.('content-type') || ''

      if (!resp.ok) {
        let errText = ''
        if (contentType.includes('application/json')) {
          const errJson = await resp.json().catch(() => null)
          errText = errJson?.error || errJson?.message || `HTTP ${resp.status}`
        } else {
          const raw = await resp.text().catch(() => '')
          errText = raw.slice(0, 120) || `HTTP ${resp.status}`
          if (raw) console.warn(`[safeJsonFetch] ${label} HTTP ${resp.status} 非 JSON 错误响应：`, raw.slice(0, 200))
        }
        if (attempt < retries && (resp.status >= 500 || resp.status === 404 || resp.status === 429)) {
          const waitMs = resp.status === 429 ? 2500 : 1500
          console.warn(`[safeJsonFetch] ${label} 遇到 HTTP ${resp.status}，等待 ${waitMs}ms 后重试...`)
          await new Promise((r) => setTimeout(r, waitMs))
          continue
        }
        return { ok: false, error: errText || `HTTP ${resp.status}` }
      }

      if (!contentType.includes('application/json')) {
        const raw = await resp.text().catch(() => '')
        console.warn(`[safeJsonFetch] ${label} 2xx 但非 JSON 响应（HTTP ${resp.status}）：`, raw.slice(0, 200))
        return {
          ok: false,
          error: `${label}：服务返回了非 JSON 响应（HTTP ${resp.status}）——多为网关超时或代理错误页，请稍后重试`,
        }
      }

      // content-type 是 JSON 但体损坏（连接中途被切断）也走兜底，不裸抛 SyntaxError
      let data
      try {
        data = await resp.json()
      } catch (err) {
        console.warn(`[safeJsonFetch] ${label} 响应体 JSON 损坏：`, err?.message)
        return { ok: false, error: `${label}：响应数据不完整（JSON 解析失败），可能连接被中途切断，请重试` }
      }
      if (!data || typeof data !== 'object') {
        return { ok: false, error: `${label}：响应格式异常` }
      }
      return data
    } catch (err) {
      if (timerId && err?.name === 'AbortError') {
        return { ok: false, error: `${label}请求超时（${Math.round(timeoutMs / 1000)} 秒），请稍后重试` }
      }
      if (attempt < retries) {
        console.warn(`[safeJsonFetch] ${label} 请求异常，等待 1500ms 后重试...`, err?.message)
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      return { ok: false, error: err?.message || '网络连接异常' }
    } finally {
      if (timerId) clearTimeout(timerId)
    }
  }
  return { ok: false, error: `${label}：请求未能完成` }
}
