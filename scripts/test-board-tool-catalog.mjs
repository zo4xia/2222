/**
 * test-board-tool-catalog.mjs — 板书播放链降级隔离回归测试
 *
 * 背景（2026-10-13 第六轮实锤）：boardToolCatalog.prepare() 三处降级/noop 路径
 * 曾引用未导入的 MIN_HAND_LIFT_GAP_MS，导致"单步失败降级"自身抛 ReferenceError，
 * 一个坏动作炸死整批播放。本测试锁死以下行为：
 *   1. 未知工具名 → 降级 noop，enqueue 正常排队执行，不抛同步异常
 *   2. 合法工具但 prepare 失败（目标失配）→ fallback-noop，同样隔离
 *   3. 混入坏动作的 enqueueAll 整批存活，后续动作照常执行
 *   4. 降级 plan 的 gapAfterMs = MIN_HAND_LIFT_GAP_MS（1000ms，真源 boardToolTiming.js）
 *   5. cancelAll 后 enqueue 不互斥死锁（generation 语义）
 *   6. 取消类拒绝可被 catch 捕获（unhandled rejection 隔离模式成立）
 */
import {
  createBoardToolRuntime,
} from '../src/board-tools/boardToolCatalog.js'
import { MIN_HAND_LIFT_GAP_MS } from '../src/board-tools/boardToolTiming.js'

let pass = 0
let fail = 0
function assert(condition, name, detail = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

const noopDom = () => null
function freshRuntime() {
  return createBoardToolRuntime({
    resolveCanvas: noopDom,
    resolveRegion: noopDom,
    resolveRegionBounds: noopDom,
    boardPlan: {},
  })
}

const badNotation = {
  tool: 'rough-notation',
  action: 'underline',
  target: { region: 'analysis', exactText: '不存在文本', occurrence: 1 },
  order: 2,
}

console.log('=== 1. 未知工具名：prepare 降级不抛同步异常 ===')
{
  const runtime = freshRuntime()
  let threw = null
  try { runtime.enqueue({ tool: 'magic-pen', order: 1 }) } catch (err) { threw = err }
  assert(!threw, '未知工具 enqueue 不抛同步异常', threw ? `${threw.constructor.name}: ${threw.message}` : '')
}

console.log('=== 2. 合法工具 prepare 失败：catch 降级自身可执行 ===')
{
  const runtime = freshRuntime()
  let threw = null
  try { runtime.enqueue(badNotation) } catch (err) { threw = err }
  assert(!threw, '目标失配 enqueue 不抛同步异常', threw ? `${threw.constructor.name}: ${threw.message}` : '')
}

console.log('=== 3. 混批存活：坏动作不炸整批 enqueueAll ===')
{
  const runtime = freshRuntime()
  const results = await Promise.allSettled(runtime.enqueueAll([
    { tool: 'magic-pen', order: 1 },
    { ...badNotation },
    { tool: 'another-fake', order: 3 },
  ]))
  const fulfilled = results.filter((r) => r.status === 'fulfilled')
  // noop durationMs=100 + gap 1000ms；真实等待由 wait() 驱动，allSettled 等全部完成
  assert(fulfilled.length === 3, '三个动作全部完成（含降级）', `fulfilled=${fulfilled.length}`)
}

console.log('=== 4. 降级 plan 尊重调度器硬下限（MIN_HAND_LIFT_GAP_MS） ===')
{
  const runtime = freshRuntime()
  const state = runtime.getState()
  assert(state.minimumGapMs === MIN_HAND_LIFT_GAP_MS,
    `调度器硬下限 = ${MIN_HAND_LIFT_GAP_MS}ms（boardToolTiming.js 真源）`,
    `实际 ${state.minimumGapMs}`)
  // 降级 plan 的 gapAfterMs 不再触发 enqueue 校验拒绝（gapAfterMs 缺省/等于下限均合法）
  const results = await Promise.allSettled(runtime.enqueueAll([
    { tool: 'fake-a', order: 1 },
    { tool: 'fake-b', order: 2 },
  ]))
  assert(results.every((r) => r.status === 'fulfilled'),
    '降级动作全部通过 gapAfterMs 校验并完成')
}

console.log('=== 5. cancelAll 后可重新入队（重播语义） ===')
{
  const runtime = freshRuntime()
  const first = runtime.enqueueAll([
    { tool: 'fake-long-a', order: 1 },
    { tool: 'fake-long-b', order: 2 },
  ])
  runtime.clear()
  const cancelled = await Promise.allSettled(first)
  assert(cancelled.every((r) => r.status === 'rejected'),
    '旧批次全部以拒绝收尾（已取消）')
  const second = await Promise.allSettled(runtime.enqueueAll([
    { tool: 'fake-new', order: 1 },
  ]))
  assert(second.every((r) => r.status === 'fulfilled'),
    'clear 后新批次正常执行（generation 不串台）')
}

console.log('=== 6. 取消拒绝可捕获（unhandled rejection 隔离模式） ===')
{
  const runtime = freshRuntime()
  const task = runtime.enqueue({ tool: 'fake-cancel-me', order: 1 })
  const observed = task.then(() => null, (err) => err)
  runtime.clear() // 任务在途时取消
  const result = await observed
  assert(result instanceof Error && /已取消/.test(result.message),
    '取消拒绝可被 catch 捕获（隔离模式成立）', `result=${result && result.message}`)
}

console.log(`\n结果: ${pass}/${pass + fail} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
