import { existsSync, readdirSync, statSync, unlinkSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isOptions, sendJson } from './http.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '..', 'public')

const CLEANUP_RULES = [
  { dir: 'audio-cache', keep: () => false },
  { dir: 'audio', keep: () => false },
  { dir: 'pic', keep: (name, keepSet) => keepSet.has(name) },
  // @legacy L3-B03 ✅ 已治理 · 保留 .original.json 备份文件
  // 否则 cleanup 后 check-agent/knowledge revert 永久失效
  { dir: 'board-result', keep: (name, keepSet) => keepSet.has(name) || name === 'current.json' || name.endsWith('.original.json') },
  { dir: 'deliverable', keep: (name, keepSet) => keepSet.has(name) || name === 'current.json' || name === 'current.html' || name === 'DELIVERABLE_API_SPEC.md' || name === 'deliverable.schema.json' || name.endsWith('.original.json') },
]

function readPointer(dir, keys, keep) {
  const path = resolve(publicDir, dir, 'current.json')
  if (!existsSync(path)) return
  try {
    const pointer = JSON.parse(readFileSync(path, 'utf8'))
    for (const key of keys) if (pointer?.[key]) keep.add(pointer[key])
  } catch {
    return
  }
}

function collectKeepSet() {
  const keep = new Set()
  readPointer('board-result', ['filename', 'htmlFilename'], keep)
  readPointer('deliverable', ['filename', 'htmlFilename'], keep)
  try {
    const handoff = JSON.parse(readFileSync(resolve(publicDir, 'handoff', 'current.json'), 'utf8'))
    if (handoff?.screenshotUrl) keep.add(handoff.screenshotUrl.split('/').pop())
  } catch {
    // 没有当前截图时无需保留图片文件。
  }
  return keep
}

function cleanupGeneratedFiles() {
  const keep = collectKeepSet()
  const removed = []
  let bytes = 0
  for (const rule of CLEANUP_RULES) {
    const dir = resolve(publicDir, rule.dir)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) {
      if (rule.keep(name, keep)) continue
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
