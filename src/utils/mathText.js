/**
 * 教学板书公式渲染（KaTeX）
 * 全项目统一：数字、分数、根号、角度、乘除等走这里
 * 参考 teaching-cut FormulaText，第1步先做预览轻量版
 */
import katex from 'katex'
import 'katex/dist/katex.min.css'
// 车同轨、书同文：错误转义 / 控制字符 / HTML 实体统一过全局唯一超级过滤器
import { cleanTextEscapes } from './superFilter.js'

const LATEX_HINT = /\\[a-zA-Z]|[_^]\{|\$\$|\$|\\\(|\\\[/
const CJK = /[\u4e00-\u9fff\uff00-\uffef]/
const SIMPLE_FRACTION = /(^|[^\w./])(\d+)\/(\d+)(?=$|[^\w./])/g

// 控制字符 / 错误转义清洗统一由唯一真源 src/utils/superFilter.js 的 cleanTextEscapes 负责，
// 本文件只保留 KaTeX 渲染职责，不再自带第二份归一化实现。

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function promoteSimpleFractions(text) {
  return String(text || '').replace(SIMPLE_FRACTION, '$1\\frac{$2}{$3}')
}

function renderKatex(math, displayMode = false) {
  try {
    return katex.renderToString(math, {
      throwOnError: false,
      output: 'html',
      strict: 'ignore',
      displayMode,
      trust: false,
    })
  } catch {
    return escapeHtml(math)
  }
}

/** 抽出 $...$ / $$...$$ / \(...\) / \[...\] */
function renderDelimited(text) {
  const src = String(text || '')
  const parts = []
  let i = 0
  while (i < src.length) {
    if (src.startsWith('$$', i)) {
      const end = src.indexOf('$$', i + 2)
      if (end > i) {
        parts.push(renderKatex(src.slice(i + 2, end).trim(), true))
        i = end + 2
        continue
      }
    }
    if (src[i] === '$') {
      const end = src.indexOf('$', i + 1)
      if (end > i) {
        parts.push(renderKatex(src.slice(i + 1, end).trim(), false))
        i = end + 1
        continue
      }
    }
    if (src.startsWith('\\[', i)) {
      const end = src.indexOf('\\]', i + 2)
      if (end > i) {
        parts.push(renderKatex(src.slice(i + 2, end).trim(), true))
        i = end + 2
        continue
      }
    }
    if (src.startsWith('\\(', i)) {
      const end = src.indexOf('\\)', i + 2)
      if (end > i) {
        parts.push(renderKatex(src.slice(i + 2, end).trim(), false))
        i = end + 2
        continue
      }
    }
    // plain until next delimiter or bare latex command
    let j = i + 1
    while (j < src.length) {
      if (src.startsWith('$$', j) || src[j] === '$' || src.startsWith('\\[', j) || src.startsWith('\\(', j)) break
      if (src[j] === '\\' && j + 1 < src.length && /[a-zA-Z]/.test(src[j + 1])) break
      j++
    }
    const chunk = src.slice(i, j)
    if (chunk.includes('\\') && LATEX_HINT.test(chunk)) {
      parts.push(renderMixedBareLatex(chunk))
    } else {
      parts.push(escapeHtml(chunk).replace(/\n/g, '<br>'))
    }
    i = j
  }
  return parts.join('')
}

/** 中文夹裸 LaTeX：\frac{1}{2}、\sqrt{3}、60^\circ */
function renderMixedBareLatex(text) {
  const parts = []
  let i = 0
  const src = String(text || '')
  while (i < src.length) {
    if (src[i] === '\\' && i + 1 < src.length && /[a-zA-Z]/.test(src[i + 1])) {
      let j = i
      let depth = 0
      while (j < src.length) {
        const ch = src[j]
        if (ch === '{') {
          depth++
          j++
          continue
        }
        if (ch === '}') {
          depth--
          j++
          continue
        }
        if (depth === 0 && CJK.test(ch)) break
        // stop bare command at whitespace when depth 0 after command body started
        if (depth === 0 && j > i + 1 && /[\s，。；：！？、]/.test(ch)) break
        j++
      }
      // include trailing ^\circ or _x loosely
      while (j < src.length && /[\^_]/.test(src[j])) {
        j++
        if (src[j] === '{') {
          let d = 0
          while (j < src.length) {
            if (src[j] === '{') d++
            if (src[j] === '}') {
              d--
              j++
              if (d === 0) break
              continue
            }
            j++
          }
        } else if (src[j]) {
          j++
        }
      }
      const mathPart = src.slice(i, j).trim()
      parts.push(renderKatex(mathPart, false))
      i = j
    } else {
      let j = i
      while (
        j < src.length &&
        !(src[j] === '\\' && j + 1 < src.length && /[a-zA-Z]/.test(src[j + 1]))
      ) {
        j++
      }
      parts.push(escapeHtml(src.slice(i, j)).replace(/\n/g, '<br>'))
      i = j
    }
  }
  return parts.join('')
}

/**
 * 把题文渲染成可安全 v-html 的 HTML
 * - 普通中文/数字原样（转义）
 * - 分数 3/4、LaTeX 命令、$...$ 走 KaTeX
 */
export function renderProblemHtml(text) {
  // 超级过滤器：先清错误转义与多余换行转义，再走 KaTeX / 富文本渲染
  const raw = cleanTextEscapes(text).trim()
  if (!raw) return ''
  const promoted = promoteSimpleFractions(raw)
  if (!LATEX_HINT.test(promoted) && !/\d+\/\d+/.test(raw)) {
    return escapeHtml(raw).replace(/\n/g, '<br>')
  }
  return renderDelimited(promoted)
}

export function hasMathContent(text) {
  const raw = String(text || '')
  return LATEX_HINT.test(raw) || /\d+\/\d+/.test(raw)
}
