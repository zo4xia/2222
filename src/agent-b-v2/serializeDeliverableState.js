// Agent B 交付物序列化：只负责把运行时快照转换为下游交付合同。
// 2026-09-17 契约定案：row = { stage, mp3, speech, boards:[{startDelay,content}], actionSpec }
// speech 内 **加粗锚点** 按序映射 boards[i]；单手串行 = boards 全部写完 → 再执行 actionSpec。
import { normalizeBoardsField } from './contract.js'

export function serializeDeliverableState({
  rows,
  projectCode,
  problemText,
  sourceImageUrl,
  keepOriginal,
  topicLayout,
  boardPlan,
  screenshotUrl,
  // 下载物唯一真相源：handoff 动态参数 / B 页面 UI 设置 / 题目全量信息，根节点完整注入
  handoffCanvasParams,
  uiSettings,
  problemInfo,
  problemType,
  boardFocus,
  gradeLevel,
  knowledgeTitle,
  canvasSize,
  totalDuration,
  totalDurationText,
  charCount,
  actionCount,
  checkApplied,
  changeCount,
  safeDeepClone,
  computeRowGroupTimeline,
}) {
  const cleanRows = rows.map((row, index) => {
    // boards 数组唯一契约：新合同直读；旧 board 单对象兼容归一；triggerKeyword 剥离不导出
    const boards = normalizeBoardsField(row.boards, row.board)
      .map((board) => ({ startDelay: typeof board.startDelay === 'number' ? board.startDelay : 0, content: board.content || '' }))
    const normalizedRow = {
      duration: Number(row.audioDurationMs) > 0
        ? Math.round((Number(row.audioDurationMs) / 1000) * 10) / 10
        : (Number(row.duration) || 0),
      durationLabel: Number(row.audioDurationMs) > 0 ? '真实音频时长' : '预估',
      stage: row.stage || (index === 0 ? '题目' : '分析'),
      mp3: typeof row.mp3 === 'string' && row.mp3 ? row.mp3 : (row.audioUrl || ''),
      speech: row.speech != null ? String(row.speech) : '',
      boards,
      actionSpec: Array.isArray(row.actionSpec) ? safeDeepClone(row.actionSpec) : [],
      audioUrl: row.audioUrl || '',
      audioDurationMs: Number(row.audioDurationMs) > 0 ? Math.round(Number(row.audioDurationMs)) : null,
    }
    const timing = computeRowGroupTimeline(normalizedRow)
    return {
      ...normalizedRow,
      estimatedDurationMs: timing.rowTotalDurationMs,
      exclusiveExecutionPlan: timing.exclusiveExecutionPlan,
      timingPolicy: 'boards-all-written-then-actions-serial',
    }
  })

  return {
    $schema: '/deliverable/deliverable.schema.json',
    apiSpecVersion: '2.0.0',
    apiDocUrl: '/deliverable/DELIVERABLE_API_SPEC.md',
    specificationSummary: '每个 row 为一组原子单元（五字段：stage/mp3/speech/boards/actionSpec）；语音全程；speech 内 **加粗** 按序映射 boards[i] 触发落笔；单手串行：本 row 所有 boards 写完才按 order 执行 actionSpec；动作时长定量 1~2 秒作为标点停顿。供下游课件制作与画布 Agent 直接消费。',
    projectCode,
    problemText,
    sourceImageUrl,
    keepOriginal,
    topicLayout,
    boardPlan,
    screenshotUrl,
    // 真相源块（下游与规范说明段落共用这唯一一份，禁止各处另起一套）
    canvasParams: handoffCanvasParams || null,
    uiSettings: uiSettings || null,
    problemInfo: problemInfo || null,
    meta: {
      problemType,
      boardFocus,
      gradeLevel,
      knowledgeTitle,
      canvasSize,
    },
    stats: {
      totalDuration,
      totalDurationText,
      stepCount: cleanRows.length,
      charCount,
      actionCount,
    },
    checkInfo: {
      checkApplied,
      changeCount,
    },
    rows: cleanRows,
  }
}
