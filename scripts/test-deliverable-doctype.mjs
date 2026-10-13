#!/usr/bin/env node
/**
 * test-deliverable-doctype.mjs — 预览固化 HTML 病头修复契约
 * 病灶：row-player.html 模板（根 + public 双胞胎）首行漏左尖角括号
 * （`!DOCTYPE html>`），浏览器无 DOCTYPE 声明掉怪异模式（盒模型/行高/
 * 字号继承全按 1998 老标准）；renderDeliverableHtml 拿它当模板，
 * 每个固化导出的 deliverable-*.html 都继承病头。
 * 断言：双模板头痊愈、真链产物头健康、防御层补正行为、注入不破坏。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const { renderDeliverableHtml, ensureDoctype } = await import('../server/renderDeliverableHtml.js')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('预览固化 HTML 病头修复（DOCTYPE 尖角括号）')

ok('根模板 row-player.html 首行痊愈（<!DOCTYPE html>）', () => {
  const first = readFileSync(join(root, 'row-player.html'), 'utf-8').split('\n')[0].trim()
  assert.ok(/^<!doctype\s+html\s*>$/i.test(first), `首行应为标准 DOCTYPE，实际：${first}`)
})

ok('public 模板 row-player.html 首行痊愈（双胞胎同修）', () => {
  const first = readFileSync(join(root, 'public/row-player.html'), 'utf-8').split('\n')[0].trim()
  assert.ok(/^<!doctype\s+html\s*>$/i.test(first), `首行应为标准 DOCTYPE，实际：${first}`)
})

ok('真链产物：renderDeliverableHtml 输出以标准 DOCTYPE 开头', () => {
  const html = renderDeliverableHtml({ projectCode: 'T-DOCTYPE', rows: [{ stage: '题目' }] })
  assert.ok(/^\s*<!doctype\s+html\s*>/i.test(html), '固化产物首行必须是 DOCTYPE 声明（标准模式保证）')
})

ok('真链产物：注入数据仍在 </head> 前且不破坏结构', () => {
  const payload = { projectCode: 'T-INJECT', rows: [{ stage: '题目', speech: '你好' }] }
  const html = renderDeliverableHtml(payload)
  assert.ok(html.includes('window.__INITIAL_DELIVERABLE__ = '), '注入脚本应存在')
  const injectIdx = html.indexOf('window.__INITIAL_DELIVERABLE__')
  const headCloseIdx = html.indexOf('</head>')
  const bodyIdx = html.indexOf('<body')
  assert.ok(injectIdx > -1 && headCloseIdx > injectIdx, '注入在 </head> 之前')
  assert.ok(bodyIdx > headCloseIdx, '</head> 后紧跟 <body>，结构未被注入破坏')
  assert.ok(html.includes('"projectCode":"T-INJECT"'), '数据载荷完整')
})

ok('真链产物：JSON < 转义防 </script> 注入保持', () => {
  const html = renderDeliverableHtml({ evil: '<script>alert(1)</script>' })
  const inject = html.slice(html.indexOf('window.__INITIAL_DELIVERABLE__'), html.indexOf('</head>'))
  assert.ok(!inject.includes('<script>alert'), '载荷中的 < 必须被转义为 \\u003c')
  assert.ok(inject.includes('\\u003cscript'), '转义序列应出现')
})

// ── 防御层（堵再生路径）──
ok('防御层：病模板 !DOCTYPE html>（漏尖角括号）→ 原位补正', () => {
  const healed = ensureDoctype('!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n</head>\n<body></body>\n</html>')
  assert.ok(healed.startsWith('<!DOCTYPE html>'), '应原位补上左尖角括号')
  assert.ok(!healed.startsWith('\n'), '不应前置换行（原位补正非前置兜底）')
})

ok('防御层：完全无头模板 → 前置标准声明', () => {
  const healed = ensureDoctype('<html lang="zh-CN">\n<head></head>\n</html>')
  assert.ok(healed.startsWith('<!DOCTYPE html>\n<html'), '应前置 DOCTYPE 声明')
})

ok('防御层：健康模板（大小写/前导空白宽容）→ 原样通过零改动', () => {
  for (const healthy of ['<!DOCTYPE html>\n<html></html>', '<!doctype html >\n<html></html>', '  <!DOCTYPE  html>\n<html></html>']) {
    assert.strictEqual(ensureDoctype(healthy), healthy, '健康输入不应被改动')
  }
})

ok('防御层：空串/非字符串脏输入不炸', () => {
  assert.strictEqual(typeof ensureDoctype(''), 'string')
  assert.ok(ensureDoctype('').startsWith('<!DOCTYPE html>'), '空串前置声明')
})

ok('模板候选链完备：三候选路径静态结构保持（次序与注释契约）', () => {
  const src = readFileSync(join(root, 'server/renderDeliverableHtml.js'), 'utf8')
  assert.ok(src.includes("../row-player.html'"), '候选 1：根模板')
  assert.ok(src.includes("../public/row-player.html'"), '候选 2：public 模板')
  assert.ok(src.includes("../public/deliverable/row-player.html'"), '候选 3：public/deliverable 模板')
  assert.ok(src.indexOf("../row-player.html'") < src.indexOf("../public/row-player.html'"), '根模板优先于 public')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
