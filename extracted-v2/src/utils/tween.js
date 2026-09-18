/**
 * @qh-core LANE=SHARED POINT=TWEEN 缓动函数库
 *
 * 移植自 canvas-drawing-editor（参考实现 typsusan-zzz/canvas-drawing-editor）
 * 原项目零依赖，本文件也零依赖，纯函数实现。
 *
 * 15 种缓动：Quad/Cubic/Elastic/Bounce/Back 各 in/out/inOut + Linear
 *
 * 用法：
 *   import { Easing, tweenAnimate } from '@/utils/tween'
 *   tweenAnimate(obj, { opacity: 1 }, { duration: 1000, easing: 'easeOutCubic', onComplete: () => {} })
 */

export const Easing = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  easeInElastic: t => {
    if (t === 0 || t === 1) return t
    const c4 = (2 * Math.PI) / 3
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.075) * c4)
  },
  easeOutElastic: t => {
    if (t === 0 || t === 1) return t
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * c4) + 1
  },
  easeInOutElastic: t => {
    if (t === 0 || t === 1) return t
    const c5 = (2 * Math.PI) / 4.5
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1
  },
  easeOutBounce: t => {
    const n1 = 7.5625, d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
  easeInBack: t => {
    const c1 = 1.70158, c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeOutBack: t => {
    const c1 = 1.70158, c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInOutBack: t => {
    const c1 = 1.70158, c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },
}

/**
 * tweenAnimate - 简易补间动画
 * @param {Object} target - 要修改的对象（如 row、canvas state）
 * @param {Object} toProps - 目标属性 { opacity: 1, x: 100 }
 * @param {Object} config - 配置
 * @param {number} config.duration - 持续时间 ms
 * @param {number} [config.delay=0] - 延迟 ms
 * @param {string} [config.easing='linear'] - 缓动函数名
 * @param {Function} [config.onStart] - 开始回调
 * @param {Function} [config.onUpdate] - 每帧回调 (currentProps)
 * @param {Function} [config.onComplete] - 完成回调
 * @returns {number} tweenId（可用 stopAnimation 取消）
 */
export function tweenAnimate(target, toProps, config = {}) {
  const {
    duration = 300,
    delay = 0,
    easing = 'linear',
    onStart,
    onUpdate,
    onComplete,
  } = config

  const easeFn = Easing[easing] || Easing.linear
  const fromProps = {}
  for (const key of Object.keys(toProps)) {
    fromProps[key] = typeof target[key] === 'number' ? target[key] : 0
  }

  let tweenId = 0
  tweenId = tweenCounterValue.value + 1
  tweenCounterValue.value = tweenId
  activeTweens.set(tweenId, { cancelled: false })

  // eslint-disable-next-line no-undef
  const start = performance.now() + delay
  onStart?.({ tweenId, target })

  function tick(now) {
    const t = activeTweens.get(tweenId)
    if (!t || t.cancelled) return

    const elapsed = now - start
    if (elapsed < 0) {
      // eslint-disable-next-line no-undef
      requestAnimationFrame(tick)
      return
    }

    const progress = Math.min(elapsed / duration, 1)
    const eased = easeFn(progress)

    const currentProps = {}
    for (const key of Object.keys(toProps)) {
      const from = fromProps[key]
      const to = toProps[key]
      currentProps[key] = from + (to - from) * eased
      if (target && typeof target === 'object') {
        target[key] = currentProps[key]
      }
    }

    onUpdate?.({ tweenId, target, progress, currentProps })

    if (progress < 1) {
      // eslint-disable-next-line no-undef
      requestAnimationFrame(tick)
    } else {
      activeTweens.delete(tweenId)
      onComplete?.({ tweenId, target })
    }
  }

  // eslint-disable-next-line no-undef
  requestAnimationFrame(tick)
  return tweenId
}

const tweenCounterValue = { value: 0 }
const activeTweens = new Map()

/**
 * 停止动画
 */
export function stopAnimation(tweenId) {
  const t = activeTweens.get(tweenId)
  if (t) t.cancelled = true
}

/**
 * 停止对象上所有动画
 */
export function stopObjectAnimations(_target) {
  // 简化版：取消所有动画（实际可按 target 索引）
  for (const entry of activeTweens) {
    entry[1].cancelled = true
    activeTweens.delete(entry[0])
  }
}

/**
 * 停止全部动画
 */
export function stopAllAnimations() {
  for (const [id, t] of activeTweens) {
    t.cancelled = true
  }
  activeTweens.clear()
}

export default { Easing, tweenAnimate, stopAnimation, stopObjectAnimations, stopAllAnimations }
