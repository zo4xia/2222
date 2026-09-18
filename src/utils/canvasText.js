/**
 * Canvas-only text normalization.
 *
 * This is deliberately separate from speech, metadata, and ordinary page text:
 * only strings that are about to be rendered inside a teaching canvas should use
 * these rules. It repairs transport/JSON escaping without changing the source
 * value used by the rest of the application.
 */
export function normalizeCanvasText(value) {
  if (value == null) return ''

  let text = String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  // Repair the common JSON/LLM damage before removing control characters.
  // A form-feed followed by "rac" is a damaged "\\frac".
  text = text
    .replace(/\u000c\s*rac/g, '\\frac')
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac')

  // Remove actual control characters, but keep newlines for canvas paragraphs.
  // eslint-disable-next-line no-control-regex
  text = text.replace(/[\t\u0008\u000B\u000C]+/g, ' ')

  // Decode entities once. The order prevents &amp;lt; from being decoded twice.
  text = text
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&minus;/gi, '−')
    .replace(/&plusmn;/gi, '±')
    .replace(/&deg;/gi, '°')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
    .replace(/&ne;/gi, '≠')
    .replace(/&middot;/gi, '·')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&')

  // Canvas content is text, not markup. Convert line-break tags and strip the
  // remaining tags before the renderer escapes the final HTML.
  text = text.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')

  // A literal escaped newline is a line break, except when it starts a LaTeX
  // command such as \\neq, \\not, or \\nabla.
  text = text.replace(/\\r\\n/g, '\n').replace(/\\n(?![a-zA-Z])/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text
}

export function normalizeCanvasLines(value) {
  return normalizeCanvasText(value)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
}
