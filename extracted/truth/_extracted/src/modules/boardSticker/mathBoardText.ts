// @cleanroom-module: mathBoardText
// @domain: board-sticker-rendering
// @boundary: local display repair/tokenization only; never mutates source script or TTS text

export type BoardTextToken =
  | {
    kind: 'text';
    text: string;
  }
  | {
    kind: 'math';
    latex: string;
  };

// @xiaxia-math-entry-p0: Enhanced dollar-sign and LaTeX function recognition
// @xiaxia-c-font-boundary: C handwriting font supports digits, Latin letters, and simple operators.
// Keep font-supported linear text like "y=2x+1" in handwriting; reserve formula route for structural math.
const EXPLICIT_MATH_PATTERN = /(?:^|\s|[^\\])(?:\${1,2}[^$]+\${1,2}|\\\([^]+?\\\)|\\\[[^]+?\\\])/;
const LATEX_HINT_PATTERN =
  /\\(?:frac|dfrac|tfrac|sqrt|times|div|cdot|boxed|left|right|begin|overline|underline|sin|cos|tan|cot|sec|csc|exp|log|ln|lg|lim|liminf|limsup|sum|prod|int|iint|iiint|oint|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega|varepsilon|vartheta|le|ge|neq|approx|equiv|mod|gcd|lcm|min|max|infty|partial|nabla|hbar|ell|Re|Im|mathbf|mathbb|mathcal|mathrm|rm|bf|it|tt|tiny|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge)|\^|_(?![a-zA-Z0-9])/;
const INLINE_MATH_PATTERN =
  /(?:[a-zA-Z]\s*\([^)]*\)|\d|[a-zA-Z\\])\s*(?:[=+\-×÷*/<>≤≥≠≈]|\\(?:le|ge|neq|approx|equiv|mod))\s*(?:\d|[a-zA-Z\\(])/;
const MATH_OPERATOR_PATTERN = /[=+\-×÷*/<>]/;
// 结构数学模式：只拦截真正的 LaTeX 结构和多层上下标，不拦截字体支持的简单 a^2 / x_1
// 原版会拦截 a^2、x_1 等字体支持的线性文本，违反真相文件"C手写字体支持基础数字字母和简单算式"
const HANDWRITING_STRUCTURAL_MATH_PATTERN =
  /\\[a-zA-Z]+|[A-Za-z0-9)\]}]\s*[\^_]\s*\{[^}]+\}|[A-Za-z0-9)\]}]\s*[\^_]\s*[A-Za-z0-9]\s*[\^_]/;
const HANDWRITING_ASCII_SYMBOLS = `!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`;
const HANDWRITING_EXTRA_SYMBOLS = "\u201c\u201d\u2018\u2019\uff08\uff09\u3010\u3011\u300a\u300b\u3008\u3009\u300c\u300d\u300e\u300f\uff0c\u3002\uff01\uff1f\uff1b\uff1a\u3001\u2014\u2026\u00b7\uff1d\u00d7\u00f7\u2264\u2265\u2260\u2248\u2220\u00b0\u00b1\u2213\u221e\u03c0\u221d\u22a5\u2225\u25b3\u2299\u2235\u2234";

export function normalizeBoardMathText(text: string) {
  return text
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[\s([{:=+\-×÷*/，,：:])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[\s([{:=+\-×÷*/，,：:])frac(?=\s*\{)/g, '$1\\frac');
}

export function hasBoardMath(text: string) {
  const normalizedText = normalizeBoardMathText(text);

  // Check for explicit math delimiters with robust dollar-sign handling
  if (/\${1,2}[^$]*\${1,2}|\\\([^)]*\\\)|\\\[[^\]]*\\\]/.test(normalizedText)) {
    return true;
  }

  // Check for LaTeX hints (functions, operators, etc.)
  if (LATEX_HINT_PATTERN.test(normalizedText)) {
    return true;
  }

  return false;
}

export function stripSimpleBoardMathDelimiters(text: string) {
  const normalizedText = normalizeBoardMathText(text).trim();
  const explicitTokens = tokenizeExplicitMath(normalizedText);

  if (explicitTokens.length !== 1 || explicitTokens[0].kind !== 'text') {
    return text;
  }

  return explicitTokens[0].text;
}

export function normalizeElementaryBoardHandwritingText(text: string): string {
  const strippedText = stripOuterMathDelimiters(normalizeBoardMathText(text).trim());
  if (/\\(?:dfrac|tfrac|frac)\b/.test(strippedText)) {
    return text;
  }

  const normalizedText = strippedText
    .replace(/\\(?:left|right)\s*/g, '')
    .replace(/\\times\b/g, '×')
    .replace(/\\div\b/g, '÷')
    .replace(/\\cdot\b/g, '·')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalizedText || normalizedText === text) {
    return text;
  }

  if (isBoardTextSupportedByHandwritingFont(normalizedText)) {
    return normalizedText;
  }

  return text;
}

export function tokenizeBoardText(text: string): BoardTextToken[][] {
  const normalizedText = normalizeBoardMathText(text).trim();

  return normalizedText.split('\n').map((line) => tokenizeBoardLine(line.trim()));
}

function tokenizeBoardLine(line: string): BoardTextToken[] {
  if (!line) {
    return [{ kind: 'text', text: '' }];
  }

  const explicitTokens = tokenizeExplicitMath(line);
  if (EXPLICIT_MATH_PATTERN.test(line)) {
    return explicitTokens;
  }

  if (explicitTokens.some((token) => token.kind === 'math')) {
    return explicitTokens;
  }

  if (shouldKeepAsHandwritingText(line) || (!LATEX_HINT_PATTERN.test(line) && !INLINE_MATH_PATTERN.test(line))) {
    return [{ kind: 'text', text: line }];
  }

  const mathStartIndex = findImplicitMathStart(line);
  if (mathStartIndex <= 0) {
    return [{ kind: 'math', latex: line }];
  }

  return [
    { kind: 'text', text: line.slice(0, mathStartIndex) },
    { kind: 'math', latex: line.slice(mathStartIndex).trim() },
  ];
}

function tokenizeExplicitMath(line: string): BoardTextToken[] {
  const tokens: BoardTextToken[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    const delimiterMatch = findNextExplicitMathDelimiter(line, cursor);
    if (!delimiterMatch) {
      pushTextToken(tokens, line.slice(cursor));
      break;
    }

    pushTextToken(tokens, line.slice(cursor, delimiterMatch.openIndex));

    const contentStart = delimiterMatch.openIndex + delimiterMatch.open.length;
    const closeIndex = line.indexOf(delimiterMatch.close, contentStart);

    if (closeIndex < 0) {
      pushTextToken(tokens, line.slice(delimiterMatch.openIndex));
      break;
    }

    const latex = line.slice(contentStart, closeIndex).trim();
    if (latex) {
      tokens.push(shouldKeepAsHandwritingText(latex) ? { kind: 'text', text: latex } : { kind: 'math', latex });
    }
    cursor = closeIndex + delimiterMatch.close.length;
  }

  return tokens.length ? tokens : [{ kind: 'text', text: line }];
}

function shouldKeepAsHandwritingText(line: string) {
  return isBoardTextSupportedByHandwritingFont(line);
}

// Single support gate for C handwriting text. Keep formulas with structure in FormulaText.
// 根据真相文件，C手写字体支持：基础数字、英文大小写、常用英文标点和符号、
// 常用中文标点，以及一部分常用中文字符。这里判断"是否允许走手写字体"，
// 不是判断"必须同时含有哪两类字符"。
export function isBoardTextSupportedByHandwritingFont(line: string) {
  const normalizedLine = line.trim();
  if (!normalizedLine) {
    return false;
  }

  if (HANDWRITING_STRUCTURAL_MATH_PATTERN.test(normalizedLine)) {
    return false;
  }

  return Array.from(normalizedLine).every(isHandwritingSupportedChar);
}

function isHandwritingSupportedChar(char: string) {
  return (
    /\s/.test(char) ||
    /[0-9０-９A-Za-z]/.test(char) ||
    // CJK 统一汉字
    /[\u4e00-\u9fff]/.test(char) ||
    // Unicode 上标和下标：¹²³⁰ⁱⁿ⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎
    /[\u00b9\u00b2\u00b3\u2070-\u2079\u207b-\u207f\u2080-\u2089\u208b-\u208e]/.test(char) ||
    // 希腊字母（π 等）
    /[\u0391-\u03a9\u03b1-\u03c9]/.test(char) ||
    HANDWRITING_ASCII_SYMBOLS.includes(char) ||
    HANDWRITING_EXTRA_SYMBOLS.includes(char)
  );
}

function stripOuterMathDelimiters(text: string) {
  if (text.startsWith('$$') && text.endsWith('$$')) return text.slice(2, -2).trim();
  if (text.startsWith('$') && text.endsWith('$')) return text.slice(1, -1).trim();
  if (text.startsWith('\\(') && text.endsWith('\\)')) return text.slice(2, -2).trim();
  if (text.startsWith('\\[') && text.endsWith('\\]')) return text.slice(2, -2).trim();
  return text;
}

function findNextExplicitMathDelimiter(
  line: string,
  cursor: number,
): { close: string; open: string; openIndex: number } | null {
  const candidates = [
    { close: '$$', open: '$$', openIndex: line.indexOf('$$', cursor) },
    { close: '$', open: '$', openIndex: line.indexOf('$', cursor) },
    { close: '\\)', open: '\\(', openIndex: line.indexOf('\\(', cursor) },
    { close: '\\]', open: '\\[', openIndex: line.indexOf('\\[', cursor) },
  ].filter((candidate) => candidate.openIndex >= 0);

  if (!candidates.length) {
    return null;
  }

  return candidates.sort((left, right) => left.openIndex - right.openIndex || right.open.length - left.open.length)[0];
}

function pushTextToken(tokens: BoardTextToken[], text: string) {
  if (text) {
    tokens.push({ kind: 'text', text });
  }
}

function findImplicitMathStart(line: string) {
  const latexIndex = line.search(LATEX_HINT_PATTERN);
  const inlineMathIndex = line.search(INLINE_MATH_PATTERN);
  const mathIndexCandidates = [latexIndex, inlineMathIndex].filter((index) => index >= 0);
  const mathIndex = mathIndexCandidates.length ? Math.min(...mathIndexCandidates) : -1;
  if (mathIndex <= 0) {
    return mathIndex;
  }

  for (let index = mathIndex; index >= 0; index -= 1) {
    const char = line[index];
    if (!char) {
      continue;
    }
    if (/[\s，,：:]/.test(char)) {
      return index + 1;
    }
    if (/[a-zA-Z\d]|\\|\(|\[/.test(char) || MATH_OPERATOR_PATTERN.test(char)) {
      continue;
    }
    return index + 1;
  }

  return 0;
}
