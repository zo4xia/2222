// Agent B 交付物序列化：只负责把运行时快照转换为下游交付合同。
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
  parseBoard,
  safeDeepClone,
  computeRowGroupTimeline,
}) {
  const cleanRows = rows.map((row, index) => {
    const parsedBoard = parseBoard(row.board)
    const normalizedRow = {
      duration: Number(row.audioDurationMs) > 0
        ? Math.round((Number(row.audioDurationMs) / 1000) * 10) / 10
        : (Number(row.duration) || 0),
      durationLabel: Number(row.audioDurationMs) > 0 ? '真实音频时长' : '预估',
      stage: row.stage || (index === 0 ? '题目' : '分析'),
      speech: row.speech != null ? String(row.speech) : '',
      audioUrl: row.audioUrl || '',
      audioDurationMs: Number(row.audioDurationMs) > 0 ? Math.round(Number(row.audioDurationMs)) : null,
      board: {
        content: parsedBoard.content || '',
        // 输出物「可选」透传（2026-09-17 拍板降为可选）：落笔坐标与触发词。
        // 有就带（下游优先采用），没有也不影响（下游回退 boardPlan 区左上角 +2%/+4%，四区照样板开）
        ...(parsedBoard.startCoord ? { startCoord: parsedBoard.startCoord } : {}),
        ...(parsedBoard.triggerKeyword ? { triggerKeyword: parsedBoard.triggerKeyword } : {}),
        startDelay: typeof parsedBoard.startDelay === 'number' && !Number.isNaN(parsedBoard.startDelay)
          ? parsedBoard.startDelay
          : 0,
      },
      actionSpec: Array.isArray(row.actionSpec) ? safeDeepClone(row.actionSpec) : [],
    }
    const timing = computeRowGroupTimeline(normalizedRow)
    return {
      ...normalizedRow,
      estimatedDurationMs: timing.rowTotalDurationMs,
      exclusiveExecutionPlan: timing.exclusiveExecutionPlan,
      timingPolicy: 'speech-full-board-action-mutually-exclusive',
    }
  })

  return {
    $schema: '/deliverable/deliverable.schema.json',
    apiSpecVersion: '2.0.0',
    apiDocUrl: '/deliverable/DELIVERABLE_API_SPEC.md',
    specificationSummary: '每个 row 为一组原子单元；语音全程；板书与动作二者绝对互斥；动作时长定量 1~2 秒作为标点停顿。供下游课件制作与画布 Agent 直接消费。',
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
