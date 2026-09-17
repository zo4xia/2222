import { polishSpeechText } from '../check-agent/asrPolish.js'
// 车同轨、书同文：板书文本统一过全局唯一超级过滤器（清洗错误转义与多余换行）
import { superCleanBoardField } from '../utils/superFilter.js'
// 画布字号/行高/字体唯一真源：src/services/stepHandoff.js
import {
  QUESTION_FONT_SIZE,
  QUESTION_LINE_HEIGHT,
  BOARD_FONT_SIZE,
  CANVAS_SIZE,
  COORDINATE_SYSTEM,
  HANDWRITING_FAMILY,
  LINE_HEIGHT_RULE,
  alignHandoffCanvasParams,
} from '../services/stepHandoff.js'

// ---- 规范说明参数段落（下载物唯一真相源）----
// 完整要素表 MD 与分镜表 MD 共用这唯一一份说明，禁止各自再写一套参数表。
// 参数一律从 handoff 文件动态读取（meta.handoffCanvasParams / handoffBoardPlan / handoffZoneAnchors /
// canvasParams / problemInfo）；handoff 缺失时回退 stepHandoff.js 真源常量。
const REGION_KEYS = ['question', 'analysis', 'solution', 'summary']
const REGION_LABELS = { question: '题目区', analysis: '分析区', solution: '解答区', summary: '总结区' }
const BOARD_REGION_KEYS = ['analysis', 'solution', 'summary']

function pickText(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}
function numText(value, fallback = '—') {
  const n = Number(value)
  return Number.isFinite(n) ? String(Number(n.toFixed(2))) : pickText(value, fallback)
}
function anchorText(anchor) {
  if (!anchor || typeof anchor !== 'object') return '—'
  const parts = []
  const label = anchor.labelStartCoord || anchor.label
  const region = anchor.regionStartCoord
  if (label) parts.push(`标签(${numText(label.x, '')}%, ${numText(label.y, '')}%)`)
  if (region) parts.push(`区域(${numText(region.x, '')}%, ${numText(region.y, '')}%)`)
  return parts.join(' ｜ ') || '—'
}

export function buildStandardExplainParamsSection(meta = {}) {
  // 画布固定规格与真源对齐（旧 handoff 快照可能停留在拍板前的字号），题目相关真相仍严格读 handoff
  const hcp = alignHandoffCanvasParams(meta.handoffCanvasParams)
  const hbp = meta.handoffBoardPlan || {}
  const anchors = meta.handoffZoneAnchors || meta.problemInfo?.zoneAnchors || {}
  const cp = meta.canvasParams || {}
  const pi = meta.problemInfo || {}
  const fs = hcp.fontSize || {}
  const speechSpeed = Number(cp.speechSpeed) || 160
  const out = []

  out.push(
    '',
    '## 规范说明参数（下载物唯一真相源）',
    '',
    '> 全部参数从 handoff 文件动态读取（Agent A 按题目实时判定），为下载物唯一真相源；handoff 缺失项回退 `src/services/stepHandoff.js` 真源常量。',
    '',
    '### 1. handoff 画布参数（真相源）',
    '',
    '| 参数 | 值 |',
    '| --- | --- |',
    `| 画布尺寸 | ${numText(hcp.canvasSize?.width, CANVAS_SIZE.width)} × ${numText(hcp.canvasSize?.height, CANVAS_SIZE.height)} px（${pickText(hcp.canvasSize?.origin, CANVAS_SIZE.origin)}） |`,
    `| 坐标体系 | ${pickText(hcp.coordinateSystem, COORDINATE_SYSTEM)} |`,
    `| ${REGION_LABELS.question} | ${numText(fs.question?.px, QUESTION_FONT_SIZE)}px ｜ ${pickText(fs.question?.family)} ｜ ${pickText(fs.question?.color)} ｜ 行高 ${numText(hcp.lineHeight?.question, QUESTION_LINE_HEIGHT)} |`,
    ...BOARD_REGION_KEYS.map((key) => `| ${REGION_LABELS[key]} | ${numText(fs[key]?.px, BOARD_FONT_SIZE)}px ｜ ${pickText(fs[key]?.family, HANDWRITING_FAMILY)} ｜ ${pickText(fs[key]?.color)} ｜ 行高 ${pickText(hcp.lineHeight?.others, LINE_HEIGHT_RULE)} |`),
    `| 板书渲染速度 | ${pickText(hcp.boardSpeed)} |`,
    `| 动作速度 | ${pickText(hcp.actionSpeed)} |`,
    `| 字间距 | 题目 ${pickText(hcp.letterSpacing?.question)} ｜ 板书 ${pickText(hcp.letterSpacing?.others)} |`,
    `| 整体风格 | ${pickText(hcp.style)} |`,
    '',
  )

  const zoneRows = REGION_KEYS.map((key) => {
    const z = hbp[key] || {}
    return `| ${REGION_LABELS[key]} | ${numText(z.x, '')} | ${numText(z.y, '')} | ${numText(z.w, '')} | ${numText(z.h, '')} | ${anchorText(anchors[key])} |`
  })
  if (hbp.image) {
    const z = hbp.image
    zoneRows.push(`| 图片区 | ${numText(z.x, '')} | ${numText(z.y, '')} | ${numText(z.w, '')} | ${numText(z.h ?? z.maxH, '')} | — |`)
  }
  out.push(
    '### 2. handoff 四区布局（真相源）',
    '',
    '| 区域 | 左% | 上% | 宽% | 高% | 动态锚点（handoff zoneAnchors） |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
    ...zoneRows,
    '',
  )

  out.push(
    '### 3. UI 可调参数（B 页面设置）',
    '',
    '| 参数 | 值 |',
    '| --- | --- |',
    `| 坐标计算方式 | ${cp.coordinateMode === 'percentage' ? '百分比' : pickText(cp.coordinateMode, '百分比')} |`,
    `| 题目字号 | ${numText(cp.questionFontSize, QUESTION_FONT_SIZE)}px |`,
    `| 题目字体 | \`${pickText(cp.questionFontFamily)}\` |`,
    `| 题目行高 | ${numText(cp.questionLineHeight, QUESTION_LINE_HEIGHT)} |`,
    `| 行间隔时长 | ${numText(cp.rowGapMs, 1500)}ms |`,
    `| 音频播放速度策略 | 有音频 URL → 按自然播放时间（\`audioDurationMs\` 毫秒真源，秒制 \`duration = ms/1000\`）；无音频 → 按 ${speechSpeed} 字/分估算兜底（虚拟时钟推进，不卡死） |`,
    '',
  )

  const ratio = pi.stageRatio || meta.stageRatio || null
  const formulas = Array.isArray(pi.knowledgeAnalysis?.coreKnowledge)
    ? pi.knowledgeAnalysis.coreKnowledge
      .map((k) => pickText(k?.formula || k?.knowledgePoint || k?.summary, ''))
      .filter(Boolean)
    : []
  const knowledges = Array.isArray(pi.relatedKnowledge) ? pi.relatedKnowledge : []
  out.push(
    '### 4. 题目全量信息与环节配比',
    '',
    '| 项目 | 值 |',
    '| --- | --- |',
    `| 题目截图地址 | ${pickText(pi.screenshotUrl || meta.screenshotUrl)} |`,
    `| 题型 | ${pickText(pi.problemType)} ｜ 板书侧重 ${pickText(pi.boardFocus)} ｜ 年级 ${pickText(pi.gradeLevel)} ｜ 图片类型 ${pickText(pi.imageKind)} |`,
    `| 教学重点 | ${pickText(pi.essence)} |`,
    `| 环节配比占比 | ${ratio
      ? `分析 ${pickText(ratio.suggestedRatio?.analysis)} ｜ 解答 ${pickText(ratio.suggestedRatio?.solution)} ｜ 总结 ${pickText(ratio.suggestedRatio?.summary)} ｜ 开收场 ${pickText(ratio.suggestedRatio?.introAndClosing)}（${pickText(ratio.category)}／${pickText(ratio.type)} 型，${pickText(ratio.essence)}）`
      : '—'} |`,
    '',
  )
  if (formulas.length) {
    out.push('**关键公式清单**', '', ...formulas.map((f) => `- ${f}`), '')
  }
  if (knowledges.length) {
    out.push('**关联知识点**', '', ...knowledges.map((k) => `- ${typeof k === 'string' ? k : pickText(k?.knowledgePoint || k?.name || k)}`), '')
  }
  out.push('**区域锚点（动态）**', '', ...REGION_KEYS.map((key) => `- ${REGION_LABELS[key]}：${anchorText(anchors[key])}`), '')
  return out
}

export function buildElementsMarkdown(rows, meta = {}) {
  const sourceRows = Array.isArray(rows) ? rows : []
  const escapeCell = (value) => String(value ?? '')
    .replace(/\|/g, '&#124;')
    .replace(/\r?\n/g, '<br>')
  const formatActionSpec = (actionSpec) => {
    if (!Array.isArray(actionSpec) || !actionSpec.length) return '[]'
    return JSON.stringify(actionSpec, null, 2)
  }
  const title = String(meta.title || '讲题完整要素表')
  const metadata = [
    meta.problemText ? `- 题目：${String(meta.problemText).replace(/\r?\n/g, ' ')}` : '',
    meta.model ? `- 模型：${meta.model}` : '',
    meta.generatedAt ? `- 生成时间：${meta.generatedAt}` : '',
  ].filter(Boolean)

  // 规范说明参数段落（下载物唯一真相源，与分镜表共用同一函数）
  const canvasParamsSection = buildStandardExplainParamsSection(meta)

  // 计算每个 stage 内的行号
  const stageRowCounts = {}
  const rowsWithRowInStage = sourceRows.map((row) => {
    const stage = row?.stage || '分析'
    stageRowCounts[stage] = (stageRowCounts[stage] || 0) + 1
    return { ...row, rowInStage: stageRowCounts[stage] }
  })

  const rowsText = rowsWithRowInStage.map((row, index) => {
    const { content } = parseBoardField(row?.board)
    const boardText = content
    return [
      index + 1,
      `${row?.stage || ''}第${row.rowInStage}行`,
      row?.speech,
      boardText,
      formatActionSpec(row?.actionSpec),
      row?.audioDurationMs > 0 ? `${row.audioDurationMs}ms（真实音频）` : `${row?.duration ?? 0}ms（预估）`,
      row?.audioUrl || '',
    ].map(escapeCell).join(' | ')
  })
  return [
    `# ${title}`,
    ...(metadata.length ? ['', ...metadata] : []),
    ...canvasParamsSection,
    '',
    '| 序号 | 行标识 | 口播稿 | 板书内容 | 动作参数（完整 JSON） | 时长 | 音频 URL |',
    '| ---: | --- | --- | --- | --- | --- | --- |',
    ...rowsText.map((row) => `| ${row} |`),
    '',
  ].join('\n')
}

export function exportElementsMarkdown(rows, meta = {}) {
  const markdown = buildElementsMarkdown(rows, meta)
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFilename(meta.problemText)}-完整要素表.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function buildSpeechMarkdown(rows, _meta = {}) {
  // 导出必须保留完整 row 槽位和原始 speech，不能润色、过滤或合并。
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.speech ?? ''))
    .join('\n\n').trimEnd() + '\n'
}

function safeFilename(problemText) {
  const name = String(problemText || '讲题')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 20)
  return name || '讲题'
}

export function exportSpeechMarkdown(rows, meta = {}) {
  const markdown = buildSpeechMarkdown(rows, meta)
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFilename(meta.problemText)}-口播稿.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ---- 时序分镜表：按小环节分块，全局时间码，动作折叠为可读摘要 ----

function summarizeActionSpec(actionSpec) {
  if (!Array.isArray(actionSpec) || !actionSpec.length) return '—'
  return actionSpec.map((entry) => {
    const action = entry?.action
    if (!action) return '能力缺口'
    if (action.tool === 'rough-notation') {
      const label = action.action === 'highlight' ? '高亮' : '下划线'
      const text = action.target?.exactText || action.targetId || '?'
      return `${label}「${text}」`
    }
    if (action.tool === 'rough-line' || action.tool === 'rough-arrow') {
      const label = action.tool === 'rough-arrow' ? '箭头' : '辅助线'
      const region = action.region ? `[${action.region}]` : ''
      const start = Array.isArray(action.start) ? `(${action.start[0]},${action.start[1]})` : ''
      const end = Array.isArray(action.end) ? `→(${action.end[0]},${action.end[1]})` : ''
      return `${label}${region}${start}${end}`
    }
    return action.tool || '未知动作'
  }).join('｜')
}

// 解析 board 字段，兼容历史坐标前缀和当前对象格式。
export function parseBoardField(board) {
  if (board == null) return { content: '' }
  if (typeof board === 'string') {
    const match = board.match(/^\[(\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%)\]\s*/)
    const cleaned = superCleanBoardField(match ? board.slice(match[0].length) : board)
    return { content: cleaned.content, lines: cleaned.lines }
  }
  if (typeof board === 'object') {
    const cleaned = superCleanBoardField(board.content ?? board.text ?? board)
    return { content: cleaned.content, lines: cleaned.lines }
  }
  const cleaned = superCleanBoardField(board)
  return { content: cleaned.content, lines: cleaned.lines }
}

function formatBoardBlock(board) {
  const { content } = parseBoardField(board)
  const text = String(content || '').trim()
  if (!text) return '> （空）'
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')
}

export function buildStoryboardMarkdown(rows, meta = {}) {
  const sourceRows = Array.isArray(rows) ? rows : []
  const title = String(meta.title || '讲题分镜表')
  const metadata = [
    meta.problemText ? `- 题目：${String(meta.problemText).replace(/\r?\n/g, ' ')}` : '',
    meta.model ? `- 模型：${meta.model}` : '',
    meta.generatedAt ? `- 生成时间：${meta.generatedAt}` : '',
  ].filter(Boolean)

  // 规范说明参数段落（下载物唯一真相源，与完整要素表共用同一函数）
  const paramsSection = buildStandardExplainParamsSection(meta)

  const stageLabels = {
    '题目': '题目环节',
    '分析': '分析环节',
    '解答': '解答环节',
    '总结': '总结环节',
  }

  let lastStage = null
  let rowInStage = 0
  const blocks = sourceRows.map((row) => {
    const stage = row?.stage || '分析'

    if (stage !== lastStage) {
      lastStage = stage
      rowInStage = 0
    }
    rowInStage += 1

    const speech = String(row?.speech || '').trim() || '（空）'
    const board = formatBoardBlock(row?.board)
    const actions = summarizeActionSpec(row?.actionSpec)
    const duration = row?.audioDurationMs > 0
      ? `${row.audioDurationMs}ms（真实音频）`
      : `${row?.duration ?? 0}ms（预估）`
    const audioUrl = String(row?.audioUrl || '')

    const stageHeader = rowInStage === 1
      ? `\n## ${stageLabels[stage] || stage}\n`
      : ''

    return `${stageHeader}### ${stage}-第${rowInStage}行
**口播**：${speech}
**板书**：
${board}
**动作**：${actions}
**时长**：${duration}
**音频 URL**：${audioUrl}`
  })

  return [
    `# ${title}`,
    ...(metadata.length ? ['', ...metadata, ''] : []),
    ...paramsSection,
    blocks.join('\n\n'),
    '',
  ].join('\n')
}

export function exportStoryboardMarkdown(rows, meta = {}) {
  const markdown = buildStoryboardMarkdown(rows, meta)
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${safeFilename(meta.problemText)}-分镜表.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}