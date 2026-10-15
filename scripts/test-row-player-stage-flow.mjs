/**
 * Task 30 测试：row-player 同 stage 多行顺序排版（B 契约渲染层兑现）
 *
 * 病灶（夏夏 2026-10-13 实测："生成预览页面布局坏掉了，谁把我的布局规则判断规则改坏了"）：
 *   B 侧 prompt 契约早已改成"板书不输出起手坐标，由渲染层按区域自然排版"，
 *   但 row-player 渲染器从未实现顺序排版——同 stage 每一行都落区域左上角 → 同环节多行全部叠字。
 * 修复承诺（本测试守卫）：
 *   ① stageFlowPlace 纯函数：首行落区域左上锚 / 后续行自然续排 / 放不下换列 / 显式 startCoord 尊重原位
 *   ② compile 端到端：同 stage 三行不叠（y 严格递增），board task 带 layout/lines/chars
 *   ③ 动作锚定池：boardChars = 本行+先前行已写文字（B 契约"必须锚定已写出的文字"）
 *   ④ drawWriting 消费编译期布局（回退同函数自算）；drawAction 板书字池优先于题目
 *   ⑤ 字体门：字体到位后 C=compile(C.data) 整轴重排（编译期布局随真实字宽重算）
 *   ⑥ 双胞胎同步 + DOCTYPE 病头不回归（Task 26 哨兵）
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLAYER = join(ROOT, 'row-player.html')
const PLAYER_PUBLIC = join(ROOT, 'public', 'row-player.html')

const html = readFileSync(PLAYER, 'utf8')
const htmlPub = readFileSync(PLAYER_PUBLIC, 'utf8')

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${detail}`) }
}

/* ---------- 0) 双胞胎一致 + DOCTYPE 回归哨（Task 26） ---------- */
const md5 = p => createHash('md5').update(readFileSync(p, 'utf8')).digest('hex')
check('双胞胎同步（根模板与 public 模板逐字节一致）', md5(PLAYER) === md5(PLAYER_PUBLIC))
check('DOCTYPE 病头不回归（首行 <!DOCTYPE html>）', /^<!DOCTYPE html>/i.test(html.trim()))

/* ---------- 1) 提取器：按声明名做括号配平切割（HTML 单文件不能 import，只能提取求值） ---------- */
const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] || ''
check('模板内 <script> 可提取', script.length > 100000, `bytes=${script.length}`)

function extractDecl(name) {
  const patterns = [
    `function ${name}(`,
    `function ${name} (`,
    `const ${name}=`,
    `const ${name} =`,
    // ★ v2.1：HAND_FONT 改为 let 声明（字体切换器需要重赋值），提取器同步认 let
    `let ${name}=`,
    `let ${name} =`,
  ]
  for (const pat of patterns) {
    const start = script.indexOf(pat)
    if (start < 0) continue
    let i = start
    let depth = 0
    let sawBrace = false
    while (i < script.length) {
      const ch = script[i]
      if (ch === '"' || ch === "'" || ch === '`') { // 跳过字符串字面量
        const q = ch; i++
        while (i < script.length && script[i] !== q) { if (script[i] === '\\') i++; i++ }
      } else if (ch === '/' && script[i + 1] === '/') { while (i < script.length && script[i] !== '\n') i++ }
      else if (ch === '/' && script[i + 1] === '*') { i += 2; while (i < script.length && !(script[i] === '*' && script[i + 1] === '/')) i++; i++ }
      else if (ch === '{') { depth++; sawBrace = true }
      else if (ch === '}' || ch === ')' || ch === ']') depth--
      else if (ch === '(' || ch === '[') depth++
      else if (ch === ';' && !sawBrace && depth === 0) { i++; break } // 无括号的常量声明
      if (sawBrace && depth === 0) { i++; break }                       // 函数体/对象字面量闭合
      i++
    }
    return script.slice(start, i)
  }
  return null
}

const NEEDED = [
  'mulberry32', 'hashStr', 'jit', 'parseCoord',          // 第 2 节：抖动与坐标
  'measureLine', 'isRuleLine', 'readBrace', 'tokenizeLine', // 第 5 节：量宽与记号
  'isAudioSrc', 'pick',                                    // 第 8 节：装载区散件
  // ★ v2.1：HAND_FONT = let HAND_FONT_STACKS.qiaomu —— 初始化依赖 HAND_FONT_STACKS，须先提取
  'BASE_CHAR_MS', 'HAND_FONT_STACKS', 'HAND_FONT',         // 常量
]
const decls = NEEDED.map(extractDecl)
check('全部散件依赖可提取', decls.every(Boolean), NEEDED.filter((n, i) => !decls[i]).join(','))

/* 整段提取：第 3 节（编译期+顺序排版+compile）与第 5c 节（板书文本规范化超级过滤器全链） */
const sec3 = script.slice(script.indexOf('/* ============ 3.'), script.indexOf('/* ============ 4.'))
const sec5c = script.slice(script.indexOf('/* ============ 5c.'), script.indexOf('/* ============ 6.'))
check('第 3 节整段可提取（含 compile + stageFlowPlace + layoutBoardLines + boardCharPool）',
  sec3.includes('function compile') && sec3.includes('function stageFlowPlace') && sec3.includes('function layoutBoardLines') && sec3.includes('function boardCharPool'))
check('第 5c 节整段可提取（superFilter 全链 normalizeBoardLine/toBoardLines）',
  sec5c.includes('function toBoardLines') && sec5c.includes('function normalizeBoardLine'))

/* ---------- 2) 桩环境：MCTX 假字宽（每字符 38px 的确定性度量） ---------- */
const sandbox = `
  var MCTX = { font:'', measureText: function(t){ return { width: String(t).length * 38 } } };
  ${sec3}
  ${sec5c}
  ${decls.filter(Boolean).join('\n')}
`
const lib = new Function(sandbox + `
  return { resolveBoardCoord, stageFlowPlace, layoutBoardLines, boardCharPool, compile, parseCoord };
`)()
const { resolveBoardCoord, stageFlowPlace, compile } = lib

const W = 1726, H = 980
const bp = {
  canvas: { w: W, h: H },
  question: { x: 6, y: 13.32, w: 40.32, h: 26 },
  analysis: { x: 6, y: 40.62, w: 44, h: 54.38 },
  solution: { x: 54, y: 14, w: 40, h: 44 },
  summary: { x: 54, y: 69.5, w: 40, h: 22 },
}

/* ---------- 3) resolveBoardCoord：三层回退带 src 标记 ---------- */
check('显式 startCoord → src:"row"（样例/老档兼容路径保留）',
  resolveBoardCoord({ board: { startCoord: '[8%, 44%]' } }, bp, '分析').src === 'row')
check('无坐标 → src:"zone"（区域左上，仅作首行起笔锚）',
  resolveBoardCoord({ board: {} }, bp, '分析').src === 'zone')
check('区域缺位 → src:"fallback"（模板常量兜底）',
  resolveBoardCoord({ board: {} }, {}, '分析').src === 'fallback')

/* ---------- 4) stageFlowPlace 纯函数四行为 ---------- */
{
  const zone = { x: 103.56, y: 398.1 }
  const r1 = stageFlowPlace(null, zone, null, 200, W, H, 38)
  check('首行：无游标无坐标 → 落区域左上锚', r1.start.x === zone.x && r1.start.y === zone.y)
  check('首行：游标锚 anchorY = 起笔 y（后续换列回这里）', r1.cursor.anchorY === zone.y)

  const r2 = stageFlowPlace({ x: zone.x, y: 560, anchorY: zone.y, colMaxW: 400 }, zone, null, 200, W, H, 38)
  check('次行：自然续排（y=游标 y，同列不跳）', r2.start.x === zone.x && r2.start.y === 560)

  const r3 = stageFlowPlace({ x: zone.x, y: 900, anchorY: zone.y, colMaxW: 400 }, zone, null, 200, W, H, 38)
  check('放不下换列：x+colMaxW+colGap、y 回锚', Math.abs(r3.start.x - (zone.x + 400 + 34)) < 1e-9 && r3.start.y === zone.y)

  const r4 = stageFlowPlace({ x: zone.x, y: 900, anchorY: zone.y, colMaxW: 400 }, zone, { x: 900, y: 200 }, 200, W, H, 38)
  check('显式 startCoord：尊重原位不被游标改写', r4.start.x === 900 && r4.start.y === 200)
  check('显式 startCoord：游标跟随（下 行续排不叠它）', r4.cursor.x === 900 && r4.cursor.y === 200 && r4.cursor.anchorY === 200)
}

/* ---------- 5) compile 端到端：同 stage 三行不叠 ---------- */
{
  const data = {
    boardPlan: bp,
    problemText: '平行四边形底 9 高 20.4 求面积',
    rows: [
      { stage: '分析', speech: '先看底', board: { content: '第一行：看底' }, duration: 3 },
      { stage: '分析', speech: '再看高', board: { content: '第二行：看高' }, duration: 3 },
      { stage: '分析', speech: '最后找关系', board: { content: '第三行：底乘高' }, duration: 3 },
      { stage: '解答', speech: '列式', board: { startCoord: '[56%, 16%]', content: 'S=底x高' }, duration: 3 },
    ],
  }
  const C = compile(data)
  const boards = C.rows.map(r => r.plan.find(k => k.type === 'board')).filter(Boolean)
  check('四行板书任务全编译', boards.length === 4)
  check('board task 带编译期布局 layout（drawWriting 消费）', boards.every(b => Array.isArray(b.layout) && b.layout.length > 0))
  check('board task 带字池 chars（动作锚定用）', boards.every(b => Array.isArray(b.chars) && b.chars.length > 0))

  const [b1, b2, b3, b4] = boards
  const zoneY = H * (bp.analysis.y + 4) / 100
  check('同 stage 首行落区域左上锚（y = (40.62+4)%）', Math.abs(b1.layout[0].y - zoneY) < 1e-6)
  check('同 stage 第二行不叠首行（y2 > 首行末行 y）', b2.layout[0].y > b1.layout[b1.layout.length - 1].y)
  check('同 stage 第三行不叠第二行（y3 > 第二行末行 y）', b3.layout[0].y > b2.layout[b2.layout.length - 1].y)
  check('三行同列左对齐（自然段落感）', b1.layout[0].x === b2.layout[0].x && b2.layout[0].x === b3.layout[0].x)
  check('相邻行距 = 自然行高 + 2px 分数余量（字体宪法 v2.2：桩环境无度量→估算1.2→38×1.2+2=47.6，非 0 叠字）',
    Math.abs((b2.layout[0].y - b1.layout[0].y) - (38 * 1.2 + 2)) < 1e-6,
    `gap=${b2.layout[0].y - b1.layout[0].y}`)
  const solX = W * 56 / 100, solY = H * 16 / 100
  check('显式 startCoord 行尊重原位（解答 [56%,16%]）', Math.abs(b4.layout[0].x - solX) < 1e-6 && Math.abs(b4.layout[0].y - solY) < 1e-6)

  /* 动作锚定池：第 4 行（解答）之后的动作动作字池应含解答行字 */
  const act = C.rows[3].plan.find(k => k.type === 'action')
  check('compile 后时序完整（rows=4, total>0）', C.rows.length === 4 && C.total > 0)
  void act
}

/* 动作字池注入结构：plan.push 带 boardChars:boardCharsRegistry.slice() */
check('compile 动作段带板书字池快照（boardChars:boardCharsRegistry.slice()）',
  /type:'action',startOffsetMs:cursor,durationMs:adur,action:a,\s*\n\s*boardChars:boardCharsRegistry\.slice\(\)/.test(script))

/* ---------- 6) 结构断言：drawWriting / drawAction / 字体门 ---------- */
check('drawWriting 消费编译期布局（task.layout 优先 + layoutBoardLines 回退同函数）',
  /const preL=task\.layout\|\|null;/.test(script) && /const layout=preL\|\|layoutBoardLines\(task\.content,x,y,W,H\)\.layout;/.test(script))
check('drawAction 板书字池优先锚定（boardChars 先搜、Q.chars 兜底）',
  /let rg=\(task\.boardChars&&task\.boardChars\.length\)\?findRange\(task\.boardChars/.test(script) &&
  /if\(!rg\)rg=findRange\(Q\.chars/.test(script))
check('drawAction 标注框按命中字号自适应（板书 38 / 题目 30）', /const fs=rg\.size\|\|30;/.test(script))
check('findRange 返回带实际字号 size（下游标注框用）', /y2:b\.y,size:\(a\.size!=null\?a\.size:30\)/.test(script))
check('字体门：warmBoardFonts 到位后整轴重排（C=compile(C.data)）',
  /FONT_VER\+\+; ROW_CACHE\.clear\(\);[\s\S]{0,400}?C=compile\(C\.data\)/.test(script))
check('fonts.ready 同款重排（两处字体门都补）',
  (script.match(/try\{\s*C=compile\(C\.data\);\s*\}catch/g) || []).length === 2)
check('模板协议文档同步：契约描述改为渲染层顺序排版',
  /渲染层会以 stage 区域为起点|同 stage 多行顺序排版/.test(script) && !/所有板书叠一处/.test(script))

/* ---------- 7) 老档案/内置样例兼容：startCoord 行为不变（回归哨） ---------- */
check('内置样例 DATA 仍带 startCoord（显式坐标路径有真实用例）',
  /startCoord:\s*"\[8%,\s*44%\]"/.test(script) && /startCoord:\s*"\[56%,\s*16%\]"/.test(script))

/* ---------- 汇总 ---------- */
console.log(`\n[stage-flow] ${pass} 通过 / ${fail} 失败`)
if (fail > 0) process.exit(1)
