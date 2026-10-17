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
import { computeRowGroupTimeline, AUDIO_SPEED_POLICY_TEXT } from '../src/agent-b-v2/timing.js'
import { normalizeAgentBV2ActionSpec } from '../src/agent-b-v2/contract.js'
import {
  buildCanvasParams,
  handwritingFontSourceFor,
  resolveHandwritingFont,
  CANVAS_SIZE,
  QUESTION_FONT_SIZE,
  QUESTION_FONT_FAMILY,
  LINE_HEIGHT_POLICY_TEXT,
} from '../src/services/stepHandoff.js'

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
  let deliverable

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
  const projectCode = data.projectCode || genProjectCode()
  const jsonFilename = deliverableFilename(projectCode)
  const htmlFilename = deliverableHtmlFilename(projectCode)
  const jsonFilePath = fullPath(jsonFilename)
  const htmlFilePath = fullPath(htmlFilename)

  // 为每个 row 注入严格的单手互斥时序计划与动作分档时长（画圈 1s、下划线按字数 1~1.5~2s、横线 1s，真源 timing.js）
  // ★ Task 46 导出闸门：actionSpec 与生成端同门过 normalizeAgentBV2ActionSpec 白名单校验——
  //   存库导出端不再裸收手改/第三方 JSON 的白名单外动作（拒收即丢弃并 warn，与 Check 链同口径）
  // ★ 字体宪法 v2（2026-10-15）：不再补回 board.startCoord——布局唯一权威 = 播放器渲染层
  //   编译期度量排版（自然行高 + stageFlow 顺序续排），与 B 契约「板书不输出起手坐标」对齐；
  //   旧版服务端估算器（layoutBoardRows 1.2 比数注入）与渲染层度量双权威打架，已拔除。
  const normalizedRows = Array.isArray(data.rows)
    ? data.rows.map((row) => {
        const computed = computeRowGroupTimeline(row)
        const estimatedDurationMs = row.estimatedDurationMs || computed.rowTotalDurationMs
        const exclusiveExecutionPlan = row.exclusiveExecutionPlan || computed.exclusiveExecutionPlan
        // ★ Task 46 导出闸门：白名单外动作拒收（丢弃并 warn），拒收后空数组合法落盘
        let actionSpec = row.actionSpec
        if (Array.isArray(actionSpec) && actionSpec.length) {
          const before = actionSpec.length
          actionSpec = normalizeAgentBV2ActionSpec(actionSpec)
          if (actionSpec.length < before) {
            console.warn(`[deliverable] row ${row.stage || '?'}：actionSpec ${before}→${actionSpec.length} 条（白名单外动作被拒收，动作 1.0 三动作）`)
          }
        }
        return {
          ...row,
          actionSpec,
          estimatedDurationMs,
          totalDurationMs: row.totalDurationMs || estimatedDurationMs,
          exclusiveExecutionPlan,
          plan: row.plan || exclusiveExecutionPlan,
          timingPolicy: 'speech-full-board-action-mutually-exclusive',
        }
      })
    : []

  const fallbackBoardPlan = {
    question: { x: 6, y: 13.32, w: 40.32, h: '' },
    analysis: { x: 6, y: 40.62, w: 44, h: 54.38 },
    solution: { x: 54, y: 14, w: 40, h: 44 },
    summary: { x: 54, y: 69.5, w: 40, h: 22 },
  }
  const hbp = data.boardPlan || data.zoneAnchors || fallbackBoardPlan
  // ★ 2026-10-13 归一化：删掉历史手写 fontSize/lineHeight/boardSpeed 副本
  // （曾为“被 ...defaultHcp 覆盖的死值”，px:35+尖尖体是陷阱；真源唯一 = stepHandoff.buildCanvasParams）
  // ★ 2026-10-13 第五轮：canvasWidth/canvasHeight 异名键亦删除——全仓属性读取零命中
  // （下游 RealBoardPreview/BoardContentLayer/AgentBDirect 全读 canvasSize.width/height），
  // 此前“下游消费的异名键”注释与事实不符，属注释谎言
  const rawCanvasParams = data.canvasParams || {}
  // ★ v2.1：字体选择双重入口归一——uiSettings.handwritingFontChoice（数据键，随档走）优先；
  //   旧档/手改 JSON 的 canvasParams.fontSource.handwriting.choice 只作兑底。
  //   归一后 fontSource.handwriting 由真源构造器重授：选什么字体只有一个控制点（stepHandoff）。
  const rawFontChoice = (data.uiSettings && data.uiSettings.handwritingFontChoice)
    || (rawCanvasParams.fontSource && rawCanvasParams.fontSource.handwriting && rawCanvasParams.fontSource.handwriting.choice)
    || null
  const fontSel = resolveHandwritingFont(rawFontChoice)
  // ★ v2.1：默认画布参数按归一后的选择态构建（fontSize 三区文案 + fontSource 一并双态）——
  //   字体宪法域不随档走：旧档/手改档的 stale 标签（shaohua 档仍写"乔木 507"）在此治好
  const defaultHcp = buildCanvasParams(fontSel.choice)
  const canvasParams = {
    source: 'handoff (Agent A 根据题目实时判断，为唯一真相源)',
    ...defaultHcp,
    ...rawCanvasParams,
    // ★ v2.1 必胜重授（写在 spread 之后）：字体宪法域不吃旧档值——
    //   fontSize 三区文案（随选择双态）/ lineHeight 自然行高政策 / fontSource（含题目层印刷体重授）
    fontSize: defaultHcp.fontSize,
    lineHeight: defaultHcp.lineHeight,
    fontSource: {
      ...(rawCanvasParams.fontSource || defaultHcp.fontSource),
      // 服务端重授：不信任档里的旧 fontSource（可能携带已废止字体口径）
      question: defaultHcp.fontSource.question,
      handwriting: handwritingFontSourceFor(rawFontChoice),
    },
  }

  // audioSpeedPolicy / questionFontFamily / lineHeightPolicy 是说明性文案（真源 timing.js / stepHandoff.js），
  // 旧存档带来的旧口径必须丢弃——文案不是数据，不随档走（同 Task 35 audioSpeedPolicy 先例）。
  // ★ v2.1 例外：handwritingFontChoice 是数据键（用户下拉选择），随档走；
  //   handwritingFont 标签与 fontSource 一样由真源重授，旧值丢弃。
  const {
    audioSpeedPolicy: _legacyAudioSpeedPolicy,
    questionFontFamily: _legacyQuestionFontFamily,
    questionLineHeight: _legacyQuestionLineHeight,
    lineHeightPolicy: _legacyLineHeightPolicy,
    handwritingFont: _legacyHandwritingFont,
    // 剥皮防 spread 残留；归一入口在上方 rawFontChoice（uiSettings.fontSource 双入口取值）
    handwritingFontChoice: _legacyFontChoiceForPeelOnly,
    ...restUiSettings
  } = data.uiSettings || {}
  const uiSettings = {
    coordinateMode: '百分比',
    questionFontSize: `${QUESTION_FONT_SIZE}px`,
    questionFontFamily: QUESTION_FONT_FAMILY,
    lineHeightPolicy: LINE_HEIGHT_POLICY_TEXT,
    audioSpeedPolicy: AUDIO_SPEED_POLICY_TEXT,
    ...restUiSettings,
    // 字体选择数据键放 spread 之后：旧档残留 handwritingFontChoice 已剥出，此处写入归一值必胜
    handwritingFontChoice: fontSel.choice,
    handwritingFont: fontSel.family,
  }

  const rawProblemInfo = data.problemInfo || {}
  const problemInfo = {
    screenshotUrl: rawProblemInfo.screenshotUrl || data.screenshotUrl || '',
    problemType: rawProblemInfo.problemType || data.meta?.problemType || '小学数学题',
    relatedKnowledge: rawProblemInfo.relatedKnowledge || [],
    teachingFocus: rawProblemInfo.teachingFocus || '',
    keyFormulaList: rawProblemInfo.keyFormulaList || [],
    zoneAnchors: rawProblemInfo.zoneAnchors || data.zoneAnchors || hbp,
    // ★ 第八轮关联性归一：配比随题型动态判断（detectStageRatio 五类 a/b/c/d/e 各不同），
    // 缺数据诚实写"未提供"，禁止臆造固定比例污染 deliverable 存档（旧值 35/40/15/10 为臆造）
    stageRatios: rawProblemInfo.stageRatios || {
      analysis: '未提供',
      solution: '未提供',
      summary: '未提供',
      introAndClosing: '未提供',
    },
    stageRatioSuggestion: rawProblemInfo.stageRatioSuggestion || null,
    ...rawProblemInfo,
  }

  const payload = {
    // ★ Task 13：$schema / apiDocUrl 死链砍除——指向的 deliverable.schema.json 与
    // DELIVERABLE_API_SPEC.md 全仓从未存在（幽灵契约链），下游消费规范收敛到本 payload 自描述字段
    apiSpecVersion: '2.0.0',
    specificationSummary: '每个 row 为一组原子单元；语音全程；板书与动作单手互斥（程序钳制，Agent 不填时长）；动作 1.0 三动作白名单（下划线/横线/画圈，统一红）按时长分档执行：画圈 1s、下划线按字数 1~1.5~2s、横线 1s；可带 entry 级 triggerKeyword 锚定口播念到关键词时刻起笔。供下游课件制作与画布 Agent 直接消费。',
    specAnnotation: `画布规格批注：尺寸 ${CANVAS_SIZE.width}x${CANVAS_SIZE.height}、比例、题目/板书字号、stage 四区坐标落座区间、越界与手稿风格。`,
    ...data,
    canvasParams,
    boardPlan: {
      canvas: hbp.canvas || { w: CANVAS_SIZE.width, h: CANVAS_SIZE.height },
      layoutMode: hbp.layoutMode || 'portrait',
      ...(hbp.topicBottomPct !== undefined ? { topicBottomPct: hbp.topicBottomPct } : {}),
      topicLabel: hbp.topicLabel || { x: 5.7, y: 6.6, w: 7.1 },
      question: { x: hbp.question?.x ?? 6, y: hbp.question?.y ?? 13.32, w: hbp.question?.w ?? 40.32, h: hbp.question?.h ?? '' },
      analysisLabel: hbp.analysisLabel || { x: 5.7, y: 34.5, w: 7.2 },
      analysis: { x: hbp.analysis?.x ?? 6, y: hbp.analysis?.y ?? 40.62, w: hbp.analysis?.w ?? 44, h: hbp.analysis?.h ?? 54.38 },
      solutionLabel: hbp.solutionLabel || { x: 53.7, y: 6.6, w: 7.4 },
      solution: { x: hbp.solution?.x ?? 54, y: hbp.solution?.y ?? 14, w: hbp.solution?.w ?? 40, h: hbp.solution?.h ?? 44 },
      summaryLabel: hbp.summaryLabel || { x: 53.7, y: 62.0, w: 7.2 },
      summary: { x: hbp.summary?.x ?? 54, y: hbp.summary?.y ?? 69.5, w: hbp.summary?.w ?? 40, h: hbp.summary?.h ?? 22 },
      image: hbp.image || null,
      ...(hbp.method ? { method: hbp.method } : {}),
      ...(hbp.plannedAt ? { plannedAt: hbp.plannedAt } : {}),
    },
    uiSettings,
    problemInfo,
    rows: normalizedRows.length > 0 ? normalizedRows : (data.rows || []),
    projectCode,
    filename: jsonFilename,
    htmlFilename,
    createdAt: data.createdAt || new Date().toISOString(),
  }

  // ★ #017 出口一：JSON 写盘前归一音频路径 + mp3 契约字段补齐（与 renderDeliverableHtml
  //   同一实现，决策 #017 双出口单一实现铁律；幂等，HTML 出口再跑一遍无副作用）。
  //   曾随 36a960c（dependabot squash 回滚）断性丢失，导出件 file:// 必哑——本次恢复
  normalizeDeliverableAssetPaths(payload)

  // 1. 写入配套实体 JSON 归档文件
  writeFileSync(jsonFilePath, JSON.stringify(payload, null, 2), 'utf-8')

  // 2. 写入同名落地实体 HTML 交付单页文件（与 JSON 配对的归档交付物）
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

  // ★ Task 13：GET /api/deliverable/api-spec 死端点砍除——上游唯一消费者 useApiSpecDrawer 已随
  // 幽灵契约链删除；文档本体（DELIVERABLE_API_SPEC.md）全仓从未存在，端点恒返回空 markdown

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
          // 若 /deliverable/row-player.html 未就绪，自动回退到项目 public/row-player.html 或 root row-player.html
          // ★ Task 13：handdraw-player.html 僵尸名砍除——全仓零产出零引用
          if (filename === 'row-player.html') {
            const rootPlayerPath = resolve(projectRoot, 'row-player.html')
            const publicPlayerPath = resolve(projectRoot, 'public', 'row-player.html')
            const fallbackPath = existsSync(publicPlayerPath) ? publicPlayerPath : (existsSync(rootPlayerPath) ? rootPlayerPath : null)
            if (fallbackPath) {
              const content = readFileSync(fallbackPath, 'utf-8')
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              res.statusCode = 200
              res.end(content)
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
