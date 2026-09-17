/* handoff 实体文件存档 — public/handoff/ 下是唯一真实来源
   每次生成独立文件，带时间戳：handoff-YYYYMMDD-HHMMSS-SSS.json
   文件名 = 项目编码，全链路用同一个编码识别
   current 指针文件记录当前活跃的文件名
   A 写、修缮层改写、B 读，三者完全解耦 */

import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isOptions, readJsonBody, sendJson } from './http.js'
// 画布参数唯一真源在 src/services/stepHandoff.js，此处只复用，不复制字面值
import { buildCanvasParams } from '../src/services/stepHandoff.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const PUBLIC_DIR = resolve(projectRoot, 'public')
const HANDOFF_DIR = resolve(PUBLIC_DIR, 'handoff')
const CURRENT_POINTER = resolve(HANDOFF_DIR, 'current.json')

function ensureHandoffDir() {
  if (!existsSync(HANDOFF_DIR)) {
    mkdirSync(HANDOFF_DIR, { recursive: true })
  }
}

function pad(n, width = 2) { return String(n).padStart(width, '0') }

// 生成项目编码（毫秒级时间戳）
export function genProjectCode() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
}

function handoffFilename(projectCode) {
  return `handoff-${projectCode}.json`
}

export function fullPath(filename) {
  return resolve(HANDOFF_DIR, filename)
}

function ensureHandoffCompleteness(data) {
  if (!data || typeof data !== 'object') return data
  if (data.stageRatioSuggestion && !data['环节配比占比']) {
    data['环节配比占比'] = data.stageRatioSuggestion
  } else if (data['环节配比占比'] && !data.stageRatioSuggestion) {
    data.stageRatioSuggestion = data['环节配比占比']
  }
  if (!data.canvasParams) {
    data.canvasParams = buildCanvasParams()
  }
  return data
}

export function readCurrentHandoff() {
  ensureHandoffDir()
  let filename = null
  let projectCode = null
  let createdAt = null

  if (existsSync(CURRENT_POINTER)) {
    try {
      const pointer = JSON.parse(readFileSync(CURRENT_POINTER, 'utf-8'))
      if (pointer?.filename && existsSync(fullPath(pointer.filename))) {
        filename = pointer.filename
        projectCode = pointer.projectCode || null
        createdAt = pointer.createdAt || null
      }
    } catch {
      // 指针文件损坏，走 fallback
    }
  }

  // 指针文件不存在或指向失效：自动扫描目录中最新的 handoff 文件自愈
  if (!filename) {
    const files = listHandoffFiles()
    if (files.length > 0) {
      filename = files[0]
      const match = filename.match(/^handoff-(\d{8}-\d{6}-\d{3})\.json$/)
      projectCode = match ? match[1] : null
      createdAt = new Date().toISOString()
      try {
        writeFileSync(CURRENT_POINTER, JSON.stringify({ projectCode, filename, createdAt }, null, 2), 'utf-8')
      } catch { /* ignore */ }
    }
  }

  if (!filename) return null
  const filePath = fullPath(filename)
  if (!existsSync(filePath)) return null

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8'))
    return {
      filename,
      projectCode,
      handoff: ensureHandoffCompleteness(parsed),
      createdAt,
    }
  } catch {
    return null
  }
}

export function writeHandoffFile(handoff) {
  ensureHandoffDir()
  const completeHandoff = ensureHandoffCompleteness(handoff)
  const projectCode = genProjectCode()
  const filename = handoffFilename(projectCode)
  const filePath = fullPath(filename)
  writeFileSync(filePath, JSON.stringify(completeHandoff, null, 2), 'utf-8')
  // 更新 current 指针
  const pointer = {
    projectCode,
    filename,
    createdAt: new Date().toISOString(),
  }
  writeFileSync(CURRENT_POINTER, JSON.stringify(pointer, null, 2), 'utf-8')
  return { projectCode, filename }
}

export function overwriteCurrentHandoff(handoff) {
  const completeHandoff = ensureHandoffCompleteness(handoff)
  const current = readCurrentHandoff()
  if (!current) {
    return writeHandoffFile(completeHandoff)
  }
  const filePath = fullPath(current.filename)
  writeFileSync(filePath, JSON.stringify(completeHandoff, null, 2), 'utf-8')
  return { projectCode: current.projectCode, filename: current.filename }
}

export function listHandoffFiles() {
  if (!existsSync(HANDOFF_DIR)) return []
  const files = readdirSync(HANDOFF_DIR)
    .filter(f => /^handoff-\d{8}-\d{6}-\d{3}\.json$/.test(f))
    .sort()
    .reverse()
  return files
}

export async function handleHandoffStoreRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  // GET /api/handoff — 读取当前存档（中间件注册在 /api/handoff，req.url 前缀已去掉）
  if (req.method === 'GET' && path === '/') {
    const current = readCurrentHandoff()
    return sendJson(req, res, 200, {
      ok: true,
      projectCode: current?.projectCode || null,
      filename: current?.filename || null,
      createdAt: current?.createdAt || null,
      handoff: current?.handoff || null,
    })
  }

  // GET /api/handoff/list — 列出所有历史文件
  if (req.method === 'GET' && path === '/list') {
    return sendJson(req, res, 200, {
      ok: true,
      files: listHandoffFiles(),
      current: readCurrentHandoff()?.filename || null,
    })
  }

  // POST /api/handoff — 写入新存档（生成带时间戳的新文件 + 更新指针）
  if (req.method === 'POST' && (path === '/' || path === '')) {
    try {
      const body = await readJsonBody(req)
      const handoff = body.handoff
      if (!handoff || typeof handoff !== 'object') {
        return sendJson(req, res, 400, { ok: false, error: '缺少 handoff 参数' })
      }
      const { projectCode, filename } = writeHandoffFile(handoff)
      return sendJson(req, res, 200, { ok: true, projectCode, filename })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  return false
}

export function handoffStorePlugin() {
  return {
    name: 'handoff-store-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/handoff/')) return next()
        const rawPath = req.url.split('?')[0]
        const cleanName = rawPath.replace(/^\/handoff\//, '')
        if (!cleanName) return next()
        // @legacy L3-S04 ✅ 已治理 · 路径穿越校验
        if (cleanName.includes('..') || cleanName.includes('/') || cleanName.includes('\\')) {
          res.statusCode = 400
          return res.end('Invalid filename')
        }
        if (cleanName === 'current.json') {
          const cur = readCurrentHandoff()
          if (cur?.handoff) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
            return res.end(JSON.stringify(cur.handoff, null, 2))
          }
        }
        const filePath = fullPath(cleanName)
        if (existsSync(filePath)) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
          return res.end(readFileSync(filePath, 'utf-8'))
        }
        next()
      })

      server.middlewares.use('/api/handoff', (req, res, next) => {
        Promise.resolve(handleHandoffStoreRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
