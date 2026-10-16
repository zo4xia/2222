#!/usr/bin/env node
/**
 * test-visual-timeline.mjs — 时序全景时间轴双病灶修复契约
 * 病灶（夏夏实测）：
 * ① 横向滑动失效——行数超过就没了，后面的行看不到听不到
 *   （CSS 滚动链组合失效 + 无滚轮横滚 + 无播放跟随）
 * ② 动作零展示——时间轴上板书只有写字（✍️），
 *   underline/highlight/circle 标注动作没有容身之地
 * 断言：滚动链三件套、动作指标行/动作钉/图例/统计齐备、
 *   播放跟随、capabilityGap 缺口项容错。
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const src = readFileSync(join(root, 'src/components/VisualTimeline.vue'), 'utf8')

let pass = 0, fail = 0
function ok(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`) }
  catch (e) { fail++; console.error(`  ✗ ${name}: ${e.message}`) }
}

console.log('时序全景时间轴：滚动修复 + 动作容身之地')

// ── 病灶①：横向滚动 ──
ok('滚动链：track 定宽 width: max-content（内容超宽必然溢出）', () => {
  assert.ok(/\.timeline-track\s*\{[^}]*width:\s*max-content/s.test(src), 'track 应有 width: max-content')
  assert.ok(/\.timeline-track\s*\{[^}]*min-width:\s*100%/s.test(src), '行数少时 min-width: 100% 保底')
})

ok('滚动链：行块 flex: 0 0 auto（定宽不拉伸不收缩）', () => {
  assert.ok(/\.timeline-row-block\s*\{[^}]*flex:\s*0 0 auto/s.test(src), '行块应 0 0 auto')
  assert.ok(!/flex:\s*1 0 auto/.test(src), '旧 grow:1 组合不得残留')
})

ok('滚动链：容器 overflow-x: auto 保持（滚动条通道）', () => {
  assert.ok(/\.timeline-track-container\s*\{[^}]*overflow-x:\s*auto/s.test(src))
})

ok('滚轮横滚：@wheel 绑定 + deltaY 映射 scrollLeft（无需 shift+滚轮）', () => {
  assert.ok(/@wheel="onWheel"/.test(src), 'container 应绑 @wheel')
  assert.ok(/function onWheel[\s\S]*?scrollLeft \+=/.test(src), 'onWheel 应把 deltaY 累加到 scrollLeft')
  assert.ok(/function onWheel[\s\S]*?scrollWidth <= el\.clientWidth[\s\S]*?return/.test(src),
    '未溢出时不拦截（垂直滚动不受影响）')
  assert.ok(/function onWheel[\s\S]*?preventDefault/.test(src), '溢出时拦截默认滚动')
})

ok('播放跟随：watch playingIndex/activeIndex + scrollIntoView 横向居中', () => {
  assert.ok(/watch\(\(\) => \[props\.playingIndex, props\.activeIndex\]/.test(src), '应 watch 播放/激活行')
  assert.ok(/scrollIntoView\(\{ behavior: 'smooth', inline: 'center'/.test(src), '应横向居中滚进视野')
})

// ── 病灶②：动作容身之地 ──
ok('动作提取：getActions 过滤 capabilityGap 缺口项（脏数据容错）', () => {
  assert.ok(/function getActions[\s\S]*?filter\(\(e\) => e && e\.action && !e\.capabilityGap\)/.test(src),
    '应排除缺口项')
})

ok('动作指标行：块内 action-row + 类型徽章（Task 43 动作 1.0：underline/circle/rough-line）', () => {
  assert.ok(/class=\\"block-metric-row\\", \\"action-row\\"|'block-metric-row', 'action-row'/.test(src),
    '动作指标行应存在')
  assert.ok(/ACTION_LABELS = \{ underline: '下划线', circle: '圈', 'rough-line': '横线' \}/.test(src),
    '动作 1.0 三动作中文标签应齐（highlight 已砍）')
  assert.ok(/act-\$\{t\.type\}|:class=\[?'action-badge'/.test(src) || /action-badge/.test(src),
    '类型徽章渲染应存在')
})

ok('动作时点钉：mini-action-pin 按 startDelay 在微观条打点', () => {
  assert.ok(/mini-action-pin/.test(src), '动作钉元素应存在')
  assert.ok(/function getActionPinPercent[\s\S]*?getActionStartDelay\(entry\) \/ dur[\s\S]*?\* 100/.test(src),
    '钉位置应按时延/时长换算百分比')
  assert.ok(/Math\.min\(95, Math\.max\(2/.test(src), '钉位置应夹在 2%~95% 防溢出')
})

ok('动作 startDelay 提取：无值容错为 0（口播一开即触发）', () => {
  assert.ok(/function getActionStartDelay[\s\S]*?Number\.isFinite\(v\) && v >= 0 \? v : 0/.test(src))
})

ok('header 统计 + 图例：动作总数 pill 与图例项齐备', () => {
  assert.ok(/const actionCount = computed/.test(src), 'actionCount 统计应存在')
  assert.ok(/标注动作 <strong>\{\{ actionCount \}\}<\/strong>/.test(src), 'header 动作 pill 应存在')
  assert.ok(/动作触发时点/.test(src), '图例应含动作钉说明')
})

console.log(`\n${pass + fail} 用例：${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
