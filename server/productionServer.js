import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAgentBV2Request } from './agentBV2Handler.js'
import {
  handleCheckAgentRequest,
  handleCheckApplyRequest,
  handleCheckRevertRequest,
} from './checkAgentHandler.js'
import { handleCleanupRequest } from './cleanupHandler.js'
import { handleDeliverableRequest } from './deliverableStoreHandler.js'
import { handleFishAudioRequest } from './fishAudioHandler.js'
import { handleHandoffStoreRequest } from './handoffStoreHandler.js'
import { handleKnowledgeRefineRequest } from './knowledgeRefineHandler.js'
import { handleRecognitionRequest } from './recognitionHandler.js'
import { AGENT_A_KNOWLEDGE_BASE } from './docReferences.js'
import { handleScreenshotStoreRequest } from './screenshotStoreHandler.js'
import { sendJson } from './http.js'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distRoot = resolve(projectRoot, 'dist')
const publicRoot = resolve(projectRoot, 'public')
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '0.0.0.0'

function withUrl(req, pathname, callback) {
  const originalUrl = req.url
  req.url = pathname
  return Promise.resolve(callback()).finally(() => { req.url = originalUrl })
}

async function dispatchApi(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname
  const knowledge = { knowledgeBase: AGENT_A_KNOWLEDGE_BASE }

  if (pathname === '/api/recognition/problem') return handleRecognitionRequest(req, res, knowledge)
  if (pathname === '/api/agent-b-v2/generate') return handleAgentBV2Request(req, res)
  if (pathname === '/api/check-agent/check') return handleCheckAgentRequest(req, res)
  if (pathname === '/api/check-agent/apply') return handleCheckApplyRequest(req, res)
  if (pathname === '/api/check-agent/revert') return handleCheckRevertRequest(req, res)
  if (pathname === '/api/cleanup') return withUrl(req, '/', () => handleCleanupRequest(req, res))
  if (pathname === '/api/handoff' || pathname === '/api/handoff/list') {
    const suffix = pathname === '/api/handoff/list' ? '/list' : '/'
    return withUrl(req, suffix, () => handleHandoffStoreRequest(req, res))
  }
  if (pathname.startsWith('/api/knowledge/')) {
    const suffix = pathname.slice('/api/knowledge'.length)
    return withUrl(req, suffix, () => handleKnowledgeRefineRequest(req, res))
  }
  if (pathname.startsWith('/api/deliverable')) {
    const suffix = pathname.slice('/api/deliverable'.length) || '/'
    return withUrl(req, `${suffix}${new URL(req.url, 'http://localhost').search}`, () => handleDeliverableRequest(req, res))
  }
  if (pathname.startsWith('/api/tts')) return handleFishAudioRequest(req, res)
  if (pathname === '/api/screenshot') return withUrl(req, '/', () => handleScreenshotStoreRequest(req, res))
  return false
}

function safeFile(root, requestPath) {
  const requestRelative = decodeURIComponent(requestPath).replace(/^\/+/, '')
  const filePath = resolve(root, normalize(requestRelative))
  const relativePath = relative(root, filePath)
  return relativePath && !relativePath.startsWith('..') && !relativePath.includes(':') ? filePath : null
}

function contentType(filePath) {
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }[extname(filePath).toLowerCase()] || 'application/octet-stream'
}

function serveStatic(req, res) {
  const pathname = new URL(req.url, 'http://localhost').pathname
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const publicPrefixes = ['/audio/', '/audio-cache/', '/board-result/', '/deliverable/', '/handoff/', '/pic/']
  const isPublicPath = publicPrefixes.some((prefix) => pathname.startsWith(prefix))
  const root = isPublicPath ? publicRoot : distRoot
  const relativePath = pathname
  let filePath = safeFile(root, relativePath)
  let stat = filePath && existsSync(filePath) ? statSync(filePath) : null
  if (!filePath || !stat || !stat.isFile()) {
    if (root !== distRoot || pathname !== '/') return false
    filePath = join(distRoot, 'index.html')
    stat = existsSync(filePath) ? statSync(filePath) : null
    if (!stat || !stat.isFile()) return false
  }
  res.statusCode = 200
  res.setHeader('Content-Type', contentType(filePath))
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'no-cache')
  if (req.method === 'HEAD') return res.end()
  // P0-04：整文件 readFileSync 会把大交付页/音频整份打进内存（1h2g 下即 OOM 面），改流式直出
  return createReadStream(filePath).pipe(res)
}

const server = createServer(async (req, res) => {
  try {
    if (req.url?.startsWith('/api/')) {
      const handled = await dispatchApi(req, res)
      if (handled !== false) return
      return sendJson(req, res, 404, { ok: false, error: 'API 路径不存在' })
    }
    if (serveStatic(req, res)) return
    return sendJson(req, res, 404, { ok: false, error: '资源不存在' })
  } catch (error) {
    if (!res.headersSent) sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    else res.destroy(error)
  }
})

server.listen(port, host, () => {
  console.log(`production server listening on http://${host}:${port}`)
})
