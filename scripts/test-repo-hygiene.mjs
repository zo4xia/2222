#!/usr/bin/env node
/**
 * test-repo-hygiene.mjs — 仓库卫生哨兵（Task 47 · 2026-10-17）
 *
 * 背景：夏夏拍板「先稳住，归一化，删冲突垃圾过期文件，减肥」。
 * 本哨兵锁死 Task 47 归一化成果，防再劈腿：
 *   A. 技能包版本双源一致：meta.json version == SKILL.md frontmatter version（8 包全量）
 *      ——历史病灶：bsr meta 3.3.1 vs SKILL 头 3.2.0、sbt meta 1.3.0 vs SKILL 头 1.2.0 漂移一版
 *   B. skills-hub 镜像字节级同步：5 对（skill-1/2/3/4/5 ↔ 各技能包 examples/demo.html）
 *      ——历史病灶：hub 领先 demo 源落后（skill-2 旧 5 字体 vs hub 新 6 字体、skill-4 缺 Task 43 keyword 段）
 *      skill-6（board-lecture-player）/ skill-7（blingbling）为独立页无镜像契约，断言存在即可
 *   C. 死档不复活：Task 47 砍除的 10 个过期文件不得再现
 *      ——历史病灶：PROJECT_STATE.md 自称「实时真相」实停更 30+ 轮，误导接力者
 *   D. 冲突仲裁原则在宪法：AGENTS.md 必须含「冲突仲裁原则」段（锚定顺序防失传）
 *      ——源自 DECISIONS.md 第七/八轮拍板，文档已砍、原则提炼进宪法
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.error(`  ✗ FAIL: ${label}`) }
}
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex')

console.log('[repo-hygiene] 仓库卫生哨兵（Task 47 归一化锁）')

// ─── A. 版本双源一致 ───────────────────────────────────────────
console.log('A. 技能包版本 meta.json == SKILL.md frontmatter（8 包）')
const packs = readdirSync(resolve(ROOT, 'skills'), { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name)
ok(packs.length === 8, `技能包数量 = 8（实际 ${packs.length}）`)
for (const pack of packs) {
  const metaPath = resolve(ROOT, 'skills', pack, 'meta.json')
  const skillPath = resolve(ROOT, 'skills', pack, 'SKILL.md')
  if (!existsSync(metaPath) || !existsSync(skillPath)) {
    ok(false, `${pack}: meta.json 或 SKILL.md 缺失`)
    continue
  }
  const metaV = JSON.parse(readFileSync(metaPath, 'utf-8')).version
  const fm = readFileSync(skillPath, 'utf-8').match(/^version:\s*"?(\d[\d.]*)"?\s*$/m)
  const skillV = fm ? fm[1] : null
  ok(metaV === skillV && Boolean(metaV), `${pack}: meta=${metaV} == skill=${skillV}`)
}

// ─── B. hub 镜像字节级同步 ─────────────────────────────────────
console.log('B. skills-hub 镜像 md5 一致（5 对 + 2 独立页存在性）')
const mirrorPairs = [
  ['public/skills-hub/skill-1.html', 'skills/board-zone-layout/examples/demo.html'],
  ['public/skills-hub/skill-2.html', 'skills/handwriting-font-policy/examples/demo.html'],
  ['public/skills-hub/skill-3.html', 'skills/hand-action-control/examples/demo.html'],
  ['public/skills-hub/skill-4.html', 'skills/speech-board-timing/examples/demo.html'],
  ['public/skills-hub/skill-5.html', 'skills/field-char-escape-filter/examples/demo.html'],
]
for (const [hub, demo] of mirrorPairs) {
  const hp = resolve(ROOT, hub); const dp = resolve(ROOT, demo)
  if (!existsSync(hp) || !existsSync(dp)) { ok(false, `${hub} 或 ${demo} 缺失`); continue }
  ok(md5(hp) === md5(dp), `${hub.split('/').pop()} ↔ ${demo.replace('skills/', '').replace('/examples/demo.html', '')} 镜像一致（md5=${md5(dp).slice(0, 8)}）`)
}
// skill-6（board-lecture-player）/ skill-7（blingbling）独立页：只断存在
ok(existsSync(resolve(ROOT, 'public/skills-hub/skill-6.html')), 'skill-6.html（board-lecture-player 独立页）存在')
ok(existsSync(resolve(ROOT, 'public/skills-hub/skill-7.html')), 'skill-7.html（blingbling 独立页）存在')

// ─── C. 死档不复活 ─────────────────────────────────────────────
console.log('C. Task 47 砍除的 10 个死档不复活')
const deadFiles = [
  'ENGINEERING_LOG.md', 'PROJECT_STATE.md', 'DECISIONS.md',
  'doc/建议提示.md', 'doc/起始语-过渡-总结-兜底话术.md',
  'doc/minimal-runtime-loop.md', 'doc/board_initial_state.md',
  'doc/board_risk_matrix.md', 'doc/speech-board-guide.md',
  'doc/agent-b-control-responsibility.md',
]
for (const f of deadFiles) {
  ok(!existsSync(resolve(ROOT, f)), `${f} 未复活`)
}

// ─── D. 冲突仲裁原则在宪法 ─────────────────────────────────────
console.log('D. AGENTS.md 宪法层断言')
const agents = readFileSync(resolve(ROOT, 'AGENTS.md'), 'utf-8')
ok(agents.includes('冲突仲裁原则'), 'AGENTS.md 含「冲突仲裁原则」段（DECISIONS 活原则已提炼）')
ok(agents.includes('用户钦定规格 > 播放端事实 > 生成侧白名单'), '锚定顺序原则在宪法（用户钦定 > 播放端 > 生成侧）')
ok(agents.includes('git commit message'), '工作记录真源 = git commit message 已归一入宪法')
ok(!/^- `PROJECT_STATE\.md`/m.test(agents), '宪法不再教写 PROJECT_STATE.md（三大文档条款已退役）')

// ─── 结果 ─────────────────────────────────────────────────────
const total = pass + fail
console.log(`== 仓库卫生哨兵: ${pass}/${total} 通过, ${fail} 失败 ==`)
if (fail > 0) process.exit(1)
