// 冒烟测试: 验证 skillViolations.js 能检出 5 个 skill 的反模式
import { auditRowsBySkills, checkSkillViolations } from '../src/check-agent/skillViolations.js'

const cases = [
  {
    name: '合规 row (应 PASS)',
    row: {
      stage: '解答',
      speech: '九乘以二十点四等于一百八十三点六',
      board: { startDelay: 1.5, region: 'solution', content: 'S = 9 × 20.4 = 183.6' },
      actionSpec: [
        { action: { tool: 'rough-notation', action: 'underline', target: { region: 'solution', exactText: '183.6', occurrence: 1 }, order: 1 } },
      ],
    },
    expectViolations: 0,
  },
  {
    name: 'skill 4 违规: 口播含斜杠分数',
    row: { stage: '分析', speech: '三/四 加 五/六', board: { region: 'analysis', content: '' }, actionSpec: [] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 4 违规: 口播含小数点',
    row: { stage: '解答', speech: '3.14 是圆周率', board: { region: 'solution', content: '' }, actionSpec: [] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 5 违规: 板书含 $ \\left \\right',
    row: { stage: '解答', speech: '解方程', board: { region: 'solution', content: '$\\left( a + b \\right)$' }, actionSpec: [] },
    expectAtLeast: 2, // $ 一条规则 + \\left\\right 合一一条
  },
  {
    name: 'skill 5 违规: 板书含 HTML 实体',
    row: { stage: '解答', speech: '解方程', board: { region: 'solution', content: '5 &times; 3 &amp; 2' }, actionSpec: [] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 5 违规: 板书含控制字符',
    row: { stage: '解答', speech: '解', board: { region: 'solution', content: '第一行\t第二行\u000c第三行' }, actionSpec: [] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 3 违规: 自造工具 circle',
    row: { stage: '分析', speech: '解', board: { region: 'analysis', content: '' }, actionSpec: [{ action: { tool: 'circle', order: 1 } }] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 3 违规: Agent 填 durationMs',
    row: { stage: '分析', speech: '解', board: { region: 'analysis', content: '' }, actionSpec: [{ action: { tool: 'rough-notation', action: 'underline', durationMs: 2000, order: 1 } }] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 3 违规: rough-notation 动作非法',
    row: { stage: '分析', speech: '解', board: { region: 'analysis', content: '' }, actionSpec: [{ action: { tool: 'rough-notation', action: 'circle', order: 1 } }] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 1 违规: 坐标越界 150',
    row: { stage: '分析', speech: '解', board: { region: 'analysis', content: '' }, actionSpec: [{ action: { tool: 'rough-line', region: 'analysis', start: [150, 45], end: [50, 45], order: 1 } }] },
    expectAtLeast: 1,
  },
  {
    name: 'skill 2 违规: 题目区 board.content 非空',
    row: { stage: '题目', speech: '读题', board: { region: 'question', content: '不应写板书' }, actionSpec: [] },
    expectAtLeast: 1,
  },
]

let pass = 0, fail = 0
console.log('== skillViolations 冒烟测试 ==')
cases.forEach((c, i) => {
  const v = checkSkillViolations(c.row, 0)
  const got = v.length
  let ok
  if (c.expectViolations != null) ok = got === c.expectViolations
  else if (c.expectAtLeast != null) ok = got >= c.expectAtLeast
  const tag = ok ? '✓' : '✗'
  console.log(`${tag} [${i + 1}] ${c.name} → ${got} 违规 (期望 ${c.expectViolations ?? '≥' + c.expectAtLeast})`)
  if (!ok) {
    console.log('  实际违规:')
    v.forEach(x => console.log(`    - ${x.path}: [${x.from}] ${x.msg}`))
    fail++
  } else pass++
})

console.log(`\n== 结果: ${pass}/${cases.length} 通过, ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
