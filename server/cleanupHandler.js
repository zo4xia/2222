import { existsSync, readdirSync, statSync, unlinkSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isOptions, sendJson } from './http.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

/* ★ Task 23 = R8-② cleanup 双误删修复
 * 原病灶：
 *   1. handoff/current.json 是「指针」（仅 projectCode/filename/createdAt），旧代码
 *      直接当实体读 screenshotUrl → 恒 undefined → 活跃截图必被误删（Task 22 起
 *      该截图还是播放页背景图，误删 = 背景直接 404）
 *   2. deliverable 存档 payload 里的 screenshotUrl / rows[].audioUrl 引用未进
 *      keep 集合；且 audioUrl 只认 /audio/ 前缀，/audio-cache/ 缓存音频全裸奔
 *   3. audio-cache 目录规则 keep: () => false 无条件全清——正在播放的缓存音频
 *      被删（播放中断 + 下次重合成白白多耗上游 TTS 调用）
 */

// ★ 缓存音频年龄保护：48h 内的 audio-cache 文件视为活跃（播放中/刚生成中间态）
const AUDIO_CACHE_MAX_AGE_MS = 48 * 60 * 60 * 1000

const CLEANUP_RULES = [
  { dir: 'audio-cache', keep: (name, keepSet, dirPath) => keepSet.has(name) || isFreshFile(dirPath, name) },
  { dir: 'audio', keep: (name, keepSet) => keepSet.has(name) },
  { dir: 'pic', keep: (name, keepSet) => keepSet.has(name) },
  { dir: 'board-result', keep: (name, keepSet) => keepSet.has(name) || name === 'current.json' },
  { dir: 'deliverable', keep: (name, keepSet) => keepSet.has(name) || name === 'current.json' || name === 'current.html' },
]

function isFreshFile(dirPath, name) {
  try {
    const stat = statSync(resolve(dirPath, name))
    return Date.now() - stat.mtimeMs < AUDIO_CACHE_MAX_AGE_MS
  } catch {
    return false // stat 读不到就不保，交给 unlink 自己容错
  }
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** 收本仓静态前缀（/audio/ /audio-cache/ /pic/）URL 指向的文件名进 keep 集合 */
function addUrlName(keep, url) {
  if (typeof url !== 'string' || !url) return
  if (/^\/(audio|audio-cache|pic)\//.test(url.trim())) keep.add(url.trim().split('/').pop())
}

function collectKeepSet(basePath = publicDir) {
  const keep = new Set()

  // board-result / deliverable 指针文件本身 + 其指向的存档实体（filename/htmlFilename）
  for (const dir of ['board-result', 'deliverable']) {
    const pointer = readJsonSafe(resolve(basePath, dir, 'current.json'))
    if (pointer?.filename) keep.add(pointer.filename)
    if (pointer?.htmlFilename) keep.add(pointer.htmlFilename)
  }

  // ★ 修复 1：handoff 指针解引用——读实体拿 screenshotUrl（活跃截图/播放页背景图）
  const handoffPointer = readJsonSafe(resolve(basePath, 'handoff', 'current.json'))
  if (handoffPointer?.filename) {
    keep.add(handoffPointer.filename)
    const handoffEntity = readJsonSafe(resolve(basePath, 'handoff', handoffPointer.filename))
    addUrlName(keep, handoffEntity?.screenshotUrl)
  }

  // ★ 修复 2：交付物存档引用链——payload.screenshotUrl（背景图）+ rows[].audioUrl
  // （/audio/ 与 /audio-cache/ 两前缀都收；优先用指针内嵌全量，退实体文件兜底）
  const deliverablePointer = readJsonSafe(resolve(basePath, 'deliverable', 'current.json'))
  const deliverablePayload = deliverablePointer?.deliverable
    || (deliverablePointer?.filename
      ? readJsonSafe(resolve(basePath, 'deliverable', deliverablePointer.filename))
      : null)
  addUrlName(keep, deliverablePayload?.screenshotUrl)
  const rows = Array.isArray(deliverablePayload?.rows) ? deliverablePayload.rows : []
  for (const row of rows) addUrlName(keep, row?.audioUrl)

  return keep
}

function cleanupGeneratedFiles(basePath = publicDir) {
  const keep = collectKeepSet(basePath)
  const removed = []
  let bytes = 0
  for (const rule of CLEANUP_RULES) {
    const dir = resolve(basePath, rule.dir)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (rule.keep(name, keep, dir)) continue
      const path = resolve(dir, name)
      try {
        const stat = statSync(path)
        if (!stat.isFile()) continue
        bytes += stat.size
        unlinkSync(path)
        removed.push(`${rule.dir}/${name}`)
      } catch {
        // 单个损坏或正在使用的文件不应阻断其他文件清理。
      }
    }
  }
  return { count: removed.length, bytes, files: removed }
}

export function handleCleanupRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  if (!['/', ''].includes(url.pathname)) return false
  if (req.method !== 'POST') {
    sendJson(req, res, 405, { ok: false, error: '只允许 POST 请求' })
    return true
  }
  try {
    const result = cleanupGeneratedFiles()
    return sendJson(req, res, 200, { ok: true, ...result })
  } catch (error) {
    return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
  }
}

export function cleanupPlugin() {
  return {
    name: 'cleanup-generated-files',
    configureServer(server) {
      server.middlewares.use('/api/cleanup', (req, res, next) => {
        Promise.resolve(handleCleanupRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}

// 供测试与上层复用
export { cleanupGeneratedFiles, collectKeepSet }
