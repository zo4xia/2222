#!/usr/bin/env node
/**
 * test-board-background.mjs — Task 22 结构契约：AgentA 排版截图 = 画布底图原装引用
 * 防将来改丢三条接线：
 *   1. RealBoardPreview 有 backgroundImageUrl prop + L1 优先引用 + BoardContentLayer 退位
 *   2. BoardPreviewApp 把 screenshotUrl 传下去（此前收了没用——最后一厘米断线）
 *   3. Step1Entry 生产方不传 backgroundImageUrl（AgentA 排版行为不变）
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf-8')
let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('── 画布底图原装引用契约（Task 22）──')

ok('RealBoardPreview: backgroundImageUrl prop 定义存在', () => {
  const s = read('src/components/RealBoardPreview.vue')
  assert.ok(s.includes('backgroundImageUrl: { type: String, default: \'\' }'), 'prop 定义缺失')
})

ok('RealBoardPreview: L1 底图截图优先（无截图回退纸张）', () => {
  const s = read('src/components/RealBoardPreview.vue')
  assert.ok(s.includes(':src="backgroundImageUrl || canvasImageUrl"'), 'L1 引用链缺失')
})

ok('RealBoardPreview: 有背景截图时 BoardContentLayer 题目二次排版退位', () => {
  const s = read('src/components/RealBoardPreview.vue')
  assert.ok(/<BoardContentLayer\s+v-if="!backgroundImageUrl"/.test(s), 'v-if 退位条件缺失')
})

ok('BoardPreviewApp: screenshotUrl 已接线传给画布（最后一厘米）', () => {
  const s = read('src/board-preview/BoardPreviewApp.vue')
  // ★ Task 58 布局修订闭环升级：非编辑态直传 screenshotUrl（原形态）；布局编辑态临时退截图
  //   底图复活活排版（layoutEditMode ? '' : screenshotUrl）——两种形态都满足
  //   「screenshotUrl 接线给画布」的哨兵意图，缺一即红。
  const wired = s.includes(':background-image-url="screenshotUrl"')
    || /:background-image-url="layoutEditMode \? '' : screenshotUrl"/.test(s)
  assert.ok(wired, '接线缺失')
})

ok('Step1Entry: 生产方不传 backgroundImageUrl（AgentA 排版行为不变）', () => {
  const s = read('src/components/Step1Entry.vue')
  assert.ok(!s.includes('background-image-url'), '生产方误传新 prop 会破坏排版阶段')
  assert.ok(!s.includes('backgroundImageUrl'), '生产方误用新 prop')
})

ok('固化链: AgentBDirect payload 仍带 screenshotUrl（数据源不丢）', () => {
  const s = read('src/agent-b-v2/AgentBDirect.vue')
  assert.ok(s.includes('screenshotUrl: payload.screenshotUrl || handoff.value?.screenshotUrl'), '固化链数据源缺失')
})

console.log(`\n结果: ${pass + fail} 用例, ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
