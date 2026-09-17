import { annotate } from 'rough-notation'
import { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'

export { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'

export const ROUGH_NOTATION_TOOL_ID = 'rough-notation'
export const ROUGH_NOTATION_ENABLED_ACTIONS = Object.freeze([
  'underline',
  'highlight',
  'box',
  'circle',
  'bracket',
  'strike-through',
  'crossed-off',
])
export const MARK_DURATION_PER_HAN_WIDTH_MS = 400

export const BOARD_MARK_COLORS = Object.freeze({
  red: '#d64545',
  yellow: '#f8e58c',
  blue: '#3b82f6',
  ink: '#1f2937',
})

const TYPE_DESCRIPTIONS = Object.freeze({
  underline: '在已存在的关键词或数字下方画手绘下划线',
  highlight: '在已存在的关键词或数字上画荧光高亮',
  box: '在关键词或公式外侧画手绘矩形框',
  circle: '在关键词或数字外侧画手绘椭圆圈出',
  bracket: '在文本旁侧画大括号/中括号',
  'strike-through': '在错误项上画删除横线',
  'crossed-off': '在错误项上画叉叉',
})

function requireElement(element) {
  if (typeof HTMLElement === 'undefined' || !(element instanceof HTMLElement)) {
    throw new Error('RoughNotation 目标必须是已渲染的 HTMLElement')
  }
  return element
}

function resolveColor(colorId) {
  const color = BOARD_MARK_COLORS[colorId] || BOARD_MARK_COLORS.red
  return color
}

function normalizeOptions(action, options = {}) {
  if (!ROUGH_NOTATION_ENABLED_ACTIONS.includes(action)) {
    throw new Error(`当前未开放的 RoughNotation 动作: ${action || '空'}`)
  }
  const colorId = options.colorId || (action === 'highlight' ? 'yellow' : 'red')
  return {
    type: action,
    animate: true,
    color: resolveColor(colorId),
    strokeWidth: 2,
    padding: 5,
    iterations: 2,
    multiline: Boolean(options.multiline),
    rtl: Boolean(options.rtl),
  }
}

function targetRects(element, multiline) {
  if (multiline) {
    const rects = [...element.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
    if (rects.length) return rects
  }
  return [element.getBoundingClientRect()]
}

export function estimateMarkDurationMs(element, { multiline = false } = {}) {
  const target = requireElement(element)
  const rects = targetRects(target, multiline)
  const totalWidth = rects.reduce((sum, rect) => sum + rect.width, 0)
  const computedFontSize = Number.parseFloat(getComputedStyle(target).fontSize)
  const fallbackFontSize = Math.max(...rects.map((rect) => rect.height), 1)
  const hanWidth = Number.isFinite(computedFontSize) && computedFontSize > 0
    ? computedFontSize
    : fallbackFontSize
  const equivalentHanWidth = totalWidth / hanWidth
  return Math.max(1, Math.round(equivalentHanWidth * MARK_DURATION_PER_HAN_WIDTH_MS))
}

export function validateRoughNotationAction(action) {
  try {
    if (!action || action.tool !== ROUGH_NOTATION_TOOL_ID) {
      throw new Error(`tool 必须是 ${ROUGH_NOTATION_TOOL_ID}`)
    }
    if (!ROUGH_NOTATION_ENABLED_ACTIONS.includes(action.action)) {
      throw new Error(`action 只支持 ${ROUGH_NOTATION_ENABLED_ACTIONS.join('|')}`)
    }
    const target = action.targetId?.trim()
      ? action.targetId.trim()
      : {
          region: action.target?.region,
          exactText: action.target?.exactText?.trim(),
          occurrence: Math.round(action.target?.occurrence ?? 1),
        }
    if (typeof target !== 'string' && (!target.region || !target.exactText)) {
      throw new Error('需要 targetId，或 target.region + target.exactText')
    }
    const order = Math.round(action.order ?? 1)
    if (!Number.isFinite(order) || order < 1) throw new Error('order 必须是正整数')
    if (action.estimatedDurationMs != null || action.gapAfterMs != null) {
      throw new Error('标记时长与抬笔间隔由程序工具计算，Agent 不得覆盖')
    }
    const options = normalizeOptions(action.action, action.options)
    return {
      ok: true,
      value: {
        tool: ROUGH_NOTATION_TOOL_ID,
        action: action.action,
        target,
        order,
        options,
      },
    }
  } catch (error) {
    return { ok: false, error: error?.message || String(error) }
  }
}

export function prepareRoughNotationAction(action, resolveTarget) {
  const result = validateRoughNotationAction(action)
  if (!result.ok) throw new Error(result.error)
  if (typeof resolveTarget !== 'function') {
    throw new Error('RoughNotation 需要受控的 targetId 解析器')
  }

  const targetElement = resolveTarget(result.value.target)
  if (!targetElement) throw new Error('找不到标记目标')
  requireElement(targetElement)
  const durationMs = estimateMarkDurationMs(targetElement, result.value.options)
  const targetKey = typeof result.value.target === 'string'
    ? result.value.target
    : `${result.value.target.region}:${result.value.target.exactText}:${result.value.target.occurrence}`
  let annotation = null

  return {
    id: `${ROUGH_NOTATION_TOOL_ID}:${targetKey}:${result.value.action}`,
    order: result.value.order,
    durationMs,
    gapAfterMs: MIN_HAND_LIFT_GAP_MS,
    execute() {
      annotation?.remove()
      annotation = annotate(targetElement, {
        ...result.value.options,
        animationDuration: durationMs,
      })
      annotation.show()
      return annotation
    },
    cancel() {
      annotation?.hide()
    },
    remove() {
      annotation?.remove()
      annotation = null
    },
  }
}

export function getRoughNotationAgentTool() {
  return {
    id: ROUGH_NOTATION_TOOL_ID,
    purpose: '只用于给已存在的题目或板书文字划重点，不画几何图形',
    concurrency: {
      mode: 'teacher-hand-exclusive',
      minimumGapAfterMs: MIN_HAND_LIFT_GAP_MS,
      rule: 'Agent C 的自动写字、画图、标记动作互斥，任意时刻只允许一笔；L4 用户透明层不进入此队列',
    },
    timing: {
      owner: 'program',
      rule: '3 个汉字宽度 = 1200ms；按目标实际渲染宽度折算，Agent 不填秒数',
      millisecondsPerHanWidth: MARK_DURATION_PER_HAN_WIDTH_MS,
    },
    actionSchema: {
      tool: ROUGH_NOTATION_TOOL_ID,
      action: ROUGH_NOTATION_ENABLED_ACTIONS.join('|'),
      target: {
        region: 'question|analysis|solution|summary',
        exactText: '要标记的完整原文，禁止改写',
        occurrence: '同文重复时指定第几个，默认 1',
      },
      targetId: '仅当 C 已经创建稳定目标 ID 时使用；不使用画布网格坐标',
      order: 'Agent C 老师一只手队列中的正整数顺序',
      options: {
        multiline: '目标跨行时才为 true',
        rtl: '默认 false，只在明确需要反向落笔时为 true',
      },
    },
    actions: ROUGH_NOTATION_ENABLED_ACTIONS.map((action) => ({
      action,
      description: TYPE_DESCRIPTIONS[action],
      example: {
        tool: ROUGH_NOTATION_TOOL_ID,
        action,
        target: { region: 'question', exactText: '题目中要标记的原文', occurrence: 1 },
        order: 1,
        options: {},
      },
    })),
  }
}
