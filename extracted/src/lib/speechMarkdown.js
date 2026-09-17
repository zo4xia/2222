// 画布字号/行高唯一真源：src/services/stepHandoff.js
import { buildCanvasParams } from '../services/stepHandoff.js'

/**
 * 导出物全局说明参数（真相源与规范基准）
 * 布局参数从 handoff 文件动态读取（Agent A 根据题目实时判断），为唯一真相源
 */
export function buildStandardExplainParamsSection(meta = {}) {
  const hcp = meta.handoffCanvasParams || meta.canvasParams || buildCanvasParams()
  const fallbackHbp = {
    question: { x: 6, y: 13.32, w: 40.32, h: '' },
    analysis: { x: 6, y: 40.62, w: 44, h: 54.38 },
    solution: { x: 54, y: 14, w: 40, h: 44 },
    summary: { x: 54, y: 69.5, w: 40, h: 22 },
  }
  const rawHbp = meta.handoffBoardPlan || meta.boardPlan || meta.zoneAnchors || fallbackHbp
  const hbp = {
    question: { ...fallbackHbp.question, ...(rawHbp.question || {}) },
    analysis: { ...fallbackHbp.analysis, ...(rawHbp.analysis || {}) },
    solution: { ...fallbackHbp.solution, ...(rawHbp.solution || {}) },
    summary: { ...fallbackHbp.summary, ...(rawHbp.summary || {}) },
  }

  // 题目信息与环节配比
  const screenshotUrl = meta.screenshotUrl || '无'
  const problemType = meta.problemType || '未指定'
  const relatedKnowledge = Array.isArray(meta.relatedKnowledge) ? meta.relatedKnowledge : []
  const knowledgeText = relatedKnowledge.length
    ? relatedKnowledge.map(k => typeof k === 'string' ? k : (k.title || k.name || JSON.stringify(k))).join('、')
    : '无'
  const teachingFocus = meta.teachingFocus || '未指定'
  const keyFormulaList = Array.isArray(meta.keyFormulaList) ? meta.keyFormulaList : []
  const formulaText = keyFormulaList.length ? keyFormulaList.join('；') : '无'
  const zoneAnchorsText = meta.zoneAnchors ? (typeof meta.zoneAnchors === 'object' ? JSON.stringify(meta.zoneAnchors) : String(meta.zoneAnchors)) : '使用默认四区锚点'

  const stageRatioData = meta.stageRatioSuggestion || meta['环节配比占比'] || null
  const suggestedRatio = stageRatioData?.suggestedRatio || meta.stageRatios || {}

  const analysisPct = suggestedRatio.analysis || '35%'
  const solutionPct = suggestedRatio.solution || '40%'
  const summaryPct = suggestedRatio.summary || '15%'
  const introPct = suggestedRatio.introAndClosing || suggestedRatio.intro || '10%'

  return [
    '',
    '> 布局参数从 handoff 文件动态读取（Agent A 根据题目实时判断），为唯一真相源。',
    '',
    '### handoff 画布参数（真相源）',
    '',
    '| 参数 | 值 |',
    '| --- | --- |',
    `| 画布宽度 | ${hcp.canvasSize?.width ?? 1726}px |`,
    `| 画布高度 | ${hcp.canvasSize?.height ?? 980}px |`,
    `| 坐标系统 | ${hcp.coordinateSystem || '百分比坐标 0-100'} |`,
    `| 题目区字号 | ${hcp.fontSize?.question?.px ?? 30}px |`,
    `| 题目区字体 | \`${hcp.fontSize?.question?.family || '微软雅黑（印刷体，30px）'}\` |`,
    `| 题目区颜色 | ${hcp.fontSize?.question?.color || '黑色'} |`,
    `| 分析区字号 | ${hcp.fontSize?.analysis?.px ?? 35}px |`,
    `| 分析区字体 | \`${hcp.fontSize?.analysis?.family || 'LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）'}\` |`,
    `| 分析区颜色 | ${hcp.fontSize?.analysis?.color || '红色'} |`,
    `| 解答区字号 | ${hcp.fontSize?.solution?.px ?? 35}px |`,
    `| 解答区字体 | \`${hcp.fontSize?.solution?.family || 'LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）'}\` |`,
    `| 解答区颜色 | ${hcp.fontSize?.solution?.color || '黑色'} |`,
    `| 总结区字号 | ${hcp.fontSize?.summary?.px ?? 35}px |`,
    `| 总结区字体 | \`${hcp.fontSize?.summary?.family || 'LikeJianJianTi（手写尖尖体，网络字体 fontSource.handwriting，font-weight: normal，约题目的1.2~1.5倍，推荐35px）'}\` |`,
    `| 总结区颜色 | ${hcp.fontSize?.summary?.color || '黑色'} |`,
    `| 题目区行高 | ${hcp.lineHeight?.question ?? 1.65} |`,
    `| 其他区行高 | ${hcp.lineHeight?.others || '自然换行即可；渲染层会对行高做微小随机抖动营造手写感，B 按正常行高估算坐标，不需要自己叠加抖动'} |`,
    `| 板书速度 | ${hcp.boardSpeed || '下游渲染参数：1秒约2~3个汉字，每行±10%轻微抖动（B 不需要处理速度细节）'} |`,
    `| 动作速度 | ${hcp.actionSpeed || '差不多同样速度（rough-line/rough-arrow/rough-notation绘制速度）'} |`,
    '',
    '| 区域 | 左% | 上% | 宽% | 高% |',
    '| --- | ---: | ---: | ---: | ---: |',
    `| 题目区 | ${hbp.question?.x ?? 6} | ${hbp.question?.y ?? 13.32} | ${hbp.question?.w ?? 40.32} | ${hbp.question?.h ?? ''} |`,
    `| 分析区 | ${hbp.analysis?.x ?? 6} | ${hbp.analysis?.y ?? 40.62} | ${hbp.analysis?.w ?? 44} | ${hbp.analysis?.h ?? 54.38} |`,
    `| 解答区 | ${hbp.solution?.x ?? 54} | ${hbp.solution?.y ?? 14} | ${hbp.solution?.w ?? 40} | ${hbp.solution?.h ?? 44} |`,
    `| 总结区 | ${hbp.summary?.x ?? 54} | ${hbp.summary?.y ?? 69.5} | ${hbp.summary?.w ?? 40} | ${hbp.summary?.h ?? 22} |`,
    '',
    '### UI 可调参数（B 页面设置）',
    '',
    '| 参数 | 值 |',
    '| --- | --- |',
    '| 坐标计算方式 | 百分比 |',
    '| 题目字号（UI） | 30px |',
    '| 题目字体（UI） | `"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` |',
    '| 音频速度 | （若有音频url的，以音频自然播放时间为时间，一组一组自然播放即可，如果没有音频url信息的，用填充演示数据占位，）速度计算 160字/分 |',
    '',
    '### 题目信息与环节配比',
    '',
    `- 题目截图地址 (screenshotUrl)：${screenshotUrl}`,
    `- 题型 (problemType)：${problemType}`,
    `- 关联知识点 (relatedKnowledge)：${knowledgeText}`,
    `- 教学重点 (teachingFocus)：${teachingFocus}`,
    `- 关键公式清单 (keyFormulaList)：${formulaText}`,
    `- 区域锚点 (zoneAnchors)：${zoneAnchorsText}`,
    '- 内容占比环节配比占比：',
    `  - 分析：${analysisPct}`,
    `  - 解答：${solutionPct}`,
    `  - 总结：${summaryPct}`,
    `  - 开收场：${introPct}`,
    '',
  ]
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

  const explainParamsSection = buildStandardExplainParamsSection(meta)

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
      row?.audioUrl || '音频暂未生成',
    ].map(escapeCell).join(' | ')
  })
  return [
    `# ${title}`,
    ...(metadata.length ? ['', ...metadata] : []),
    ...explainParamsSection,
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
function parseBoardField(board) {
  if (board == null) return { content: '' }
  if (typeof board === 'string') {
    const match = board.match(/^\[(\d+(?:\.\d+)?%\s*,\s*\d+(?:\.\d+)?%)\]\s*/)
    if (match) return { content: board.slice(match[0].length) }
    return { content: board }
  }
  if (typeof board === 'object') {
    return { content: board.content || '' }
  }
  return { content: String(board) }
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
    const audioUrl = String(row?.audioUrl || '音频暂未生成')

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