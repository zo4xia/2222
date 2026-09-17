/**
 * @qh-core LANE=SERVER POINT=SAFE_FILE 路径穿越校验
 * 防止 ../ 等目录穿越攻击读取/写入任意文件
 */

import { resolve, normalize, relative } from 'path'
import { existsSync, readFileSync } from 'fs'

/**
 * 安全解析文件路径，防止目录穿越
 * @param {string} rootDir - 根目录（绝对路径）
 * @param {string} requestPath - 用户请求的相对路径
 * @returns {string|null} 安全的绝对路径，或在穿越时返回 null
 */
export function safeFilePath(rootDir, requestPath) {
  if (!requestPath || typeof requestPath !== 'string') return null

  // 解码 URL 编码（防止 %2e%2e 绕过）
  let decoded
  try {
    decoded = decodeURIComponent(requestPath)
  } catch {
    return null
  }

  // 标准化路径（解析 . 与 ..）
  const normalized = normalize(decoded)

  // 禁止 .. 与绝对路径
  if (normalized.startsWith('..') || normalized.includes('..') || normalized.startsWith('/')) {
    return null
  }

  // Windows 盘符禁用
  if (/^[a-zA-Z]:/.test(normalized)) return null

  // 解析到根目录下的绝对路径
  const fullPath = resolve(rootDir, normalized)

  // 用 relative 校验最终路径是否仍在 rootDir 内
  const rel = relative(rootDir, fullPath)
  if (rel.startsWith('..') || rel.includes('..') || /^[a-zA-Z]:/.test(rel)) {
    return null
  }

  return fullPath
}

/**
 * 校验 projectCode 格式（防止目录穿越写入）
 * 合法格式：YYYYMMDD-HHMMSS-SSS 或任意 alphanumeric+dash
 * @param {string} code - 待校验的 projectCode
 * @returns {boolean} 是否合法
 */
export function isValidProjectCode(code) {
  if (!code || typeof code !== 'string') return false
  // 只允许：8位数字-6位数字-3位数字 或 alphanumeric+dash
  return /^\d{8}-\d{6}-\d{3}$/.test(code) || /^[a-zA-Z0-9_-]+$/.test(code)
}

/**
 * 校验文件名（防止目录穿越读取）
 * @param {string} filename - 待校验的文件名
 * @returns {boolean} 是否合法
 */
export function isValidFilename(filename) {
  if (!filename || typeof filename !== 'string') return false
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false
  if (filename.startsWith('.')) return false
  // Windows 盘符
  if (/^[a-zA-Z]:/.test(filename)) return false
  return true
}

/**
 * 安全读取文件（带穿越校验）
 */
export function safeReadFile(rootDir, requestPath, encoding = 'utf-8') {
  const fullPath = safeFilePath(rootDir, requestPath)
  if (!fullPath || !existsSync(fullPath)) return null
  try {
    return readFileSync(fullPath, encoding)
  } catch {
    return null
  }
}
