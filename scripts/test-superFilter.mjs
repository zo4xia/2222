#!/usr/bin/env node
/**
 * test-superFilter.mjs — 超级过滤器 v2（字库实测校准版）测试
 * 覆盖: 12 步流水线各步骤、缺字凑法降级、白名单校验、纯文本降级、渲染 HTML、
 *       四处副本镜像一致性哨兵
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  normalizeBoardLine, toBoardLines, isStructMath,
  findUnsafeChars, boardTextToPlain, renderBoardTextHtml,
} from '../src/utils/superFilter.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

let pass = 0, fail = 0
function eq(input, expected, label) {
  const out = normalizeBoardLine(input)
  if (out === expected) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}\n      输入: ${JSON.stringify(input)}\n      期望: ${JSON.stringify(expected)}\n      实际: ${JSON.stringify(out)}`) }
}
function ok(cond, label) {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`) }
}

console.log('━━ 1. 换行与控制字符（步骤①②⑫）')
eq('a\\r\\nb', 'a\nb', '字面量 \\r\\n 还原')
eq('第一行\\n第二行', '第一行\n第二行', '字面量 \\n 还原（后非字母）')
eq('a \\neq b', 'a != b', '字面量 \\n 不打断 \\neq（\\neq 随后转 !=）')
eq('a\t\tb', 'a b', '制表符退化空格并压缩')
eq('a\u000Bb\u000C', 'a b', '垂直制表/换页退化空格')
eq('a\r\nb\rc', 'a\nb\nc', '真实 \\r\\n / \\r 统一为 \\n')
eq('a\n\n\n\n\nb', 'a\n\nb', '3+ 连续换行压缩为 2')
eq('\\frac{1}{2}\n', '\\frac{1}{2}', '行末空白去除')

console.log('━━ 2. HTML 实体解码（步骤③）')
eq('5 &times; 3', '5 x 3', '&times; 经 ⑦ 凑法降级为 x')
eq('12 &divide; 3', '\\frac{12}{3}', '&divide; → ÷ → / → 升 frac（除号一律转分数，仓库既定设计）')
eq('a &minus; b', 'a - b', '&minus; → − → -')
eq('x&sup2; = 4', 'x² = 4', '&sup2; → ²（保留，渲染层代画）')
eq('&amp;lt; 保持', '&lt; 保持', '&amp; 最后解，防二次解码')
eq('&nbsp;A', ' A', '&nbsp; → 半角空格')

console.log('━━ 3. LaTeX 损伤修复 + 剥壳（步骤④⑤）')
eq('rac{3}{4}', '\\frac{3}{4}', 'rac 损伤修复')
eq('frac{3}{4}', '\\frac{3}{4}', 'frac 损伤修复')
eq('\u000crac{1}{2}'.replace('\\u000c', '\u000c'), ' \\frac{1}{2}', '换页符+rac 损伤修复（控制字符已先退化空格）')
eq('$x$ + \\left( 1 \\right)', 'x + ( 1 )', '$ \\left \\right 剥除')
eq('\\begin{aligned} S &= 1 \\\\ T &= 2 \\end{aligned}', ' S= 1 \n T= 2', 'aligned 环境剥壳（& 对齐符连带空格剥除）')
eq('\\(a\\)', 'a', '\\( \\) 剥除')

console.log('━━ 4. HTML 标签（步骤④\'）')
eq('<b>方法一</b><br>S = 9', '方法一\nS = 9', '格式标签剥除 + <br>→换行')
eq('3 < x, 5 > x', '3 < x, 5 > x', '不等式文本不被误吃（白名单标签策略）')
eq('<img onerror=alert(1)>x', '<img onerror=alert(1)>x'.replace(/x/g, 'x'), '非白名单标签原样保留（不被吞，但也不产生标签）')

console.log('━━ 5. 缺字凑法降级 —— 箭头/关系符（步骤⑦⑧）★核心')
eq('A → B', 'A -> B', 'Unicode → 转 ASCII')
eq('A ⇒ B', 'A => B', 'Unicode ⇒ 转 ASCII')
eq('A ↔ B', 'A <-> B', 'Unicode ↔ 转 ASCII')
eq('A \\rightarrow B', 'A -> B', '\\rightarrow 转ASCII')
eq('A \\Rightarrow B', 'A => B', '\\Rightarrow 转 ASCII')
eq('C \\to D', 'C -> D', '\\to 转 ASCII（在 \\rightarrow 之后）')
eq('A \\rightarrow B, C \\to D', 'A -> B, C -> D', '长短命令共存不截断')
eq('x ≤ 5', 'x <= 5', 'Unicode ≤ 转 <=')
eq('y ≥ 2', 'y >= 2', 'Unicode ≥ 转 >=')
eq('a ≠ 0', 'a != 0', 'Unicode ≠ 转 !=')
eq('a ≈ 10', 'a 约 10', 'Unicode ≈ 转中文「约」')
eq('x \\le 5', 'x <= 5', '\\le 转 <=')
eq('x \\leq 5', 'x <= 5', '\\leq 转 <=')
eq('a \\ne 0', 'a != 0', '\\ne 转 !=')
eq('a \\neq 0', 'a != 0', '\\neq 转 !=')

console.log('━━ 6. 缺字凑法降级 —— 运算符/几何/单位（步骤⑦⑧）')
eq('24 × 3', '24 x 3', 'Unicode × 转 x')
eq('24 \\times 3', '24 x 3', '\\times 转 x')
eq('12 ÷ 3', '\\frac{12}{3}', 'Unicode ÷ 转 / 后升 frac（除号一律转分数）')
eq('5 − 3', '5 - 3', '数学长减号 U+2212 转 -')
eq('x ± 2', 'x +- 2', 'Unicode ± 转 +-')
eq('a · b', 'a x b', '间隔号 · 转 x')
eq('a \\cdot b', 'a x b', '\\cdot 转 x')
eq('√9 + 3', '根号9 + 3', 'Unicode √ 转根号')
eq('\\sqrt{9}', '根号9', '\\sqrt{9} 转根号9')
eq('\\sqrt 9', '根号 9', '\\sqrt 9 转根号 9')
eq('30°', '30度', 'Unicode ° 转度')
eq('90 \\circ', '90 度', '\\circ 转度')
eq('x^{\\circ}', 'x度', '^\\circ 转度')
eq('25℃', '25摄氏度', '℃ 转摄氏度')
eq('∠A = 30°', '角A = 30度', '∠ 转角，° 转度')
eq('AB ⊥ CD', 'AB 垂直 CD', '⊥ 转垂直')
eq('AB ∥ CD', 'AB // CD', '∥ 转 //（视觉像平行线）')
eq('AB \\perp CD', 'AB 垂直 CD', '\\perp 转垂直')
eq('AB \\parallel CD', 'AB // CD', '\\parallel 转 //')
eq('π ≈ 3.14', '圆周率 约 3.14', 'π 转圆周率，≈ 转约')
eq('x -> ∞', 'x -> 无穷', '∞ 转无穷')
eq('a ∵ b ∴ c', 'a 因为 b 因此 c', '∵ ∴ 转中文')
eq('\\triangle ABC', '三角形 ABC', '\\triangle 转三角形')
eq('2πr', '2圆周率r', 'π 在式中的凑法')

console.log('━━ 7. 全角变体（步骤⑥）')
eq('Ａ Ｂ Ｃ', 'A B C', '全角字母转半角')
eq('１２３', '123', '全角数字转半角')
eq('ａ ＝ ｂ', 'a = b', '全角等号转半角')
eq('（１＋２）', '（1+2）', '全角括号内数字转半角（括号字体支持保留）')
eq('５／２', '\\frac{5}{2}', '全角斜杠转半角后升 frac')
eq('３／４ x 5', '\\frac{3}{4} x 5', '全角数字+斜杠 → frac')

console.log('━━ 8. 上标与分数 DSL（步骤⑨⑩）')
eq('x^2 + y^3', 'x² + y³', '^2 ^3 转 ² ³')
eq('x^{2}', 'x²', '带花括号上标')
eq('9² = 81', '9² = 81', '已有 ² 保留')
eq('2^2', '2²', '数字底数上标')
eq('(a+b)^2', '(a+b)²', '括号底数上标')
eq('3/4 颗糖', '\\frac{3}{4} 颗糖', '纯整数 a/b 升 frac')
eq('183.6 / 9', '183.6 / 9', '含小数点不误伤')
eq('a/b', 'a/b', '字母分数不误伤')
eq('12 ÷ 3 = 4', '\\frac{12}{3} = 4', '数字除式一律升 frac（除号一律转分数）')
eq('\\frac{3}{8} x 20', '\\frac{3}{8} x 20', '已有 frac 保留')
eq('1\\frac{1}{2}', '1\\frac{1}{2}', '带分数保留')

console.log('━━ 9. 白名单校验 + 纯文本降级')
ok(findUnsafeChars('A -> B, x <= 5, 30度, 角ABC').length === 0, '凑法输出全部手写安全')
ok(findUnsafeChars('→ × ° ² ∵').join('') === '→×°∵', '白名单外字符可检出（² 已豁免）')
ok(boardTextToPlain('\\frac{3}{4} x²') === '3/4 x^2', 'boardTextToPlain 纯文本降级')
const html = renderBoardTextHtml('S = \\frac{3}{4} + 5²')
ok(html.includes('inline-flex') && html.includes('super') && !html.includes('\\frac'), 'renderBoardTextHtml: frac 转 span、² 转上标')
const htmlEsc = renderBoardTextHtml('<b>x</b> & <y>')
ok(htmlEsc.includes('&lt;y&gt;') && htmlEsc.includes('&amp;') && !htmlEsc.includes('<b>'), 'renderBoardTextHtml 标签剥除与转义')

console.log('━━ 10. toBoardLines + isStructMath')
const lines = toBoardLines([{ content: 'a → b\n× 2' }, 'c ≤ d'])
ok(lines.join('|') === 'a -> b|x 2|c <= d', 'toBoardLines 数组对象多行统一')
ok(isStructMath('\\sigma + 1'), '未知 LaTeX 命令命中结构数学')
ok(!isStructMath('a -> b 30度'), '凑法输出不命中结构数学')
ok(!isStructMath('\\frac{1}{2} + 1'), '\\frac 不算结构数学')

console.log('━━ 11. 综合端到端')
const out = normalizeBoardLine('小明有24 × \\frac{3}{8}颗糖，a \\ne 0，5 − 3，x^2，A \\Rightarrow B，∠ABC -> ∠DEF')
eq(out, '小明有24 x \\frac{3}{8}颗糖，a != 0，5 - 3，x²，A => B，角ABC -> 角DEF', '旧规约 V1.0 示例的 v2 输出')
ok(findUnsafeChars(out).length === 0, '端到端输出全部手写安全')

console.log('━━ 12. 副本镜像一致性哨兵（lite-player 2026-10-13 退役，剩两处）')
const mirrors = [
  ['row-player.html', 'row-player.html'],
  ['public/row-player.html', 'public/row-player.html'],
]
const sentinels = ['UNICODE2SAFE', 'LATEX2SAFE', 'FW_KEEP']
for (const [name, path] of mirrors) {
  try {
    const src = readFileSync(resolve(root, path), 'utf-8')
    const hits = sentinels.filter(s => src.includes(s))
    if (hits.length === sentinels.length) { pass++; console.log(`  ✓ ${name} 镜像已同步（含 ${sentinels.join('/')}）`) }
    else { fail++; console.log(`  ✗ ${name} 镜像缺哨兵: ${sentinels.filter(s => !src.includes(s)).join('/')}`) }
  } catch (e) { fail++; console.log(`  ✗ ${name} 读取失败: ${e.message.slice(0, 60)}`) }
}

console.log('\n══════════════════════════════════════════')
console.log(`  ${pass} 通过, ${fail} 失败`)
console.log('══════════════════════════════════════════')
process.exit(fail ? 1 : 0)
