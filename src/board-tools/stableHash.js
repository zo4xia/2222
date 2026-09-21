/**
 * stableHash.js — FNV-1a 32-bit hash 唯一真源
 *
 * ponytail: 合并 textTargetRegistry.js#hashText 与 roughDrawingTool.js#stableSeed
 * 两处独立手搓同一算法（hash=2166136261 → ^codePointAt → Math.imul 16777619）。
 *
 * 用法:
 *   stableHashBase36(str) → base36 字符串（用于 targetId 稳定 key）
 *   stableHashInt(str)    → 32-bit 无符号整数（用于 roughjs seed）
 *
 * @qh-core LANE=SHARED POINT=STABLE_HASH
 */

function fnv1a32(str) {
  let hash = 2166136261
  for (const char of String(str || '')) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function stableHashBase36(str) {
  return fnv1a32(str).toString(36)
}

export function stableHashInt(str) {
  return fnv1a32(str)
}

// ponytail: 唯一真源 — 2 处调用方 import 这个，不再手搓
