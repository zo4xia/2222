import { annotate } from 'rough-notation'
import { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'
// ★ Task 61 根治归一：字数分档常量不再镜像手抄，直接 import 唯一真源 src/agent-b-v2/timing.js
// （Task 46 时真源未导出只能同值手抄；真源现已导出，改档只动 timing.js 一处，双侧天然零漂移）
import {
  NOTATION_DURATION_MS as MARK_DURATION_MS,
  UNDERLINE_LONG_MS,
  UNDERLINE_XLONG_MS,
  UNDERLINE_MID_CHARS,
  UNDERLINE_XLONG_CHARS,
} from '../agent-b-v2/timing.js'

export { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'

export const ROUGH_NOTATION_TOOL_ID = 'rough-notation'
// ★ Task 43 夏夏拍板「动作 1.0」：白名单收紧为 underline/circle 两 notation 动作（+rough-line 横线
// 在 roughDrawingTool），highlight 砍掉（「其他做我怕做不好」）；颜色统一红 #dc2626
// （与 row-player STAGE_COLOR 分析区红同值，销 #d64545/#dc2626 双红分裂）。
// 历史依据：2026-10-13 第七轮 circle 回归白名单（夏夏原话#33 underline+circle 兜底）。
// ★ Task 46 分档归一：estimateMarkDurationMs 不再按 DOM 宽度×400ms/字，改吃 timing.js 字数分档口径（2026-10-17，夏夏「统一性归一化去歧义」）
export const ROUGH_NOTATION_ENABLED_ACTIONS = Object.freeze([
  'underline',
  'circle',
])

// ★ Task 46 分档归一：estimateMarkDurationMs 不再按 DOM 宽度×400ms/字，改吃 timing.js 字数分档口径（2026-10-17，夏夏「统一性归一化去歧义」）
// ★ Task 61 根治归一：原五常量同值手抄副本（NOTATION_DURATION_MS/UNDERLINE_* 镜像）退役，已改顶部 import 派生。
// 旧 MARK_DURATION_PER_HAN_WIDTH_MS=400（DOM 量宽×400ms/字，8 字下划线≈3200ms、
// 无 1~2s 钳制、circle 不固定 1000）已删，引用全文件清零。

export const BOARD_MARK_COLORS = Object.freeze({
  red: '#dc2626',
})

const TYPE_DESCRIPTIONS = Object.freeze({
  underline: '在已存在的关键词或数字下方画手绘下划线（红色）',
  circle: '在已存在的关键词或数字外画手绘圈（固定红色，粗圈关键词/关键数字）',
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
  // ★ Task 43：颜色统一红（highlight 已砍，yellow 色板同步删除）
  const colorId = 'red'
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

/**
 * 标记动作时长估算（Task 46 分档归一后口径）：
 *   circle 固定 1000ms；underline 按 exactText 字数分档——>10字 2000 / >5字 1500 / 其他 1000
 *   （含 targetId 串式目标无 exactText → 0 字档，与真源 timing.js 的 target.exactText 缺省同口径）。
 * 分档内参经第二参数 options 传入（options.type 由 normalizeOptions 填，options.exactText
 * 由 prepareRoughNotationAction 从 result.value.target 注入）；element 形参保留仅为
 * L127 调用点兼容（签名不动），时长计算不再读 DOM——旧 DOM 量宽逻辑（targetRects/
 * getComputedStyle/字宽折算）已整段移除。
 * @orphan [零外部调用估算函数] */
export function estimateMarkDurationMs(element, { type, exactText } = {}) {
  if (type === 'circle') return MARK_DURATION_MS.circle
  const textLen = [...String(exactText || '')].length
  if (textLen > UNDERLINE_XLONG_CHARS) return UNDERLINE_XLONG_MS
  if (textLen > UNDERLINE_MID_CHARS) return UNDERLINE_LONG_MS
  return MARK_DURATION_MS.underline
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
    // ★ Task 46：禁填清单对称化（与 roughDrawingTool normalizeCommonAction 一致口径）——
    // 补 durationMs；Agent 自填时长一律拒收（分档真源 timing.js，程序算）
    if (
      action.durationMs != null || action.estimatedDurationMs != null
      || action.gapAfterMs != null
    ) {
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
  // ★ Task 46 分档归一：exactText 作为时长分档内参挂进 options（下方调用点原样不动）——
  //   仅本函数消费，execute() 里不进 annotate 配置；targetId 串式目标无 exactText
  //   → 0 字档 1000ms（与 timing.js 同口径）
  if (typeof result.value.target === 'object' && result.value.target.exactText) {
    result.value.options.exactText = result.value.target.exactText
  }
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
      // ★ Task 46：exactText 是时长分档内参，不进 annotate 配置（保持传入键纯净）
      const annotationOptions = { ...result.value.options }
      delete annotationOptions.exactText
      annotation = annotate(targetElement, {
        ...annotationOptions,
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
      // ★ Task 43 分档口径（真源 timing.js estimateActionDuration，画圈 1000ms；
      // 下划线 ≤5字 1000 / >5字 1500 / >10字 2000），Agent 不填秒数
      rule: '画圈固定 1s；下划线按 exactText 字数分档（≤5字 1s / >5字 1.5s / >10字 2s），Agent 不填秒数',
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
