/**
 * parseLLMJson.js — LLM 输出 JSON 解析的唯一真源
 *
 * ponytail: 合并 6 处手搓 JSON parser（contract.js / check-agent/contract.js /
 * server/recognitionHandler.js / knowledgeRefineHandler.js / checkAgentHandler.js /
 * agentBV2Handler.js），消除"算法分裂 + bug 单点修不全面"风险。
 *
 * 算法阶梯（按尝试顺序）：
 *   1. 直接 JSON.parse
 *   2. 剥 ```json fence 后再 parse
 *   3. 尾部残缺补全（{ 开头但缺 } 或 ]}）后 parse
 *   4. 截取首个 { 到末个 } 后 parse
 *   5. 含 "rows" 块的兜底截取（contract.js 原有，最完整版）
 *
 * 全部失败返回 null，调用方自行处理（recognitionHandler 会降级为 problemText 字符串）。
 *
 * @qh-core LANE=SHARED POINT=PARSE_LLM_JSON
 */

/**
 * 尝试解析 LLM 输出的 JSON 文本，支持 fence 剥离 + 尾部补全 + brace 截取 + rows 兜底
 * @param {string} text LLM 原始输出
 * @param {object} [opts]
 * @param {boolean} [opts.repairTail=true] 是否做尾部残缺补全（{ 缺 } 时补 ]} 或 }）
 * @param {boolean} [opts.rowsFallback=true] 是否做 "rows" 块兜底截取
 * @returns {object|null} 解析出的对象，或 null
 */
export function parseLLMJson(text, opts = {}) {
  const { repairTail = true, rowsFallback = true } = opts
  const source = String(text || '').trim()
  if (!source) return null

  // 剥 ```json fence（兼容 LLM 经常输出 ``` 包裹）
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || source

  // 1. 直接 parse
  let res = tryParse(candidate)
  if (isRecord(res)) return res

  // 2. 尾部残缺补全（{ 开头但缺 } 或 ]}）
  if (repairTail) {
    res = tryParseWithTailRepair(candidate)
    if (isRecord(res)) return res
  }

  // 3. 截取首个 { 到末个 }
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start >= 0 && end > start) {
    res = tryParse(candidate.slice(start, end + 1))
    if (isRecord(res)) return res
  }

  // 4. 含 "rows" 块的兜底截取（最完整版独有，用于 LLM 输出含杂质前缀的场景）
  if (rowsFallback) {
    const rowsIdx = candidate.indexOf('"rows"')
    if (rowsIdx > 0) {
      const subStart = candidate.lastIndexOf('{', rowsIdx)
      if (subStart >= 0) {
        res = tryParse(candidate.slice(subStart))
        if (isRecord(res)) return res
      }
    }
  }

  return null
}

function tryParse(str) {
  try { return JSON.parse(str) } catch { return null }
}

function tryParseWithTailRepair(str) {
  try { return JSON.parse(str) } catch { /* continue */ }
  try {
    let patched = str.trim()
    if (patched.startsWith('{') && !patched.endsWith('}')) {
      // 末尾缺 } 时，判断是否也缺 ]（数组未闭合）
      if (patched.lastIndexOf(']') < patched.lastIndexOf('[')) patched += ']}'
      else patched += '}'
    }
    return JSON.parse(patched)
  } catch { return null }
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// ponytail: 唯一真源，6 处调用方 import 这个，不再手搓本地版
