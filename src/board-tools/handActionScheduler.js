import { MIN_HAND_LIFT_GAP_MS } from './boardToolTiming.js'

function wait(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs))
}

export function createHandActionScheduler({ minimumGapMs = MIN_HAND_LIFT_GAP_MS } = {}) {
  if (!Number.isFinite(minimumGapMs) || minimumGapMs < MIN_HAND_LIFT_GAP_MS) {
    throw new Error(`Agent C 老师手抬笔间隔不得小于 ${MIN_HAND_LIFT_GAP_MS}ms`)
  }

  let tail = Promise.resolve()
  let activeActionId = ''
  let activePlan = null
  let nextAllowedAt = 0
  let generation = 0
  const listeners = new Set()

  function notify() {
    const state = { activeActionId, nextAllowedAt, minimumGapMs }
    listeners.forEach((listener) => listener(state))
  }

  function enqueue(plan) {
    if (!plan?.id || typeof plan.execute !== 'function') {
      return Promise.reject(new Error('手部动作缺少 id 或 execute'))
    }
    if (!Number.isFinite(plan.durationMs) || plan.durationMs <= 0) {
      return Promise.reject(new Error(`动作 ${plan.id} 缺少有效 durationMs`))
    }
    if ((plan.gapAfterMs ?? minimumGapMs) < minimumGapMs) {
      return Promise.reject(new Error(`动作 ${plan.id} 的抬笔间隔小于 ${minimumGapMs}ms`))
    }

    const queuedGeneration = generation
    const task = tail.then(async () => {
      if (queuedGeneration !== generation) throw new Error(`动作 ${plan.id} 已取消`)
      const waitBeforeMs = Math.max(0, nextAllowedAt - Date.now())
      if (waitBeforeMs) await wait(waitBeforeMs)
      if (queuedGeneration !== generation) throw new Error(`动作 ${plan.id} 已取消`)
      if (activeActionId) throw new Error(`互斥冲突：${activeActionId} 尚未结束`)

      activeActionId = plan.id
      activePlan = plan
      notify()
      try {
        const result = plan.execute()
        await wait(plan.durationMs)
        if (queuedGeneration === generation) {
          nextAllowedAt = Date.now() + Math.max(plan.gapAfterMs ?? minimumGapMs, minimumGapMs)
        }
        return result
      } finally {
        activeActionId = ''
        activePlan = null
        notify()
      }
    })

    tail = task.catch(() => {})
    return task
  }

  function cancelAll() {
    generation += 1
    activePlan?.cancel?.()
    nextAllowedAt = 0
    notify()
  }

  return {
    enqueue,
    enqueueAll(plans) {
      return [...plans]
        .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
        .map((plan) => enqueue(plan))
    },
    cancelAll,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getState: () => ({ activeActionId, nextAllowedAt, minimumGapMs }),
  }
}
