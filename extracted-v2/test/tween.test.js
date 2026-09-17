/**
 * @qh-core LANE=TEST POINT=TWEEN 缓动函数单元测试
 *
 * 注意：tween.js 用了 performance.now() 和 requestAnimationFrame()，
 * 在 node 测试环境需要 polyfill
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { performance } from 'perf_hooks'

// node 环境模拟浏览器 API
beforeAll(() => {
  globalThis.performance = globalThis.performance || performance
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(globalThis.performance.now()), 16)
    globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
  }
})

const tweenModule = await import('../../src/utils/tween.js')
const { Easing, tweenAnimate, stopAnimation } = tweenModule

describe('Easing 函数库', () => {
  it('linear 应返回输入值', () => {
    expect(Easing.linear(0)).toBe(0)
    expect(Easing.linear(0.5)).toBe(0.5)
    expect(Easing.linear(1)).toBe(1)
  })

  it('easeInQuad 应满足 t² 关系', () => {
    expect(Easing.easeInQuad(0)).toBe(0)
    expect(Easing.easeInQuad(0.5)).toBeCloseTo(0.25)
    expect(Easing.easeInQuad(1)).toBe(1)
  })

  it('easeOutQuad 应满足 2t-t² 关系', () => {
    expect(Easing.easeOutQuad(0)).toBe(0)
    expect(Easing.easeOutQuad(0.5)).toBeCloseTo(0.75)
    expect(Easing.easeOutQuad(1)).toBe(1)
  })

  it('所有缓动函数端点 0→0, 1→1', () => {
    for (const [_name, fn] of Object.entries(Easing)) {
      const at0 = fn(0)
      const at1 = fn(1)
      expect(at0).toBeGreaterThanOrEqual(-0.001)
      expect(at0).toBeLessThanOrEqual(0.001)
      expect(at1).toBeGreaterThanOrEqual(0.999)
      expect(at1).toBeLessThanOrEqual(1.001)
    }
  })

  it('不存在的缓动名应回退到 linear', () => {
    const easeFn = Easing['nonExistent'] || Easing.linear
    expect(easeFn(0.5)).toBe(0.5)
  })
})

describe('tweenAnimate', () => {
  it('应在 duration 后调用 onComplete', async () => {
    const target = { x: 0 }
    const promise = new Promise((resolvePromise) => {
      tweenAnimate(target, { x: 100 }, {
        duration: 50,
        easing: 'linear',
        onComplete: () => resolvePromise(target.x),
      })
    })
    const finalX = await promise
    expect(finalX).toBeCloseTo(100, 0)
  })

  it('应能在完成前停止动画', async () => {
    const target = { x: 0 }
    let completed = false
    const tweenId = tweenAnimate(target, { x: 1000 }, {
      duration: 1000,
      easing: 'linear',
      onComplete: () => { completed = true },
    })
    stopAnimation(tweenId)
    await new Promise(r => setTimeout(r, 100))
    expect(completed).toBe(false)
  })

  it('应支持 delay 参数', async () => {
    const target = { x: 0 }
    let started = false
    tweenAnimate(target, { x: 1 }, {
      duration: 50,
      delay: 100,
      onStart: () => { started = true },
      onComplete: () => {},
    })
    await new Promise(r => setTimeout(r, 200))
    expect(started).toBe(true)
  })
})
