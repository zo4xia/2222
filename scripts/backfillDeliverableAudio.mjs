/**
 * 补齐交付产物缺失音频并重建产物（解决 Go/No-Go 阻断第 1 条：解答段 56% 静音）
 *
 * 用法：
 *   node scripts/backfillDeliverableAudio.mjs --check   只自校验时长算法（不联网、不写盘）
 *   node scripts/backfillDeliverableAudio.mjs           补生成缺失行音频 → 重建全部产物
 *
 * 重建走 server/deliverableStoreHandler.writeDeliverableFile()，因此自动获得：
 *   - 资源路径归一 /audio-cache/ → ../audio-cache/（决策 #017）
 *   - 契约字段 mp3 补齐（未生成写 ""）
 *   - current.json / current.html / 实体归档 JSON+HTML 四份一起更新
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { synthesizeSpeech } from '../server/fishAudioHandler.js'
import { writeDeliverableFile } from '../server/deliverableStoreHandler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CURRENT = resolve(ROOT, 'public', 'deliverable', 'current.json')

const BITRATES_MPEG1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
const RATES_MPEG1 = [44100, 48000, 32000]

/**
 * ponytail: 只读首帧按 CBR 估算时长，够用且零依赖；VBR 文件会偏窄。
 * 需要逐帧精确时再引入 music-metadata（当前产物实测全部 CBR，见 --check 输出）。
 */
function mp3DurationMs(buf) {
  let i = 0
  if (buf.slice(0, 3).toString('ascii') === 'ID3') {
    i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9])
  }
  for (; i < buf.length - 4; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue
    const versionBits = (buf[i + 1] >> 3) & 0x03
    const layerBits = (buf[i + 1] >> 1) & 0x03
    if (versionBits !== 3 || layerBits !== 1) continue // 只认 MPEG1 Layer III
    const bitrate = BITRATES_MPEG1_L3[(buf[i + 2] >> 4) & 0x0f]
    const rate = RATES_MPEG1[(buf[i + 2] >> 2) & 0x03]
    if (!bitrate || !rate) continue
    return Math.round(((buf.length - i) * 8) / (bitrate * 1000) * 1000)
  }
  return 0
}

function readCached(relUrl) {
  const abs = resolve(ROOT, 'public', String(relUrl).replace(/^\//, '').replace(/^\.\.\//, ''))
  return existsSync(abs) ? readFileSync(abs) : null
}

function checkMode() {
  const pointer = JSON.parse(readFileSync(CURRENT, 'utf-8'))
  const rows = pointer.deliverable.rows
  let worst = 0
  rows.forEach((row, i) => {
    if (!row.audioUrl) { console.log(`row${i} 无音频（跳过校验）`); return }
    const buf = readCached(row.audioUrl)
    if (!buf) { console.log(`row${i} 文件缺失: ${row.audioUrl}`); return }
    const parsed = mp3DurationMs(buf)
    const recorded = Number(row.audioDurationMs) || 0
    const diff = recorded ? Math.abs(parsed - recorded) / recorded * 100 : 0
    worst = Math.max(worst, diff)
    console.log(`row${i} 解析=${parsed}ms 记录=${recorded}ms 误差=${diff.toFixed(1)}% 比特率≈${Math.round(buf.length * 8 / (parsed / 1000) / 1000)}kbps`)
  })
  console.log(`\n最大误差=${worst.toFixed(1)}% → ${worst < 5 ? 'CBR 估算可用 ✅' : '存在 VBR，需换精确解析 ❌'}`)
  return worst < 5
}

async function backfill() {
  const pointer = JSON.parse(readFileSync(CURRENT, 'utf-8'))
  const deliverable = pointer.deliverable
  const missing = deliverable.rows
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => !row.audioUrl && row.speech)

  console.log(`待补音频 ${missing.length} 行`)
  for (const { row, i } of missing) {
    const result = await synthesizeSpeech({ text: row.speech })
    const buf = readCached(result.audioUrl)
    const ms = mp3DurationMs(buf)
    if (!ms) throw new Error(`row${i} 音频时长解析失败: ${result.audioUrl}`)
    row.audioUrl = result.audioUrl
    row.mp3 = result.audioUrl
    row.audioDurationMs = Math.round(ms)
    row.duration = Math.round(ms / 100) / 10
    row.durationLabel = '真实音频时长'
    console.log(`row${i} ✅ ${result.audioUrl} ${(ms / 1000).toFixed(1)}s cached=${result.cached}`)
  }

  const saved = writeDeliverableFile(deliverable)
  const total = saved.deliverable.rows.reduce((s, r) => s + (Number(r.audioDurationMs) || 0), 0)
  const silent = saved.deliverable.rows.filter((r) => !r.audioUrl)
  console.log(`\n重建完成: ${saved.filename}`)
  console.log(`音频总时长=${(total / 1000).toFixed(1)}s  静音行=${silent.length}/${saved.deliverable.rows.length}`)
  console.log(`mp3 字段样例=${JSON.stringify(saved.deliverable.rows.map((r) => r.mp3).slice(0, 3))}`)
}

const mode = process.argv.includes('--check') ? 'check' : 'backfill'
if (mode === 'check') {
  const ok = checkMode()
  process.exit(ok ? 0 : 1)
} else {
  backfill().catch((err) => {
    console.error('[backfill] 失败:', err.message)
    process.exit(1)
  })
}
