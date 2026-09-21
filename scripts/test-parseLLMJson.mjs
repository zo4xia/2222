// ponytail: parseLLMJson 冒烟测试 — 替换 6 处手搓前先验证逻辑等价或更强
import { parseLLMJson } from '../src/lib/parseLLMJson.js'

let pass = 0, fail = 0
function check(name, got, expect) {
  const ok = JSON.stringify(got) === JSON.stringify(expect)
  console.log(`${ok ? '✓' : '✗'} ${name} → ${JSON.stringify(got)}`)
  if (ok) pass++; else { fail++; console.log(`  期望: ${JSON.stringify(expect)}`) }
}

// 1. 直接 JSON.parse
check('合法 JSON', parseLLMJson('{"a":1}'), { a: 1 })

// 2. fence 剥离
check('```json fence', parseLLMJson('```json\n{"a":1}\n```'), { a: 1 })
check('``` fence', parseLLMJson('```\n{"a":1}\n```'), { a: 1 })

// 3. 尾部残缺补全
check('尾部缺 }', parseLLMJson('{"a":1'), { a: 1 })
check('尾部缺 ]}（数组未闭合）', parseLLMJson('{"rows":[{"a":1}]'), { rows: [{ a: 1 }] })

// 4. 截取首个 { 到末个 }
check('含杂质前缀', parseLLMJson('好的，我来回答：\n{"a":1}\n以上。'), { a: 1 })
check('含杂质后缀', parseLLMJson('{"a":1}\n这是结果。'), { a: 1 })

// 5. rows 兜底
check('rows 块兜底', parseLLMJson('好的，开始：\n{"rows":[{"stage":"题目"}]}\n以上。'), { rows: [{ stage: '题目' }] })

// 6. 边界
check('空字符串', parseLLMJson(''), null)
check('null', parseLLMJson(null), null)
check('undefined', parseLLMJson(undefined), null)
check('非 JSON', parseLLMJson('hello world'), null)
check('数组（不是 record）', parseLLMJson('[1,2,3]'), null)  // isRecord 排除数组

// 7. opts.repairTail=false（关闭尾部补全）
check('repairTail=false 时尾部缺 }', parseLLMJson('{"a":1', { repairTail: false }), null)

// 8. opts.rowsFallback=false（关闭 rows 兜底）
check('rowsFallback=false 含杂质前缀仍能截取', parseLLMJson('好的：{"a":1}', { rowsFallback: false }), { a: 1 })

// 9. 复杂真实场景：LLM 输出带 ```json + 杂质
const llmOutput = '好的，我来生成分镜表：\n\n```json\n{\n  "rows": [\n    {"stage":"题目","speech":"读题","board":{"content":"","startDelay":0},"actionSpec":[]}\n  ]\n}\n```\n\n以上是五字段执行表。'
const r = parseLLMJson(llmOutput)
check('LLM 真实输出（带 fence + 杂质前后缀）', r && Array.isArray(r.rows) && r.rows.length === 1, true)

console.log(`\n== 结果: ${pass}/${pass+fail} 通过, ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
