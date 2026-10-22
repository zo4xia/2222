/* @qh-core LANE=STEP1 POINT=HANDOFF_OWNER payload from Agent A to Agent B */
/**
 * 第1步 → 板书参数书稿页 交接
 * 信号：用户点击「确定进入生成表」
 * 核心：题目内容、题型、板书侧重 + 第1步已定题目坐标
 */
/* 画布参数【唯一真源】
 * 全项目画布尺寸 / 题目字号 / 板书字号 / 字体族 / 颜色 / 行高口径只在此定义，其余位置一律 import。
 * 禁止再写字面值（30 / 38 / 1726 / 980 / 微软雅黑栈 / #dc2626 / #000000）；发现别处硬编码 = 那处是 bug。
 * 注意 skills/ 下的 html 是测试草稿，不是本文件的依据。
 *
 * ★ Task 10 修复 (2026-09-21)：恢复甲方原始要求（row-player.html v1.1 2026-09-17 拍板版）
 *   - 板书字号 38px → 40px（2026-10-22 夏夏实测「还是小了一点」；38 为 2026-09-17 的 35/42 折中）
 *   - 板书字体 LikeJianJianTi(490) → 平方乔木体(507) 优先，490 作为降级栈尾
 *   - 字距 0-2px 微小随机 → 三路抖动（字号/基线/字距）+ 位置抖动（⚠ 2026-10-17 夏夏拍板书写抖动全拔：三路+位置+逐字旋转+整行微倾均已归零退役，手写感只由手写字体+rough笔触承载）
 *
 * ★ 字体宪法 v2（2026-10-15 夏夏拍板，全库归一）：
 *   - 画布 1726×980px（以实际硬编码画布尺寸为准）
 *   - 题目：微软雅黑 30px（印刷体）；题目之外：板书 40px 手写体
 *   - 板书字体 2 种可选：默认平方乔木体(507)；备选链 157韶华→511上上谦→510三生→509韶拓→490栗坚（按栈自动降级）
 *   - ★ v2.1（2026-10-15 同日）：UI 下拉切换器接入。选择值 = uiSettings.handwritingFontChoice
 *     （数据键，随档走），全消费端用 resolveHandwritingFont(choice) 派生，禁止手写字面量；
 *     备选态 = 韶华(157)主链（157→511→510→509→490→楷体，不含乔木 507——选了韶华就不要乔木）
 *   - 颜色：分析区红色，其余全部黑色（渲染端色值唯一真源 = ANALYSIS_TEXT_COLOR / BOARD_TEXT_COLOR）
 *   - 行高 = 自然行高（CSS line-height: normal / 字体自身度量），不设强制行高规范（旧 1.65 / 1.7± 已废止）
 *   - 每个标签区域内 CSS 流动自适应：行内段落自然间距、自然换行；布局由渲染层编译期度量排版（唯一布局权威）
 */
export const CANVAS_SIZE = { width: 1726, height: 980, unit: 'px', origin: '左上角(0,0), X向右Y向下' }
export const COORDINATE_SYSTEM = '百分比坐标 0-100'
export const QUESTION_FONT_SIZE = 30
// ★ 字体宪法 v2：题目印刷体 = 微软雅黑（夏夏 2026-10-15 拍板；旧 Segoe UI 优先栈已废止）
export const QUESTION_FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", sans-serif'
export const QUESTION_FONT_FAMILY_TEXT = '微软雅黑（印刷体，本地字体）'
// ★ Task 10: 板书字号 38px（甲方 2026-09-17 拍板，35 与 42 折中）；2026-10-22 夏夏实测「还是小了一点」38→40
export const BOARD_FONT_SIZE = 40
export const BOARD_FONT_RATIO_TEXT = '约题目的1.2~1.5倍，推荐40px'
// ★ Task 10: 主手写体 = 平方乔木体 (CDN 507)；490 (栗壳坚坚体) 降为字体栈尾
// 字体宪法 v2「2 种可选」：默认 = 平方乔木体(507)；备选 = 平方韶华体(157)，其后为加载失败自动降级链
export const HANDWRITING_FAMILY = '平方乔木体'
export const HANDWRITING_FAMILY_ALT = '平方韶华体'
export const HANDWRITING_CSS_HREF = 'https://fontsapi.zeoseven.com/507/main/result.css'
// ★ v2.1 字体切换器（UI 下拉 2 选 1）：选择值全链路唯一键 = uiSettings.handwritingFontChoice
//   注册表/解析器/字体源构造器是选择态唯一派生口，消费端禁止手写备选栈字面量
export const HANDWRITING_FONT_CHOICES = [
  { id: 'qiaomu', label: '平方乔木体（默认）', family: HANDWRITING_FAMILY },
  { id: 'shaohua', label: '平方韶华体', family: HANDWRITING_FAMILY_ALT },
]
export const HANDWRITING_FONT_CHOICE_DEFAULT = 'qiaomu'
// ★ Task 10: 完整字体栈（与 row-player.html HAND_FONT_STACKS 块同步镜像；★ Task 61 起值级一致由
//   test-font-single-source H2 哨兵 noWs 压缩比对锁死，改栈先跑哨兵）
//   顺序：507 平方乔木体（主）→ 157 平方韶华体 → 511 平方上上谦体 → 510 平方三生体 → 509 平方韶拓体 → 490 栗壳坚坚体 → 系统楷体
export const HANDWRITING_FONT_STACK = [
  '"平方乔木体"',
  '"平方韶华体"',
  '"平方上上谦体"',
  '"平方三生体"',
  '"PingFangSaTuoTi"',
  '"LikeJianJianTi"',
  'KaiTi',
  'STKaiti',
  '"PingFang SC"',
  'serif',
].join(', ')
// ★ Task 10: 降级字体 CDN href 列表（与上面栈顺序同序）
export const HANDWRITING_CSS_HREF_FALLBACKS = [
  'https://fontsapi.zeoseven.com/507/main/result.css',  // 主：平方乔木体
  'https://fontsapi.zeoseven.com/157/main/result.css',  // 平方韶华体
  'https://fontsapi.zeoseven.com/511/main/result.css',  // 平方上上谦体
  'https://fontsapi.zeoseven.com/510/main/result.css',  // 平方三生体
  'https://fontsapi.zeoseven.com/509/main/result.css',  // 平方韶拓体
  'https://fontsapi.zeoseven.com/490/main/result.css',  // 栗壳坚坚体（原主字体降为降级）
]
// ★ v2.1 备选态字体栈：韶华(157) 主链 = 夏夏链路 157→511→510→509→490→楷体（不含乔木 507）
export const HANDWRITING_FONT_STACK_ALT = [
  '"平方韶华体"',
  '"平方上上谦体"',
  '"平方三生体"',
  '"PingFangSaTuoTi"',
  '"LikeJianJianTi"',
  'KaiTi',
  'STKaiti',
  '"PingFang SC"',
  'serif',
].join(', ')
// 选择值解析器（唯一派生口）：未知值一律兑底默认 qiaomu（旧档/手改 JSON 防污染）
export function resolveHandwritingFont(choice) {
  const normalized = choice === 'shaohua' ? 'shaohua' : 'qiaomu'
  if (normalized === 'shaohua') {
    return {
      choice: 'shaohua',
      family: HANDWRITING_FAMILY_ALT,
      cdn: '157',
      fontStack: HANDWRITING_FONT_STACK_ALT,
      cssHrefs: HANDWRITING_CSS_HREF_FALLBACKS.filter(h => !h.includes('/507/')),
    }
  }
  return {
    choice: 'qiaomu',
    family: HANDWRITING_FAMILY,
    cdn: '507',
    fontStack: HANDWRITING_FONT_STACK,
    cssHrefs: [...HANDWRITING_CSS_HREF_FALLBACKS],
  }
}
// fontSource.handwriting 完整对象唯一构造器（buildCanvasParams 与消费端覆写共用，不出现第二份拼装）
export function handwritingFontSourceFor(fontChoice) {
  const sel = resolveHandwritingFont(fontChoice)
  return {
    family: sel.family,
    choice: sel.choice,
    fontStack: sel.fontStack,
    label: `手写体（分析/解答/总结板书，主字体=${sel.family} CDN ${sel.cdn}）`,
    fontWeight: 'normal',
    cssHref: sel.cssHrefs[0],
    cssHrefFallbacks: sel.cssHrefs,
    loadSnippet: `<link href="${sel.cssHrefs[0]}" onload="this.rel='stylesheet'" rel="preload" as="style" crossorigin />`,
    // ★ Task 10: 多 CDN 字体降级栈（异步按需加载，不阻塞首屏）
    loadSnippetFallbacks: sel.cssHrefs.slice(1).map(
      href => `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'" />`
    ).join('\n        '),
    fallbackSnippet: `<noscript><link rel="stylesheet" href="${sel.cssHrefs[0]}" /></noscript>`,
    usage: `渲染前必须先加载该 CSS（font-family: "${sel.family}"; font-weight: normal），字体栈 fallback 顺序见 fontStack；${sel.cdn} 不可用时按栈降级`,
  }
}
// ★ 字体宪法 v2.2（v2 2026-10-15 拍板自然行高；v2.2 2026-10-16 夏夏追加 +2px 分数余量）：自然行高，不设强制行高规范。
//   渲染口径：DOM 用 line-height: normal；画布用字体度量（fontBoundingBoxAscent+Descent），两者同源。
//   分数余量：分数记法（分子在上/分母在下——画布 frac 真排版 + 题目层 KaTeX 行内公式）会越出字体自然行盒，
//   纯 normal 相邻行视觉贴死，自然行高之上统一再加 NATURAL_LINE_HEIGHT_EXTRA_PX（px，设计坐标系 1726×980）：
//   画布直接加 px（row-player 镜像常量 NATURAL_LH_EXTRA_PX）；DOM 用 src/lib/naturalLineHeight.js 度量比数 + 2px 折算无单位 line-height。
//   估算口径（B 感知垂直跨度 / 服务端换行预判）= 字号 × LINE_HEIGHT_ESTIMATE_RATIO + NATURAL_LINE_HEIGHT_EXTRA_PX。
//   旧 QUESTION_LINE_HEIGHT=1.65 / BOARD_LINE_HEIGHT 1.7±(1.55~1.85) 已全库废止拔除。
export const LINE_HEIGHT_POLICY_TEXT = '自然行高（CSS line-height: normal / 字体自身度量）+2px 分数余量（分数上下结构越出行盒需呼吸空间），不设强制行高规范；区域内行内段落自然间距、自然换行；板书层（分析/解答/总结）行距余量 4px = 2px 分数余量 + 2px 行距呼吸（2026-10-22 夏夏拍板「自动换行的行高再加 2px 左右，题目字号除外」），题目层维持 2px'
export const LINE_HEIGHT_POLICY_SHORT = '自然+2px 分数余量（无强制行高规范）'
export const LINE_HEIGHT_ESTIMATE_RATIO = 1.2
export const NATURAL_LINE_HEIGHT_EXTRA_PX = 2
// ★ 字体宪法 v2.3（2026-10-22 夏夏拍板「自动换行的行高再加 2px 左右，除了题目的字号」）：
//   板书层（分析/解答/总结）行距余量 4px = 2px 分数余量 + 2px 行距呼吸；题目层维持 NATURAL_LINE_HEIGHT_EXTRA_PX=2px 不变。
//   消费端：row-player 镜像常量 BOARD_LH_EXTRA_PX（行距推进/换列判定/换列预判）；DOM 板书层 naturalLhWithFractionMargin 第三参；估算公式 板书 = 字号×RATIO+4、题目 = 字号×RATIO+2。
export const BOARD_LINE_HEIGHT_EXTRA_PX = 4
export const BOARD_LINE_HEIGHT_POLICY_SHORT = '自然+4px（2px分数余量+2px行距呼吸，无强制行高规范）'
// ★ 字体宪法 v2：颜色唯一真源——分析区红色，其余全部黑色（画布/ DOM 渲染端色值从这里派生）
export const ANALYSIS_TEXT_COLOR = '#dc2626'
export const BOARD_TEXT_COLOR = '#000000'
// ★ 板书速度真相源（timing.js BASE_CHAR_WRITE_MS=220ms/字 为唯一代码真源）：1秒4~5字 + ±30ms 抖动 + 超音频窗口自适应加速
export const BOARD_SPEED_CHARS_PER_SEC = 4.5  // 1秒4~5字（2026-10-15 夏夏拍板提速，基准 220ms/字），均值 4.5
export const BOARD_SPEED_JITTER = 0.14       // ±30ms/220ms ≈ ±14% 轻微抖动（timing.js jitter ±30ms 真源换算）
export const BOARD_SPEED_ADAPTIVE_COMPRESS = true  // 书写时长超出音频窗口时自适应加速压进音频内

/** 生成 handoff 的 canvasParams：stepHandoff 生成与 server 兜底补全共用同一份
 *  v2.1：可选 fontChoice 参数（默认 qiaomu）——A→B 交接契约永远默认态；
 *  用户态选择（B 工作台下拉）由消费端用 handwritingFontSourceFor(choice) 覆写 fontSource.handwriting */
export function buildCanvasParams(fontChoice = HANDWRITING_FONT_CHOICE_DEFAULT) {
  const fontSel = resolveHandwritingFont(fontChoice)
  const boardFamily =
    `${fontSel.family}（手写体，网络字体 fontSource.handwriting 主 CDN ${fontSel.cdn}，font-weight: normal，${BOARD_FONT_RATIO_TEXT}）`
  return {
    canvasSize: { ...CANVAS_SIZE },
    coordinateSystem: COORDINATE_SYSTEM,
    fontSource: {
      // ★ v2.1：handwriting 字段唯一构造点 = handwritingFontSourceFor（默认/备选双态共用拼装器）
      handwriting: handwritingFontSourceFor(fontChoice),
      question: {
        family: QUESTION_FONT_FAMILY_TEXT,
        stack: QUESTION_FONT_FAMILY,
        label: '印刷体（题目层，微软雅黑本地字体，不加载网络字体）',
        fontWeight: 'normal',
      },
    },
    fontSize: {
      question: { px: QUESTION_FONT_SIZE, family: `微软雅黑（印刷体，${QUESTION_FONT_SIZE}px）`, color: '黑色' },
      analysis: { px: BOARD_FONT_SIZE, family: boardFamily, color: '红色' },
      solution: { px: BOARD_FONT_SIZE, family: boardFamily, color: '黑色' },
      summary: { px: BOARD_FONT_SIZE, family: boardFamily, color: '黑色' },
    },
    lineHeight: {
      // ★ 字体宪法 v2.2/v2.3：题目 自然+2px 分数余量；板书 自然+4px（2px 分数余量+2px 行距呼吸）；estimateRatio/extraPx 仅供 B 估算垂直跨度
      policy: LINE_HEIGHT_POLICY_TEXT,
      question: LINE_HEIGHT_POLICY_SHORT,
      others: BOARD_LINE_HEIGHT_POLICY_SHORT,
      estimateRatio: LINE_HEIGHT_ESTIMATE_RATIO,
      extraPx: NATURAL_LINE_HEIGHT_EXTRA_PX,
      boardExtraPx: BOARD_LINE_HEIGHT_EXTRA_PX,
    },
    letterSpacing: {
      question: '0',
      others: '下游渲染参数：字距均匀无随机（2026-10-17 书写抖动全拔，B 不需要处理）',
    },
    style: '老师上课草算演示，微微达芬奇手稿style（草稿推演质感，轻盈生动；板书绝不可溢出画布）',
    // ★ Task 10: 板书速度真相源 - 1秒2-3字 + ±5%抖动 + 自适应加速
    boardSpeed: `下游渲染参数：1秒约${BOARD_SPEED_CHARS_PER_SEC}个汉字，每行±${BOARD_SPEED_JITTER * 100}%轻微抖动；书写时长超出音频窗口时自适应加速压进音频内（音频=行时长唯一主时钟）`,
    boardSpeedCharsPerSec: BOARD_SPEED_CHARS_PER_SEC,
    boardSpeedJitter: BOARD_SPEED_JITTER,
    boardSpeedAdaptiveCompress: BOARD_SPEED_ADAPTIVE_COMPRESS,
    actionSpeed: '差不多同样速度（rough-line/rough-notation 绘制速度，三动作白名单）',
    lineHeightPolicy: LINE_HEIGHT_POLICY_TEXT,
  }
}

export function hasUsableAgentAKnowledge(analysis) {
  return Array.isArray(analysis?.coreKnowledge) && analysis.coreKnowledge.length > 0
}

/* relatedKnowledge 每项取可读文本的唯一真源读取口（第八轮 2026-10-13 契约归一）
 * A 链真源形状 = 中文字段对象（Step1Entry 从 coreKnowledge 映射：知识点/考点/策略方法/易错点/总结归纳/_formula）
 * 历史兼容：字符串（旧档/人工编辑）与英文字段（knowledgePoint/name/title）
 * 全仓读 relatedKnowledge 项文本一律 import 此函数，禁止再写 k.xxx || k.yyy 的局部猜测链 */
export function knowledgeItemText(item) {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    return String(item['知识点'] ?? item.knowledgePoint ?? item.name ?? item.title ?? '').trim()
  }
  return ''
}

/* 题型比例判断（SK-06 绑定CU）
 * 根据题型、知识点、题目文本判断属于 a/b/c/d/e 哪类，给出各stage时间占比建议
 * a 计算确定：整数/小数/分数计算、竖式、口算 → 解答50-78%为主
 * b 方法确定：图形面积/周长、植树、鸡兔同笼、归一、税率、利率、比和比例 → 解答55-65%
 * c 答案不确定：最值、规律、列举组合、开放应用 → 分析≈解答25-50%
 * d 建模推导：行程、工程、浓度、等量代换、列方程 → 边画边讲，解答55-70%
 * e 概念确定：图形认识、概念辨析、单位换算、定义判定 → 读题+直接判定，分析可近0
 */
const STAGE_RATIO_TABLE = {
  a: {
    cuCode: 'CU-02',
    category: '计算确定',
    topicExamples: '整数计算、小数宝典(加减乘除)、分数计算、竖式/口算',
    analysisPct: '4-12%',
    solutionPct: '50-78%',
    summaryPct: '15-28%',
    introPct: '7%',
    essence: '解答绝对主体+收尾必做法则/方法大总结；读题/寒暄极短',
    keywords: ['计算', '整数', '小数', '分数', '竖式', '口算', '加减乘除', '四则运算'],
  },
  b: {
    cuCode: 'CU-03',
    category: '方法确定',
    topicExamples: '长方形&正方形(面积/周长)、平行四边形/梯形(面积)、植树、鸡兔同笼(假设)、归一、税率、利润利率、比和比例',
    analysisPct: '5-15%',
    solutionPct: '55-65%',
    summaryPct: '5-10%',
    introPct: '23%',
    essence: '解答绝对主体，标准结构',
    keywords: ['长方形', '正方形', '平行四边形', '梯形', '面积', '周长', '植树', '鸡兔同笼', '归一', '税率', '利润', '利率', '比和比例', '比例'],
  },
  c: {
    cuCode: 'CU-01',
    category: '答案不确定',
    topicExamples: '最值(开放)、规律&算式规律(探索)、列举与组合(方案)、开放应用',
    analysisPct: '25-40%',
    solutionPct: '38-50%',
    summaryPct: '8-14%',
    introPct: '13%',
    essence: '分析≈解答，试错链承载决策（分析=试错探索含否定/重选；解答=收敛结论）',
    keywords: ['最值', '最大', '最小', '规律', '找规律', '列举', '组合', '开放', '至少', '至多', '可能'],
  },
  d: {
    cuCode: 'CU-04',
    category: '建模推导',
    topicExamples: '行程、工程、浓度、等量代换与应用、列方程解应用',
    analysisPct: '5-15%',
    solutionPct: '55-70%',
    summaryPct: '5-10%',
    introPct: '20%',
    essence: '边画边讲，模型即分析载体',
    keywords: ['行程', '相遇', '追及', '工程', '浓度', '等量代换', '列方程', '解方程', '方程'],
  },
  e: {
    cuCode: 'CU-05',
    category: '概念确定',
    topicExamples: '图形认识与分类、概念辨析(质数合数/奇偶/因数倍数)、单位换算判定、定义判定',
    analysisPct: '0-8%',
    solutionPct: '55-65%',
    summaryPct: '5-10%',
    introPct: '29%',
    essence: '读题+直接判定，分析可近0',
    keywords: ['图形认识', '分类', '概念辨析', '单位换算', '定义', '判断', '比较', '辨认'],
  },
}

export function detectStageRatio(problemType, relatedKnowledge, problemText) {
  const text = `${problemType || ''} ${(relatedKnowledge || []).map(knowledgeItemText).join(' ')}` + ` ${problemText || ''}`
  let bestMatch = null
  let bestScore = 0
  for (const [key, rule] of Object.entries(STAGE_RATIO_TABLE)) {
    let score = 0
    for (const kw of rule.keywords) {
      if (text.includes(kw)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = key
    }
  }
  if (!bestMatch) return null
  const rule = STAGE_RATIO_TABLE[bestMatch]
  return {
    type: bestMatch,
    cuCode: rule.cuCode,
    category: rule.category,
    topicExamples: rule.topicExamples,
    suggestedRatio: {
      analysis: rule.analysisPct,
      solution: rule.solutionPct,
      summary: rule.summaryPct,
      introAndClosing: rule.introPct,
    },
    essence: rule.essence,
    confidence: bestScore >= 2 ? 'high' : 'medium',
  }
}

export function buildStep1Handoff(input = {}) {
  const problemText = String(input.problemText || '').trim()
  const problemType = input.problemType || null
  const boardFocus = input.boardFocus || null
  const imageKind = input.imageKind || (input.keepOriginal ? 'has_diagram' : 'text_only')
  const topicLayout = roundLayoutNumbers(input.topicLayout ? JSON.parse(JSON.stringify(input.topicLayout)) : null)
  const relatedKnowledge = Array.isArray(input.relatedKnowledge)
    ? JSON.parse(JSON.stringify(input.relatedKnowledge))
    : null

  // Agent A 深度知识点分析结果（识别时 LLM 直接产出）
  const knowledgeAnalysis = hasUsableAgentAKnowledge(input.knowledgeAnalysis)
    ? JSON.parse(JSON.stringify(input.knowledgeAnalysis))
    : null

  // 从 knowledgeAnalysis 提取参考年级（供 Agent B 参考）
  const suggestedGrade = String(input.suggestedGrade || knowledgeAnalysis?.suggestedGrade || '').trim()

  // Agent A 与 Agent B 只使用同一套百分比坐标。
  const coordinateSpec = {
    coordinateSystem: '百分比坐标（0—100），原点左上',
    format: {
      region: '区域：[左%, 上%, 宽%, 高%]，所有百分比最多保留 2 位小数',
      point: '起点/终点：[x%, y%]',
    },
    example: '若分析区动作锚点为 [6, 40.62]，则动作参考点为 [6, 40.62]（40.62 = 默认分析区 y，见 boardLayout.js DEFAULT_BOARD_PLAN 派生）',
  }

  // 从 boardPlan 提取各区域定位锚点（落座标签 + 区域参考起点，板书由渲染层自然排版）
  const boardPlan = roundLayoutNumbers(input.boardPlan ? JSON.parse(JSON.stringify(input.boardPlan)) : null)
  const zoneAnchors = extractZoneAnchors(boardPlan, topicLayout)

  // 画布参数（Agent B 动作坐标与渲染区域参考，固定值不随题目变化）
  const ratioResult = detectStageRatio(problemType, relatedKnowledge, problemText)

  const canvasParams = buildCanvasParams()

  return {
    handoffVersion: 1,
    confirmedAt: new Date().toISOString(),
    problemText,
    problemType,
    boardFocus,
    relatedKnowledge,
    knowledgeAnalysis,
    suggestedGrade,
    uncertainItems: Array.isArray(input.uncertainItems) ? JSON.parse(JSON.stringify(input.uncertainItems)) : [],
    suggestedLayout: input.suggestedLayout || null,
    imageKind,
    keepOriginal: Boolean(input.keepOriginal),
    coordinateSpec,
    zoneAnchors,
    topicLayout,
    boardPlan,
    canvasParams,
    showGrid: Boolean(input.showGrid),
    // B 图片传输冻结：甲方后续确认该能力并追加预算后，再恢复原图/快照交接。
    // 当前 B 只接收题干文字和 Agent A 的结构化布局信息。
    agentPageName: input.agentPageName || '',
    agentCapability: input.agentCapability || '',
    screenshotUrl: input.screenshotUrl || null,
    knowledgeBasePath: input.knowledgeBasePath || 'doc/knowledge-a.compact.json',
    essence: input.essence || ratioResult?.essence || '解答为主体，板书草算推演，启发式引导孩子形成直觉',
    // 题型比例建议（SK-06 绑定CU）：根据题型判断 a/b/c/d/e 类，给出各stage时间占比建议
    // 同时提供 stageRatioSuggestion 与 环节配比占比，供 Agent B 与下游全面直接引用
    stageRatioSuggestion: ratioResult,
    环节配比占比: ratioResult,
  }
}

function roundLayoutNumbers(value) {
  if (Array.isArray(value)) return value.map(roundLayoutNumbers)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, roundLayoutNumbers(item)]))
  }
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(2))
    : value
}

/**
 * 从 boardPlan + topicLayout 提取各区域的标签位置和动作参考位置。
 * 这些坐标会传给 Agent B，让它在生成 draw 动作时有明确的落点参考。
 * ★ Task 60 导出：布局修订同步链需要重派生 zoneAnchors（见 applyBoardPlanRevision）。
 */
export function extractZoneAnchors(boardPlan, _topicLayout) {
  if (!boardPlan) return null
  const anchors = {}
  // 题目区
  if (boardPlan.topicLabel || boardPlan.question) {
    anchors.question = {
      label: boardPlan.topicLabel || null,
      labelStartCoord: boardPlan.topicLabel
        ? { x: boardPlan.topicLabel.x, y: boardPlan.topicLabel.y }
        : null,
      regionStartCoord: boardPlan.question
        ? { x: boardPlan.question.x, y: boardPlan.question.y, w: boardPlan.question.w, h: boardPlan.question.h || null }
        : null,
    }
  }
  // 分析区、解答区、总结区
  const zones = ['analysis', 'solution', 'summary']
  const labelZones = ['analysisLabel', 'solutionLabel', 'summaryLabel']
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i]
    const labelKey = labelZones[i]
    const label = boardPlan[labelKey]
    const region = boardPlan[zone]
    if (label || region) {
      anchors[zone] = {
        label: label || null,
        labelStartCoord: label
          ? { x: label.x, y: label.y }
          : null,
        regionStartCoord: region
          ? { x: region.x, y: region.y, w: region.w, h: region.h || null }
          : null,
      }
    }
  }
  return anchors
}

/**
 * ★ Task 60 归一（2026-10-22 夏夏拍板「不能回老路坑」）：布局修订三处同步唯一入口。
 * 病理（60-a 子代理实测揪出）：布局修订只覆写 boardPlan 时，handoff.zoneAnchors
 * （LLM actionSpec 落点参考，agentBV2Handler 与 boardPlan 同时进 prompt）与
 * handoff.topicLayout（BoardContentLayer 的 plan computed 对 topicLabel/question
 * 优先读取）仍持旧坐标 → 「动作按旧坐标、文字按新布局」错位 + 预览旧位置。
 * 一处覆写、三处同步：boardPlan 覆写 + zoneAnchors 重派生 + topicLayout 三键对齐。
 */
export function applyBoardPlanRevision(handoff, newBoardPlan) {
  if (!handoff || !newBoardPlan) return handoff
  const topicLayout = { ...(handoff.topicLayout || {}) }
  if (newBoardPlan.topicLabel) topicLayout.topicLabel = { ...newBoardPlan.topicLabel }
  if (newBoardPlan.question) {
    topicLayout.question = { ...(topicLayout.question || {}), ...newBoardPlan.question }
  }
  if (newBoardPlan.image !== undefined) topicLayout.image = newBoardPlan.image
  return {
    ...handoff,
    boardPlan: newBoardPlan,
    zoneAnchors: extractZoneAnchors(newBoardPlan, topicLayout),
    topicLayout,
  }
}
