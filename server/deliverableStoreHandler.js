/* 教学视频素材参数产物实体文件存档 — public/deliverable/ 下是唯一真实来源
   每次生成独立文件，带时间戳：deliverable-YYYYMMDD-HHMMSS-SSS.json
   文件名 = 项目编码，全链路用同一个编码识别
   current 指针文件记录当前活跃的产物数据
   支持刷新不丢失、支持历史产物回溯 */

import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { isOptions, readJsonBody, sendJson } from './http.js'
import { renderDeliverableHtml, normalizeDeliverableAssetPaths } from './renderDeliverableHtml.js'
import { computeRowGroupTimeline } from '../src/agent-b-v2/timing.js'
import { parseBoardField } from '../src/lib/speechMarkdown.js'
// 车同轨、书同文：对外 JSON 统一带规格批注（画布 / 比例 / 字号 / 四区区间 / 越界与手稿风格）
import { buildCanvasSpecAnnotation } from '../src/utils/superFilter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const PUBLIC_DIR = resolve(projectRoot, 'public')
const DELIVERABLE_DIR = resolve(PUBLIC_DIR, 'deliverable')
const CURRENT_POINTER = resolve(DELIVERABLE_DIR, 'current.json')

function ensureDeliverableDir() {
  if (!existsSync(DELIVERABLE_DIR)) {
    mkdirSync(DELIVERABLE_DIR, { recursive: true })
  }
}

function pad(n, width = 2) { return String(n).padStart(width, '0') }

// 生成项目编码（毫秒级时间戳）
export function genProjectCode() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
}

function deliverableFilename(projectCode) {
  return `deliverable-${projectCode}.json`
}

function deliverableHtmlFilename(projectCode) {
  return `deliverable-${projectCode}.html`
}

export function fullPath(filename) {
  return resolve(DELIVERABLE_DIR, filename)
}

// 自动为已有但在早期未生成 HTML 的历史 JSON 补齐 companion HTML 文件
export function syncExistingDeliverableHtmls(force = false) {
  ensureDeliverableDir()
  try {
    const jsonFiles = readdirSync(DELIVERABLE_DIR).filter(f => /^deliverable-\d{8}-\d{6}-\d{3}\.json$/.test(f))
    for (const jf of jsonFiles) {
      const code = jf.replace(/^deliverable-/, '').replace(/\.json$/, '')
      const htmlFile = deliverableHtmlFilename(code)
      const htmlPath = fullPath(htmlFile)
      if (force || !existsSync(htmlPath)) {
        try {
          const raw = readFileSync(fullPath(jf), 'utf-8')
          const data = JSON.parse(raw)
          const htmlContent = renderDeliverableHtml({ ...data, projectCode: code })
          writeFileSync(htmlPath, htmlContent, 'utf-8')
        } catch {}
      }
    }
    // 同步 current.html
    const currentPath = resolve(DELIVERABLE_DIR, 'current.html')
    if ((force || !existsSync(currentPath)) && existsSync(CURRENT_POINTER)) {
      try {
        const cur = JSON.parse(readFileSync(CURRENT_POINTER, 'utf-8'))
        if (cur?.deliverable) {
          writeFileSync(currentPath, renderDeliverableHtml(cur.deliverable), 'utf-8')
        }
      } catch {}
    }
  } catch {}
}

export function readDeliverableByCode(codeOrFilename) {
  ensureDeliverableDir()
  if (!codeOrFilename) return null
  let filename = codeOrFilename
  if (!filename.endsWith('.json')) {
    filename = deliverableFilename(codeOrFilename)
  }
  const filePath = fullPath(filename)
  if (!existsSync(filePath)) return null
  try {
    const raw = readFileSync(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function readCurrentDeliverable() {
  ensureDeliverableDir()
  let filename = null
  let projectCode = null
  let createdAt = null
  let deliverable = null

  if (existsSync(CURRENT_POINTER)) {
    try {
      const pointer = JSON.parse(readFileSync(CURRENT_POINTER, 'utf-8'))
      if (pointer?.filename && existsSync(fullPath(pointer.filename))) {
        filename = pointer.filename
        projectCode = pointer.projectCode || null
        createdAt = pointer.createdAt || null
      }
    } catch {
      // 指针损坏，继续向下走 fallback
    }
  }

  // 指针文件不存在或失效：自动扫描最新的 deliverable 文件
  if (!filename) {
    const files = listDeliverableFiles()
    if (files.length > 0) {
      filename = files[0]
      const match = filename.match(/^deliverable-(\d{8}-\d{6}-\d{3})\.json$/)
      projectCode = match ? match[1] : null
      createdAt = new Date().toISOString()
    }
  }

  if (!filename) return null
  const filePath = fullPath(filename)
  if (!existsSync(filePath)) return null

  try {
    deliverable = JSON.parse(readFileSync(filePath, 'utf-8'))
    return {
      filename,
      projectCode: projectCode || deliverable?.projectCode || null,
      createdAt: createdAt || deliverable?.createdAt || null,
      deliverable,
    }
  } catch {
    return null
  }
}

export function writeDeliverableFile(data) {
  ensureDeliverableDir()
  // 车同轨：项目编码唯一真源 = 服务端 genProjectCode()（YYYYMMDD-HHMMSS-SSS，见文件头契约"文件名=项目编码"）。
  // 前端传入的 projectCode 一律不信任（历史事故：曾传入 deliverable-<epoch> / handoff-xxx，
  // 造成 deliverable-deliverable-* 双前缀，与全链路 \d{8}-\d{6}-\d{3} 正则失配 → 列表/索引/清理/补 HTML 全部失明）。
  const projectCode = genProjectCode()
  const jsonFilename = deliverableFilename(projectCode)
  const htmlFilename = deliverableHtmlFilename(projectCode)
  const jsonFilePath = fullPath(jsonFilename)
  const htmlFilePath = fullPath(htmlFilename)

  // 为每个 row 注入严格的单手互斥时序计划与定量 1-2 秒标点停顿动作计划。
  // 板书区域由 Agent A 提供；Agent B 只交付自然段内容和触发方式，不生成坐标或固定行距。
  const normalizedRows = Array.isArray(data.rows)
    ? data.rows.map((row) => {
        const computed = computeRowGroupTimeline(row)
        const sourceBoard = row.board && typeof row.board === 'object' ? row.board : {}
        const triggerKeyword = typeof sourceBoard.triggerKeyword === 'string'
          ? sourceBoard.triggerKeyword.trim()
          : ''
        // 车同轨·书同文：板书统一过超级过滤器，单个 row 组内一行一个、写完一个再写一个（lines 数组）
        const parsedBoard = parseBoardField(row.board)
        const board = {
          content: parsedBoard.content,
          lines: parsedBoard.lines || [],
          ...(triggerKeyword
            ? { triggerKeyword }
            : { startDelay: Number.isFinite(Number(sourceBoard.startDelay)) ? Math.max(0, Number(sourceBoard.startDelay)) : 0 }),
        }
        const measuredAudioDurationMs = Number(row.audioDurationMs)
        const hasMeasuredAudio = Number.isFinite(measuredAudioDurationMs) && measuredAudioDurationMs > 0
        // 契约诚实（决策 #019）：行内已存旧排程时，只要拿到真实音频时长就必须重算。
        // 否则 exclusiveExecutionPlan 的 speech 段仍是语速预估（实测 row4 预估 15.7s vs 真实 8.46s），
        // 下游按契约里的 timingPolicy 读数字会算错。computeRowGroupTimeline() 以 row.audioDurationMs
        // 为语音时长真源（timing.js:81-86），重算即自动对齐，无需另写缩放逻辑。
        const rowTotalDurationMs = hasMeasuredAudio
          ? computed.rowTotalDurationMs
          : (row.estimatedDurationMs || computed.rowTotalDurationMs)
        const exclusiveExecutionPlan = hasMeasuredAudio
          ? computed.exclusiveExecutionPlan
          : (row.exclusiveExecutionPlan || computed.exclusiveExecutionPlan)
        return {
          ...row,
          board,
          // audioDurationMs 是真实音频时长；duration 仅保留为旧播放器兼容的秒单位字段
          duration: hasMeasuredAudio
            ? Math.round((measuredAudioDurationMs / 1000) * 10) / 10
            : (typeof row.duration === 'number' && row.duration > 0
              ? row.duration
              : Math.round((rowTotalDurationMs / 1000) * 10) / 10),
          audioDurationMs: hasMeasuredAudio ? Math.round(measuredAudioDurationMs) : null,
          rowTotalDurationMs,
          estimatedDurationMs: rowTotalDurationMs,
          totalDurationMs: row.totalDurationMs || rowTotalDurationMs,
          exclusiveExecutionPlan,
          plan: row.plan || exclusiveExecutionPlan,
          timingPolicy: 'speech-full-board-action-mutually-exclusive',
        }
      })
    : []

  const payload = normalizeDeliverableAssetPaths({
    $schema: '/deliverable/deliverable.schema.json',
    apiSpecVersion: '2.0.0',
    apiDocUrl: '/deliverable/DELIVERABLE_API_SPEC.md',
    specificationSummary: '每个 row 为一组原子单元；语音全程；板书与动作二者绝对互斥（一维时间线上播放的东西绝对没有交集，动作可插在板书前后的时间缝隙里）；动作时长定量 1~2 秒作为标点停顿。供下游课件制作与画布 Agent 直接消费。',
    // 对外规格批注：画布尺寸 / 比例 / 题目字号 / 板书字号 / 本题 stage 四区坐标落座区间 / 越界与手稿风格
    specAnnotation: buildCanvasSpecAnnotation({
      zoneAnchors: data.boardPlan || data.zoneAnchors || null,
    }),
    ...data,
    // 下载物唯一真相源块（前端 serializeDeliverableState 根节点注入；缺失显式置 null，保证下游结构稳定）
    canvasParams: data.canvasParams ?? null,
    uiSettings: data.uiSettings ?? null,
    problemInfo: data.problemInfo ?? null,
    rows: normalizedRows.length > 0 ? normalizedRows : (data.rows || []),
    projectCode,
    filename: jsonFilename,
    htmlFilename,
    createdAt: data.createdAt || new Date().toISOString(),
  })

  // 1. 写入配套实体 JSON 归档文件
  writeFileSync(jsonFilePath, JSON.stringify(payload, null, 2), 'utf-8')

  // 2. 写入同名落地实体 HTML 交付单页文件（夏夏核心需求：与 JSON 配对的一批归档物）
  const htmlContent = renderDeliverableHtml(payload)
  writeFileSync(htmlFilePath, htmlContent, 'utf-8')

  // 3. 更新 current 指针文件 (JSON 与 HTML)
  const pointer = {
    projectCode,
    filename: jsonFilename,
    htmlFilename,
    createdAt: payload.createdAt,
    deliverable: payload,
  }
  writeFileSync(CURRENT_POINTER, JSON.stringify(pointer, null, 2), 'utf-8')
  writeFileSync(resolve(DELIVERABLE_DIR, 'current.html'), htmlContent, 'utf-8')

  return {
    projectCode,
    filename: jsonFilename,
    htmlFilename,
    url: `/deliverable/${htmlFilename}`,
    deliverable: payload,
  }
}

export function listDeliverableFiles() {
  if (!existsSync(DELIVERABLE_DIR)) return []
  const files = readdirSync(DELIVERABLE_DIR)
    .filter(f => /^deliverable-\d{8}-\d{6}-\d{3}\.json$/.test(f))
    .sort()
    .reverse()
  return files
}

export async function handleDeliverableRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname

  // GET /api/deliverable — 读取当前产物（或指定 ?id= 或 ?file=）
  if (req.method === 'GET' && (path === '/' || path === '')) {
    const id = url.searchParams.get('id')
    const file = url.searchParams.get('file')

    if (id || file) {
      const data = readDeliverableByCode(file || id)
      if (data) {
        return sendJson(req, res, 200, {
          ok: true,
          projectCode: data.projectCode || id || null,
          filename: data.filename || file || null,
          createdAt: data.createdAt || null,
          deliverable: data,
        })
      }
    }

    const current = readCurrentDeliverable()
    return sendJson(req, res, 200, {
      ok: true,
      projectCode: current?.projectCode || null,
      filename: current?.filename || null,
      createdAt: current?.createdAt || null,
      deliverable: current?.deliverable || null,
    })
  }

  // GET /api/deliverable/api-spec — 获取下游 Agent 官方消费规范文档
  if (req.method === 'GET' && (path === '/api-spec' || path === '/spec')) {
    const specPath = fullPath('DELIVERABLE_API_SPEC.md')
    let markdown = ''
    if (existsSync(specPath)) {
      markdown = readFileSync(specPath, 'utf-8')
    } else {
      const rootDoc = resolve(projectRoot, 'doc', 'DELIVERABLE_API_SPEC.md')
      if (existsSync(rootDoc)) markdown = readFileSync(rootDoc, 'utf-8')
    }
    return sendJson(req, res, 200, {
      ok: true,
      specVersion: '2.0.0',
      schemaUrl: '/deliverable/deliverable.schema.json',
      markdown,
      summary: '每个 row 为一组原子单元；语音全程；板书与动作二者绝对互斥；动作时长定量 1~2 秒作为标点停顿。供下游课件制作与画布 Agent 直接消费。',
    })
  }

  // GET /api/deliverable/list — 列出历史产物文件
  if (req.method === 'GET' && path === '/list') {
    return sendJson(req, res, 200, {
      ok: true,
      files: listDeliverableFiles(),
      current: readCurrentDeliverable()?.filename || null,
    })
  }

  // POST /api/deliverable/update-sync — 更新时序同步与音频参数
  if (req.method === 'POST' && path === '/update-sync') {
    try {
      const body = await readJsonBody(req)
      const projectCode = body.projectCode || body.deliverable?.projectCode
      const rows = body.rows || body.deliverable?.rows
      if (!projectCode || !Array.isArray(rows)) {
        return sendJson(req, res, 400, { ok: false, error: '缺少 projectCode 或 rows' })
      }
      let currentData = readDeliverableByCode(projectCode)
      if (!currentData) {
        const cur = readCurrentDeliverable()
        if (cur?.projectCode === projectCode) {
          currentData = cur.deliverable
        }
      }
      if (!currentData) {
        return sendJson(req, res, 404, { ok: false, error: '未找到对应产物: ' + projectCode })
      }
      const updated = {
        ...currentData,
        rows,
        updatedAt: new Date().toISOString(),
      }
      const { filename, htmlFilename, url, deliverable: saved } = writeDeliverableFile(updated)
      return sendJson(req, res, 200, {
        ok: true,
        projectCode,
        filename,
        htmlFilename,
        url: url || `/deliverable/${htmlFilename}`,
        deliverable: saved,
      })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  // POST /api/deliverable/update-layout — 保存微调后的坐标与自由拖拽布局
  if (req.method === 'POST' && path === '/update-layout') {
    try {
      const body = await readJsonBody(req)
      let projectCode = body.projectCode
      let currentData = null
      if (projectCode) {
        currentData = readDeliverableByCode(projectCode)
      }
      if (!currentData) {
        const cur = readCurrentDeliverable()
        currentData = cur?.deliverable
        projectCode = cur?.projectCode || projectCode || genProjectCode()
      }
      if (!currentData) {
        return sendJson(req, res, 404, { ok: false, error: '未找到当前产物，无法更新布局' })
      }

      const updated = {
        ...currentData,
        updatedAt: new Date().toISOString(),
      }
      if (body.topicLayout) {
        updated.topicLayout = { ...(updated.topicLayout || {}), ...body.topicLayout }
      }
      if (body.boardPlan) {
        updated.boardPlan = { ...(updated.boardPlan || {}), ...body.boardPlan }
      }
      if (Array.isArray(body.rows)) {
        updated.rows = body.rows
      }
      if (body.blocks) {
        if (!updated.topicLayout) updated.topicLayout = {}
        updated.topicLayout.blocks = body.blocks
      }

      const { filename, htmlFilename, url, deliverable: saved } = writeDeliverableFile(updated)
      return sendJson(req, res, 200, {
        ok: true,
        projectCode,
        filename,
        htmlFilename,
        url: url || `/deliverable/${htmlFilename}`,
        deliverable: saved,
      })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  // POST /api/deliverable — 保存产物生成新文件
  if (req.method === 'POST' && (path === '/' || path === '')) {
    try {
      const body = await readJsonBody(req)
      const deliverable = body.deliverable || body
      if (!deliverable || typeof deliverable !== 'object') {
        return sendJson(req, res, 400, { ok: false, error: '缺少 deliverable 参数' })
      }
      const { projectCode, filename, htmlFilename, url, deliverable: saved } = writeDeliverableFile(deliverable)
      return sendJson(req, res, 200, {
        ok: true,
        projectCode,
        filename,
        htmlFilename,
        url: url || `/deliverable/${htmlFilename}`,
        deliverable: saved,
      })
    } catch (error) {
      return sendJson(req, res, 500, { ok: false, error: error?.message || String(error) })
    }
  }

  return false
}

export function deliverableStorePlugin() {
  return {
    name: 'deliverable-store-proxy',
    configureServer(server) {
      // 启动时同步并补齐历史交付物的 companion HTML 文件
      try {
        syncExistingDeliverableHtmls()
      } catch (e) {
        console.warn('[deliverable-store] sync existing html warning:', e)
      }

      server.middlewares.use('/api/deliverable', (req, res, next) => {
        Promise.resolve(handleDeliverableRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })

      // 强保障：专门拦截 /deliverable/ 静态文件，避免 Vite SPA fallback 将 404 重定向到 index.html
      server.middlewares.use('/deliverable', (req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        const rawName = decodeURIComponent(url.pathname.replace(/^\//, ''))
        const filename = rawName || 'current.html'
        const filePath = fullPath(filename)

        if (filename.endsWith('.json')) {
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
              res.statusCode = 200
              res.end(content)
              return
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ ok: false, error: 'Read file error: ' + err.message }))
              return
            }
          }
          // 不存在时返回标准 JSON 404，绝不回退到 index.html
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: `Deliverable JSON not found: ${filename}` }))
          return
        }

        if (filename.endsWith('.html')) {
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.statusCode = 200
              res.end(content)
              return
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Read html error: ' + err.message)
              return
            }
          }
        }

        if (filename.endsWith('.md')) {
          if (existsSync(filePath)) {
            try {
              const content = readFileSync(filePath, 'utf-8')
              res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
              res.statusCode = 200
              res.end(content)
              return
            } catch (err) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Read markdown error: ' + err.message)
              return
            }
          }
        }

        next()
      })
    },
  }
}
