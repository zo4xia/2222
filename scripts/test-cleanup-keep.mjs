#!/usr/bin/env node
/**
 * test-cleanup-keep.mjs — Task 23 = R8-② cleanup 双误删修复契约
 * 场景：临时目录构造 handoff 指针+实体、deliverable 指针+payload 引用链、
 * 新旧 mtime 缓存文件，断言：引用链全保留、未引用旧文件正常清、48h 内缓存不删。
 */
import { strict as assert } from 'node:assert'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { cleanupGeneratedFiles, collectKeepSet } = await import('../server/cleanupHandler.js')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

const base = mkdtempSync(join(tmpdir(), 'cleanup-keep-'))
const DAY = 24 * 60 * 60 * 1000
const threeDaysAgo = new Date(Date.now() - 3 * DAY)

const w = (dir, name, content, oldMtime = false) => {
  mkdirSync(join(base, dir), { recursive: true })
  const p = join(base, dir, name)
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content))
  if (oldMtime) utimesSync(p, threeDaysAgo, threeDaysAgo)
  return p
}

// ── 场景构造 ──
// handoff：指针 → 实体（screenshotUrl 指向 pic/active-shot.jpg）
w('handoff', 'current.json', { projectCode: 'P1', filename: 'handoff-P1.json', createdAt: '2026-10-13T00:00:00Z' })
w('handoff', 'handoff-P1.json', { projectCode: 'P1', screenshotUrl: '/pic/active-shot.jpg' })

// deliverable：指针带全量 payload（背景图 + 两前缀行音频）
w('deliverable', 'current.json', {
  projectCode: 'P1', filename: 'deliverable-P1.json', htmlFilename: 'deliverable-P1.html',
  deliverable: {
    screenshotUrl: '/pic/deliverable-bg.jpg',
    rows: [
      { audioUrl: '/audio/a-fixed.mp3' },
      { audioUrl: '/audio-cache/b-md5.mp3' },
      { audioUrl: '音频暂未生成' },   // 非法值应被安全忽略
    ],
  },
})
w('deliverable', 'deliverable-P1.json', { screenshotUrl: '/pic/deliverable-bg.jpg', rows: [] })

// pic：活跃截图×2 + 陈旧截图×1
w('pic', 'active-shot.jpg', 'x', true)        // 被 handoff 实体引用（mtime 旧也必须保留）
w('pic', 'deliverable-bg.jpg', 'x', true)     // 被 deliverable payload 引用
w('pic', 'stale-shot.jpg', 'x', true)         // 无引用 → 删

// audio：被引用×1 + 未引用×1
w('audio', 'a-fixed.mp3', 'x', true)
w('audio', 'stale-voice.mp3', 'x', true)

// audio-cache：被引用×1 + 新鲜未引用×1 + 陈旧未引用×1
w('audio-cache', 'b-md5.mp3', 'x', true)
w('audio-cache', 'fresh-mid.mp3', 'x')        // mtime = 现在（48h 保护）
w('audio-cache', 'old-mid.mp3', 'x', true)    // mtime 3 天前无引用 → 删

// board-result：指针保留 + 未引用实体删
w('board-result', 'current.json', { filename: 'board-P1.json' })
w('board-result', 'board-P1.json', '{}')
w('board-result', 'orphan-P0.json', '{}')

console.log('── R8-② cleanup keep 引用链 ──')

ok('keep 集合：handoff 指针解引用拿到活跃截图文件名', () => {
  const keep = collectKeepSet(base)
  assert.ok(keep.has('active-shot.jpg'), 'handoff 实体 screenshotUrl 未进 keep')
  assert.ok(keep.has('handoff-P1.json'), 'handoff 实体文件本身未进 keep')
})

ok('keep 集合：deliverable 背景图 + 双前缀行音频全收', () => {
  const keep = collectKeepSet(base)
  assert.ok(keep.has('deliverable-bg.jpg'), 'payload.screenshotUrl 未进 keep')
  assert.ok(keep.has('a-fixed.mp3'), '/audio/ 行音频未进 keep')
  assert.ok(keep.has('b-md5.mp3'), '/audio-cache/ 行音频未进 keep')
})

ok('误删清零：活跃截图/被引音频/48h 内缓存全保留', () => {
  const r = cleanupGeneratedFiles(base)
  const removed = new Set(r.files)
  for (const survivor of [
    'pic/active-shot.jpg', 'pic/deliverable-bg.jpg',
    'audio/a-fixed.mp3', 'audio-cache/b-md5.mp3', 'audio-cache/fresh-mid.mp3',
    'board-result/board-P1.json', 'deliverable/deliverable-P1.json',
  ]) {
    assert.ok(existsSync(join(base, survivor)), `${survivor} 被误删！`)
    assert.ok(!removed.has(survivor), `${survivor} 出现在删除清单`)
  }
})

ok('该清的照清：无引用陈旧文件正常删除', () => {
  assert.ok(!existsSync(join(base, 'pic/stale-shot.jpg')), '陈旧截图未清')
  assert.ok(!existsSync(join(base, 'audio/stale-voice.mp3')), '未引用音频未清')
  assert.ok(!existsSync(join(base, 'audio-cache/old-mid.mp3')), '陈旧缓存未清')
  assert.ok(!existsSync(join(base, 'board-result/orphan-P0.json')), '孤儿 board-result 未清')
})

ok('指针与 HTML 本体保留（current.json/current.html 不清）', () => {
  assert.ok(existsSync(join(base, 'handoff/current.json')))
  assert.ok(existsSync(join(base, 'deliverable/current.json')))
  assert.ok(existsSync(join(base, 'board-result/current.json')))
})

ok('deliverable 指针无内嵌全量时退实体文件兜底', () => {
  // 重建一个只有 filename 指针（无 deliverable 字段）的目录验证兜底链
  const base2 = mkdtempSync(join(tmpdir(), 'cleanup-fallback-'))
  const w2 = (dir, name, content) => {
    mkdirSync(join(base2, dir), { recursive: true })
    writeFileSync(join(base2, dir, name), typeof content === 'string' ? content : JSON.stringify(content))
  }
  w2('deliverable', 'current.json', { filename: 'deliverable-X.json' })
  w2('deliverable', 'deliverable-X.json', { screenshotUrl: '/pic/x-bg.jpg', rows: [{ audioUrl: '/audio-cache/x-md5.mp3' }] })
  w2('pic', 'x-bg.jpg', 'x')
  const keep = collectKeepSet(base2)
  assert.ok(keep.has('x-bg.jpg') && keep.has('x-md5.mp3') && keep.has('deliverable-X.json'), '实体兜底链失效')
  rmSync(base2, { recursive: true, force: true })
})

rmSync(base, { recursive: true, force: true })
console.log(`\n结果: ${pass + fail} 用例, ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
