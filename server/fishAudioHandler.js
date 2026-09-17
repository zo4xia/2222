import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const AUDIO_CACHE_DIR = resolve(projectRoot, 'public', 'audio-cache')
const AUDIO_DIR = resolve(projectRoot, 'public', 'audio')
const PIC_DIR = resolve(projectRoot, 'public', 'pic')

const DEFAULT_API_KEYS = [
  'sk-fish-5-R0Y_BCg8RXVY_iaokb0BAWLY1jc9p90F9zaox9FWk',
  'sk-fish-MYToCn_B0xhQT-9H4tV_YXR9aTwWg_-CjHWkXli4iec',
]
const DEFAULT_MODEL = 's2.1-pro-free'
const DEFAULT_REFERENCE_ID = 'fcee4dd834844f28a92b246e0d996104'

let currentKeyIndex = 0

function maskKey(key) {
  if (!key || typeof key !== 'string') return ''
  if (key.length <= 16) return key.slice(0, 6) + '***'
  return `${key.slice(0, 11)}...${key.slice(-6)}`
}

export function getApiKeys() {
  const envKeys = process.env.FISH_AUDIO_API_KEYS
    ? process.env.FISH_AUDIO_API_KEYS.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  if (process.env.FISH_AUDIO_API_KEY && !envKeys.includes(process.env.FISH_AUDIO_API_KEY)) {
    envKeys.unshift(process.env.FISH_AUDIO_API_KEY)
  }
  const all = [...new Set([...envKeys, ...DEFAULT_API_KEYS])]
  return all.length > 0 ? all : DEFAULT_API_KEYS
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function ensureAudioCacheDir() {
  ensureDir(AUDIO_CACHE_DIR)
}

function pad(n, width = 2) {
  return String(n).padStart(width, '0')
}

function genTimestampAudioName(stepIndex) {
  const d = new Date()
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  const stepPart = stepIndex !== undefined && stepIndex !== null ? `-step${Number(stepIndex) + 1}` : ''
  return `audio-${ts}${stepPart}.mp3`
}

function getAudioHash(text, referenceId, model) {
  return createHash('md5')
    .update(`${text || ''}::${referenceId || ''}::${model || ''}`)
    .digest('hex')
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

function readJsonBody(req) {
  return new Promise((resolvePromise, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw) {
        resolvePromise({})
        return
      }
      try {
        resolvePromise(JSON.parse(raw))
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message))
      }
    })
    req.on('error', reject)
  })
}

/**
 * 调用 Fish Audio API 进行语音合成（支持多Key自动轮换与故障转移）
 */
export async function synthesizeSpeech({
  text,
  referenceId = DEFAULT_REFERENCE_ID,
  model = DEFAULT_MODEL,
  apiKey,
  forceRefresh = false,
}) {
  if (!text || typeof text !== 'string') {
    throw new Error('缺少有效文本 text')
  }

  ensureAudioCacheDir()
  // 契约（2026-09-17）：speech 内 **加粗** 是板书触发锚点，TTS 只读纯文字，统一在合成入口剔除
  const cleanText = text.trim().replace(/\*\*([^*\n]+?)\*\*/g, '$1')
  const hash = getAudioHash(cleanText, referenceId, model)
  const filename = `${hash}.mp3`
  const filePath = resolve(AUDIO_CACHE_DIR, filename)
  const audioUrl = `/audio-cache/${filename}`

  // 若已缓存且文件有效，且未强制重新生成，直接返回
  if (!forceRefresh && existsSync(filePath)) {
    try {
      const stat = readFileSync(filePath)
      if (stat && stat.length > 500) {
        return {
          ok: true,
          audioUrl,
          cached: true,
          hash,
          model,
          referenceId,
        }
      }
    } catch {
      // ignore
    }
  }

  // 获取可用 key 列表并自动轮换
  const allKeys = getApiKeys()
  const candidateKeys = apiKey ? [apiKey] : allKeys

  let lastError = null
  const startIndex = apiKey ? 0 : (currentKeyIndex++) % candidateKeys.length

  for (let attempt = 0; attempt < candidateKeys.length; attempt++) {
    const activeKey = candidateKeys[(startIndex + attempt) % candidateKeys.length]
    try {
      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeKey}`,
          'Content-Type': 'application/json',
          'model': model,
        },
        body: JSON.stringify({
          text: cleanText,
          reference_id: referenceId,
          format: 'mp3',
        }),
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      writeFileSync(filePath, buffer)

      return {
        ok: true,
        audioUrl,
        cached: false,
        hash,
        model,
        referenceId,
        usedKey: maskKey(activeKey),
      }
    } catch (err) {
      lastError = err
      console.warn(`[FishAudio] Key (${maskKey(activeKey)}) 请求异常，准备轮换下一个 Key:`, err.message)
      // 继续循环尝试下一个 key
    }
  }

  throw lastError || new Error('所有可用 Fish Audio Key 均调用失败')
}

/**
 * 保存本地音频文件（规范化时间戳命名，并配套存入 public/audio/ 与 public/pic/）
 */
export async function saveSpeechLocally({
  text,
  referenceId = DEFAULT_REFERENCE_ID,
  model = DEFAULT_MODEL,
  apiKey,
  stepIndex,
  forceRefresh = false,
  audioUrl,
}) {
  if (!text || typeof text !== 'string') {
    throw new Error('缺少有效口播文本 text')
  }

  ensureDir(AUDIO_DIR)
  ensureDir(PIC_DIR)

  let buffer = null
  // 若已给出 audioUrl 且未强制刷新，先检查本地文件
  if (audioUrl && !forceRefresh) {
    const cleanRelPath = String(audioUrl).replace(/^\//, '')
    const localCandidate = resolve(projectRoot, 'public', cleanRelPath)
    if (existsSync(localCandidate)) {
      try {
        const stat = readFileSync(localCandidate)
        if (stat && stat.length > 500) {
          buffer = stat
        }
      } catch (_err) {
        // ignore
      }
    }
  }

  // 若无可用 buffer，实时调用合成
  if (!buffer) {
    const synthResult = await synthesizeSpeech({
      text,
      referenceId,
      model,
      apiKey,
      forceRefresh,
    })
    const cacheFile = resolve(projectRoot, 'public', synthResult.audioUrl.replace(/^\//, ''))
    if (existsSync(cacheFile)) {
      buffer = readFileSync(cacheFile)
    }
  }

  if (!buffer || buffer.length < 500) {
    throw new Error('未能生成或读取有效的音频文件')
  }

  const filename = genTimestampAudioName(stepIndex)
  const audioFilePath = resolve(AUDIO_DIR, filename)
  const picFilePath = resolve(PIC_DIR, filename)

  writeFileSync(audioFilePath, buffer)
  try {
    writeFileSync(picFilePath, buffer) // 与截图同目录配套存放一份
  } catch (_err) {
    // ignore
  }

  return {
    ok: true,
    filename,
    urlPath: `/audio/${filename}`,
    audioUrl: `/audio/${filename}`,
    companionPicUrl: `/pic/${filename}`,
    size: buffer.length,
  }
}

/**
 * 轻量并发调度器 (限制并发数为 1~2)
 */
async function mapConcurrent(items, limit, workerFn) {
  if (!items.length) return []
  const results = new Array(items.length)
  let nextIndex = 0
  const concurrency = Math.min(Math.max(1, limit), items.length)
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (nextIndex < items.length) {
      const idx = nextIndex++
      try {
        results[idx] = await workerFn(items[idx], idx)
      } catch (err) {
        results[idx] = { ok: false, error: err.message || String(err) }
      }
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * 处理 TTS 相关 HTTP 接口
 */
export async function handleFishAudioRequest(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1')
  const path = url.pathname.replace(/^\/api\/tts/, '')

  // GET /api/tts/info — 获取当前语音配置信息及轮换池状态
  if (req.method === 'GET' && (path === '/info' || path === '')) {
    const keys = getApiKeys()
    sendJson(res, 200, {
      ok: true,
      provider: 'fish-audio',
      model: DEFAULT_MODEL,
      referenceId: DEFAULT_REFERENCE_ID,
      keyCount: keys.length,
      keys: keys.map(maskKey),
      docs: 'https://docs.fish.audio/developer-guide/getting-started/quickstart',
    })
    return true
  }

  // POST /api/tts/synthesize — 单条文本语音合成（自动轮换 Key）
  if (req.method === 'POST' && path === '/synthesize') {
    try {
      const body = await readJsonBody(req)
      const { text, referenceId, model, apiKey, forceRefresh } = body
      const result = await synthesizeSpeech({ text, referenceId, model, apiKey, forceRefresh })
      sendJson(res, 200, result)
      return true
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      })
      return true
    }
  }

  // POST /api/tts/save-local — 保存本地并返回下载 URL（配套存入 public/audio/ 与 public/pic/）
  if (req.method === 'POST' && path === '/save-local') {
    try {
      const body = await readJsonBody(req)
      const result = await saveSpeechLocally(body)
      sendJson(res, 200, result)
      return true
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error.message || String(error),
      })
      return true
    }
  }

  // POST /api/tts/batch — 批量文本语音合成（一次并发 1-2 个，自动轮换 Key）
  if (req.method === 'POST' && path === '/batch') {
    try {
      const body = await readJsonBody(req)
      const items = Array.isArray(body.items) ? body.items : []
      const referenceId = body.referenceId || DEFAULT_REFERENCE_ID
      const model = body.model || DEFAULT_MODEL
      const concurrency = Math.min(2, Math.max(1, Number(body.concurrency) || 2))

      const results = await mapConcurrent(items, concurrency, async (item, index) => {
        const text = typeof item === 'string' ? item : item.text || item.speech
        const id = item.id !== undefined ? item.id : index + 1
        if (!text) {
          return { id, text: '', ok: false, error: '空文本' }
        }
        try {
          const resItem = await synthesizeSpeech({ text, referenceId, model })
          return { id, text, ok: true, ...resItem }
        } catch (e) {
          return { id, text, ok: false, error: e.message || String(e) }
        }
      })

      sendJson(res, 200, {
        ok: true,
        concurrency,
        items: results,
      })
      return true
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || String(error) })
      return true
    }
  }

  return false
}

export function fishAudioPlugin() {
  return {
    name: 'fish-audio-proxy',
    configureServer(server) {
      ensureAudioCacheDir()
      server.middlewares.use('/api/tts', (req, res, next) => {
        Promise.resolve(handleFishAudioRequest(req, res))
          .then((handled) => {
            if (!handled) next()
          })
          .catch(next)
      })
    },
  }
}
