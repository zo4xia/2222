/* @qh-core LANE=SERVER POINT=ENV_LOADER
 * .env 文件加载器（Task 18 env 统一化）
 * ------------------------------------------------------------------
 * 使用方:
 *   - productionServer.js（独立 node 进程）: 首位 import './loadDotEnv.js'
 *   - vite dev: 由 vite.config.js 的 loadEnv 桥回写 process.env（同一套 .env 文件）
 *   - Vercel / Zeabur / Docker: 平台环境变量注入，优先级高于本加载器（不覆盖已存在值）
 *
 * 语义:
 *   - 幂等: process.env 已存在的键不覆盖（平台注入 > .env 文件）
 *   - 支持: 空行 / # 注释 / KEY=VALUE / 引号包裹值 / 无引号值行内注释截断 / export 前缀宽容
 *   - 解析失败不影响启动（坏行跳过，不抛错）
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultEnvPath = resolve(projectRoot, '.env')

/**
 * 解析并加载 .env 到目标对象（默认 process.env）。
 * @returns {{ loaded: number, path: string, exists: boolean }}
 */
export function loadDotEnvFile(filePath = defaultEnvPath, target = process.env) {
  if (!existsSync(filePath)) return { loaded: 0, path: filePath, exists: false }
  const raw = readFileSync(filePath, 'utf-8')
  let loaded = 0
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const stripped = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = stripped.indexOf('=')
    if (eq <= 0) continue
    const key = stripped.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = stripped.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    } else {
      const hash = value.indexOf(' #')
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    if (target[key] === undefined) {
      target[key] = value
      loaded++
    }
  }
  return { loaded, path: filePath, exists: true }
}

// 副作用加载：仅 productionServer 独立进程 import 本模块时生效
loadDotEnvFile()
