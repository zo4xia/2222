/**
 * Task 32 测试：第一步"回填的题目和上传内容完全不一样"修复（分支2 canvasText 移植 + blocks 陈旧防御）
 *
 * 病灶（夏夏 2026-10-14："我上传图片，回填的题目居然和上传的内容完全不一样，坏掉了"）：
 *   ① 识别链返回的题文带着 LLM/JSON 传输损伤（\frac 被吃成 rac{、&times; 实体、字面 \n、
 *      HTML 标签）——分支2（旧版第一步好的真身）最后两个提交（c0ba3a9/c298e5a3）落地了
 *      canvasText 修复层接进 renderProblemHtml，main 初始导入没带上，损伤题文原样上画布。
 *   ② 旧题的 customTopicLayout.blocks 从 localStorage 恢复后压过新识别回填的题目文本
 *      ——画布显示的还是上一题（"回填的题目完全不一样"的另一真凶）。
 * 修复承诺（本测试守卫）：
 *   A. canvasText.js 存在且为分支2 原样移植（损伤修复规则逐条可验）；
 *   B. renderProblemHtml 首行进 normalizeCanvasText（Step1 画布 + board-preview 全屏同源生效）；
 *   C. 回填边界：placeOnCanvas 回填前先清洗（rac{ 不进题目框）；
 *   D. blocks 陈旧防御：blocks 文本 ≠ 当前题目文本 → 弃用旧块（新题不被旧题块压制）；
 *   E. 行为测试：损伤文本进 renderProblemHtml 出来是修复后的渲染（rac{ → KaTeX 分数）。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = p => readFileSync(join(ROOT, p), 'utf8')

const canvasTextSrc = read('src/utils/canvasText.js')
const mathTextSrc = read('src/utils/mathText.js')
const step1Src = read('src/components/Step1Entry.vue')
const layerSrc = read('src/components/BoardContentLayer.vue')

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${detail}`) }
}

/* ---------- A. canvasText.js 存在且规则齐备（分支2 原样移植） ---------- */
console.log('A. canvasText 修复层（分支2 移植）')
check('文件存在且导出 normalizeCanvasText/normalizeCanvasLines',
  /export function normalizeCanvasText/.test(canvasTextSrc) && /export function normalizeCanvasLines/.test(canvasTextSrc))
check('LaTeX 损伤修复规则（\\u000c+rac / rac{ / frac{ → \\frac）',
  /\\u000c\\s\*rac/.test(canvasTextSrc) && /rac\(\?=\\s\*\\{\)/.test(canvasTextSrc) && /frac\(\?=\\s\*\\{\)/.test(canvasTextSrc))
check('HTML 实体解码（&times; &divide; &amp; 最后解）',
  canvasTextSrc.includes('&times;') && canvasTextSrc.includes('&divide;') && canvasTextSrc.includes(".replace(/&amp;/gi, '&')"))
check('控制字符清理但保留换行（\\t\\b\\v\\f 退化空格）',
  canvasTextSrc.includes('[\\t\\u0008\\u000B\\u000C]+'))
check('字面 \\n 还原（后非字母，保 \\neq 类命令）', /\\\\n\(\?!\[a-zA-Z\]\)/.test(canvasTextSrc))

/* ---------- B. renderProblemHtml 接线 ---------- */
console.log('B. 题文渲染入口接线')
check('mathText 引入 normalizeCanvasText', /from '\.\/canvasText\.js'/.test(mathTextSrc))
check('renderProblemHtml 首行进修复（不再原样 String(text)）',
  /export function renderProblemHtml\(text\) \{\s*\n\s*const raw = normalizeCanvasText\(text\)\.trim\(\)/.test(mathTextSrc)
  && !/const raw = String\(text \|\| ''\)\.trim\(\)/.test(mathTextSrc))
check('hasMathContent 分支2 同名 API 补齐', /export function hasMathContent/.test(mathTextSrc))
check('BoardContentLayer 画布题块走 renderProblemHtml（同源受益）', /renderProblemHtml\(currentText\)/.test(layerSrc))
check('board-preview 全屏题文走 renderProblemHtml（同源受益）', read('src/board-preview/BoardPreviewApp.vue').includes('renderProblemHtml(problemText'))

/* ---------- C. 回填边界清洗 ---------- */
console.log('C. 回填边界清洗')
check('Step1Entry 引入 normalizeCanvasText', /from '\.\.\/utils\/canvasText\.js'/.test(step1Src))
check('placeOnCanvas 回填先清洗（rac{ 不进题目框）',
  /problemText\.value = normalizeCanvasText\(result\.problemText\)\.trim\(\) \|\| result\.problemText/.test(step1Src))

/* ---------- D. blocks 陈旧防御 ---------- */
console.log('D. blocks 陈旧防御（旧题块不得压新题）')
check('防御函数存在（文本一致才复用）', /function savedBlocksMatchCurrentText/.test(step1Src))
check('topicLayout.blocks 过防御门（不再裸用 customTopicLayout.value.blocks）',
  /blocks: savedBlocksMatchCurrentText\(customTopicLayout\.value\.blocks, problemText\.value\) \|\| auto\.blocks/.test(step1Src)
  && !/blocks: customTopicLayout\.value\.blocks \|\| auto\.blocks/.test(step1Src))

/* ---------- E. 行为测试（真函数求值） ---------- */
console.log('E. 行为验证（canvasText + renderProblemHtml 端到端）')
const require = createRequire(import.meta.url)
const { normalizeCanvasText, normalizeCanvasLines } = await import(join(ROOT, 'src/utils/canvasText.js'))

check('rac{12}{8} 损伤修复为 \\frac{12}{8}',
  normalizeCanvasText('长12米rac{12}{8}米') === '长12米\\frac{12}{8}米')
check('frac{ 无反斜杠前导同样修复', normalizeCanvasText('x frac{1}{2} y') === 'x \\frac{1}{2} y')
check('已有 \\frac 不被二次处理', normalizeCanvasText('a \\frac{1}{2} b') === 'a \\frac{1}{2} b')
check('实体解码 &times;&divide;&nbsp;',
  normalizeCanvasText('3&times;4&divide;2') === '3×4÷2' && normalizeCanvasText('a&nbsp;b') === 'a b')
check('&amp; 最后解（&amp;lt; 只解一层得 &lt;，不二次解成 <）', normalizeCanvasText('&amp;lt;') === '&lt;')
check('字面 \\n 还原为换行（后非字母）', normalizeCanvasText('第一行\\n第二行') === '第一行\n第二行')
check('LaTeX 命令 \\neq 不被误伤', normalizeCanvasText('a\\neq b') === 'a\\neq b')
check('HTML 标签剥除 + <br> 换行', normalizeCanvasText('题<br/>目<x>文') === '题\n目文')
check('normalizeCanvasLines 逐行清理', JSON.stringify(normalizeCanvasLines(' a \\n b \\n\\n ')) === JSON.stringify(['a', 'b']))

// mathText 引 katex CSS（Node ESM 无法直接 import）——拷贝剥离 CSS import 后求值
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const mathCopy = join(ROOT, 'scripts', '.tmp-mathText.test.mjs')
writeFileSync(mathCopy, mathTextSrc
  .replace(/import 'katex\/dist\/katex.min.css'/, '')
  .replace("from './canvasText.js'", "from '../src/utils/canvasText.js'"), 'utf8')
const { renderProblemHtml } = await import(mathCopy)
const html = renderProblemHtml('rac{12}{8} &times; 3')
check('renderProblemHtml 吃进损伤文本吐出修复渲染（KaTeX 分数 + 实体解码）',
  html.includes('katex') && !html.includes('rac{') && html.includes('×'),
  `实际输出: ${html.slice(0, 120)}`)
const plain = renderProblemHtml('纯中文题目&divide;不含损伤')
check('纯文本路径同样过修复（&divide; → ÷）', plain.includes('÷') && !plain.includes('&divide;'), plain)

import { rmSync } from 'node:fs'
try { rmSync(mathCopy) } catch {}

console.log(`\n结果: ${pass}/${pass + fail} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
