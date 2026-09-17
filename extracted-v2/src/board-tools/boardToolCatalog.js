/* @qh-core LANE=SHARED POINT=TOOL_CATALOG only registered actions for B script */
import { createHandActionScheduler } from './handActionScheduler.js'
import { createTextTargetRegistry } from './textTargetRegistry.js'
import {
  getRoughNotationAgentTool,
  prepareRoughNotationAction,
  ROUGH_NOTATION_TOOL_ID,
  validateRoughNotationAction,
} from './roughNotationTool.js'
import {
  getRoughDrawingAgentTools,
  prepareRoughDrawingAction,
  ROUGH_DRAWING_TOOL_IDS,
  validateRoughDrawingAction,
} from './roughDrawingTool.js'
// @legacy prompt-1 ✅ 已治理 · draw 工具从 catalog 移除（prompt.js:246 明文禁止）
// drawIntentTool.js 代码保留，但不再注册到 catalog，模型永不产出 tool:"draw"
// 用户裁定"R2 有用、不可删除"：保留代码能力，仅不暴露给模型

export const BOARD_TOOL_CATALOG_VERSION = '1.4.1'

export function getAgentBoardToolCatalog() {
  return {
    version: BOARD_TOOL_CATALOG_VERSION,
    rule: '只能使用 tools 中已声明的工具和 action；没有工具就返回缺口，禁止自造调用。当前仅支持 rough-notation / rough-line / rough-arrow 三种工具（draw 工具不向模型开放）。',
    // 仅注册 3 个工具，draw 已下线
    tools: [getRoughNotationAgentTool(), ...getRoughDrawingAgentTools()],
  }
}

export function getAgentBDirectorView() {
  const catalog = getAgentBoardToolCatalog()
  return {
    version: catalog.version,
    rule: catalog.rule,
    tools: catalog.tools.map(({ id, purpose, actionSchema, actions, example }) => ({
      id,
      purpose,
      actionSchema,
      ...(actions ? { actions } : {}),
      ...(example ? { example } : {}),
    })),
  }
}

export function validateBoardToolAction(action) {
  if (action?.tool === ROUGH_NOTATION_TOOL_ID) return validateRoughNotationAction(action)
  if (ROUGH_DRAWING_TOOL_IDS.includes(action?.tool)) return validateRoughDrawingAction(action)
  // draw 工具已下线，不再校验
  return { ok: false, error: `未支持的板书工具: ${action?.tool || '空'}。当前仅支持 rough-notation / rough-line / rough-arrow 三种。` }
}

export function createBoardToolRuntime({
  resolveTarget,
  resolveRegion,
  resolveCanvas,
  resolveRegionBounds,
  boardPlan,
} = {}) {
  const targetRegistry = typeof resolveTarget === 'function'
    ? null
    : createTextTargetRegistry({ resolveRegion })
  const targetResolver = resolveTarget || targetRegistry.resolve
  const scheduler = createHandActionScheduler()
  const preparedPlans = new Set()

  function prepare(action) {
    if (!action || typeof action !== 'object') {
      return { type: 'noop', execute: () => {}, remove: () => {} }
    }
    try {
      if (action?.tool === ROUGH_NOTATION_TOOL_ID) {
        const plan = prepareRoughNotationAction(action, targetResolver)
        preparedPlans.add(plan)
        return plan
      }
      if (ROUGH_DRAWING_TOOL_IDS.includes(action?.tool)) {
        const plan = prepareRoughDrawingAction(action, {
          resolveCanvas,
          resolveRegionBounds: resolveRegionBounds || ((region) => boardPlan?.[region]),
        })
        preparedPlans.add(plan)
        return plan
      }
      // draw 工具已下线，不再调用 prepareDrawIntentAction
    } catch (err) {
      console.warn('[boardToolCatalog] prepare 动作失败降级:', action?.tool, err?.message)
      return {
        type: 'fallback-noop',
        action,
        execute: () => {},
        remove: () => {},
      }
    }
    console.warn(`[boardToolCatalog] 未知板书动作工具: ${action?.tool || '空'}`)
    return { type: 'noop', execute: () => {}, remove: () => {} }
  }

  return {
    enqueue(action) {
      const plan = prepare(action)
      return scheduler.enqueue(plan)
    },
    enqueueAll(actions) {
      const plans = (actions || []).map(prepare)
      return scheduler.enqueueAll(plans)
    },
    clear() {
      scheduler.cancelAll()
      preparedPlans.forEach((plan) => plan.remove?.())
      preparedPlans.clear()
      targetRegistry?.clear()
    },
    subscribe: scheduler.subscribe,
    getState: scheduler.getState,
    listTargets: () => targetRegistry?.list() || [],
  }
}
