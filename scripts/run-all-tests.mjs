#!/usr/bin/env node
/**
 * run-all-tests.mjs — 统一测试入口
 * 一键跑全部测试, 任一失败返回非零退出码
 */

import { execSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const tests = [
  { name: 'superFilter v2 (92 用例)',     cmd: 'node scripts/test-superFilter.mjs' },
  { name: 'parseLLMJson (16 用例)',     cmd: 'node scripts/test-parseLLMJson.mjs' },
  { name: 'timing fix (5 用例)',         cmd: 'node scripts/test-timing-fix.mjs' },
  { name: 'timing computeRowGroup (7+6)', cmd: 'node scripts/test-timing-computeRowGroup.mjs' },
  { name: 'skillViolations (12 用例)',  cmd: 'node scripts/smoke-test-skills.mjs' },
  { name: 'boardToolCatalog 降级隔离 (8 用例)', cmd: 'node scripts/test-board-tool-catalog.mjs' },
  { name: 'knowledge contract (知识关联链契约)', cmd: 'node scripts/test-knowledge-contract.mjs' },
  { name: 'knowledge apply (R8-① 先确认再落盘 12 用例)', cmd: 'node scripts/test-knowledge-apply.mjs' },
  { name: 'env config (Task 18 统一化 17 用例)', cmd: 'node scripts/test-env-config.mjs' },
  { name: 'board background (Task 22 截图底图 6 用例)', cmd: 'node scripts/test-board-background.mjs' },
  { name: 'cleanup keep (R8-② 误删修复 6 用例)', cmd: 'node scripts/test-cleanup-keep.mjs' },
  { name: 'b cache (R8-⑤ 缓存键盲区 7 用例)', cmd: 'node scripts/test-b-cache.mjs' },
  { name: 'check ratio (R8-③ 配比盲视 10 用例)', cmd: 'node scripts/test-check-ratio.mjs' },
  { name: 'deliverable doctype (病头修复 10 用例)', cmd: 'node scripts/test-deliverable-doctype.mjs' },
  { name: 'speech regen button (按钮消失修复 6 用例)', cmd: 'node scripts/test-speech-regen-button.mjs' },
  { name: 'visual timeline (滚动+动作 10 用例)', cmd: 'node scripts/test-visual-timeline.mjs' },
  { name: 'row-player stage flow (同 stage 顺序排版 34 用例)', cmd: 'node scripts/test-row-player-stage-flow.mjs' },
  { name: 'step1 recognition robustness (第一步卡死防线 18 用例)', cmd: 'node scripts/test-step1-recognition-robustness.mjs' },
  { name: 'step1 canvas text (回填修复+blocks防御 25 用例)', cmd: 'node scripts/test-step1-canvas-text.mjs' },
  { name: 'step1 content region (贴图布局规则 21 用例)', cmd: 'node scripts/test-step1-content-region.mjs' },
  { name: 'refine json safe (优化确认 json 报错修复 20 用例)', cmd: 'node scripts/test-refine-json-safe.mjs' },
  { name: 'validate_contract',          cmd: 'node skills/board-lecture-player/scripts/validate_contract.cjs skills/board-lecture-player/assets/sample-rows.json' },
  { name: 'action whitelist sync (真源同步哨兵 54 用例)', cmd: 'node scripts/test-action-whitelist-sync.mjs' },
  { name: 'proxy self check (动作白名单运行时自检)',      cmd: 'node server/proxySelfCheck.js' },
  { name: 'playback speed sync (提速归一哨兵 69 用例)', cmd: 'node scripts/test-playback-speed-sync.mjs' },
  { name: 'font single source (字体宪法v2+v2.1切换器归一哨兵 55 用例)', cmd: 'node scripts/test-font-single-source.mjs' },
  { name: 'audio url lifecycle (哑巴根因链 16 用例)', cmd: 'node scripts/test-audio-url-lifecycle.mjs' },
  { name: 'repo hygiene (仓库卫生哨兵·版本/镜像/死档/宪法 30 用例)', cmd: 'node scripts/test-repo-hygiene.mjs' },
]

let pass = 0, fail = 0

console.log('═══════════════════════════════════════════════════')
console.log('  全部测试 · 一键执行')
console.log('═══════════════════════════════════════════════════\n')

for (const t of tests) {
  try {
    const output = execSync(t.cmd, { cwd: root, encoding: 'utf-8', timeout: 15000 })
    // execSync 非零退出码会抛异常（= 测试失败）；这里只需从输出中挑摘要行展示
    const lines = output.trim().split('\n')
    const summaryLine = lines.filter(l => /通过|PASS|已统一/.test(l)).pop() || lines.pop()
    console.log(`✓ ${t.name}: ${summaryLine}`)
    pass++
  } catch (e) {
    console.log(`✗ ${t.name}: FAILED (${e.message.slice(0, 80)})`)
    fail++
  }
}

console.log(`\n═══════════════════════════════════════════════════`)
console.log(`  结果: ${pass}/${pass + fail} 通过, ${fail} 失败`)
console.log(`═══════════════════════════════════════════════════`)

process.exit(fail ? 1 : 0)
