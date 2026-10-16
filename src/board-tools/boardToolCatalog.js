/* @qh-core LANE=SHARED POINT=TOOL_CATALOG only registered actions for B script */
import { createHandActionScheduler } from './handActionScheduler.js'
import { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'
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

export const BOARD_TOOL_CATALOG_VERSION = '1.5.0'  // ★ Task 43 动作 1.0：砍 drawIntent（R6 半孤岛销账）

export function getAgentBoardToolCatalog() {
  return {
    version: BOARD_TOOL_CATALOG_VERSION,
    rule: '只能使用 tools 中已声明的工具和 action；没有工具就返回缺口，禁止自造调用',
    // ★ Task 43 夏夏拍板「动作 1.0」：三动作白名单（下划线/横线/画圈），
    // highlight / rough-arrow / draw 全砍（「其他做我怕做不好」）
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
  return { ok: false, error: `未支持的板书工具: ${action?.tool || '空'}（Task 43 动作 1.0 白名单：下划线/横线/画圈）` }
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

  // 降级计划归一工厂（2026-10-13 第六轮）：空动作 / 未知工具 / prepare 失败统一走这里。
  // 修复实锤：原三份内联副本引用了未导入的 MIN_HAND_LIFT_GAP_MS，导致“单步失败降级”
  // 路径自身抛 ReferenceError 炸死整批播放（复现见 scripts/test-board-tool-catalog.mjs）。
  function degradedPlan(action, type) {
    const order = Number.isFinite(action?.order) ? Math.round(action.order) : 1
    return {
      id: `${type}:${action?.tool || (action ? 'unknown' : 'empty')}:${order}:${Date.now()}`,
      order,
      durationMs: 100,
      gapAfterMs: MIN_HAND_LIFT_GAP_MS,
      type,
      execute: () => {},
      remove: () => {},
    }
  }

  function prepare(action) {
    if (!action || typeof action !== 'object') {
      return degradedPlan(null, 'noop')
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
      console.warn(`[boardToolCatalog] 未知板书动作工具: ${action?.tool || '空'}（已降级 noop，不阻断后续动作）`)
      return degradedPlan(action, 'noop')
    } catch (err) {
      console.warn('[boardToolCatalog] prepare 动作失败降级（单步隔离，不阻断后续）:', action?.tool, err?.message)
      return degradedPlan(action, 'fallback-noop')
    }
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
