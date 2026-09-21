import { countCharacters, countPunctuationPauseMs, estimateSpeechDurationMs } from '../src/agent-b-v2/timing.js'

const cases = [
  { name: '短句带标点', speech: '那么？' },
  { name: '中句逗号+句号', speech: '小明有 5 个苹果，吃了 2 个，还剩几个？' },
  { name: '长句多标点', speech: '首先，我们观察图形。平行四边形沿高分割后，会形成一个直角三角形和一个梯形。' },
  { name: '空字符串', speech: '' },
  { name: '纯数字+符号', speech: '9 × 20.4 = 183.6' },
]

console.log('== countCharacters (剥标点) ==')
cases.forEach(c => console.log(`  ${c.name}: ${countCharacters(c.speech)} 字`))

console.log('\n== countPunctuationPauseMs ==')
cases.forEach(c => console.log(`  ${c.name}: ${countPunctuationPauseMs(c.speech)}ms`))

console.log('\n== estimateSpeechDurationMs (含 1500ms 下限 + 标点停顿) ==')
cases.forEach(c => console.log(`  ${c.name}: ${estimateSpeechDurationMs(c.speech)}ms`))

console.log('\n== P0 bug 验证: 旧 UI vs 新 UI ==')
const test = '小明有 5 个苹果，吃了 2 个，还剩几个？'
const oldUI = String(test).replace(/\s+/g,'').length
const newUI = countCharacters(test)
const oldUISec = Math.max(1, Math.round((oldUI/160)*60))
const newUISec = Math.max(1, Math.round(estimateSpeechDurationMs(test)/1000))
console.log(`  旧 UI: ${oldUI} 字 / ${oldUISec}s (含标点 + 无下限)`)
console.log(`  新 UI: ${newUI} 字 / ${newUISec}s (剥标点 + 含 1500ms 下限 + 标点停顿)`)
console.log(`  ${oldUI === newUI ? '✗ 仍分叉' : '✓ 已统一 (字数 -' + (oldUI-newUI) + ', 秒数 +' + (newUISec-oldUISec) + 's, 含标点停顿)'}`)
