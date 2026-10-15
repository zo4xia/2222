#!/usr/bin/env node
/**
 * test-speech-regen-button.mjs — 语音"重新生成"按钮消失修复契约
 * 病灶（夏夏实测）：小喇叭首次生成成功即回填 record.audioUrl（L730），
 * 按钮组 v-if/v-else 排他——audioUrl 一有值，"播放预览"就把"重新生成"
 * 顶掉，用户从此失去重合成入口（改稿后/合成不满意无路可走）。
 * 断言：重新生成常驻（不再 v-else 排他）、播放预览仍按 audioUrl 条件显隐、
 * forceRefresh 强制刷新语义保持、首次生成回填链不回归。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const src = readFileSync(join(root, 'src/agent-b-v2/AgentBDirect.vue'), 'utf8')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('语音重新生成按钮常驻修复')

const regenBtnMatch = src.match(/<a-button\s+size="small"\s+class="speech-btn-regen"[\s\S]*?<\/a-button>/)
const regenBtn = regenBtnMatch ? regenBtnMatch[0] : ''

ok('重新生成按钮存在且已脱离 v-else 排他（常驻）', () => {
  assert.ok(regenBtnMatch, 'speech-btn-regen 按钮应存在')
  assert.ok(!/\bv-else\b|\bv-if=/.test(regenBtn), '重新生成按钮不得带 v-if/v-else 条件（必须常驻）')
})

ok('重新生成按钮仍绑定 handleRegenerateSpeech 与 loading 态', () => {
  assert.ok(regenBtn.includes('@click="handleRegenerateSpeech(index, record)"'), '点击应绑 handleRegenerateSpeech')
  assert.ok(regenBtn.includes(':loading="regeneratingRowIndex === index"'), '行级 loading 应保留')
})

ok('播放预览按钮仍按 record.audioUrl 条件显隐（语义未削弱）', () => {
  const previewMatch = src.match(/<a-button\s+v-if="record\.audioUrl"\s+size="small"\s+class="speech-btn-preview"[\s\S]*?<\/a-button>/)
  assert.ok(previewMatch, '播放预览按钮应保留 v-if="record.audioUrl"')
})

ok('两个按钮共存于同一按钮组（非异地互斥）', () => {
  const actionsMatch = src.match(/<div class="speech-audio-actions">([\s\S]*?)<\/div>\s*<\/div>/)
  assert.ok(actionsMatch, 'speech-audio-actions 按钮组应存在')
  const group = actionsMatch[1]
  assert.ok(group.includes('speech-btn-preview') && group.includes('speech-btn-regen'),
    '播放预览与重新生成应共存于同一按钮组')
  // 排他结构回归哨：v-if 之后紧跟 v-else 的旧病灶模式不得复活
  assert.ok(!/v-if="record\.audioUrl"[\s\S]{0,400}?v-else[\s\S]{0,200}?speech-btn-regen/.test(src),
    'v-if/v-else 排他旧模式不得回归')
})

ok('handleRegenerateSpeech 仍带 forceRefresh: true（强制刷新语义保持）', () => {
  const fnMatch = src.match(/async function handleRegenerateSpeech[\s\S]{0,1200}?\n\}/)
  assert.ok(fnMatch, 'handleRegenerateSpeech 函数应存在')
  assert.ok(fnMatch[0].includes('forceRefresh: true'), '重新生成必须强制刷新（绕过缓存重合成）')
})

ok('小喇叭首次生成回填链保持（真源写入口 + 时长元数据）', () => {
  const fnMatch = src.match(/async function handlePlayOrSynthesizeSpeech[\s\S]{0,1600}?\n\}/)
  assert.ok(fnMatch, 'handlePlayOrSynthesizeSpeech 函数应存在')
  // ★ 2026-10-15 哑巴根修复后断言翻转：必须写真源（setRowAudioUrl → rows.value[index]），
  //   旧克隆写法 record.audioUrl = ... 会在 applyAgentBV2Timeline 重建时蒸发（导出/播放哑巴根因）
  assert.ok(fnMatch[0].includes('setRowAudioUrl(index, data.audioUrl)'), '首次生成应走真源写入口 setRowAudioUrl')
  assert.ok(fnMatch[0].includes('recordAudioMetadata'), '应记录音频元数据')
  assert.ok(!/record\.audioUrl\s*=/.test(src), '克隆写法 record.audioUrl = 全文不得残留（会蒸发，哑巴根因）')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
