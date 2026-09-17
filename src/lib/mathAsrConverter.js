/**
 * 数学算式专用 ASR 口播转换工具函数库 (Math ASR Converter)
 * 专门用于将小学各年级数学算式（包含分数、带分数、幂运算、未知数 x、带括号混合运算、
 * 比例、百分数、不等式、带余除法、几何符号、常用单位等）自动转换为符合口播朗读规则的纯中文文本。
 * 
 * 作为前端即时兜底转换的核心，双保险保障网络延时或模型异常时的口播质量。
 */

// 阿拉伯数字转中文读音（用于小数部分逐位朗读、小范围数字）
const DIGIT_TO_CHINESE = {
  '0': '零',
  '1': '一',
  '2': '二',
  '3': '三',
  '4': '四',
  '5': '五',
  '6': '六',
  '7': '七',
  '8': '八',
  '9': '九',
}

/**
 * 将小数部分逐位转换为中文发音（如 "14" -> "一四"，"05" -> "零五"）
 */
export function convertDecimalPart(str) {
  return String(str || '')
    .split('')
    .map((ch) => DIGIT_TO_CHINESE[ch] || ch)
    .join('')
}

/**
 * 转换带分数逻辑：
 * 例如 "1 \frac{1}{2}" 或 "1 1/2" -> "1又2分之1"（或者规范为一又二分之一）
 * "2 3/4" -> "2又4分之3"
 */
export function convertMixedFractions(text) {
  if (!text) return ''
  let res = text

  // 匹配 LaTeX 格式带分数: 1 \frac{1}{2} 或 1\frac{3}{4}
  res = res.replace(/(\d+)\s*\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, whole, num, den) => {
    return `${whole}又${den.trim()}分之${num.trim()}`
  })

  // 匹配纯文本混合形式带分数: 如 "1 1/2"（整数后跟空格与分数）
  res = res.replace(/(?<=\b|\s)(\d+)\s+(\d+)\/(\d+)(?=\b|\s|[，。！？、\n])/g, (_match, whole, num, den) => {
    return `${whole}又${den.trim()}分之${num.trim()}`
  })

  return res
}

/**
 * 转换普通分数（真分数、假分数、代数式分数）
 * 遵循“先读分母，后读分子”的中国数学口播铁律
 */
export function convertFractions(text) {
  if (!text) return ''
  let res = text

  // 先匹配 LaTeX: \frac{分子}{分母}
  res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
    return `${den.trim()}分之${num.trim()}`
  })

  // 匹配文本分数: 7/15 -> 15分之7, a/b -> b分之a
  // 排除单位 km/h 或 m/s，排除年份 2026/09
  res = res.replace(/(?<![a-zA-Z0-9_\/])([a-zA-Z0-9\+\-]+)\/([a-zA-Z0-9\+\-]+)(?![a-zA-Z0-9_\/])/g, (match, num, den) => {
    if (/^(?:km|m|cm|mm|dm)$/i.test(num) && /^(?:h|s|min)$/i.test(den)) {
      return match
    }
    if (/^\d{4}$/.test(num)) {
      return match
    }
    return `${den.trim()}分之${num.trim()}`
  })

  return res
}

/**
 * 转换幂运算与次方
 * 如 a² -> a的平方, b³ -> b的立方, 61^2 -> 61的平方, 2^n -> 2的n次方
 */
export function convertPowers(text) {
  if (!text) return ''
  let res = text

  // 常用特殊符号 ² 和 ³
  res = res.replace(/([a-zA-Z0-9\)]+)²/g, '$1的平方')
  res = res.replace(/([a-zA-Z0-9\)]+)³/g, '$1的立方')

  // ^2 / ^3 / ^{n}
  res = res.replace(/([a-zA-Z0-9\)]+)\^2(?![0-9])/g, '$1的平方')
  res = res.replace(/([a-zA-Z0-9\)]+)\^3(?![0-9])/g, '$1的立方')
  res = res.replace(/([a-zA-Z0-9\)]+)\^\{?([a-zA-Z0-9\+\-]+)\}?/g, '$1的$2次方')

  return res
}

/**
 * 转换根号
 * 如 √9 -> 根号9, \sqrt{240} -> 根号240
 */
export function convertRoots(text) {
  if (!text) return ''
  let res = text
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, '根号$1')
  res = res.replace(/√\s*([a-zA-Z0-9]+)/g, '根号$1')
  return res
}

/**
 * 转换小学常用几何与物理单位，避免孩子听英文缩写发懵
 */
export function convertUnits(text) {
  if (!text) return ''
  let res = text

  res = res.replace(/(\d+)\s*km\/h\b/gi, '$1千米每小时')
  res = res.replace(/(\d+)\s*m\/s\b/gi, '$1米每秒')
  res = res.replace(/(?:\b|(?<=\d\s*))cm²(?![a-zA-Z0-9])/gi, '平方厘米')
  res = res.replace(/(?:\b|(?<=\d\s*))dm²(?![a-zA-Z0-9])/gi, '平方分米')
  res = res.replace(/(?:\b|(?<=\d\s*))m²(?![a-zA-Z0-9])/gi, '平方米')
  res = res.replace(/(?:\b|(?<=\d\s*))km²(?![a-zA-Z0-9])/gi, '平方千米')
  res = res.replace(/(?:\b|(?<=\d\s*))cm³(?![a-zA-Z0-9])/gi, '立方厘米')
  res = res.replace(/(?:\b|(?<=\d\s*))dm³(?![a-zA-Z0-9])/gi, '立方分米')
  res = res.replace(/(?:\b|(?<=\d\s*))m³(?![a-zA-Z0-9])/gi, '立方米')
  res = res.replace(/(?:\b|(?<=\d\s*))℃(?![a-zA-Z0-9])/g, '摄氏度')

  return res
}

/**
 * 转换小数读法：整数部分保留阿拉伯数字，小数点读"点"，小数部分逐位读汉字
 * 如 3.14 -> 3点一四, 0.05 -> 0点零五
 */
export function convertDecimals(text) {
  if (!text) return ''
  return text.replace(/(\d+)\.(\d+)/g, (_match, intPart, decPart) => {
    return `${intPart}点${convertDecimalPart(decPart)}`
  })
}

/**
 * 转换关系运算符、几何符号、比例与带余除法
 */
export function convertSymbols(text) {
  if (!text) return ''
  let res = text

  // 百分数: 25% -> 百分之25, 3.14% -> 百分之3点一四
  res = res.replace(/(\d+(?:点[零一二三四五六七八九]+)?)\s*%/g, '百分之$1')

  // 比例: 3:2 -> 3比2 (排除时间如 12:00:00)
  res = res.replace(/(?<!\d:)(?<=[0-9a-zA-Z\)])\s*:\s*(?=[0-9a-zA-Z\(])(?!\d:\d)/g, '比')

  // 不等号与近似号
  res = res.replace(/\\approx|≈/g, '约等于')
  res = res.replace(/\\neq|≠/g, '不等于')
  res = res.replace(/\\ge(?:q)?|≥/g, '大于或等于')
  res = res.replace(/\\le(?:q)?|≤/g, '小于或等于')

  // 带余除法: 17 ÷ 3 = 5 …… 2 -> 17除以3等于5余2
  res = res.replace(/(\d+)\s*(?:……|\.{3,6})\s*(\d+)/g, '$1余$2')

  // 几何图形与关系
  res = res.replace(/∠\s*([0-9a-zA-Z]+)/g, '角$1')
  res = res.replace(/[△▲]\s*([a-zA-Z]{2,4})/g, '三角形$1')
  res = res.replace(/\\perp|⊥/g, '垂直于')
  res = res.replace(/\\parallel|∥/g, '平行于')
  res = res.replace(/π/g, '圆周率π')

  return res
}

/**
 * 处理算式括号：
 * (a + b) -> 括号里a加b
 * (120 + 2) ÷ 2 -> 括号里120加2除以2
 * (a + b)(a - b) -> 括号里a加b，乘以括号里a减b
 */
export function convertParentheses(text) {
  if (!text) return ''
  let res = text

  // 1. 处理相邻括号相乘的情况：(a+b)(a-b) -> (a+b)乘以(a-b)
  res = res.replace(/[）\)]\s*[（\(]/g, '）乘以（')

  // 2. 将括号内容加上"括号里"
  res = res.replace(/[（\(]([^（\)\n]+)[）\)]/g, (_match, inner) => {
    const trimmed = inner.trim()
    if (trimmed.startsWith('括号里')) return trimmed
    // 如果只是序号或纯单个数字，保留括号不念"括号里"
    if (/^\d+$/.test(trimmed) || /^[一二三四五六七八九十]+$/.test(trimmed)) {
      return `(${trimmed})`
    }
    return `括号里${trimmed}`
  })

  return res
}

/**
 * 转换四则运算符号与未知数 x
 * 必须遵循严格顺序：
 * 先替换乘法（两数或括号之间的乘号、×、*）
 * 再替换未知数 x（如 8x -> 8艾克斯，设x为 -> 设艾克斯为）
 */
export function convertArithmeticAndVariables(text) {
  if (!text) return ''
  let res = text

  // 1. 显式乘号替换：\times, ×, *
  res = res.replace(/\\times|×/g, '乘以')
  res = res.replace(/(\d+)\s*\*\s*(\d+)/g, '$1乘以$2')

  // 2. 算式中的 x 作乘号：
  // 数字与数字之间: 8 x 113 -> 8乘以113
  // 小数与数字/括号之间: 3点一四 x 括号里 -> 3点一四乘以括号里
  res = res.replace(/(\d+|[零一二三四五六七八九点]+)\s*x\s*(\d+|[零一二三四五六七八九点]+)/gi, '$1乘以$2')
  res = res.replace(/(\d+|[零一二三四五六七八九点]+|[a-zA-Z\)])\s*x\s*(括号里|[（\(])/gi, '$1乘以$2')
  res = res.replace(/(括号里[^，。！？\s]+)\s*x\s*(\d+|[a-zA-Z]|括号里)/gi, '$1乘以$2')

  // 算式中口播的单字 "乘" 统一规范为 "乘以"（如 8乘113 -> 8乘以113）
  res = res.replace(/(\d+)\s*乘\s*(\d+)/g, '$1乘以$2')

  // 3. 识别代数未知数 x：
  // 3.1 紧跟在数字后面的未知数，如 8x -> 8个x 或 8艾克斯（在小学代数中读 8个艾克斯 或 8艾克斯）
  res = res.replace(/(\d+)\s*x(?![a-zA-Z0-9])/gi, '$1艾克斯')
  // 3.2 独立未知数 x: "设 x", "x =", "x >", "求 x", "把 x", "x 是"
  res = res.replace(/(?<=[设让求把有是\s\(（])x(?=[为是等于\s\+\-\*\/÷=><≥≤，。！？、\)）])/gi, '艾克斯')
  res = res.replace(/\bx\s*([=><≥≤])/gi, '艾克斯$1')
  res = res.replace(/\bx\s*(加|减|乘以|除以)/gi, '艾克斯$1')
  res = res.replace(/(加|减|乘以|除以)\s*x\b/gi, '$1艾克斯')

  // 4. 除号转换：÷, \div
  res = res.replace(/\\div|÷/g, '除以')
  res = res.replace(/(\d+)\s*除以\s*(\d+)/g, '$1除以$2')

  // 5. 算式内加减等于号转换（变量、数字、括号之间）
  // a² - b² -> a的平方减b的平方
  res = res.replace(/([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)\s*\+\s*([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)/g, '$1加$2')
  res = res.replace(/([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)\s*\-\s*([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)/g, '$1减$2')
  res = res.replace(/([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)\s*=\s*([0-9a-zA-Z的平方的立方的次方]+|括号里[^，。！？\s]+)/g, '$1等于$2')

  return res
}

/**
 * 完整口播算式转中文主函数 (Math Speech Polish Master)
 * 接受纯文本口播稿，执行完整严格的数学算式语音规范转换。
 * 纯文字输出，绝不输出任何 TTS 控制标签或占位符。
 */
export function formatMathSpeechToChinese(rawText) {
  if (typeof rawText !== 'string') return ''
  let text = rawText

  // 1. 去除所有调试标签、占位符、用户误留标签
  text = text.replace(/【点击生成语音】/g, '')
  text = text.replace(/\[点击生成语音\]/g, '')
  text = text.replace(/点击生成语音/g, '')
  text = text.replace(/\[(?:pause|excited|emphasis|speed|pitch)\]/gi, '')
  text = text.replace(/```[\s\S]*?```/g, '')
  text = text.replace(/`([^`]+)`/g, '$1')

  // 2. 优先转换单位（在处理通用幂 ²/³ 之前，避免 cm² 被拆成 cm的平方）
  text = convertUnits(text)

  // 3. 根号处理
  text = convertRoots(text)

  // 4. 幂次与次方
  text = convertPowers(text)

  // 5. 带分数处理
  text = convertMixedFractions(text)

  // 6. 普通分数处理
  text = convertFractions(text)

  // 7. 小数读法
  text = convertDecimals(text)

  // 8. 关系运算符、几何符号、比例与带余除法
  text = convertSymbols(text)

  // 9. 算式括号（念出"括号里"）
  text = convertParentheses(text)

  // 10. 四则运算与未知数 x
  text = convertArithmeticAndVariables(text)

  // 11. 再次清理多余空格和连续标点
  text = text.replace(/[ \t]+/g, ' ')
  text = text.replace(/，{2,}/g, '，')
  text = text.replace(/。{2,}/g, '。')
  text = text.replace(/\s+([，。！？、])/g, '$1')

  // 12. 确保没有多余占位符与首尾标点
  text = text.replace(/【点击生成语音】/g, '').replace(/\[点击生成语音\]/g, '').replace(/点击生成语音/g, '').trim()
  text = text.replace(/^[，。！？、]+/, '').replace(/[，、]+$/, '。')

  return text
}

/**
 * 批量转换表格 rows（双保险兜底函数）
 * 返回转换后的新 rows 以及变更详情
 */
export function batchPolishRowsMathAsr(rows) {
  if (!Array.isArray(rows) || !rows.length) {
    return { rows: [], changes: [] }
  }

  const polishedRows = []
  const changes = []

  rows.forEach((row, index) => {
    const newRow = { ...row }
    const originalSpeech = String(row.speech || '')
    const polishedSpeech = formatMathSpeechToChinese(originalSpeech)

    if (originalSpeech !== polishedSpeech) {
      newRow.speech = polishedSpeech
      changes.push({
        row: index + 1,
        field: 'speech',
        before: originalSpeech,
        after: polishedSpeech,
        reason: '纯中文数学读音与 ASR 规范化',
      })
    }

    polishedRows.push(newRow)
  })

  return { rows: polishedRows, changes }
}
