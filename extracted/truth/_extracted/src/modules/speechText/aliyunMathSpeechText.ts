// @cleanroom-module: aliyun-math-speech-text
// @domain: tts-audio-pipeline
// @boundary: local text preparation only; does not split script or call Aliyun

const existingMathDelimiterPattern = /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g;
const latexFractionPattern = /\\(?:frac|dfrac|tfrac)\s*\{[^{}]+\}\s*\{[^{}]+\}/g;
const latexSqrtPattern = /\\sqrt(?:\s*\[[^\]]+\])?\s*\{[^{}]+\}/g;
const inlineMathPattern =
  /[0-9]+(?:\.[0-9]+)?(?:\s*(?:[+\-×*÷/=]|＝)\s*[0-9]+(?:\.[0-9]+)?)+(?:\s*(?:[+\-×*÷/=]|＝)\s*[0-9]+(?:\.[0-9]+)?)*/g;
const simpleFractionPattern = /\b[0-9]+\/[0-9]+\b/g;
const percentPattern = /\b[0-9]+(?:\.[0-9]+)?%/g;

export function prepareAliyunMathSpeechText(text: string): string {
  return repairCommonLatexEscapeDamage(text)
    .split(existingMathDelimiterPattern)
    .map((segment) => {
      if (!segment) return segment;
      if (isAliyunMathDelimited(segment)) return speakDelimitedMathSegment(segment);
      return speakUndelimitedMath(segment);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeAliyunMathFormula(formula: string): string {
  return repairCommonLatexEscapeDamage(formula)
    .replace(/\\(?:dfrac|tfrac)(?=\s*\{)/g, '\\frac')
    .replace(/\\(?:left|right)\s*/g, '')
    .replace(/\\displaystyle\s*/g, '')
    .replace(/\\(?:,|;|:|!)\s*/g, ' ')
    .replace(/\\(?:quad|qquad)\s*/g, ' ')
    .replace(/\\div\b/g, '÷')
    .replace(/\\(?:times|cdot)\b/g, '×')
    .replace(/\\pm\b/g, '±')
    .replace(/\\mp\b/g, '∓')
    .replace(/\\(?:leq|le)\b/g, '≤')
    .replace(/\\(?:geq|ge)\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\approx\b/g, '≈')
    .replace(/\\text\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\mathrm\s*\{([^{}]*)\}/g, '$1')
    .replace(/＝/g, '=')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:，。；：])/g, '$1')
    .replace(/([({\[])\s+/g, '$1')
    .replace(/\s+([)}\]])/g, '$1')
    .trim();
}

export function repairCommonLatexEscapeDamage(text: string): string {
  return text
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[\s([{:=+\-×÷*/，,：:>])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[\s([{:=+\-×÷*/，,：:>])frac(?=\s*\{)/g, '$1\\frac');
}

function protectUndelimitedMath(text: string): string {
  const ranges = [
    ...collectMatches(text, latexFractionPattern),
    ...collectMatches(text, latexSqrtPattern),
    ...collectMatches(text, inlineMathPattern),
    ...collectMatches(text, simpleFractionPattern),
    ...collectMatches(text, percentPattern),
  ].sort((first, second) => first.start - second.start || second.end - first.end);

  let cursor = 0;
  let result = '';
  for (const range of ranges) {
    if (range.start < cursor) continue;
    result += text.slice(cursor, range.start);
    result += wrapFormula(text.slice(range.start, range.end));
    cursor = range.end;
  }

  return result + text.slice(cursor);
}

function speakUndelimitedMath(text: string): string {
  const ranges = [
    ...collectMatches(text, latexFractionPattern),
    ...collectMatches(text, latexSqrtPattern),
    ...collectMatches(text, inlineMathPattern),
    ...collectMatches(text, simpleFractionPattern),
    ...collectMatches(text, percentPattern),
  ].sort((first, second) => first.start - second.start || second.end - first.end);

  let cursor = 0;
  let result = '';
  for (const range of ranges) {
    if (range.start < cursor) continue;
    result += text.slice(cursor, range.start);
    result += speakMathFormula(text.slice(range.start, range.end));
    cursor = range.end;
  }

  return result + text.slice(cursor);
}

function wrapFormula(formula: string): string {
  const normalizedFormula = normalizeAliyunMathFormula(formula);
  if (!normalizedFormula || isAliyunMathDelimited(normalizedFormula)) return formula;
  return `$${normalizedFormula}$`;
}

function normalizeDelimitedMathSegment(segment: string): string {
  const delimiter = readMathDelimiter(segment);
  if (!delimiter) return segment;

  const innerFormula = segment.slice(delimiter.open.length, segment.length - delimiter.close.length);
  return `${delimiter.open}${normalizeAliyunMathFormula(innerFormula)}${delimiter.close}`;
}

function speakDelimitedMathSegment(segment: string): string {
  const delimiter = readMathDelimiter(segment);
  if (!delimiter) return segment;

  const innerFormula = segment.slice(delimiter.open.length, segment.length - delimiter.close.length);
  return speakMathFormula(innerFormula);
}

function speakMathFormula(formula: string): string {
  return normalizeAliyunMathFormula(formula)
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, numerator: string, denominator: string) => {
      return `${speakMathFormula(denominator)}分之${speakMathFormula(numerator)}`;
    })
    .replace(/\\sqrt\s*\{([^{}]+)\}/g, (_, radicand: string) => `根号${speakMathFormula(radicand)}`)
    .replace(/\(([^()]+)\)/g, (_, inner: string) => `括号${speakMathFormula(inner)}括号`)
    .replace(/\{([^{}]+)\}/g, (_, inner: string) => speakMathFormula(inner))
    .replace(/([0-9]+(?:\.[0-9]+)?)\/([0-9]+(?:\.[0-9]+)?)/g, (_, numerator: string, denominator: string) => {
      return `${speakMathFormula(denominator)}分之${speakMathFormula(numerator)}`;
    })
    .replace(/\^([0-9]+|\{[^{}]+\})/g, (_, exponent: string) => `的${speakMathFormula(exponent.replace(/[{}]/g, ''))}次方`)
    .replace(/%/g, '百分号')
    .replace(/=/g, '等于')
    .replace(/＝/g, '等于')
    .replace(/\+/g, '加')
    .replace(/-/g, '减')
    .replace(/×|\*/g, '乘以')
    .replace(/÷/g, '除以')
    .replace(/≤/g, '小于等于')
    .replace(/≥/g, '大于等于')
    .replace(/≠/g, '不等于')
    .replace(/≈/g, '约等于')
    .replace(/±/g, '正负')
    .replace(/∓/g, '负正')
    .replace(/π/g, '派')
    .replace(/\s+/g, '')
    .trim();
}

function readMathDelimiter(text: string): { close: string; open: string } | null {
  if (text.startsWith('$$') && text.endsWith('$$')) return { close: '$$', open: '$$' };
  if (text.startsWith('$') && text.endsWith('$')) return { close: '$', open: '$' };
  if (text.startsWith('\\(') && text.endsWith('\\)')) return { close: '\\)', open: '\\(' };
  if (text.startsWith('\\[') && text.endsWith('\\]')) return { close: '\\]', open: '\\[' };
  return null;
}

function isAliyunMathDelimited(text: string): boolean {
  return (
    (text.startsWith('$$') && text.endsWith('$$')) ||
    (text.startsWith('$') && text.endsWith('$')) ||
    (text.startsWith('\\(') && text.endsWith('\\)')) ||
    (text.startsWith('\\[') && text.endsWith('\\]'))
  );
}

function collectMatches(text: string, pattern: RegExp): Array<{ end: number; start: number }> {
  pattern.lastIndex = 0;
  return [...text.matchAll(pattern)]
    .map((match) => ({
      end: (match.index ?? 0) + match[0].length,
      start: match.index ?? 0,
    }))
    .filter((range) => range.end > range.start);
}
