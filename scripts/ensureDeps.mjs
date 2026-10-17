#!/usr/bin/env node
/**
 * ensureDeps.mjs — ant-design-vue 安装完整性自愈防线（Task 48 · 2026-10-17）
 *
 * 背景：ant-design-vue es/ 子包损坏老病，历史复发 8 次（挂账 7→8，约每 1-2 轮 build 后复发），
 * 症状 = vite build 报 [UNRESOLVED_IMPORT] Could not resolve './upload' in
 * node_modules/ant-design-vue/es/components.js。根因是 npm 安装竞态/缓存损坏把 es/ 下的
 * 子目录装缺（每次恰好缺 upload，但通用防线覆盖全部子导入）。
 * 此前每轮都要人肉 `rm -rf node_modules/ant-design-vue && npm install --no-save` 救火。
 *
 * 防线逻辑（幂等，正常时 <50ms 静默通过）：
 *   1. 读 ant-design-vue/es/components.js 的全部 `from './xxx'` 子导入
 *   2. 逐一验证 node_modules/ant-design-vue/es/xxx 目录存在
 *   3. 任一缺失 → 自动 rm -rf node_modules/ant-design-vue + npm install --no-save 重装 → 复验
 *   4. 复验仍缺 → 退出码 1（真病：npm 源问题），build 前置拦截
 *
 * 挂载点：package.json build / test 前置（显式 && 串联，防 pre 脚本被 --no-pre-hooks 绕过）。
 */
import { readFileSync, existsSync, rmSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', 'ant-design-vue')
const ES_DIR = resolve(PKG_DIR, 'es')
const COMPONENTS = resolve(ES_DIR, 'components.js')

if (!existsSync(COMPONENTS)) {
  // 整包缺失（node_modules 未装/半装）：不属于「损坏」范畴，交给 npm install 正常流程
  console.log('[ensureDeps] ant-design-vue 未安装（全新环境），跳过完整性自检')
  process.exit(0)
}

// ─── 1. 从 components.js 抽取全部 es/ 子导入 ───────────────────
const src = readFileSync(COMPONENTS, 'utf-8')
const subImports = [...new Set([...src.matchAll(/from\s+'\.\/([a-z-]+)'/g)].map(m => m[1]))]

// ─── 2. 逐一验证目录存在 ───────────────────────────────────────
const missing = subImports.filter(name => {
  const dir = resolve(ES_DIR, name)
  // 目录存在但空目录也算损坏（历史上 upload 目录被装成空壳）
  if (existsSync(dir) && readdirSync(dir).length > 0) return false
  return true
})

if (missing.length === 0) {
  // 正常路径：静默（不污染每次 build 的输出）
  process.exit(0)
}

// ─── 3. 损坏 → 自动重装修复 ────────────────────────────────────
console.warn(`[ensureDeps] 检测到 ant-design-vue es/ 子包损坏（缺失: ${missing.join(', ')}），自动重装修复中…`)
try {
  rmSync(PKG_DIR, { recursive: true, force: true })
  execSync('npm install --no-save', { stdio: 'inherit', timeout: 300000 })
} catch (e) {
  console.error('[ensureDeps] 自动重装失败（npm 源/网络问题），请手动执行: npm install')
  process.exit(1)
}

// ─── 4. 复验 ───────────────────────────────────────────────────
if (!existsSync(COMPONENTS)) {
  console.error('[ensureDeps] 重装后 components.js 仍缺失，请手动执行: npm install')
  process.exit(1)
}
const stillMissing = subImports.filter(name => {
  const dir = resolve(ES_DIR, name)
  return !(existsSync(dir) && readdirSync(dir).length > 0)
})
if (stillMissing.length > 0) {
  console.error(`[ensureDeps] 重装后仍缺失: ${stillMissing.join(', ')}——真病（npm 缓存/源问题），建议 rm -rf node_modules && npm install`)
  process.exit(1)
}
console.log('[ensureDeps] ✅ ant-design-vue 已自愈（重装完成，子导入完整）')
process.exit(0)
