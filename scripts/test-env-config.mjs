#!/usr/bin/env node
/**
 * test-env-config.mjs — Task 18 env 统一化契约测试
 * 覆盖: loadDotEnv 解析 / fish key 池三态 / 三惰性函数 / 前端预设结构
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadDotEnvFile } from '../server/loadDotEnv.js'
import { getApiKeys, getFishModel, getFishReferenceId, getFishBaseUrl } from '../server/fishAudioHandler.js'
import { parseApiKeys as parseHttpApiKeys } from '../server/http.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const root = join(__dirname, '..')
let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

const FISH_ENV_KEYS = ['FISH_AUDIO_API_KEYS', 'FISH_AUDIO_API_KEY', 'FISH_AUDIO_MODEL', 'FISH_AUDIO_REFERENCE_ID', 'FISH_AUDIO_API_BASE_URL']
const saved = {}
for (const k of FISH_ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k] }
const restore = () => { for (const k of FISH_ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } }

// ── 1. loadDotEnvFile 解析契约 ──
console.log('── loadDotEnv 解析 ──')
const dir = mkdtempSync(join(tmpdir(), 'envcfg-'))
const tmpEnv = join(dir, '.env')
ok('基本 KEY=VALUE / 引号剥离 / 注释 / export 前缀 / 行内注释截断', () => {
  writeFileSync(tmpEnv, [
    '# 全行注释',
    'PLAIN=value1',
    'QUOTED="value 2"',
    "SINGLE='value3'",
    'export PREFIXED=value4',
    'INLINE=value5 # 行内注释',
    'BADLINE_NO_EQ',
    '=NOKEY',
    '',
  ].join('\n'))
  const target = {}
  const r = loadDotEnvFile(tmpEnv, target)
  assert.equal(r.loaded, 5)
  assert.equal(target.PLAIN, 'value1')
  assert.equal(target.QUOTED, 'value 2')
  assert.equal(target.SINGLE, 'value3')
  assert.equal(target.PREFIXED, 'value4')
  assert.equal(target.INLINE, 'value5')
})
ok('幂等：已存在键不覆盖', () => {
  const target = { PLAIN: 'already' }
  loadDotEnvFile(tmpEnv, target)
  assert.equal(target.PLAIN, 'already')
})
ok('文件不存在：exists:false 不炸', () => {
  const r = loadDotEnvFile(join(dir, 'nope.env'), {})
  assert.equal(r.exists, false)
  assert.equal(r.loaded, 0)
})

// ── 2. fish key 池三态 ──
console.log('── getApiKeys 三态 ──')
ok('无 env → 空池（71 夏夏拍板 env 化拔源码密钥，key 只从 env 来）', () => {
  const keys = getApiKeys()
  assert.equal(keys.length, 0)
})
ok('复数 env → 完全替代默认池（不混入默认池）', () => {
  process.env.FISH_AUDIO_API_KEYS = 'k-alpha, k-beta'
  const keys = getApiKeys()
  assert.deepEqual(keys, ['k-alpha', 'k-beta'])
})
ok('单数 env 旧名兼容（单数优先，去重合并）', () => {
  process.env.FISH_AUDIO_API_KEY = 'k-solo'
  process.env.FISH_AUDIO_API_KEYS = 'k-alpha,k-beta'
  assert.deepEqual(getApiKeys(), ['k-solo', 'k-alpha', 'k-beta'])
  delete process.env.FISH_AUDIO_API_KEYS
  assert.deepEqual(getApiKeys(), ['k-solo'])
})
delete process.env.FISH_AUDIO_API_KEY

// ── 2.5 全角逗号宽容（Task 20：中文粘贴场景） ──
console.log('── 全角逗号宽容 ──')
ok('getApiKeys：全角，分隔 → 正确切多枚', () => {
  process.env.FISH_AUDIO_API_KEYS = 'k-一，k-二， k-三'
  assert.deepEqual(getApiKeys(), ['k-一', 'k-二', 'k-三'])
})
ok('getApiKeys：半全角混合 → 正确切多枚', () => {
  process.env.FISH_AUDIO_API_KEYS = 'k-a,k-b，k-c'
  assert.deepEqual(getApiKeys(), ['k-a', 'k-b', 'k-c'])
})
ok('getApiKeys：单数变量内多 key 也容错切开', () => {
  delete process.env.FISH_AUDIO_API_KEYS
  process.env.FISH_AUDIO_API_KEY = 's-1，s-2'
  assert.deepEqual(getApiKeys(), ['s-1', 's-2'])
})
ok('http.parseApiKeys：全角，分隔 → 正确切多枚（AI 链轮询分割器）', () => {
  assert.deepEqual(parseHttpApiKeys('a-1，a-2， a-3'), ['a-1', 'a-2', 'a-3'])
  assert.deepEqual(parseHttpApiKeys('a-1,a-2'), ['a-1', 'a-2'])
})
delete process.env.FISH_AUDIO_API_KEY
delete process.env.FISH_AUDIO_API_KEYS

// ── 3. 三惰性函数 ──
console.log('── 惰性 getter ──')
ok('getFishModel：env 未设回退内置 s2.1-pro-free', () => {
  assert.equal(getFishModel(), 's2.1-pro-free')
})
ok('getFishModel：env 设值生效', () => {
  process.env.FISH_AUDIO_MODEL = ' s2.1-pro '
  assert.equal(getFishModel(), 's2.1-pro')
  delete process.env.FISH_AUDIO_MODEL
})
ok('getFishReferenceId：env 未设回退内置 ID', () => {
  assert.equal(getFishReferenceId(), 'fcee4dd834844f28a92b246e0d996104')
})
ok('getFishReferenceId：env 设值生效', () => {
  process.env.FISH_AUDIO_REFERENCE_ID = 'ref-xyz'
  assert.equal(getFishReferenceId(), 'ref-xyz')
  delete process.env.FISH_AUDIO_REFERENCE_ID
})
ok('getFishBaseUrl：env 未设回退 https://api.fish.audio', () => {
  assert.equal(getFishBaseUrl(), 'https://api.fish.audio')
})
ok('getFishBaseUrl：env 设值 + 尾斜杠规范化', () => {
  process.env.FISH_AUDIO_API_BASE_URL = 'https://fish.example.com/'
  assert.equal(getFishBaseUrl(), 'https://fish.example.com')
  delete process.env.FISH_AUDIO_API_BASE_URL
})

restore()

// ── 4. 前端预设结构静态断言（防将来改丢 env 桥） ──
console.log('── 前端 define 桥结构 ──')
ok('userApiConfig: PRESET 三行 + DEFAULT 兜底链', () => {
  const s = readFileSync(join(root, 'src/lib/userApiConfig.js'), 'utf-8')
  assert.ok(s.includes('const PRESET_ENDPOINT = import.meta.env.AI_API_ENDPOINT'))
  assert.ok(s.includes('const PRESET_API_KEY = import.meta.env.AI_API_KEY'))
  assert.ok(s.includes('const PRESET_MODEL = import.meta.env.AI_API_MODEL'))
  assert.ok(s.includes("PRESET_ENDPOINT || 'https://www.loomex.space/v1/chat/completions'"))
})
ok('agentBApiConfig: 同结构', () => {
  const s = readFileSync(join(root, 'src/lib/agentBApiConfig.js'), 'utf-8')
  assert.ok(s.includes('const PRESET_ENDPOINT = import.meta.env.AI_API_ENDPOINT'))
  assert.ok(s.includes("PRESET_MODEL || 'gemini-2.5-flash-lite'"))
})
ok('checkAgentApiConfig: AI_CHECK_MODEL 专用链（回退 AI_API_MODEL）', () => {
  const s = readFileSync(join(root, 'src/lib/checkAgentApiConfig.js'), 'utf-8')
  assert.ok(s.includes('const PRESET_MODEL = import.meta.env.AI_CHECK_MODEL || import.meta.env.AI_API_MODEL'))
})
ok('vite.config: define 桥四项 + process.env 回写', () => {
  const s = readFileSync(join(root, 'vite.config.js'), 'utf-8')
  assert.ok(s.includes("'import.meta.env.AI_API_ENDPOINT'"))
  assert.ok(s.includes("'import.meta.env.AI_CHECK_MODEL'"))
  assert.ok(s.includes('if (process.env[key] === undefined) process.env[key] = value'))
})
ok('productionServer: loadDotEnv 首位 import', () => {
  const s = readFileSync(join(root, 'server/productionServer.js'), 'utf-8')
  assert.ok(s.startsWith("import './loadDotEnv.js'"))
})
ok('五处 key 分割器全角，兼容（fish×1 + http×1 + 前端 config×3）', () => {
  for (const f of ['server/fishAudioHandler.js', 'server/http.js', 'src/lib/userApiConfig.js', 'src/lib/agentBApiConfig.js', 'src/lib/checkAgentApiConfig.js']) {
    const s = readFileSync(join(root, f), 'utf-8')
    assert.ok(s.includes('split(/[,，]/)'), `${f} 缺全角逗号兼容`)
  }
})

rmSync(dir, { recursive: true, force: true })
console.log(`\n结果: ${pass + fail} 用例, ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
