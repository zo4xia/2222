// 画布字号/行高唯一真源：src/services/stepHandoff.js
// ★ Task 10: 引入完整常量避免硬编码 35/30/LikeJianJianTi
import {
  buildCanvasParams,
  CANVAS_SIZE,
  QUESTION_FONT_SIZE,
  QUESTION_FONT_FAMILY,
  BOARD_FONT_SIZE,
  resolveHandwritingFont,
  BOARD_FONT_RATIO_TEXT,
  LINE_HEIGHT_POLICY_TEXT,
  LINE_HEIGHT_POLICY_SHORT,
  LINE_HEIGHT_ESTIMATE_RATIO,
  NATURAL_LINE_HEIGHT_EXTRA_PX,
  BOARD_LINE_HEIGHT_EXTRA_PX,
  BOARD_LINE_HEIGHT_POLICY_SHORT,
  BOARD_SPEED_CHARS_PER_SEC,
  BOARD_SPEED_JITTER,
  knowledgeItemText,
} from '../services/stepHandoff.js'
import { AUDIO_SPEED_POLICY_TEXT } from '../agent-b-v2/timing.js'

/**
 * 导出物全局说明参数（真相源与规范基准）
 * 布局参数从 handoff 文件动态读取（Agent A 根据题目实时判断），为唯一真相源
 */
export function buildStandardExplainParamsSection(meta = {}) {
  const hcp = meta.handoffCanvasParams || meta.canvasParams || buildCanvasParams()
  // ★ v2.1：板书区字体行随用户选择派生（handoff 永远默认态，选择值经 meta.handwritingFontChoice
  //   传入）；不再读 hcp.fontSize 文案——那是 handoff 默认态，shaohua 选择下会说谎。
  //   同步拔掉旧 fallback 里的"主 CDN 507"字面量（字体宪法 lite 违例）
  const boardFontSel = resolveHandwritingFont(meta.handwritingFontChoice)
  const boardFontText = `${boardFontSel.family}（手写体，网络字体 fontSource.handwriting 主 CDN ${boardFontSel.cdn}，font-weight: normal，${BOARD_FONT_RATIO_TEXT}）`
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
  // ★ 第八轮契约归一：relatedKnowledge 项文本读取口唯一真源 = knowledgeItemText（中文字段对象优先）
  // 旧实现 k.title || k.name || JSON.stringify(k) 对 A 链中文字段全 miss，裸 JSON 会直接污染导出产物
  const knowledgeText = relatedKnowledge.length
    ? relatedKnowledge.map(knowledgeItemText).filter(Boolean).join('、')
    : '无'
  const teachingFocus = meta.teachingFocus || '未指定'
  const keyFormulaList = Array.isArray(meta.keyFormulaList) ? meta.keyFormulaList : []
  const formulaText = keyFormulaList.length ? keyFormulaList.join('；') : '无'
  const zoneAnchorsText = meta.zoneAnchors ? (typeof meta.zoneAnchors === 'object' ? JSON.stringify(meta.zoneAnchors) : String(meta.zoneAnchors)) : '使用默认四区锚点'

  const stageRatioData = meta.stageRatioSuggestion || meta['环节配比占比'] || null
  const suggestedRatio = stageRatioData?.suggestedRatio || meta.stageRatios || {}

  // ★ 第八轮关联性归一（2026-10-13）：配比唯一真源 = handoff.stageRatioSuggestion
  // （detectStageRatio 按题型动态判断，五类 a/b/c/d/e 各不同，cuCode+置信度随行）
  // 缺数据时诚实写"未提供"，禁止臆造固定比例（旧值 35/40/15/10 与五类真值均对不上）
  const analysisPct = suggestedRatio.analysis || '未提供'
  const solutionPct = suggestedRatio.solution || '未提供'
  const summaryPct = suggestedRatio.summary || '未提供'
  const introPct = suggestedRatio.introAndClosing || suggestedRatio.intro || '未提供'

  return [
    '',
    '> 布局参数从 handoff 文件动态读取（Agent A 根据题目实时判断），为唯一真相源。',
    '',
    '### handoff 画布参数（真相源）',
    '',
    '| 参数 | 值 |',
    '| --- | --- |',
    `| 画布宽度 | ${hcp.canvasSize?.width ?? CANVAS_SIZE.width}px |`,
    `| 画布高度 | ${hcp.canvasSize?.height ?? CANVAS_SIZE.height}px |`,
    `| 坐标系统 | ${hcp.coordinateSystem || '百分比坐标 0-100'} |`,
    `| 题目区字号 | ${hcp.fontSize?.question?.px ?? QUESTION_FONT_SIZE}px |`,
    `| 题目区字体 | \`${hcp.fontSize?.question?.family || `微软雅黑（印刷体，${QUESTION_FONT_SIZE}px）`}\` |`,
    `| 题目区颜色 | ${hcp.fontSize?.question?.color || '黑色'} |`,
    `| 分析区字号 | ${hcp.fontSize?.analysis?.px ?? BOARD_FONT_SIZE}px |`,
    `| 分析区字体 | \`${boardFontText}\` |`,
    `| 分析区颜色 | ${hcp.fontSize?.analysis?.color || '红色'} |`,
    `| 解答区字号 | ${hcp.fontSize?.solution?.px ?? BOARD_FONT_SIZE}px |`,
    `| 解答区字体 | \`${boardFontText}\` |`,
    `| 解答区颜色 | ${hcp.fontSize?.solution?.color || '黑色'} |`,
    `| 总结区字号 | ${hcp.fontSize?.summary?.px ?? BOARD_FONT_SIZE}px |`,
    `| 总结区字体 | \`${boardFontText}\` |`,
    `| 总结区颜色 | ${hcp.fontSize?.summary?.color || '黑色'} |`,
    // ★ 字体宪法 v2.2/v2.3：题目层 自然+2px 分数余量；板书层 自然+4px（2px 分数余量+2px 行距呼吸，2026-10-22 夏夏拍板）——不随档走，文案/余量真源 stepHandoff，估算公式一并告知 B
    `| 行高（题目层） | ${LINE_HEIGHT_POLICY_SHORT}（完整政策：${LINE_HEIGHT_POLICY_TEXT}）；估算行高 ≈ 字号 × ${LINE_HEIGHT_ESTIMATE_RATIO} + ${NATURAL_LINE_HEIGHT_EXTRA_PX}px |`,
    `| 行高（板书层） | ${BOARD_LINE_HEIGHT_POLICY_SHORT}；估算行高 ≈ 字号 × ${LINE_HEIGHT_ESTIMATE_RATIO} + ${BOARD_LINE_HEIGHT_EXTRA_PX}px（2026-10-22 夏夏拍板：2px 分数余量 + 2px 行距呼吸） |`,
    `| 板书速度 | ${hcp.boardSpeed || `下游渲染参数：1秒约${BOARD_SPEED_CHARS_PER_SEC}个汉字，每行±${BOARD_SPEED_JITTER * 100}%轻微抖动；书写时长超出音频窗口时自适应加速压进音频内（音频=行时长唯一主时钟）`} |`,
    `| 动作速度 | ${hcp.actionSpeed || '差不多同样速度（rough-line/rough-notation 绘制速度，三动作白名单）'} |`,
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
    `| 题目字号（UI） | ${QUESTION_FONT_SIZE}px |`,
    `| 题目字体（UI） | \`${QUESTION_FONT_FAMILY}\` |`,
    `| 行高（UI） | ${LINE_HEIGHT_POLICY_TEXT} |`,
    `| 音频速度 | ${AUDIO_SPEED_POLICY_TEXT} |`,
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
    // ★ Task 43 动作 1.0：三动作标签对齐白名单（highlight/rough-arrow 已砍，死分支清除）
    // entry 级 triggerKeyword（口播触发词）随动作摘要展示
    const kw = typeof entry?.triggerKeyword === 'string' && entry.triggerKeyword.trim()
      ? `（口播触发"${entry.triggerKeyword}"）` : ''
    if (action.tool === 'rough-notation') {
      const label = action.action === 'circle' ? '画圈' : '下划线'
      const text = action.target?.exactText || action.targetId || '?'
      return `${label}「${text}」${kw}`
    }
    if (action.tool === 'rough-line') {
      const region = action.region ? `[${action.region}]` : ''
      const start = Array.isArray(action.start) ? `(${action.start[0]},${action.start[1]})` : ''
      const end = Array.isArray(action.end) ? `→(${action.end[0]},${action.end[1]})` : ''
      return `横线${region}${start}${end}${kw}`
    }
    return action.tool || '未知动作'
  }).join('｜')
}

// ponytail: parseBoardField 归并到 contract.js#normalizeBoard 唯一真源
import { normalizeBoard } from '../agent-b-v2/contract.js'
function parseBoardField(board) {
  return { content: normalizeBoard(board).content }
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