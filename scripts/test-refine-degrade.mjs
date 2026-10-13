#!/usr/bin/env node
/**
 * 验证 knowledgeRefineHandler 上游异常降级：
 * 场景 = prorisehub 直通型中转站（Gemini 原生协议）返回 400 Unknown name "messages"，
 * 期望 = 不再透传 502 弹崩，改为 200 + 原样 handoff + refineOk:false + warning。
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const handoffDir = resolve(root, 'public/handoff')
const pointer = resolve(handoffDir, 'current.json')
const testFile = resolve(handoffDir, 'handoff-20261013-999999-999.json')

// 2026-10-13 第七轮修复：原版测试结束后直接删 current.json 指针且不恢复——
// 跑一次就毁掉用户当前会话状态（真 handoff 文件还在但指针没了）。
// 现改为：指针与手写件双备份 → 测试 → 双恢复；原本不存在才允许删除。
const pointerBackup = existsSync(pointer) ? readFileSync(pointer, 'utf-8') : null
const testFileBackup = existsSync(testFile) ? readFileSync(testFile, 'utf-8') : null
const originalHandoff = {
  problemText: '测试题：3+5=?',
  knowledgeAnalysis: { coreKnowledge: [{ knowledgeId: 'K1', knowledgePoint: '加法' }] },
}

mkdirSync(handoffDir, { recursive: true })
writeFileSync(testFile, JSON.stringify(originalHandoff, null, 2), 'utf8')
writeFileSync(pointer, JSON.stringify({ projectCode: '20261013-999999-999', filename: 'handoff-20261013-999999-999.json', createdAt: new Date().toISOString() }, null, 2), 'utf8')

const PORT = 3199
const server = spawn('node', ['server/productionServer.js'], { cwd: root, env: { ...process.env, PORT }, stdio: 'pipe' })
const serverLog = []
server.stdout.on('data', (d) => serverLog.push(String(d)))
server.stderr.on('data', (d) => serverLog.push(String(d)))

const cleanup = () => {
  try { server.kill('SIGKILL') } catch {}
  // 恢复指针优先：有备份写回备份，无备份（原本就不存在）才允许删除
  try {
    if (pointerBackup != null) writeFileSync(pointer, pointerBackup, 'utf-8')
    else rmSync(pointer, { force: true })
  } catch {}
  // 测试手写件：有备份写回备份，无备份才删（不碰用户同名真实存档）
  try {
    if (testFileBackup != null) writeFileSync(testFile, testFileBackup, 'utf-8')
    else rmSync(testFile, { force: true })
  } catch {}
  // 目录清空判断：原版 require() 在 ESM 下 ReferenceError 被 catch 吞掉，从未生效
  try { if (existsSync(handoffDir) && readdirSync(handoffDir).length === 0) rmSync(handoffDir, { recursive: true }) } catch {}
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(1200)

let pass = 0, fail = 0
const check = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${detail}`) }
}

try {
  // prorisehub 直通型：上游会返回 400 Unknown name "messages"（实测复现过）
  const resp = await fetch(`http://127.0.0.1:${PORT}/api/knowledge/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'https://newapi.prorisehub.com/v1/chat/completions',
      apiKey: 'sk-yuaOvpouXwD7YUaUvtVV4nSkteeqbztsZVZRFcv3wsfyYAsz',
      model: 'gemini-2.5-flash-lite',
    }),
    signal: AbortSignal.timeout(45000),
  })
  const body = await resp.json()
  console.log(`HTTP ${resp.status}  refineOk=${body.refineOk}  warning=${(body.warning || body.error || '').slice(0, 60)}`)
  check('HTTP 状态 = 200（不再 502 弹崩）', resp.status === 200)
  check('ok = true（前端走成功分支）', body.ok === true)
  check('refineOk = false（标记未生效）', body.refineOk === false)
  // 断言口径：降级 handoff 应与 GET /api/handoff（同一 ensureHandoffCompleteness 标准化）一致，证明降级未改数据
  const liveResp = await fetch(`http://127.0.0.1:${PORT}/api/handoff`, { cache: 'no-store' })
  const liveBody = await liveResp.json()
  check('handoff 原样保留（与 /api/handoff 同口径零改动）', JSON.stringify(body.handoff) === JSON.stringify(liveBody.handoff))
  check('warning 提示存在且含原因', typeof body.warning === 'string' && body.warning.length > 10)
  check('协议直通特征被识别', /直通|协议/.test(body.warning || ''))
} catch (e) {
  fail++
  console.error('请求异常:', e?.message)
} finally {
  cleanup()
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
if (serverLog.length) console.log('server log:', serverLog.join('').slice(0, 300))
process.exit(fail ? 1 : 0)
