// 播放速度统一哨兵（2026-10-15 提速归一：写字 400→220ms/字、rowGap 1500→1000ms）
// 方法论 = test-action-whitelist-sync：锚定 timing.js 真源常量，扫描全部镜像/教法/档案定义点。
// 教训：两两一致 ≠ 正确，集体背离真源是盲区 —— 本测试直接锚定代码常量真源。
// 防散保证：任何人改速度若只改一处（漏改镜像/教法），本测试立刻红。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(path.join(root, p), 'utf-8')
const md5 = (s) => createHash('md5').update(s).digest('hex')

import {
  AGENT_B_V2_SPEECH_RATE,
  AGENT_B_V2_ROW_GAP_MS,
  BASE_CHAR_WRITE_MS,
  calculateBoardWritingDuration,
  estimateSpeechDurationMs,
} from '../src/agent-b-v2/timing.js'

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`✓ ${name}`); pass++ }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); fail++ }
}

// ═══ A. 真源行为断言 ══════════════════════════════════════════
check('A1 真源常量: BASE_CHAR_WRITE_MS = 220 (一秒4~5字)', BASE_CHAR_WRITE_MS === 220)
check('A2 真源常量: AGENT_B_V2_ROW_GAP_MS = 1000 (夏夏拍板)', AGENT_B_V2_ROW_GAP_MS === 1000)
check('A3 真源常量: AGENT_B_V2_SPEECH_RATE = 160 (语速不变)', AGENT_B_V2_SPEECH_RATE === 160)

// 3 字板书: jitter 循环 i=0,1,2 → 190/220/250 = 660ms（旧 400 时代 1110ms）
const d3 = calculateBoardWritingDuration('三个字')
check('A4 板书耗时真值: 3字 = 660ms (190+220+250)', d3 === 660, `got ${d3}`)
// 换算一致性: 1000/BASE_CHAR_WRITE_MS ≈ 4.5 字/秒（1秒4~5字区间的中值）
const cps = 1000 / BASE_CHAR_WRITE_MS
check('A5 字速换算: 4.4~4.6 字/秒（"一秒4~5字"中值）', cps > 4.4 && cps < 4.6, `got ${cps}`)
// 抖动边界: 单字永远 ≥ 190（下限）
const one = calculateBoardWritingDuration('单')
check('A6 单字下限 ≥ 190ms', one >= 190, `got ${one}`)
// 口播: 剥标点 + 停顿 + 1500 下限
check('A7 空口播 = 1500ms', estimateSpeechDurationMs('') === 1500)
check('A8 短口播走 1500 下限', estimateSpeechDurationMs('嗯。') === 1500)

// ═══ B. 播放器双胞胎镜像一致（离线单文件，自带一份）══════════════
const rpA = read('row-player.html'), rpB = read('public/row-player.html')
check('B1 row-player 双胞胎 md5 一致', md5(rpA) === md5(rpB))
for (const [tag, src] of [['根目录', rpA], ['public/', rpB]]) {
  check(`B2 ${tag} BASE_CHAR_MS=220 (镜像真源)`, /const BASE_CHAR_MS=220/.test(src))
  check(`B3 ${tag} 无旧值残留 BASE_CHAR_MS=400`, !/const BASE_CHAR_MS=400/.test(src))
  check(`B4 ${tag} 规格注释=1秒4~5个汉字`, /板书速度 1秒4~5个汉字/.test(src))
  check(`B5 ${tag} 兜底估算已对齐剥标点+停顿口径`, /estSpeechChars/.test(src) && /estPunctMs/.test(src))
}

// ═══ C. 消费端硬编码清零（防"一个东西多个地方控制"）═════════════
const abSrc = read('src/agent-b-v2/AgentBDirect.vue')
check('C1 AgentBDirect 默认 rowGapMs 真源派生', /rowGapMs: AGENT_B_V2_ROW_GAP_MS/.test(abSrc))
check('C2 AgentBDirect 默认 speechSpeed 真源派生', /speechSpeed: AGENT_B_V2_SPEECH_RATE/.test(abSrc))
check('C3 AgentBDirect 无 rowGap 硬编码 1500 残留', !/rowGapMs: 1500/.test(abSrc) && !/rowGapMs[^,\n]*\|\| 1500/.test(abSrc))
check('C4 AgentBDirect 无 speechSpeed 硬编码 160 残留', !/speechSpeed: 160/.test(abSrc))
check('C5 AgentBDirect B缓存恢复路径重算时间轴（旧缓存防散）', /applyAgentBV2Timeline\(cached\.rows/.test(abSrc))

const vtSrc = read('src/components/VisualTimeline.vue')
check('C6 VisualTimeline 无 "+1500" 暗点', !/\+ 1500/.test(vtSrc))
check('C7 VisualTimeline 真源派生 + 优先吃 estimatedStartMs', /AGENT_B_V2_ROW_GAP_MS/.test(vtSrc) && /estimatedStartMs/.test(vtSrc))

// ═══ D. handoff / 提示词教法层（给 LLM 的速度教法）═══════════════
const shSrc = read('src/services/stepHandoff.js')
check('D1 stepHandoff BOARD_SPEED_CHARS_PER_SEC = 4.5', /BOARD_SPEED_CHARS_PER_SEC = 4\.5/.test(shSrc))
check('D2 stepHandoff 无旧值 2.5 残留', !/BOARD_SPEED_CHARS_PER_SEC = 2\.5/.test(shSrc))
check('D3 stepHandoff JITTER = 0.14 (±30ms/220ms 换算)', /BOARD_SPEED_JITTER = 0\.14/.test(shSrc))

const bPrompt = read('src/agent-b-v2/prompt.js')
check('D4 B 提示词: 两处"1 秒 4~5 字"教法', (bPrompt.match(/1 秒 4~5 字/g) || []).length >= 2)
check('D5 B 提示词: 无旧"2~3 字"教法残留', !/1 秒 2~3 字/.test(bPrompt))
check('D6 B 提示词: "1 秒 row gap"（旧 1.5 秒已清）', /1 秒 row gap/.test(bPrompt) && !/1\.5 秒 row gap/.test(bPrompt))

const checkPrompt = read('src/check-agent/prompt.js')
check('D7 Check 提示词语速 160 教法保留（语速未变）', /160 汉字\/分钟/.test(checkPrompt))

// ═══ E. 技能包档案层（教法数值 = 真源数值）═══════════════════════
const sbtSkill = read('skills/speech-board-timing/SKILL.md')
check('E1 speech-board-timing SKILL: 220ms 基准', /\*\*220ms\*\*/.test(sbtSkill))
check('E2 speech-board-timing SKILL: 无板书字速旧值 400ms（动作标记 400ms/汉字宽属另一语义，不算）', !/400ms\/字/.test(sbtSkill) && !/\*\*400ms\*\*[^|]*书写基准/.test(sbtSkill))
check('E3 speech-board-timing SKILL: Row 间 1000ms', /`AGENT_B_V2_ROW_GAP_MS` \| \*\*1000ms\*\*/.test(sbtSkill) && !/\| \*\*1500ms\*\*/.test(sbtSkill))
check('E4 speech-board-timing SKILL: 版本 1.2.0', /version: "1\.2\.0"/.test(sbtSkill))
check('E5 speech-board-timing SKILL: 抖动区间 190—250', /190—250ms/.test(sbtSkill) && !/360—440/.test(sbtSkill))
check('E6 speech-board-timing SKILL: 快慢诊断线已提速（6字/3字）', /1 秒 6 字/.test(sbtSkill) && !/1 秒 5 字 \| 基准 400/.test(sbtSkill))

const sbtMeta = read('skills/speech-board-timing/meta.json')
check('E7 speech-board-timing meta: 220ms + 1000ms', /220ms\/字/.test(sbtMeta) && /Row 间 1000ms/.test(sbtMeta))
check('E8 speech-board-timing meta: 无 400ms/1500ms 旧值', !/400ms\/字/.test(sbtMeta) && !/Row 间 1500ms/.test(sbtMeta))
check('E9 speech-board-timing meta: 口播下限 1500（旧 1200 已清）', /max\(1500/.test(sbtMeta))

const bsrSkill = read('skills/board-speech-rules/SKILL.md')
check('E10 board-speech-rules SKILL: 1秒4~5字教法（B8 病灶已销）', /1 秒 4~5 个汉字/.test(bsrSkill) && /1 秒 4~5 字/.test(bsrSkill))
check('E11 board-speech-rules SKILL: 无"1 秒 2 字"旧教法', !/1 秒 2 个汉字/.test(bsrSkill) && !/1 秒 2 字（/.test(bsrSkill))
check('E12 board-speech-rules SKILL: 行间隔 1 秒 + 无 1.5 秒残留', /约 1 秒（由渲染端控制/.test(bsrSkill) && !/约 1\.5 秒（由渲染端控制/.test(bsrSkill))

const bsrMeta = read('skills/board-speech-rules/meta.json')
check('E13 board-speech-rules meta: 4~5字 + 1000ms', /1秒4~5字/.test(bsrMeta) && /Row间隔约1秒/.test(bsrMeta))
check('E14 board-speech-rules meta: key_rules 无"板书速度约1秒2字"旧值（v3_2 历史变更记录除外）', !/板书速度约1秒2字/.test(bsrMeta))

const hacSkill = read('skills/hand-action-control/SKILL.md')
check('E15 hand-action-control SKILL: ROW_GAP=1000ms', /AGENT_B_V2_ROW_GAP_MS = 1000ms/.test(hacSkill))
check('E16 hand-action-control SKILL: 无 1500ms 残留', !/AGENT_B_V2_ROW_GAP_MS = 1500/.test(hacSkill))

// ═══ F. demo 与 skills-hub 镜像（数值 = 真源）═══════════════════
for (const p of ['skills/speech-board-timing/examples/demo.html', 'public/skills-hub/skill-4.html']) {
  const src = read(p)
  check(`F1 ${p}: BASE_CHAR_MS=220`, /const BASE_CHAR_MS=220/.test(src))
  check(`F2 ${p}: ROW_GAP=1000`, /const ROW_GAP=1000/.test(src))
  check(`F3 ${p}: 无旧 400/1500 残留`, !/const BASE_CHAR_MS=400/.test(src) && !/const ROW_GAP=1500/.test(src))
  check(`F4 ${p}: jitter 下限 190`, /Math\.max\(190,BASE_CHAR_MS\+jitter\)/.test(src))
}
const hubIndex = read('public/skills-hub/index.html')
check('F5 skills-hub 目录页: 220ms/字 描述', /220ms\/字/.test(hubIndex) && !/400ms\/字/.test(hubIndex))
const skillsReadme = read('skills/README.md')
check('F6 skills 目录 README: 220ms/字', /220ms\/字/.test(skillsReadme) && !/400ms\/字/.test(skillsReadme))

// ═══ G. 口播估算双实现行为一致性（App vs 播放器兜底）════════════
// row-player 兜底口径已对齐 timing.js: 同句口播估算应一致（剥标点+停顿+下限）
const sample = '这道题我们来看一下。'
const appMs = estimateSpeechDurationMs(sample)
// 手工按播放器新口径算（无法 import html，公式复刻）
const chars = [...sample.replace(/\s+/g, '').replace(/[。，、；：？！“”‘’（）《》【】……—.,!?;:'"()\[\]<>~`@#$%^&*_+=|\\/]/g, '')].length
const punct = (sample.match(/。/g) || []).length * 700 + (sample.match(/，/g) || []).length * 500 + (sample.match(/…+/g) || []).length * 1000
const playerMs = Math.max(1500, Math.round(chars * 60 / 160 * 1000) + punct)
check('G1 播放器兜底估算 == App 估算（同一句不再分叉）', appMs === playerMs, `app=${appMs} player=${playerMs}`)

console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
