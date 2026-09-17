/* Agent B 生成结果实体文件存档 — public/board-result/ 下是唯一真实来源
   每次生成独立文件，带时间戳：board-result-YYYYMMDD-HHMMSS-SSS.json
   文件名 = 项目编码，全链路用同一个编码识别
   current 指针文件记录当前活跃的文件名
   B 写、Check 读改写，二者完全解耦
   存储格式：{ rows, model, usage, createdAt, handoffFilename } */

import { writeFileSync, readFileSync, existsSync, readdirSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const PUBLIC_DIR = resolve(projectRoot, 'public')
const RESULT_DIR = resolve(PUBLIC_DIR, 'board-result')
const CURRENT_POINTER = resolve(RESULT_DIR, 'current.json')

function ensureDir() {
  if (!existsSync(RESULT_DIR)) {
    mkdirSync(RESULT_DIR, { recursive: true })
  }
}

function pad(n, width = 2) { return String(n).padStart(width, '0') }

export function genProjectCode() {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
}

function resultFilename(projectCode) {
  return `board-result-${projectCode}.json`
}

export function fullPath(filename) {
  return resolve(RESULT_DIR, filename)
}

// 读取当前活跃的 B 生成结果（带指针失效自愈机制）
export function readCurrentResult() {
  ensureDir()
  let filename = null
  let projectCode = null
  let createdAt = null

  if (existsSync(CURRENT_POINTER)) {
    try {
      const pointer = JSON.parse(readFileSync(CURRENT_POINTER, 'utf-8'))
      if (pointer?.filename && existsSync(fullPath(pointer.filename))) {
        filename = pointer.filename
        projectCode = pointer.projectCode || null
        createdAt = pointer.createdAt || null
      }
    } catch {
      // 指针文件损坏，走 fallback
    }
  }

  // 指针文件不存在或指向失效：自动扫描目录中最新的 board-result 文件自愈
  if (!filename) {
    const files = listResultFiles()
    if (files.length > 0) {
      filename = files[0]
      const match = filename.match(/^board-result-(\d{8}-\d{6}-\d{3})\.json$/)
      projectCode = match ? match[1] : null
      createdAt = new Date().toISOString()
      try {
        writeFileSync(CURRENT_POINTER, JSON.stringify({ projectCode, filename, createdAt }, null, 2), 'utf-8')
      } catch { /* ignore */ }
    }
  }

  if (!filename) return null
  const filePath = fullPath(filename)
  if (!existsSync(filePath)) return null

  try {
    return {
      filename,
      projectCode,
      result: JSON.parse(readFileSync(filePath, 'utf-8')),
      createdAt,
    }
  } catch {
    return null
  }
}

// 写入新的 B 生成结果（生成带时间戳的新文件 + 更新指针）
export function writeResultFile(result) {
  ensureDir()
  const projectCode = genProjectCode()
  const filename = resultFilename(projectCode)
  const filePath = fullPath(filename)
  writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
  const pointer = {
    projectCode,
    filename,
    createdAt: new Date().toISOString(),
  }
  writeFileSync(CURRENT_POINTER, JSON.stringify(pointer, null, 2), 'utf-8')
  return { projectCode, filename }
}

// 覆写当前 B 生成结果（不生成新文件，原地改写）
export function overwriteCurrentResult(result) {
  const current = readCurrentResult()
  if (!current) {
    return writeResultFile(result)
  }
  const filePath = fullPath(current.filename)
  writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8')
  return { projectCode: current.projectCode, filename: current.filename }
}

export function listResultFiles() {
  if (!existsSync(RESULT_DIR)) return []
  const files = readdirSync(RESULT_DIR)
    .filter(f => /^board-result-\d{8}-\d{6}-\d{3}\.json$/.test(f))
    .sort()
    .reverse()
  return files
}

// ---------- 原始备份（第一次 apply 前存一份，用于 revert） ----------

function originalBackupPath(filename) {
  return resolve(RESULT_DIR, filename.replace(/\.json$/, '.original.json'))
}

export function saveOriginalBackup(filename, result) {
  const backupPath = originalBackupPath(filename)
  if (existsSync(backupPath)) return // 已有备份就不覆盖
  writeFileSync(backupPath, JSON.stringify(result, null, 2), 'utf-8')
}

export function hasOriginalBackup(filename) {
  return existsSync(originalBackupPath(filename))
}

export function loadOriginalBackup(filename) {
  const backupPath = originalBackupPath(filename)
  if (!existsSync(backupPath)) return null
  try {
    return JSON.parse(readFileSync(backupPath, 'utf-8'))
  } catch {
    return null
  }
}
