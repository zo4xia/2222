#!/usr/bin/env node
/**
 * @file sync-twin-player.mjs
 * @description 三胞胎文件守护机制（Triplet-file Guardian，吸收自小gemini版并按本仓铁律三胞胎化）
 * 确保根目录 / public / dist 三份 row-player.html 永远保持字节级 MD5 强一致。
 * - 自动检测 mtime，较新文件向较旧文件单向同步镜像（dist 跟随根版刷）
 * - --check 模式：只读校验（三份任一不一致退 1，绝不写文件——CI/测试用）
 * - --force 模式：强制根目录向 public/ 与 dist/ 覆盖
 * - dev watcher 场景：由 vite twin-player-guardian 插件在 row-player.html 变化时调用
 */

import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT_PLAYER = resolve(ROOT, 'row-player.html')
const PUBLIC_PLAYER = resolve(ROOT, 'public', 'row-player.html')
const DIST_PLAYER = resolve(ROOT, 'dist', 'row-player.html')

function md5(filePath) {
  if (!existsSync(filePath)) return null
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

export function syncTwinPlayer({ checkOnly = false, forceFromRoot = false } = {}) {
  const rootExists = existsSync(ROOT_PLAYER)
  const publicExists = existsSync(PUBLIC_PLAYER)
  const distExists = existsSync(DIST_PLAYER)

  if (!rootExists && !publicExists) {
    console.error('[triplet-guard] 错误：根目录与 public 的 row-player.html 均不存在！')
    return { ok: false, error: 'NO_FILES' }
  }

  // --check 模式：纯只读校验三胞胎一致性，绝不写文件
  if (checkOnly) {
    const hashRoot = md5(ROOT_PLAYER)
    const hashPublic = md5(PUBLIC_PLAYER)
    const hashDist = md5(DIST_PLAYER)
    const problems = []
    if (hashRoot !== hashPublic) {
      problems.push(`根目录 vs public 不一致：root=${hashRoot} public=${hashPublic}`)
    }
    if (distExists && hashDist !== hashRoot) {
      problems.push(`dist 陈旧（root=${hashRoot} dist=${hashDist}）——请重新 npm run build 刷 dist`)
    }
    if (problems.length > 0) {
      console.error('[triplet-guard] ❌ 三胞胎校验失败：\n  ' + problems.join('\n  '))
      return { ok: false, error: 'MISMATCH', problems }
    }
    console.log(`[triplet-guard] ✓ 三胞胎 MD5 强一致（${hashRoot ? hashRoot.slice(0, 8) + '...' : 'n/a'}）`)
    return { ok: true, matched: true, md5: hashRoot }
  }

  if (!publicExists && rootExists) {
    writeFileSync(PUBLIC_PLAYER, readFileSync(ROOT_PLAYER))
    if (distExists) writeFileSync(DIST_PLAYER, readFileSync(ROOT_PLAYER))
    console.log('[triplet-guard] ✓ 已自动补建 public/row-player.html')
    return { ok: true, synced: 'root->public' }
  }

  if (!rootExists && publicExists) {
    writeFileSync(ROOT_PLAYER, readFileSync(PUBLIC_PLAYER))
    if (distExists) writeFileSync(DIST_PLAYER, readFileSync(PUBLIC_PLAYER))
    console.log('[triplet-guard] ✓ 已自动补建根目录 row-player.html')
    return { ok: true, synced: 'public->root' }
  }

  const hashRoot = md5(ROOT_PLAYER)
  const hashPublic = md5(PUBLIC_PLAYER)
  const hashDist = md5(DIST_PLAYER)

  const rootPublicMatch = hashRoot === hashPublic
  const distMatch = !distExists || hashDist === hashRoot

  if (rootPublicMatch && distMatch) {
    return { ok: true, matched: true, md5: hashRoot }
  }

  let source, dest, direction
  if (forceFromRoot || rootPublicMatch) {
    // 双胞胎一致仅 dist 陈旧，或强制以根为准：根版刷 public+dist
    source = ROOT_PLAYER
    dest = PUBLIC_PLAYER
    direction = 'root -> public + dist'
  } else {
    const statRoot = statSync(ROOT_PLAYER)
    const statPublic = statSync(PUBLIC_PLAYER)
    if (statRoot.mtimeMs >= statPublic.mtimeMs) {
      source = ROOT_PLAYER
      dest = PUBLIC_PLAYER
      direction = 'root -> public (root newer)'
    } else {
      source = PUBLIC_PLAYER
      dest = ROOT_PLAYER
      direction = 'public -> root (public newer)'
    }
  }

  const content = readFileSync(source)
  writeFileSync(dest, content)
  if (distExists) writeFileSync(DIST_PLAYER, content)
  const finalMd5 = md5(source)

  console.log(`[triplet-guard] ✓ 三胞胎守护生效：${direction} 完成镜像同步（MD5: ${finalMd5.slice(0, 8)}...）`)
  return { ok: true, synced: direction, md5: finalMd5 }
}

// CLI 执行通道
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const isCheck = process.argv.includes('--check')
  const isForce = process.argv.includes('--force')
  const res = syncTwinPlayer({ checkOnly: isCheck, forceFromRoot: isForce })
  if (!res.ok) {
    process.exit(1)
  }
}
