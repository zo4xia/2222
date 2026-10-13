/**
 * Task 30 测试：第一步图片上传"一直卡"防线（识别超时 / 超时快速失败 / 上传压缩 / 客户端超时）
 *
 * 病灶（夏夏 2026-10-13："第一步图片上传…为什么我一直卡"）：
 *   ① 识别是全链最重的多模态调用（图片+知识库上下文+全量 JSON 输出，视觉模型常见 60-180 秒），
 *      却只给 60 秒超时（B 生成 90/300 秒）——慢模型每次都是转圈两分钟后 504，第一步永远走不完，
 *      排版根本没机会跑（用户看到的"排版坏掉了"其实是识别死在半路）。
 *   ② 超时后还重试一轮（60×2=122s）——超出 Vercel maxDuration 120s 函数预算，函数被平台击杀，
 *      浏览器拿到的是平台错误而不是我们的 504 文案。
 *   ③ 上传原图无压缩——手机照片 base64 后 4~10MB，上传慢 + 超 Vercel 4.5MB 函数体上限（413）。
 *   ④ 客户端 fetch 无超时——理论上可以无限等。
 * 修复承诺（本测试守卫）：
 *   服务端 110s 单次（Vercel 120s 预算内）+ 超时快速失败（retryOnAbort:false，慢上游重试=再白等一程）；
 *   客户端 130s AbortController 主动断 + 友好文案；上传前压到长边≤1600px/JPEG 0.85（失败回退原图）。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

const handler = read('server/recognitionHandler.js')
const http = read('server/http.js')
const client = read('src/services/recognitionClient.js')
const step1 = read('src/components/Step1Entry.vue')
const vercel = read('vercel.json')

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${detail}`) }
}

/* ---------- 1) 服务端超时：60 → 110 秒（Vercel 120s 预算内单次完成） ---------- */
check('识别超时 110 秒（旧 60 秒已废）', /timeoutMs:\s*110000/.test(handler) && !/timeoutMs:\s*60000/.test(handler))
check('识别超时快速失败（retryOnAbort: false——慢上游重试只是再白等一程）', /retryOnAbort:\s*false/.test(handler))
check('超时根因注释在档（"第一步一直卡"留痕）', /第一步一直卡/.test(handler))

/* ---------- 2) http.js：retryOnAbort 参数（默认 true——其他调用方行为不变） ---------- */
check('requestChatCompletion 签名带 retryOnAbort（默认 true）',
  /requestChatCompletion\(\{\s*endpoint,\s*apiKey,\s*apiKeys,\s*model,\s*body,\s*timeoutMs\s*=\s*300000,\s*retryOnAbort\s*=\s*true\s*\}\)/.test(http))
check('超时快速失败分支（isAbort && !retryOnAbort → throw）', /if\s*\(isAbort\s*&&\s*!retryOnAbort\)\s*throw\s*error/.test(http))
check('其他调用方零改动（B 生成 90s/300s、check 25s、knowledgeRefine 60s 保持）',
  /timeoutMs:\s*90000/.test(read('server/agentBV2Handler.js')) && /timeoutMs:\s*25000/.test(read('server/checkAgentHandler.js')))

/* ---------- 3) 504 文案：可行动的报错（说人话，指出路） ---------- */
check('超时报错文案可行动（换更快模型/稍后重试）', /单次 110 秒/.test(handler) && /换更快的视觉模型/.test(handler))
check('旧文案"连续两次请求均超时"已废（不再误导）', !/连续两次请求均超时/.test(handler))

/* ---------- 4) 客户端：fetch 超时 + 友好错误 ---------- */
check('客户端 130 秒 AbortController（服务端 110s + 缓冲，绝不无限等）',
  /REQUEST_TIMEOUT_MS\s*=\s*130000/.test(client) && /signal:\s*controller\.signal/.test(client))
check('客户端超时友好文案（130 秒 + 换模型指引）', /识别请求超时/.test(client) && /请重试或换更快的模型/.test(client))
check('timeout 定时器必清（finally clearTimeout，不泄漏）', /finally\s*\{[\s\S]{0,120}clearTimeout\(timeoutId\)/.test(client))

/* ---------- 5) 上传压缩：payload 瘦身 ---------- */
check('compressImageToDataUrl 导出（长边≤1600px、JPEG 0.85）',
  /export async function compressImageToDataUrl/.test(client) && /maxLongEdge\s*=\s*1600/.test(client) && /quality\s*=\s*0\.85/.test(client))
check('小图直传（≤1600px 不重编码，保真）', /long\s*<=\s*maxLongEdge\)\s*return origDataUrl/.test(client))
check('压缩失败回退原图（绝不让上传死在压缩上）', /catch\s*\(_\)\s*\{[\s\S]{0,80}return readOriginal\(\)/.test(client))
check('压缩产物比原大才采用（防倒退）', /out\.length\s*<\s*origDataUrl\.length\s*\?\s*out\s*:\s*origDataUrl/.test(client))
check('Step1Entry 上传链改用压缩（旧 fileToDataUrl 直传已废）',
  /sourceImageDataUrl\.value\s*=\s*await compressImageToDataUrl\(file\)/.test(step1) &&
  !/sourceImageDataUrl\.value\s*=\s*await fileToDataUrl\(file\)/.test(step1))
check('import 同步（compressImageToDataUrl 进 Step1Entry 导入表）', /import\s*\{[^}]*compressImageToDataUrl[^}]*\}\s*from\s*'..\/services\/recognitionClient'/.test(step1))

/* ---------- 6) Vercel 函数预算对齐 ---------- */
const maxDuration = Number(vercel.match(/api\/recognition\/problem\.js[\s\S]{0,120}?maxDuration"?\s*:\s*(\d+)/)?.[1] || 0)
check('Vercel recognition maxDuration ≥ 120（110s 单次尝试 + 响应余量装得下）', maxDuration >= 120, `实际=${maxDuration}`)

/* ---------- 汇总 ---------- */
console.log(`\n[step1-robustness] ${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
