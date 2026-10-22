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
  computeRowGroupTimeline,
} from '../src/agent-b-v2/timing.js'
import { evalEstSpeech } from './playerMirrorExtract.mjs'

let pass = 0, fail = 0
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`✓ ${name}`); pass++ }
  else { console.log(`✗ ${name}${detail ? ' — ' + detail : ''}`); fail++ }
}

// ═══ A. 真源行为断言 ══════════════════════════════════════════
check('A1 真源常量: BASE_CHAR_WRITE_MS = 220 (一秒4~5字)', BASE_CHAR_WRITE_MS === 220)
check('A2 真源常量: AGENT_B_V2_ROW_GAP_MS = 1000 (夏夏拍板)', AGENT_B_V2_ROW_GAP_MS === 1000)
check('A3 真源常量: AGENT_B_V2_SPEECH_RATE = 160 (语速不变)', AGENT_B_V2_SPEECH_RATE === 160)

// 3 字板书: 无抖动口径（Task 52 与实播同窗口）→ 3×220 = 660ms（旧 jitter 190+220+250 巧合同为 660）
const d3 = calculateBoardWritingDuration('三个字')
check('A4 板书耗时真值: 3字 = 660ms (3×220 无抖动，镜像 row-player compile)', d3 === 660, `got ${d3}`)
// 换算一致性: 1000/BASE_CHAR_WRITE_MS ≈ 4.5 字/秒（1秒4~5字区间的中值）
const cps = 1000 / BASE_CHAR_WRITE_MS
check('A5 字速换算: 4.4~4.6 字/秒（"一秒4~5字"中值）', cps > 4.4 && cps < 4.6, `got ${cps}`)
// 抖动边界: 单字 = 220 基准（估算轴无抖动，实播抖动在渲染层行配速）
const one = calculateBoardWritingDuration('单')
check('A6 单字 = 220ms 基准（估算轴无抖动）', one === 220, `got ${one}`)
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
check('E4 speech-board-timing SKILL: 版本 1.3.0（Task 47 与 meta.json 双源归一）', /version: "1\.3\.0"/.test(sbtSkill))
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
// ★ Task 61：旧 G1 在测试里手抄第三份公式再比对（三胞胎 md5 绿 ≠ 播放器公式对）——
//   改为提取播放器 estSpeech 实代码沙箱求值，与 timing.js 真源对拍（基建 playerMirrorExtract.mjs；
//   更大语料的同类对拍 = test-player-mirror-parity.mjs B7）
const playerMs = evalEstSpeech(readFileSync(path.join(root, 'row-player.html'), 'utf-8'))({ speech: sample })
check('G1 播放器兜底估算 == App 估算（提取播放器实代码对拍，测试内不再复刻公式）', appMs === playerMs, `app=${appMs} player=${playerMs}`)

// ═══ H. 兜位定位归一（2026-10-15 夏夏定性：160 是兜位不是功能，有音频跟音频）═══
// 兜位不越权 = 有实测音频时 160 完全不参与；文案/系数全部真源派生，无平行字面量
const asrSrc = read('src/check-agent/asrPolish.js')
check('H1 asrPolish 秒/字系数真源派生（60/SPEECH_RATE），无 0.375 计算字面量',
  /FALLBACK_SEC_PER_CHAR = 60 \/ AGENT_B_V2_SPEECH_RATE/.test(asrSrc) && !/bestIndex \* 0\.375/.test(asrSrc))

check('H2 音频速度文案唯一真源：timing.js 导出 AUDIO_SPEED_POLICY_TEXT',
  /export const AUDIO_SPEED_POLICY_TEXT/.test(read('src/agent-b-v2/timing.js')))

for (const [tag, p] of [
  ['AgentBDirect', 'src/agent-b-v2/AgentBDirect.vue'],
  ['speechMarkdown', 'src/lib/speechMarkdown.js'],
  ['deliverableStoreHandler', 'server/deliverableStoreHandler.js'],
]) {
  const src = read(p)
  check(`H3 ${tag} audioSpeedPolicy 文案 import 真源（旧"速度计算 160字/分"字面量清零）`,
    /AUDIO_SPEED_POLICY_TEXT/.test(src) && !/速度计算 160字\/分/.test(src))
}

check('H4 兜位不越权：有 audioDurationMs 时口播时长 = 实测值（160 不参与）',
  computeRowGroupTimeline({ speech: '这道题我们来看一下。', audioDurationMs: 5200 }).speechDurationMs === 5200)
check('H5 无 audioDurationMs 时才走 160 兜底估算',
  computeRowGroupTimeline({ speech: '这道题我们来看一下。' }).speechDurationMs === estimateSpeechDurationMs('这道题我们来看一下。'))

check('H6 B 提示词语速行兜底定性（有音频真实语速由音频决定）', /兜底估算语速/.test(bPrompt))
check('H7 Check 提示词兜位语境完好（仅在无音频 URL 时初始预估）', /仅在无音频 URL/.test(checkPrompt) && /兜位估算口径/.test(checkPrompt))
check('H8 播放器优先级链：audioRow 实测优先 / estSpeechMs 末位兜底', /audioRow/.test(rpA) && /: estSpeechMs/.test(rpA))
check('H9 存档覆盖防御：旧档 uiSettings 旧文案被剥（文案不随档走）', /_legacyAudioSpeedPolicy/.test(read('server/deliverableStoreHandler.js')))

// ═══ I. Task 52 统一口径哨兵（夏夏拍板「234 要统一」，2026-10-19）═════════
// 估算轴（timing.js）与实播轴（row-player）三方归一：startDelay 字面语义 / 板书先动作后 /
// 字数口径 / 音频行 gap=0 与锁时长。任何人改一侧漏改另一侧，本区块立刻红。
const timingSrc = read('src/agent-b-v2/timing.js')
check('I1 timing.js 有 rowHasRealAudio/isAudioSrc 镜像（音频行统一判据）', /rowHasRealAudio/.test(timingSrc) && /AUDIO_SRC_RE/.test(timingSrc))
check('I2 timing.js startDelay 兜底已拔（无 min(1800/min(1500 暗改）', !/Math\.min\(1800/.test(timingSrc) && !/Math\.min\(1500/.test(timingSrc))
check('I3 timing.js 模式A动作前置已砍（无 isTargetingQuestion）', !/isTargetingQuestion/.test(timingSrc))
check('I4 timing.js 板书字数口径镜像（visualLen/isRuleLine/readBrace）', /function visualLen/.test(timingSrc) && /function isRuleLine/.test(timingSrc) && /function readBrace/.test(timingSrc))
check('I5 双源同步锚：row-player 同款 visualLen/isRuleLine 都在（改两处同改）', /function visualLen/.test(rpA) && /function isRuleLine/.test(rpA))
check('I6 timing.js 音频行 gap=0（rowHasRealAudio(row) ? 0 : rowGapMs）', /rowHasRealAudio\(row\) \? 0 : rowGapMs/.test(timingSrc))
check('I7 timing.js 有音频行时长锁音频（hasRealAudio ? speechDurationMs）', /hasRealAudio \? speechDurationMs/.test(timingSrc))
check('I8 AgentBDirect totalGapMs 用 rowHasRealAudio（音频行 gap=0 同口径）', /rowHasRealAudio\(r\) \? 0 : gapUnitMs/.test(abSrc))
check('I9 Check 提示词 §6 有 startDelay=0 必校准第 5 条（生成侧防线）', /必须按上述公式校准为大于 0/.test(checkPrompt) && /绝不能裸 0/.test(checkPrompt))
check('I10 row-player 实播侧零改动（三胞胎 md5 不变 + BASE_CHAR_MS=220 仍在）', md5(rpA) === md5(rpB) && /const BASE_CHAR_MS=220/.test(rpA))

console.log(`\n== 结果: ${pass} 通过, ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
