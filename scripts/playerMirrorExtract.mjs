#!/usr/bin/env node
/**
 * playerMirrorExtract.mjs — row-player 镜像提取求值库（★ Task 61 根治归一基建）
 *
 * 背景：row-player.html 是单文件离线播放器（三胞胎 root/public/dist），无法 import src/ 真源，
 *   历史上 superFilter §5c / isRuleLine / actionDurationMs / estSpeech 兜底公式等镜像块
 *   全靠「改那边必须同步这边」的注释约定人肉维护——61-a 普查实锤 3 处活 Bug 级漂移
 *   （isRuleLine 双反斜杠正则 / superFilter ①' 语义分叉 / PRINT_FONT 多一层 system-ui）。
 *
 * 本库把「约定同步」升级为「哨兵对拍」：从播放器源码提取镜像块 → node 沙箱求值 →
 *   与真源（src/ 可 import 的 ESM）跑同一语料比对。消费方：
 *   - scripts/test-player-mirror-parity.mjs（A superFilter 行为对拍 / B 时序族对拍）
 *   - scripts/test-playback-speed-sync.mjs G 组（estSpeech 兜底公式对拍，替代测试内第三份手抄）
 *
 * 提取策略（不依赖行号，行号会化石）：
 *   - extractSection：两个 banner 注释之间（形如「五段等号 + N. 标题」的分节横幅）
 *   - extractTopLevelFunction：列 0 的 function 声明起，到列 0 的右花括号行（播放器顶层函数风格恒定）
 *   - extractInlineBlock：含起始锚串的行 → 之后第一个含结束锚串的行
 *   - extractBracedObject：锚串所在行的左花括号起，按花括号配对切片（数字对象区域，无字符串干扰）
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function readPlayer(file = 'row-player.html') {
  return readFileSync(join(ROOT, file), 'utf-8')
}

/** 提取区段：含 startNeedle 的行 → 其后第一个含 endNeedle 的行（含两端） */
export function extractSection(src, startNeedle, endNeedle) {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.includes(startNeedle))
  if (start === -1) throw new Error(`区段起始锚未命中: ${startNeedle}`)
  const end = lines.findIndex((l, i) => i > start && l.includes(endNeedle))
  if (end === -1) throw new Error(`区段结束锚未命中: ${endNeedle}`)
  return lines.slice(start, end).join('\n')
}

/** 提取顶层函数：列 0 `function name(` → 列 0 `}`（含） */
export function extractTopLevelFunction(src, name) {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.startsWith(`function ${name}(`))
  if (start === -1) throw new Error(`顶层函数未命中: function ${name}(`)
  const end = lines.findIndex((l, i) => i >= start && l === '}')
  if (end === -1 || end < start) throw new Error(`函数 ${name} 结束行（列 0 的 '}'）未命中`)
  return lines.slice(start, end + 1).join('\n')
}

/** 提取内联块：含 startNeedle 的行 → 其后第一个含 endNeedle 的行（含两端） */
export function extractInlineBlock(src, startNeedle, endNeedle) {
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.includes(startNeedle))
  if (start === -1) throw new Error(`内联块起始锚未命中: ${startNeedle}`)
  const end = lines.findIndex((l, i) => i > start && l.includes(endNeedle))
  if (end === -1) throw new Error(`内联块结束锚未命中: ${endNeedle}`)
  return lines.slice(start, end + 1).join('\n')
}

/** 提取花括号对象文本：从 openNeedle 所在行的 `{` 起，按花括号配对切片（仅适用于纯数字/标识符对象区） */
export function extractBracedObject(src, openNeedle) {
  const lines = src.split('\n')
  const lineNo = lines.findIndex((l) => l.includes(openNeedle))
  if (lineNo === -1) throw new Error(`对象锚未命中: ${openNeedle}`)
  const text = lines.slice(lineNo).join('\n')
  const open = text.indexOf('{')
  if (open === -1) throw new Error(`对象锚后无 '{': ${openNeedle}`)
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  throw new Error(`对象花括号未配对: ${openNeedle}`)
}

/** 纯 JS 沙箱求值：执行 code，返回 contextNames 指定的名字（要求块内自足、无 DOM 依赖） */
export function evalPure(code, contextNames) {
  const fn = new Function(`${code}\n;return {${contextNames.join(',')}};`)
  return fn()
}

/** 把「内联估算四行」包成 (r) => estSpeechMs 函数（row-player compile 内兜底公式专用） */
export function evalEstSpeech(playerSrc) {
  const block = extractInlineBlock(playerSrc, 'const estSpeechText=', 'const estSpeechMs=')
  // eslint-disable-next-line no-new-func
  return new Function('r', `${block}\n;return estSpeechMs;`)
}
