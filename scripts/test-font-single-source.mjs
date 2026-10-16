#!/usr/bin/env node
/**
 * test-font-single-source.mjs — 字体宪法 v2 + v2.1 切换器归一哨兵（2026-10-15 夏夏拍板）
 *
 * 背景（普查发现的散点，本哨兵守卫不再复发）：
 *   ① R8-④：board-preview.html 只挂 490 单链 → 预览页渲染栈尾栗壳坚坚体，与工作台/播放页 507 主字体不一致
 *   ② 题目字体族两口径：UI 层 'Segoe UI, PingFang SC, Microsoft YaHei' 三写 vs 教法层"微软雅黑" → 拍板微软雅黑主
 *   ③ 行高四口径：教法 1.65/1.7± / 播放器实际 1.45~1.69 / App 估算器 1.2 / DOM 预览 1.5 → 全归自然行高
 *   ④ 布局双权威：估算器 layoutBoardRows 注入 startCoord vs 播放器编译期度量排版 → 拔估算器，播放器唯一权威
 *   ⑤ 颜色两套：RealBoardPreview #b42318/#17202a vs 播放器 #dc2626/#000000 → 真源 ANALYSIS_TEXT_COLOR/BOARD_TEXT_COLOR
 *   ⑥ 旧档 uiSettings 携带旧字体口径覆盖（audioSpeedPolicy 同款病）
 *
 * 唯一真源 = src/services/stepHandoff.js（字体宪法 v2 + v2.1 切换器）。
 * ★ v2.1（2026-10-15 同日，夏夏拍板"UI 做下拉选择切换"）：板书字体 2 选 1（qiaomu 乔木 507 默认 /
 *   shaohua 韶华 157），选择值全链路唯一键 = uiSettings.handwritingFontChoice（数据键随档走），
 *   派生口 = resolveHandwritingFont / handwritingFontSourceFor / buildCanvasParams(fontChoice)，
 *   消费端 = AgentBDirect 下拉 + row-player 双胞胎（applyHandFontChoice 六入口 + 换档重预热）+
 *   deliverableStoreHandler 字体域整体重授 + RealBoardPreview fontStack 派生 + speechMarkdown 导出 MD。
 *   H 组锁死以上新契约；E5/G2 断言随 v2.1 派生模式更新（锁得更紧而非放松）。
 * 注意：lite-player.html 已于 2026-10-13 删除（Task 36 记档笔误），仓库中不存在。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  CANVAS_SIZE,
  QUESTION_FONT_SIZE,
  QUESTION_FONT_FAMILY,
  QUESTION_FONT_FAMILY_TEXT,
  BOARD_FONT_SIZE,
  HANDWRITING_FAMILY,
  HANDWRITING_FAMILY_ALT,
  HANDWRITING_FONT_CHOICES,
  HANDWRITING_FONT_CHOICE_DEFAULT,
  HANDWRITING_FONT_STACK,
  HANDWRITING_FONT_STACK_ALT,
  HANDWRITING_CSS_HREF,
  HANDWRITING_CSS_HREF_FALLBACKS,
  LINE_HEIGHT_POLICY_TEXT,
  LINE_HEIGHT_POLICY_SHORT,
  LINE_HEIGHT_ESTIMATE_RATIO,
  NATURAL_LINE_HEIGHT_EXTRA_PX,
  ANALYSIS_TEXT_COLOR,
  BOARD_TEXT_COLOR,
  resolveHandwritingFont,
  handwritingFontSourceFor,
  buildCanvasParams,
} from '../src/services/stepHandoff.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

let pass = 0
let fail = 0
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.error(`  ✗ ${name} ${detail}`) }
}

/* ========== A. 宪法数值（唯一真源行为断言） ========== */
console.log('── A. 字体宪法 v2 真源数值 ──')
check('A1 画布 1726×980（夏夏口径：以实际硬编码画布为准）',
  CANVAS_SIZE.width === 1726 && CANVAS_SIZE.height === 980)
check('A2 题目字号 30px / 板书字号 38px', QUESTION_FONT_SIZE === 30 && BOARD_FONT_SIZE === 38)
check('A3 题目印刷体 = 微软雅黑主（YaHei 第一位，旧 Segoe 优先栈废止）',
  QUESTION_FONT_FAMILY.startsWith('"Microsoft YaHei"') && !QUESTION_FONT_FAMILY.includes('Segoe UI'),
  QUESTION_FONT_FAMILY)
check('A3b 题目字体文案含微软雅黑', QUESTION_FONT_FAMILY_TEXT.includes('微软雅黑'))
check('A4 板书字体 2 种可选：默认平方乔木体 / 备选平方韶华体',
  HANDWRITING_FAMILY === '平方乔木体' && HANDWRITING_FAMILY_ALT === '平方韶华体')
const stackOrder = ['平方乔木体', '平方韶华体', '平方上上谦体', '平方三生体', 'PingFangSaTuoTi', 'LikeJianJianTi', 'KaiTi']
{
  let last = -1, ok = true
  for (const f of stackOrder) {
    const i = HANDWRITING_FONT_STACK.indexOf(f)
    if (i < 0 || i < last) { ok = false; break }
    last = i
  }
  check('A5 降级栈顺序 507→157韶华→511上上谦→510三生→509韶拓→490栗坚→楷体（夏夏链路）', ok, HANDWRITING_FONT_STACK)
}
{
  const ids = HANDWRITING_CSS_HREF_FALLBACKS.map(h => (h.match(/(\d+)\/main/) || [])[1])
  check('A6 CDN 降级链同序 507/157/511/510/509/490', HANDWRITING_CSS_HREF.includes('/507/') && ids.join(',') === '507,157,511,510,509,490', ids.join(','))
}
check('A7 颜色：分析区红 #dc2626 / 其余黑 #000000', ANALYSIS_TEXT_COLOR === '#dc2626' && BOARD_TEXT_COLOR === '#000000')
check('A8 行高口径 = 自然行高 + 2px 分数余量（无强制行高规范）',
  LINE_HEIGHT_POLICY_TEXT.includes('自然行高') && LINE_HEIGHT_POLICY_TEXT.includes('不设强制行高')
  && LINE_HEIGHT_POLICY_TEXT.includes('+2px 分数余量')
  && LINE_HEIGHT_ESTIMATE_RATIO === 1.2 && NATURAL_LINE_HEIGHT_EXTRA_PX === 2)
check('A8b 行高短文案', LINE_HEIGHT_POLICY_SHORT.includes('自然') && LINE_HEIGHT_POLICY_SHORT.includes('2px'))

const hcp = buildCanvasParams()
{
  const cp = JSON.stringify(hcp)
  check('A9 buildCanvasParams：题目 30 微软雅黑黑 / 分析 38 红 / 解答总结 38 黑',
    hcp.fontSize.question.px === 30 && hcp.fontSize.question.family.includes('微软雅黑') && hcp.fontSize.question.color === '黑色'
    && hcp.fontSize.analysis.px === 38 && hcp.fontSize.analysis.color === '红色'
    && hcp.fontSize.solution.color === '黑色' && hcp.fontSize.summary.color === '黑色')
  check('A9b buildCanvasParams 行高块 = 自然+2px 政策（数值 1.65/1.7 不出现；extraPx 数值键）',
    hcp.lineHeight.policy === LINE_HEIGHT_POLICY_TEXT && hcp.lineHeight.extraPx === NATURAL_LINE_HEIGHT_EXTRA_PX
    && !/"1\.65"/.test(cp) && !/"1\.7"/.test(cp))
  check('A9c buildCanvasParams fontSource.question.stack = 真源字体栈',
    hcp.fontSource.question.stack === QUESTION_FONT_FAMILY && hcp.fontSource.question.family === QUESTION_FONT_FAMILY_TEXT)
}

/* ========== B. 死常量清零（src/server 代码层，历史注释豁免） ========== */
console.log('── B. 强制行高死常量清零 ──')
{
  const files = [
    'src/services/stepHandoff.js', 'src/lib/speechMarkdown.js', 'src/agent-b-v2/AgentBDirect.vue',
    'src/components/BoardContentLayer.vue', 'src/components/RealBoardPreview.vue',
    'src/utils/boardLayout.js', 'server/deliverableStoreHandler.js', 'server/agentBV2Handler.js',
    'src/agent-b-v2/prompt.js', 'src/check-agent/prompt.js',
  ]
  const declRe = /export const (QUESTION_LINE_HEIGHT|BOARD_LINE_HEIGHT_(?:MEAN|MIN|MAX)|LINE_HEIGHT_RULE|LINE_HEIGHT_FORMULA)/
  const importRe = /import\s*\{[^}]*(QUESTION_LINE_HEIGHT|BOARD_LINE_HEIGHT_(?:MEAN|MIN|MAX)|LINE_HEIGHT_RULE|LINE_HEIGHT_FORMULA)[^}]*\}\s*from/
  let declHit = [], importHit = [], qLhHit = []
  for (const f of files) {
    const t = read(f)
    if (declRe.test(t)) declHit.push(f)
    if (importRe.test(t)) importHit.push(f)
    if (/questionLineHeight\s*:\s*(?!\s*_legacy)/.test(t)) qLhHit.push(f)
  }
  check('B1 旧行高常量声明全库清零（含 1.65/1.7± 族）', declHit.length === 0, declHit.join(','))
  check('B2 旧行高常量 import 全库清零', importHit.length === 0, importHit.join(','))
  check('B3 questionLineHeight 键位清零（旧 uiSettings 键）', qLhHit.length === 0, qLhHit.join(','))
}

/* ========== C. board-preview.html R8-④ 回归锁 ========== */
console.log('── C. board-preview 字体全栈（R8-④ 销账锁）──')
{
  const t = read('board-preview.html')
  const hrefs = [...t.matchAll(/fontsapi\.zeoseven\.com\/(\d+)\/main\/result\.css/g)].map(m => m[1])
  check('C1 挂 507 主字体（同步 onload 模式）', /fontsapi\.zeoseven\.com\/507\/main\/result\.css[^>]*onload="this\.rel='stylesheet'"/.test(t))
  check('C2 六级降级链全挂 507/157/511/510/509/490', hrefs.includes('507') && hrefs.includes('157') && hrefs.includes('511') && hrefs.includes('510') && hrefs.includes('509') && hrefs.includes('490'), hrefs.join(','))
  check('C3 noscript 回退指 507（不再 490-only）', /<noscript><link[^>]*zeoseven\.com\/507\//.test(t))
  check('C4 挂载注释与 index.html 同源镜像声明', t.includes('降级栈与 index.html / row-player.html 同步镜像'))
}

/* ========== D. row-player 双胞胎 + 离线镜像 ========== */
console.log('── D. row-player 双胞胎与离线镜像 ──')
{
  const rp = read('row-player.html'), rpp = read('public/row-player.html')
  const md5 = (s) => createHash('md5').update(s).digest('hex')
  check('D1 双胞胎逐字节一致（md5）', md5(rp) === md5(rpp))
  check('D2 PRINT_FONT = 微软雅黑主（镜像 stepHandoff.QUESTION_FONT_FAMILY）',
    rp.includes(`const PRINT_FONT='"Microsoft YaHei","PingFang SC",system-ui,sans-serif';`))
  check('D3 自然行高函数存在（fontBoundingBox 度量 + 1.2 兜底）',
    rp.includes('function naturalLhRatio') && /return 1\.2;\s*\n\}/.test(rp))
  check('D4 逐行行距抖动 lhJ 拔除（1.57+d 模式清零）', !/1\.57\+d/.test(rp) && !/lhJ=L\.lhJ/.test(rp))
  check('D5 换列预判 estH = 估算比数 1.2 + 2px 分数余量（v2.2）',
    /estH=lines\.length\*\(38\*1\.2\+NATURAL_LH_EXTRA_PX\)\+20/.test(rp))
  check('D6 题目行距自然度量 + 2px（30*naturalLhRatio+NATURAL_LH_EXTRA_PX，非 30*1.65）',
    /30\*naturalLhRatio\(PRINT_FONT,30\)\+NATURAL_LH_EXTRA_PX/.test(rp) && !/30\*1\.65/.test(rp))
  check('D9 v2.2 分数余量镜像常量 + 画布三处消费（行距推进/换列判定/题目）',
    /const NATURAL_LH_EXTRA_PX=2;/.test(rp)
    && /ly\+=fs\*lhR\+NATURAL_LH_EXTRA_PX;/.test(rp)
    && /ly\+size\*lhR\+NATURAL_LH_EXTRA_PX>maxY/.test(rp)
    && rp.includes('镜像 stepHandoff.NATURAL_LINE_HEIGHT_EXTRA_PX'))
  check('D10 书写抖动全拔（2026-10-17 夏夏拍板「太奇怪」）：位置抖动 amp=0 / 逐字旋转 0 / 整行微倾 0，三路 GLYPH 归零记档仍在',
    /chIdx0:s\.ci,amp:0\}/.test(rp)
    && /const rot=0;/.test(rp)
    && /const tilt=0;/.test(rp)
    && !/rot=\(rnd\(\)\*2-1\)/.test(rp)
    && !/tilt=\(rnd\(\)-0\.5\)/.test(rp)
    && !/amp:1\.2/.test(rp)
    && /GLYPH_FONT_JITTER=0/.test(rp) && /GLYPH_BASELINE_JITTER=0/.test(rp) && /GLYPH_SPACING_JITTER=0/.test(rp))
  check('D7 规格头注释：自然行高 + 微软雅黑', rp.includes('行高 = 自然') && rp.includes('印刷体(微软雅黑 Microsoft YaHei)'))
  check('D8 STAGE_COLOR：分析 #dc2626 / 其余 #000000（色值镜像宪法）',
    /STAGE_COLOR=\{'题目':'#000000','分析':'#dc2626','解答':'#000000','总结':'#000000'\}/.test(rp))
}

/* ========== E. 消费端真源派生（字面量清零） ========== */
console.log('── E. 消费端 import 派生 ──')
{
  const agent = read('src/agent-b-v2/AgentBDirect.vue')
  check('E1 AgentBDirect：questionFontFamily/lineHeightPolicy 真源派生',
    /questionFontFamily:\s*QUESTION_FONT_FAMILY/.test(agent) && /lineHeightPolicy:\s*LINE_HEIGHT_POLICY_TEXT/.test(agent) && /QUESTION_FONT_FAMILY,/.test(agent))
  check('E1b AgentBDirect 无 Segoe 字体字面量', !/"Segoe UI",\s*"PingFang SC"/.test(agent))

  const store = read('server/deliverableStoreHandler.js')
  check('E2 deliverableStoreHandler：字体真源 import + 旧档剥皮（同 audioSpeedPolicy 先例）',
    /questionFontFamily:\s*QUESTION_FONT_FAMILY/.test(store) && /_legacyQuestionFontFamily/.test(store) && /_legacyLineHeightPolicy/.test(store))
  check('E2b deliverableStoreHandler 无 Segoe 字体字面量', !/"Segoe UI",\s*"PingFang SC"/.test(store))

  const smd = read('src/lib/speechMarkdown.js')
  check('E3 speechMarkdown：题目字体真源插值 + 行高政策行（不随档走）+ v2.2 估算公式 +2px',
    /QUESTION_FONT_FAMILY/.test(smd) && /LINE_HEIGHT_POLICY_TEXT/.test(smd) && /LINE_HEIGHT_ESTIMATE_RATIO/.test(smd)
    && /NATURAL_LINE_HEIGHT_EXTRA_PX/.test(smd) && /\$\{NATURAL_LINE_HEIGHT_EXTRA_PX\}px/.test(smd))

  const bcl = read('src/components/BoardContentLayer.vue')
  check('E4 BoardContentLayer：题目层内联真源字体族/颜色 + 行高自然',
    /fontFamily:\s*QUESTION_FONT_FAMILY/.test(bcl) && /color:\s*BOARD_TEXT_COLOR/.test(bcl) && !/line-height:\s*1\.65/.test(bcl))
  check('E4b BoardContentLayer：v2.2 题目行高 = 度量比数 + 分数余量（naturalLineHeight 派生，未度量回落 normal）',
    /naturalLhRatioFor\(QUESTION_FONT_FAMILY,\s*realQuestionFontSize\.value\)/.test(bcl)
    && /lineHeight:\s*naturalLhWithFractionMargin\(topicLhRatio\.value,\s*fs\)\s*\?\?\s*undefined/.test(bcl)
    && /line-height:\s*normal/.test(bcl))   // 度量失败兑底仍在类样式

  const rbp = read('src/components/RealBoardPreview.vue')
  check('E5 RealBoardPreview：字体栈 = fontSource 派生计算属性 + 真源常量兑底（v2.1，全文件无栈字面量）',
    /const handwritingFontStack\s*=\s*computed/.test(rbp)
    && /props\.canvasParams\?\.fontSource\?\.handwriting\?\.fontStack/.test(rbp)
    && /:\s*HANDWRITING_FONT_STACK$/m.test(rbp)                     // 兑底必须 = 真源常量
    && /fontFamily:\s*handwritingFontStack/.test(rbp)               // 模板绑定派生值
    && /HANDWRITING_FONT_STACK,/.test(rbp)                           // import 自真源
    && !rbp.includes('PingFangSaTuoTi') && !rbp.includes('平方乔木体') && !rbp.includes('平方韶华体'))
  check('E5b RealBoardPreview：颜色走 CSS var 真源注入（旧 #b42318/#17202a 清零）',
    /'--board-analysis-color':\s*ANALYSIS_TEXT_COLOR/.test(rbp) && /'--board-ink-color':\s*BOARD_TEXT_COLOR/.test(rbp) && !rbp.includes('#b42318') && !rbp.includes('#17202a'))
  check('E5c RealBoardPreview：v2.2 行高 = 度量比数 + 分数余量（loadingdone 重测，旧 1.5 拔除）',
    /lineHeight:\s*boardTextLh\s*\?\?\s*'normal'/.test(rbp)
    && /naturalLhRatioFor\(handwritingFontStack\.value,\s*boardFontSize\.value\)/.test(rbp)
    && /loadingdone/.test(rbp)
    && /line-height:\s*normal/.test(rbp)      // 度量失败兑底仍在类样式
    && !/line-height:\s*1\.5;/.test(rbp))
}

/* ========== F. 布局权威归一（估算器注入拔除） ========== */
console.log('── F. 布局唯一权威（渲染层编译期度量）──')
{
  const bl = read('src/utils/boardLayout.js')
  const store = read('server/deliverableStoreHandler.js')
  const rp = read('row-player.html')
  check('F1 layoutBoardRows 估算器已拔除（不再导出）', !/export function layoutBoardRows/.test(bl))
  check('F2 deliverableStoreHandler 不再注入 startCoord（显式坐标尊重路径保留给 row 自带）',
    !/startCoord:\s*row\.board\.startCoord\s*\|\|/.test(store) && !/layoutBoardRows/.test(store.replace(/\/\/.*layoutBoardRows.*$/m, '')))
  check('F3 播放器顺序排版引擎在位（stageFlowPlace + layoutBoardLines + 显式坐标尊重）',
    rp.includes('function stageFlowPlace') && rp.includes('function layoutBoardLines') && rp.includes("resolveBoardCoord"))
}

/* ========== G. 教法层（技能包/提示词） ========== */
console.log('── G. 教法层对齐 ──')
{
  const bsr = read('skills/board-speech-rules/SKILL.md')
  check('G1 board-speech-rules：行高列自然+2px 分数余量 + 估算公式 1.2+2px + 活表格旧值清零（墓碑注释豁免）',
    bsr.includes('自然+2px 分数余量') && bsr.includes('字号 × 1.2 + 2px') && !/行高约1\.7/.test(bsr) && !/\| ~1\.65 \|/.test(bsr) && !/\| ~1\.7 /.test(bsr))
  check('G1b board-speech-rules：题目字体 = 微软雅黑', bsr.includes('印刷体（微软雅黑 Microsoft YaHei'))
  const meta = JSON.parse(read('skills/board-speech-rules/meta.json'))
  check('G1c meta.json v3.3.1 + v3_3_1_changes 记档（v2.2 分数余量）',
    meta.version === '3.3.1' && Array.isArray(meta.v3_3_1_changes) && meta.v3_3_1_changes.some(s => s.includes('分数余量'))
    && Array.isArray(meta.v3_3_changes) && meta.v3_3_changes.some(s => s.includes('自然行高')))

  const hfp = read('skills/handwriting-font-policy/SKILL.md')
  check('G2 handwriting-font-policy：L1 印刷体微软雅黑永久 + L3 v2.1 用户可切换（下拉 2 选 1 随档走）',
    hfp.includes('微软雅黑 Microsoft YaHei 主') && hfp.includes('印刷体永久')
    && hfp.includes('用户可切换（v2.1 下拉 2 选 1')
    && hfp.includes('uiSettings.handwritingFontChoice') && hfp.includes('resolveHandwritingFont'))
  check('G2b handwriting-font-policy：7.2 表行高自然（活表格旧值清零，墓碑注释豁免）',
    hfp.includes('| 题目区 | 印刷体（微软雅黑） | ~30px') && !/\| ~1\.65 \|/.test(hfp) && !/\| ~1\.7 /.test(hfp))

  const blp = read('skills/board-lecture-player/SKILL.md')
  check('G3 board-lecture-player：行距自然 + 2px 分数余量 + 无"行距抖动"',
    blp.includes('行间距自然 + 2px 分数余量') && !/行距抖动/.test(blp))

  const prompt = read('src/agent-b-v2/prompt.js')
  check('G4 B prompt 教法：题目字号 30px 微软雅黑（与宪法一致）', prompt.includes('题目字号 ${QUESTION_FONT_SIZE}px 微软雅黑'))
}

/* ========== H. v2.1 字体切换器（下拉 2 选 1，夏夏拍板） ========== */
console.log('── H. v2.1 字体切换器 ──')
{
  const rp = read('row-player.html')
  const noWs = (s) => String(s).replace(/\s+/g, '')
  check('H1 注册表恰 2 项（qiaomu 默认 / shaohua）+ DEFAULT = qiaomu',
    HANDWRITING_FONT_CHOICES.length === 2
    && HANDWRITING_FONT_CHOICES[0].id === 'qiaomu' && HANDWRITING_FONT_CHOICES[0].label === '平方乔木体（默认）'
    && HANDWRITING_FONT_CHOICES[1].id === 'shaohua' && HANDWRITING_FONT_CHOICES[1].label === '平方韶华体'
    && HANDWRITING_FONT_CHOICE_DEFAULT === 'qiaomu')
  check('H2 shaohua 态栈/CDN 不含乔木 507（157 主链；双胞胎镜像与真源逐字同构）',
    resolveHandwritingFont('shaohua').fontStack === HANDWRITING_FONT_STACK_ALT
    && !HANDWRITING_FONT_STACK_ALT.includes('平方乔木体')
    && resolveHandwritingFont('shaohua').cdn === '157'
    && resolveHandwritingFont('shaohua').cssHrefs.every(h => !h.includes('/507/'))
    && noWs(rp).includes("qiaomu:'" + noWs(HANDWRITING_FONT_STACK))
    && noWs(rp).includes("shaohua:'" + noWs(HANDWRITING_FONT_STACK_ALT)))
  check('H3 resolveHandwritingFont 非法/空值一律兑底 qiaomu（行为断言）',
    ['SANSHENG', undefined, null, '', 157, {}].every(v => resolveHandwritingFont(v).choice === 'qiaomu')
    && handwritingFontSourceFor('shaohua').cssHref.includes('/157/')
    && handwritingFontSourceFor('garbage').choice === 'qiaomu')
  {
    // 全库字面量清零：代码层（剥注释）不出现手写字体族/CDN 字面量；
    // 真源 stepHandoff.js 与 row-player 受控镜像、board-preview.html、技能包文档域外豁免
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')
    const black = /平方乔木体|平方韶华体|平方上上谦体|平方三生体|PingFangSaTuoTi|LikeJianJianTi|fontsapi\.zeoseven\.com/
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = join(dir, d.name)
      return d.isDirectory() ? walk(p) : (/\.(js|vue)$/.test(d.name) ? [p] : [])
    })
    const targets = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'server'))]
      .filter((p) => !p.endsWith('stepHandoff.js'))
    const bad = targets.filter((p) => black.test(strip(readFileSync(p, 'utf8'))))
    check('H4 全库（src/ + server/）手写字体字面量清零（注释豁免；真源/双胞胎/board-preview/技能包域外）',
      bad.length === 0, bad.map((p) => p.replace(ROOT + '/', '')).join(','))
  }
  {
    const ahfc = (rp.match(/function applyHandFontChoice\(choice\)\{[\s\S]*?\n\}/) || [''])[0]
    const entries = (rp.match(/applyHandFontChoice\((?:_?nd)\.handwritingFontChoice\)/g) || []).length
    check('H5 row-player 换档接线（六入口全调 + let HAND_FONT 双态初始化）',
      rp.includes('function applyHandFontChoice(choice)')
      && rp.includes('let HAND_FONT=HAND_FONT_STACKS.qiaomu')
      && rp.includes('handwritingFontChoice:(j.uiSettings&&j.uiSettings.handwritingFontChoice)')
      && rp.includes('ROW_CACHE.clear()')
      && entries === 6, `entries=${entries}`)
    check('H5b applyHandFontChoice 换字体后重预热 warmBoardFonts（canvas 不触发 @font-face 下载，防静默回退）',
      ahfc.includes('warmBoardFonts()'))
  }
  {
    const store = read('server/deliverableStoreHandler.js')
    check('H6 deliverableStoreHandler 字体域整体归一（选择态重建 defaultHcp + 剥皮 + spread 后必胜重授）',
      store.includes('_legacyHandwritingFont') && store.includes('_legacyFontChoiceForPeelOnly')
      && /handwritingFontChoice:\s*fontSel\.choice/.test(store) && /handwritingFont:\s*fontSel\.family/.test(store)
      && /handwriting:\s*handwritingFontSourceFor\(rawFontChoice\)/.test(store)
      && /defaultHcp\s*=\s*buildCanvasParams\(fontSel\.choice\)/.test(store)
      && /fontSize:\s*defaultHcp\.fontSize/.test(store))
  }
  {
    const agent = read('src/agent-b-v2/AgentBDirect.vue')
    const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/<!--[\s\S]*?-->/g, '')
    const black = /平方乔木体|平方韶华体|PingFangSaTuoTi|LikeJianJianTi/
    check('H7 AgentBDirect 下拉/序列化/导出全真源派生（无栈字面量，选择值随档走）',
      agent.includes('HANDWRITING_FONT_CHOICES.map')
      && agent.includes("localStorage.getItem(BOARD_FONT_CHOICE_LS_KEY)")
      && /buildCanvasParams\(boardFontChoice\.value\)/.test(agent)
      && /handwritingFontChoice:\s*boardFontSel\.choice/.test(agent)
      && /handwritingFontChoice:\s*boardFontChoice\.value/.test(agent)
      && !black.test(strip(agent)))
  }
}

/* ========== I. v2.2 分数余量（DOM 度量工具 naturalLineHeight.js） ========== */
console.log('── I. v2.2 分数余量 DOM 工具 ──')
{
  const nlh = read('src/lib/naturalLineHeight.js')
  check('I1 naturalLineHeight.js：真源余量 import + fontBoundingBox 同源度量 + 护栏区间 + null 回落',
    /NATURAL_LINE_HEIGHT_EXTRA_PX/.test(nlh)
    && /fontBoundingBoxAscent/.test(nlh) && /fontBoundingBoxDescent/.test(nlh)
    && /r > 0\.8 && r < 3/.test(nlh)
    && /typeof document === 'undefined'/.test(nlh))
  const bl = read('src/utils/boardLayout.js')
  check('I2 boardLayout 墓碑注释带余量重建口径（RATIO + EXTRA_PX，不手写比数）',
    /LINE_HEIGHT_ESTIMATE_RATIO \+ NATURAL_LINE_HEIGHT_EXTRA_PX/.test(bl))
}

/* ========== 收尾 ========== */
console.log(`\n[font-single-source] ${pass} 通过 / ${fail} 失败`)
process.exit(fail ? 1 : 0)
