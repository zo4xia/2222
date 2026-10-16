#!/usr/bin/env node
/**
 * test-action-whitelist-sync.mjs — 动作白名单"唯一真源"同步哨兵（2026-10-13 参数多地点定义审计）
 *
 * 背景（本测试要防的病）：动作白名单曾至少 5 处平行定义且互相矛盾——
 *   ① 真源 roughNotationTool.ROUGH_NOTATION_ENABLED_ACTIONS = 3 动作；
 *   ② proxySelfCheck.js 抄写 7 动作旧清单（含 box/bracket/strike-through/crossed-off）
 *     → npm run check:proxy 必炸（AssertionError）；
 *   ③ board-lecture-player 技能包「一期只 circle/underline」收口（SKILL/README/校验器三件）
 *     → 校验器把 highlight/rough-line/rough-arrow 全判 ERROR，与自家 contract-upstream.md
 *     动作表（5 行白名单）同文档内自相矛盾；
 *   ④ hand-action-control SKILL.md §八 快速参考漏 circle（同文件 §三 有 circle，内部打架）；
 *   ⑤ speech-board-timing SKILL.md/meta.json 时长行漏 circle 1500（timing.js 真源有）。
 *
 * 修复原则（夏夏钦定锚定顺序：用户规格 > 播放端事实 > 生成侧白名单）：
 *   一切动作清单从真源 ROUGH_NOTATION_ENABLED_ACTIONS + boardToolCatalog 派生；
 *   文档摘要行必须与真源一致；校验器白名单必须放行真源三动作 + line/arrow。
 *
 * 本哨兵持续守卫：真源派生断言 + 校验器行为断言（放行/拒收）+ 文档摘要行同步断言。
 */

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const read = (p) => readFileSync(resolve(root, p), 'utf8')

const { ROUGH_NOTATION_ENABLED_ACTIONS } = await import('../src/board-tools/roughNotationTool.js')
const { getAgentBoardToolCatalog } = await import('../src/board-tools/boardToolCatalog.js')

let pass = 0, fail = 0
const check = (name, cond) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`) }
}

console.log('━━ 1. 真源派生（代码层唯一真源）')
check('真源 = 动作 1.0 两 notation 动作 underline/circle（Task 43 夏夏拍板）', ROUGH_NOTATION_ENABLED_ACTIONS.length === 2
  && ROUGH_NOTATION_ENABLED_ACTIONS.includes('underline')
  && ROUGH_NOTATION_ENABLED_ACTIONS.includes('circle'))
const catalog = getAgentBoardToolCatalog()
check('catalog 工具集 = 动作 1.0 三件 rough-notation/rough-line（arrow/draw 已砍）',
  JSON.stringify(catalog.tools.map((t) => t.id)) === JSON.stringify(['rough-notation', 'rough-line']))
check('catalog notation 动作表与真源一致（不再平行漂移）',
  JSON.stringify(catalog.tools[0].actions.map((a) => a.action)) === JSON.stringify([...ROUGH_NOTATION_ENABLED_ACTIONS]))

console.log('━━ 2. proxySelfCheck 不再平行抄写清单（曾因此必炸）')
const proxySrc = read('server/proxySelfCheck.js')
check('断言改为 import 真源派生（ROUGH_NOTATION_ENABLED_ACTIONS）', proxySrc.includes('ROUGH_NOTATION_ENABLED_ACTIONS'))
check('7 动作旧清单残留清零（代码串中不再出现 box/bracket/strike-through/crossed-off）',
  !/'box'|'bracket'|'strike-through'|'crossed-off'/.test(proxySrc))

console.log('━━ 3. check 职责头注释与终裁口径同步（两处曾自相矛盾）')
const promptSrc = read('src/check-agent/prompt.js')
const handlerSrc = read('server/checkAgentHandler.js')
check('prompt.js 头注释不再教「废话合并：行合并/精简」', !promptSrc.includes('废话合并：重复啰嗦'))
check('checkAgentHandler.js 头注释同步终裁口径', !handlerSrc.includes('废话合并：重复啰嗦'))
check('prompt 正文行数守恒硬约束仍在（真规则没被误伤）',
  promptSrc.includes('行数守恒硬约束') && promptSrc.includes('收尾金句绝对保护'))

console.log('━━ 4. validate_contract.cjs 行为断言（白名单放行/拒收）')
const validator = resolve(root, 'skills/board-lecture-player/scripts/validate_contract.cjs')
const runValidator = (file) => {
  try {
    execFileSync('node', [validator, file, '--json'], { cwd: root, encoding: 'utf8', timeout: 15000 })
    return { code: 0, out: '' }
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }
  }
}
const sample = JSON.parse(read('skills/board-lecture-player/assets/sample-rows.json'))
const tmp = resolve(root, 'scripts/.tmp-whitelist-fixture.json')
const writeFixture = (rows) => writeFileSync(tmp, JSON.stringify({ rows }, null, 2), 'utf8')
try {
  // 4a. 官方示例（动作 1.0 三动作示范）必须 PASS
  const r0 = runValidator(resolve(root, 'skills/board-lecture-player/assets/sample-rows.json'))
  check('官方 sample-rows.json（动作 1.0 三动作示范）PASS', r0.code === 0)

  // 4b. 动作 1.0 三动作全放行（旧校验器会误杀）
  const okRows = sample.rows.map((row, i) => i === 2
    ? { ...row, actionSpec: [
        { action: { tool: 'rough-notation', action: 'underline', target: { region: 'solution', exactText: '244.8', occurrence: 1 }, options: { multiline: false }, order: 5 } },
        { action: { tool: 'rough-notation', action: 'circle', target: { region: 'solution', exactText: '244.8', occurrence: 1 }, options: { multiline: false }, order: 6 } },
        { action: { tool: 'rough-line', region: 'solution', start: [20, 52], end: [50, 52], order: 7 } },
      ] }
    : row)
  writeFixture(okRows)
  const r1 = runValidator(tmp)
  check('underline + circle + rough-line 全部放行（动作 1.0 白名单与真源同口径）', r1.code === 0)

  // 4c. 真源外动作仍拒收（白名单语义不松）
  const badRows = sample.rows.map((row, i) => i === 2
    ? { ...row, actionSpec: [{ action: { tool: 'rough-notation', action: 'box', target: { region: 'solution', exactText: '244.8', occurrence: 1 }, order: 5 } }] }
    : row)
  writeFixture(badRows)
  const r2 = runValidator(tmp)
  check('box 动作仍拒收（白名单未放宽）', r2.code === 1 && r2.out.includes('不在白名单'))

  // 4d. draw 拒收（Task 43 已砍 + R6 半孤岛销账，不进播放器契约）
  const drawRows = sample.rows.map((row, i) => i === 2
    ? { ...row, actionSpec: [{ action: { tool: 'draw', region: 'solution', order: 5 } }] }
    : row)
  writeFixture(drawRows)
  const r3 = runValidator(tmp)
  check('draw 拒收（Task 43 动作 1.0 白名单外）', r3.code === 1 && r3.out.includes('不在白名单'))

  // 4e. line 坐标形状校验
  const coordRows = sample.rows.map((row, i) => i === 2
    ? { ...row, actionSpec: [{ action: { tool: 'rough-line', region: 'solution', start: [150, 52], end: [50, 52], order: 5 } }] }
    : row)
  writeFixture(coordRows)
  const r4 = runValidator(tmp)
  check('rough-line 百分比越界（>100）拒收', r4.code === 1 && r4.out.includes('越界'))
} finally {
  rmSync(tmp, { force: true })
}

console.log('━━ 5. 文档摘要行与真源同步（多点定义一致性）')
const hacSkill = read('skills/hand-action-control/SKILL.md')
check('hand-action-control §八 快速参考 = 动作 1.0 三动作口径',
  hacSkill.includes('rough-notation(underline/circle) / rough-line'))
const sbtSkill = read('skills/speech-board-timing/SKILL.md')
const sbtMeta = read('skills/speech-board-timing/meta.json')
check('speech-board-timing SKILL.md 时长行 = 分档口径（画圈固定 1000）', sbtSkill.includes('画圈固定 1000'))
check('speech-board-timing meta.json 同步分档口径', sbtMeta.includes('画圈固定 1000'))
const blpSkill = read('skills/board-lecture-player/SKILL.md')
check('board-lecture-player SKILL.md 不再有「一期只有 circle/underline」收口', !blpSkill.includes('一期') || !blpSkill.includes('circle` / `underline'))
check('board-lecture-player SKILL.md 输入契约 = 动作 1.0 三动作',
  blpSkill.includes('underline` / `circle') && blpSkill.includes('+ `rough-line` 横线'))
const cu = read('skills/board-lecture-player/references/contract-upstream.md')
check('contract-upstream 自检清单 = 动作 1.0 三动作口径',
  cu.includes('underline/circle）/ rough-line（Task 43 动作 1.0 三动作）'))
check('contract-upstream 指向 .cjs（.js 双胞胎已删）', cu.includes('validate_contract.cjs') && !cu.includes('validate_contract.js'))
const skillsReadme = read('skills/README.md')
check('skills README 不再教「一期动作 circle+underline」', !skillsReadme.includes('一期动作 circle+underline'))
const playerSrc = read('public/row-player.html')
check('row-player 播放端无 box 幽灵分支（白名单外动作零残留）', !playerSrc.includes("sub==='box'"))

console.log(`\n  动作白名单同步哨兵: ${pass}/${pass + fail} 通过${fail ? `, ${fail} 失败` : ''}`)
process.exit(fail ? 1 : 0)
