/* screenshot 截图存档 — public/pic/ 下是唯一真实来源
   每次生成独立 JPG 文件，带时间戳：shot-YYYYMMDD-HHMMSS-SSS.jpg
   最简存储：接收 base64 直接写文件，不做格式解码验证 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { isOptions, readJsonBody, sendJson } from './http.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const PIC_DIR = resolve(projectRoot, 'public', 'pic')

function pad(n, width = 2) {
  return String(n).padStart(width, '0')
}

function genTimestampName() {
  const d = new Date()
  return `shot-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}.jpg`
}

function ensurePicDir() {
  if (!existsSync(PIC_DIR)) {
    mkdirSync(PIC_DIR, { recursive: true })
  }
}

function stripBase64Prefix(dataUrl) {
  return String(dataUrl || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '')
}

export async function handleScreenshotStoreRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  // 中间件注册在 /api/screenshot，req.url 前缀已去掉
  if (req.method === 'POST' && (path === '/' || path === '')) {
    try {
      const body = await readJsonBody(req)
      const base64 = stripBase64Prefix(body.imageBase64)
      if (!base64) {
        return sendJson(req, res, 400, { ok: false, error: '缺少 imageBase64 参数' })
      }
      const buffer = Buffer.from(base64, 'base64')
      ensurePicDir()
      const filename = genTimestampName()
      const filePath = resolve(PIC_DIR, filename)
      writeFileSync(filePath, buffer)
      return sendJson(req, res, 200, {
        ok: true,
        filename,
        urlPath: `/pic/${filename}`,
        size: buffer.length,
      })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  return false
}

export function screenshotStorePlugin() {
  return {
    name: 'screenshot-store-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/pic/')) return next()
        const rawPath = req.url.split('?')[0]
        const cleanName = rawPath.replace(/^\/pic\//, '')
        if (!cleanName) return next()
        const filePath = resolve(PIC_DIR, cleanName)
        if (existsSync(filePath)) {
          res.setHeader('Content-Type', 'image/jpeg')
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          return res.end(readFileSync(filePath))
        }
        next()
      })

      server.middlewares.use('/api/screenshot', (req, res, next) => {
        Promise.resolve(handleScreenshotStoreRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
