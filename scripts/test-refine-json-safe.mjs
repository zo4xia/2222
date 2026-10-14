#!/usr/bin/env node
/**
 * test-refine-json-safe.mjs — agentB「优化确认」json 报错修复哨兵
 * 病根：refine/apply 是全 App 仅剩的裸 fetch+resp.json()——非 JSON 响应（平台网关
 * 超时切断/代理 HTML 错误页/连接中途断）直接炸 SyntaxError("Unexpected token...")。
 * 修复：共享 safeJsonFetch（src/lib/safeJsonFetch.js）守卫全部异常路径，永不 throw。
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeJsonFetch } from '../src/lib/safeJsonFetch.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

// ── mock Response ──────────────────────────────────────────────
function mockResp({ status = 200, contentType = 'application/json', body = '' , brokenJson = false }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => (String(k).toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    json: async () => {
      if (brokenJson) throw new SyntaxError('Unexpected token < in JSON at position 0')
      return JSON.parse(body)
    },
  }
}
const noop = async () => {}

console.log('A. safeJsonFetch 异常路径全守卫（夏夏报障的场景）')

// A1 ★夏夏场景：平台网关超时切断 → 2xx 但 HTML 错误页 → 不抛 SyntaxError，给可读报错
{
  let threw = false
  let out = null
  try {
    out = await safeJsonFetch('/api/knowledge/refine', { method: 'POST' }, {
      label: '知识点优化',
      fetchFn: async () => mockResp({ status: 504, contentType: 'text/html', body: '<html><body>504 Gateway Timeout</body></html>' }),
    })
  } catch (e) { threw = true }
  check('A1 网关 504 HTML：不抛异常', !threw)
  check('A1 返回 ok:false + 可读错误（含 HTTP 504）', out?.ok === false && String(out.error).includes('504'), JSON.stringify(out))
}

// A2 2xx 但非 JSON（代理错误页 200 包装）→ 明确"非 JSON 响应"文案
{
  const out = await safeJsonFetch('/x', {}, {
    label: '知识点优化',
    fetchFn: async () => mockResp({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html></html>' }),
  })
  check('A2 2xx 非 JSON：ok:false 且报错含"非 JSON"', out?.ok === false && String(out.error).includes('非 JSON'), JSON.stringify(out))
}

// A3 content-type 是 JSON 但体损坏（连接中途断）→ 不裸抛 SyntaxError
{
  let threw = false
  let out = null
  try {
    out = await safeJsonFetch('/x', {}, {
      label: '应用修缮',
      fetchFn: async () => mockResp({ status: 200, contentType: 'application/json', body: '{"ok":true,"hand', brokenJson: true }),
    })
  } catch (e) { threw = true }
  check('A3 JSON 体损坏：不抛异常', !threw)
  check('A3 返回可读错误（JSON 解析失败口径）', out?.ok === false && /JSON|不完整/.test(String(out.error)), JSON.stringify(out))
}

// A4 正常 JSON 200 → 原样返回数据对象
{
  const out = await safeJsonFetch('/x', {}, {
    label: 't',
    fetchFn: async () => mockResp({ status: 200, contentType: 'application/json', body: '{"ok":true,"handoff":{"a":1}}' }),
  })
  check('A4 正常 JSON 原样返回', out?.ok === true && out?.handoff?.a === 1)
}

// A5 JSON 错误响应（500 {error}）→ 提取服务端 error 文案
{
  const out = await safeJsonFetch('/x', {}, {
    label: 't',
    fetchFn: async () => mockResp({ status: 500, contentType: 'application/json', body: '{"ok":false,"error":"上游超时（60 秒）"}' }),
  })
  check('A5 500 JSON 提取服务端 error', out?.ok === false && out?.error === '上游超时（60 秒）')
}

// A6 超时：挂死上游 → timeoutMs 触发，可读超时文案，且不白等
{
  const t0 = Date.now()
  // 模拟真 fetch 的 abort 行为：signal abort 时以 AbortError reject（挂死=永不 resolve）
  const hangingFetch = (url, opts) => new Promise((_, reject) => {
    opts?.signal?.addEventListener('abort', () => {
      const e = new Error('The operation was aborted')
      e.name = 'AbortError'
      reject(e)
    })
  })
  const out = await safeJsonFetch('/x', {}, {
    label: '知识点优化',
    timeoutMs: 80,
    fetchFn: hangingFetch,
  })
  const elapsed = Date.now() - t0
  check('A6 挂死上游：80ms 内快速返回超时文案', out?.ok === false && String(out.error).includes('超时') && elapsed < 1500, `elapsed=${elapsed}ms err=${out?.error}`)
}

// A7 网络异常（fetch failed）→ 不抛，返回错误对象
{
  let threw = false
  let out = null
  try {
    out = await safeJsonFetch('/x', {}, {
      label: 't',
      fetchFn: async () => { throw new TypeError('fetch failed') },
    })
  } catch (e) { threw = true }
  check('A7 网络异常不抛出', !threw)
  check('A7 返回 fetch failed 文案', out?.ok === false && out?.error === 'fetch failed')
}

// A8 重试：429 一次后成功（Step1 委托口径保留）
{
  let calls = 0
  const out = await safeJsonFetch('/x', {}, {
    retries: 1,
    label: 't',
    fetchFn: async () => {
      calls += 1
      if (calls === 1) return mockResp({ status: 429, contentType: 'application/json', body: '{"error":"rate limited"}' })
      return mockResp({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    },
  })
  check('A8 429 重试一次后成功', out?.ok === true && calls === 2)
}

// A9 响应 null/非对象 → 格式异常兜底
{
  const out = await safeJsonFetch('/x', {}, {
    label: 't',
    fetchFn: async () => mockResp({ status: 200, contentType: 'application/json', body: 'null' }),
  })
  check('A9 null 响应体 → ok:false 格式异常', out?.ok === false)
}

// A10 无 fetch 环境 → 可读错误
{
  const out = await safeJsonFetch('/x', {}, { label: 't', fetchFn: null })
  check('A10 无 fetch 环境不炸', out?.ok === false && String(out.error).includes('fetch'))
}

console.log('B. 接线哨兵（refine/apply 不再裸奔）')

// B1 AgentBDirect：refine + apply 都走 safeJsonFetch；两函数内不再有裸 resp.json()
{
  const src = readFileSync(resolve(root, 'src/agent-b-v2/AgentBDirect.vue'), 'utf8')
  // 剥掉注释行再匹配（修复说明注释里本来就提到"裸 resp.json()"字样，不能误伤）
  const stripComments = (s) => s.replace(/^\s*\/\/.*$/gm, '')
  const refineFn = stripComments(src.slice(src.indexOf('async function refineKnowledge'), src.indexOf('async function applyRefine')))
  const applyFn = stripComments(src.slice(src.indexOf('async function applyRefine'), src.indexOf('function keepOriginalRefine')))
  check('B1 refineKnowledge 用 safeJsonFetch', refineFn.includes("safeJsonFetch('/api/knowledge/refine'"))
  check('B1 refineKnowledge 无裸 resp.json()', !/resp\.json\(\)/.test(refineFn))
  check('B1 applyRefine 用 safeJsonFetch', applyFn.includes("safeJsonFetch('/api/knowledge/apply'"))
  check('B1 applyRefine 无裸 resp.json()', !/resp\.json\(\)/.test(applyFn))
  check('B1 refine 客户端超时 100s（覆盖服务端 61s 预算）', refineFn.includes('timeoutMs: 100000'))
}

// B2 服务端快速失败：refine 上游超时不再重试（总时长 ≤ 61s，杜绝网关切断窗口）
{
  const src = readFileSync(resolve(root, 'server/knowledgeRefineHandler.js'), 'utf8')
  const refineBlock = src.slice(src.indexOf('POST /api/knowledge/refine'))
  check('B2 服务端 refine retryOnAbort: false', /retryOnAbort:\s*false/.test(refineBlock))
}

// B3 Step1Entry 薄委托共享真源（唯一真源原则，不再平行两套实现）
{
  const src = readFileSync(resolve(root, 'src/components/Step1Entry.vue'), 'utf8')
  check('B3 Step1Entry safeFetchJson 委托 safeJsonFetch', src.includes("from '../lib/safeJsonFetch.js'") && /return safeJsonFetch\(url, options/.test(src))
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
