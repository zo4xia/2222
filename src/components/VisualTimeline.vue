<template>
  <div class="visual-timeline-root">
    <!-- 顶部状态栏与图例 -->
    <div class="timeline-header">
      <div class="timeline-title-area">
        <span class="timeline-main-icon">🎬</span>
        <span class="timeline-title">时序全景时间轴</span>
        <span class="timeline-subtitle">Row 组音频时长与板书落笔起手点映射</span>
      </div>

      <div class="timeline-summary-stats">
        <span class="summary-pill">
          <span class="pill-dot total-dot"></span>
          共 <strong>{{ rows.length }}</strong> 组 Row
        </span>
        <span class="summary-pill">
          <span class="pill-dot audio-dot"></span>
          总时长 <strong>{{ totalDurationSec }}s</strong>
          <span v-if="estimatedRowCount > 0" class="pill-est-hint">（含 {{ estimatedRowCount }} 行无音频·按 160 字/分估算）</span>
        </span>
        <span class="summary-pill" v-if="boardRowCount > 0">
          <span class="pill-dot board-dot"></span>
          板书 <strong>{{ boardRowCount }}</strong> 处（平均起手 <strong>+{{ avgStartDelay }}s</strong>）
        </span>
      </div>

      <div class="timeline-legend">
        <span class="legend-item"><span class="legend-badge stage-question"></span>题目</span>
        <span class="legend-item"><span class="legend-badge stage-analysis"></span>分析</span>
        <span class="legend-item"><span class="legend-badge stage-solution"></span>解答</span>
        <span class="legend-item"><span class="legend-badge stage-summary"></span>总结</span>
        <span class="legend-divider">|</span>
        <span class="legend-item"><span class="legend-icon">🎵</span>MP3音频</span>
        <span class="legend-item"><span class="legend-icon">✍️</span>+n秒板书起手</span>
      </div>
    </div>

    <!-- 核心横向时间轴轨道：每个 Row 组映射为一个独立区块 -->
    <div class="timeline-track-container" ref="trackRef">
      <div class="timeline-track">
        <div
          v-for="(row, idx) in rows"
          :key="row._rowKey || idx"
          :class="[
            'timeline-row-block',
            `stage-theme-${row.stage || '分析'}`,
            { 'is-active': activeIndex === idx, 'has-board': hasBoard(row) }
          ]"
          :style="{ flexBasis: getBlockWidth(row) }"
          @click="onBlockClick(idx)"
        >
          <!-- 块顶部：序号与环节 -->
          <div class="block-top-bar">
            <span class="block-index-badge">Row {{ idx + 1 }}</span>
            <span :class="['block-stage-pill', `stage-${row.stage || '分析'}`]">
              {{ row.stage || '分析' }}
            </span>
          </div>

          <!-- 核心指标1：时长（有音频=真实自然时间；无音频=160 字/分估算兜底） -->
          <div class="block-metric-row audio-row" :title="hasRealAudio(row) ? '本 Row 有音频：真实自然播放时长（audioDurationMs）' : '本 Row 无音频：按 160 字/分估算兜底（虚拟时钟推进，不卡死）'">
            <div class="metric-label-group">
              <span class="metric-icon">🎵</span>
              <span class="metric-name">{{ hasRealAudio(row) ? 'MP3时长' : '估算时长' }}</span>
            </div>
            <span :class="['metric-val', hasRealAudio(row) ? 'audio-val' : 'audio-val is-estimated']">{{ getDuration(row).toFixed(1) }}s{{ hasRealAudio(row) ? '' : '（估）' }}</span>
          </div>

          <!-- 核心指标2：板书动画起手 +n 秒延时 -->
          <div
            :class="['block-metric-row', 'offset-row', { 'no-board-offset': !hasBoard(row) }]"
            :title="hasBoard(row) ? `口播进行到 +${getStartDelay(row).toFixed(1)}s 时，右手开始落笔书写` : '本 Row 仅朗读，无板书书写'"
          >
            <div class="metric-label-group">
              <span class="metric-icon">✍️</span>
              <span class="metric-name">板书起手</span>
            </div>
            <div class="offset-adjust-box" @click.stop>
              <span v-if="!hasBoard(row)" class="metric-val zero-offset">0.0s (无板书)</span>
              <template v-else>
                <button
                  class="btn-offset-step"
                  title="减少 0.2s"
                  @click="adjustOffset(idx, -0.2)"
                >-</button>
                <span class="metric-val highlight-offset">+{{ getStartDelay(row).toFixed(1) }}s</span>
                <button
                  class="btn-offset-step"
                  title="增加 0.2s"
                  @click="adjustOffset(idx, 0.2)"
                >+</button>
              </template>
            </div>
          </div>

          <!-- 块内部微观时序分段条：直观展示口播铺垫期与落笔书写期的比例关系 -->
          <div class="mini-timeline-track" :title="getMiniTimelineTitle(row)">
            <div
              class="mini-bar-audio-prelude"
              :style="{ width: getPreludePercent(row) + '%' }"
            >
              <span v-if="getPreludePercent(row) > 20" class="mini-bar-label">纯口播</span>
            </div>
            <div
              v-if="hasBoard(row)"
              class="mini-board-start-pin"
              :style="{ left: getPreludePercent(row) + '%' }"
              title="板书开始落笔时间点"
            >
              <span class="pin-marker">✍️</span>
            </div>
            <div
              class="mini-bar-board-writing"
              :style="{ width: (100 - getPreludePercent(row)) + '%' }"
            >
              <span v-if="(100 - getPreludePercent(row)) > 25" class="mini-bar-label">
                {{ hasBoard(row) ? '板书书写' : '朗读进行' }}
              </span>
            </div>
          </div>

          <!-- 口播文案微缩预览 -->
          <div class="block-speech-preview" :title="row.speech">
            {{ row.speech || '（无口播）' }}
          </div>

          <!-- 块底部：起止时间戳 -->
          <div class="block-footer-time">
            <span>{{ (getEstimatedStart(idx) / 1000).toFixed(1) }}s</span>
            <span class="arrow-sep">➔</span>
            <span>{{ ((getEstimatedStart(idx) + getDuration(row) * 1000) / 1000).toFixed(1) }}s</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
// 车同轨、书同文：板书判空与清洗统一过全局唯一超级过滤器
import { superCleanBoardField, superCleanText } from '../utils/superFilter.js'

const props = defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  activeIndex: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits(['select-row', 'update-start-delay'])

const trackRef = ref(null)

import { AGENT_B_V2_SPEECH_RATE, AGENT_B_V2_ROW_GAP_MS } from '../agent-b-v2/timing.js'
// 语速/行间隔真源：import timing.js，禁止本地另写第二套系数（2026-09-17 收口）
const SPEECH_SPEED_CPM = AGENT_B_V2_SPEECH_RATE
const ROW_GAP_MS = AGENT_B_V2_ROW_GAP_MS

// 是否有真实音频（时长第一真源）
function hasRealAudio(row) {
  return Number(row?.audioDurationMs) > 0
}

// 提取 row 的时长（单位：秒）
// 判据（与交付物 duration 规则同源）：有音频 → 真实自然播放时间；无音频 → 160 字/分估算兜底
function getDuration(row) {
  if (hasRealAudio(row)) return Number(row.audioDurationMs) / 1000
  if (row.audioDuration && row.audioDuration > 0) return row.audioDuration
  if (row.estimatedDurationMs && row.estimatedDurationMs > 0) return row.estimatedDurationMs / 1000
  if (row.rowTimeline?.rowTotalDurationMs && row.rowTimeline.rowTotalDurationMs > 0) {
    return row.rowTimeline.rowTotalDurationMs / 1000
  }
  // 兜底语速与 canvasParams.speechSpeed 同源（默认 160 字/分），禁止另起一套系数
  const charCount = String(row.speech || '').replace(/\s+/g, '').length
  return Math.max(1, Math.round((charCount / SPEECH_SPEED_CPM) * 60 * 10) / 10)
}

// 提取板书内容是否存在
function hasBoard(row) {
  if (!row.board) return false
  if (typeof row.board === 'string') return Boolean(superCleanText(row.board).trim())
  if (Array.isArray(row.board)) return superCleanBoardField(row.board).lines.length > 0
  return superCleanBoardField(row.board.content ?? '').lines.length > 0
}

// 提取 board.startDelay（单位：秒）
function getStartDelay(row) {
  if (!hasBoard(row)) return 0
  const board = row.board
  if (board && typeof board === 'object') {
    if (typeof board.startDelay === 'number' && Number.isFinite(board.startDelay) && board.startDelay >= 0) {
      return Number(board.startDelay.toFixed(1))
    }
    if (typeof board.startDelay === 'string') {
      const m = board.startDelay.match(/[\d.]+/)
      if (m) {
        const val = parseFloat(m[0])
        if (Number.isFinite(val) && val >= 0) return Number(val.toFixed(1))
      }
    }
  }
  if (row.rowTimeline?.boardStartDelayMs != null) {
    return Number((row.rowTimeline.boardStartDelayMs / 1000).toFixed(1))
  }
  // 默认智能自适应起手点（前置 1.5s 口播铺垫）
  const dur = getDuration(row)
  return Number(Math.min(2.2, Math.max(1.0, dur * 0.2)).toFixed(1))
}

// 计算板书前纯口播铺垫百分比
function getPreludePercent(row) {
  const dur = getDuration(row)
  if (dur <= 0) return 0
  if (!hasBoard(row)) return 100
  const delay = getStartDelay(row)
  const pct = (delay / dur) * 100
  return Math.min(85, Math.max(5, Math.round(pct)))
}

// 估算累计起始时间点
function getEstimatedStart(targetIdx) {
  let accMs = 0
  for (let i = 0; i < targetIdx; i++) {
    const d = getDuration(props.rows[i]) * 1000
    accMs += d + ROW_GAP_MS // 包含默认行间隔（真源 timing.js）
  }
  return accMs
}

// 计算块宽度弹性基准
function getBlockWidth(row) {
  const dur = getDuration(row)
  const basePx = Math.max(160, Math.min(260, Math.round(dur * 24)))
  return `${basePx}px`
}

// 总时长（逐行真实音频优先 + 无音频行估算，与上方判据同源）
const totalDurationSec = computed(() => {
  if (!props.rows.length) return '0.0'
  const total = props.rows.reduce((sum, r) => sum + getDuration(r), 0)
  return total.toFixed(1)
})

// 无音频（走估算）的行数：用于顶部提示，避免把估算值当成真实音频时长
const estimatedRowCount = computed(() => props.rows.filter((r) => !hasRealAudio(r)).length)

// 带有板书的 Row 计数
const boardRowCount = computed(() => {
  return props.rows.filter(hasBoard).length
})

// 平均起手延时
const avgStartDelay = computed(() => {
  const boardRows = props.rows.filter(hasBoard)
  if (!boardRows.length) return '0.0'
  const sum = boardRows.reduce((acc, r) => acc + getStartDelay(r), 0)
  return (sum / boardRows.length).toFixed(1)
})

function getMiniTimelineTitle(row) {
  const dur = getDuration(row).toFixed(1)
  const delay = getStartDelay(row).toFixed(1)
  if (!hasBoard(row)) return `总音频时长 ${dur}s（本行无板书）`
  return `总音频时长 ${dur}s | 0s~+${delay}s 纯口播铺垫 | +${delay}s 开始落笔书写板书`
}

function onBlockClick(index) {
  emit('select-row', index)
}

function adjustOffset(index, delta) {
  const row = props.rows[index]
  if (!row) return
  const current = getStartDelay(row)
  const next = Math.max(0, Math.min(getDuration(row), Number((current + delta).toFixed(1))))
  emit('update-start-delay', { index, startDelay: next })
}
</script>

<style scoped>
.visual-timeline-root {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px 10px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

/* 顶部信息栏 */
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f1f5f9;
}

.timeline-title-area {
  display: flex;
  align-items: center;
  gap: 6px;
}
.timeline-main-icon {
  font-size: 16px;
}
.timeline-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 0.2px;
}
.timeline-subtitle {
  font-size: 11px;
  color: #64748b;
  margin-left: 4px;
}

/* 统计药丸 */
.timeline-summary-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  color: #475569;
}
.summary-pill strong {
  color: #1e293b;
  font-family: monospace;
}
.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.total-dot { background: #3b82f6; }
.audio-dot { background: #10b981; }
.board-dot { background: #f59e0b; }

/* 图例 */
.timeline-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #64748b;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend-badge {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-badge.stage-question { background: #0ea5e9; }
.legend-badge.stage-analysis { background: #f59e0b; }
.legend-badge.stage-solution { background: #10b981; }
.legend-badge.stage-summary { background: #8b5cf6; }
.legend-divider {
  color: #cbd5e1;
}

/* 核心时间轴轨道容器 (支持左右平滑滚动) */
.timeline-track-container {
  overflow-x: auto;
  padding-top: 10px;
  padding-bottom: 4px;
  scrollbar-width: thin;
}
.timeline-track-container::-webkit-scrollbar {
  height: 6px;
}
.timeline-track-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.timeline-track {
  display: flex;
  gap: 10px;
  align-items: stretch;
  min-width: 100%;
}

/* 单个 Row 组映射的独立区块 */
.timeline-row-block {
  flex: 1 0 auto;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  position: relative;
}

.timeline-row-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  border-color: #94a3b8;
}

.timeline-row-block.is-active {
  border-color: #2563eb !important;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2), 0 4px 12px rgba(37, 99, 235, 0.12);
  background: #f8faff;
}

/* 环节主题特色色彩边框 */
.stage-theme-题目 { border-top: 3px solid #0ea5e9; }
.stage-theme-分析 { border-top: 3px solid #f59e0b; }
.stage-theme-解答 { border-top: 3px solid #10b981; }
.stage-theme-总结 { border-top: 3px solid #8b5cf6; }

/* 块顶部条 */
.block-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.block-index-badge {
  font-size: 11.5px;
  font-weight: 700;
  color: #1e293b;
}
.block-stage-pill {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.block-stage-pill.stage-题目 { background: #e0f2fe; color: #0284c7; }
.block-stage-pill.stage-分析 { background: #fef3c7; color: #b45309; }
.block-stage-pill.stage-解答 { background: #d1fae5; color: #047857; }
.block-stage-pill.stage-总结 { background: #ede9fe; color: #6d28d9; }

/* 指标行 */
.block-metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
  background: #f8fafc;
  padding: 4px 7px;
  border-radius: 5px;
  font-size: 11px;
}
.audio-row {
  background: #f0fdf4;
  border: 1px solid #dcfce7;
}
.offset-row {
  background: #fffbeb;
  border: 1px solid #fef3c7;
}
.no-board-offset {
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  opacity: 0.8;
}

.metric-label-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 10.5px;
}
.metric-icon {
  font-size: 12px;
}
.metric-name {
  font-weight: 500;
}

.metric-val {
  font-family: monospace;
  font-weight: 700;
}
.audio-val {
  color: #15803d;
  font-size: 11.5px;
}
/* 无音频行的估算时长：与真实音频色区分，避免误读为真值 */
.audio-val.is-estimated {
  color: #b45309;
}
.pill-est-hint {
  margin-left: 2px;
  color: #b45309;
  font-size: 11px;
}
.highlight-offset {
  color: #b45309;
  font-size: 11.5px;
  background: #fde68a;
  padding: 0 4px;
  border-radius: 3px;
}
.zero-offset {
  color: #94a3b8;
  font-size: 10px;
  font-weight: normal;
}

.offset-adjust-box {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.btn-offset-step {
  border: 1px solid #d97706;
  background: #ffffff;
  color: #b45309;
  width: 16px;
  height: 16px;
  line-height: 14px;
  font-size: 11px;
  font-weight: bold;
  border-radius: 3px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.12s;
}
.btn-offset-step:hover {
  background: #f59e0b;
  color: #ffffff;
}

/* 微观进度条 */
.mini-timeline-track {
  width: 100%;
  height: 14px;
  background: #f1f5f9;
  border-radius: 3px;
  display: flex;
  overflow: hidden;
  position: relative;
  border: 1px solid #e2e8f0;
}
.mini-bar-audio-prelude {
  height: 100%;
  background: repeating-linear-gradient(
    45deg,
    #e0f2fe,
    #e0f2fe 4px,
    #bae6fd 4px,
    #bae6fd 8px
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  color: #0369a1;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}
.mini-board-start-pin {
  position: absolute;
  top: -2px;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;
}
.pin-marker {
  font-size: 11px;
  display: block;
}
.mini-bar-board-writing {
  height: 100%;
  background: #dcfce7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8.5px;
  color: #15803d;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
}

/* 口播缩略词 */
.block-speech-preview {
  font-size: 10.5px;
  color: #64748b;
  line-height: 1.35;
  height: 28px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 底部起止时间戳 */
.block-footer-time {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  font-family: monospace;
  color: #94a3b8;
  border-top: 1px dashed #f1f5f9;
  padding-top: 3px;
}
.arrow-sep {
  color: #cbd5e1;
}
</style>
