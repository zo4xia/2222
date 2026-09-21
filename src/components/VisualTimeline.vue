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
          音频总长 <strong>{{ totalDurationSec }}s</strong>
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

          <!-- 核心指标1：MP3 音频时长 -->
          <div class="block-metric-row audio-row" title="本 Row 组 MP3 语音音频持续时长">
            <div class="metric-label-group">
              <span class="metric-icon">🎵</span>
              <span class="metric-name">MP3时长</span>
            </div>
            <span class="metric-val audio-val">{{ getDuration(row).toFixed(1) }}s</span>
          </div>

          <!-- ★ 试听按钮：点击立即试听本 Row 的音频（缓存 mp3） -->
          <button
            v-if="getAudioUrl(row)"
            class="block-play-btn"
            :class="{ 'is-playing': playingIndex === idx }"
            :title="playingIndex === idx ? '暂停试听' : '试听本 Row 组音频'"
            @click.stop="onPlayClick(idx, row)"
          >
            <span class="play-btn-icon">{{ playingIndex === idx ? '⏸' : '▶' }}</span>
            <span class="play-btn-text">{{ playingIndex === idx ? '暂停试听' : '试听' }}</span>
          </button>
          <div v-else class="block-play-btn block-play-btn-empty" title="本 Row 尚未生成音频">
            <span class="play-btn-text-muted">未生成音频</span>
          </div>

          <!-- 核心指标2：板书动画起手延时（只读展示，由系统语义与音频自动驱动） -->
          <div
            :class="['block-metric-row', 'offset-row', { 'no-board-offset': !hasBoard(row) }]"
            :title="hasBoard(row) ? `口播进行到 +${getStartDelay(row).toFixed(1)}s 时，右手开始落笔书写` : '本 Row 仅朗读，无板书书写'"
          >
            <div class="metric-label-group">
              <span class="metric-icon">✍️</span>
              <span class="metric-name">板书起手</span>
            </div>
            <div class="offset-adjust-box">
              <span v-if="!hasBoard(row)" class="metric-val zero-offset">0.0s (无板书)</span>
              <span v-else class="metric-val highlight-offset">+{{ getStartDelay(row).toFixed(1) }}s</span>
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

const props = defineProps({
  rows: {
    type: Array,
    default: () => [],
  },
  activeIndex: {
    type: Number,
    default: -1,
  },
  // ★ 当前正在播放的 row index（用于在时间轴块上显示"正在播放"状态）
  playingIndex: {
    type: Number,
    default: -1,
  },
})

// ★ emit 增加两个事件：select-row（行定位，原有） + play-audio（试听，新增）
const emit = defineEmits(['select-row', 'play-audio'])

const trackRef = ref(null)

// ★ 提取 row 的音频 URL（优先 audioUrl，兜底缓存 rowAudioCache，再兜底 audio.mp3）
//  注意：父组件传入的 row 已含 audioUrl 与 audioDurationMs 字段（若已生成）
function getAudioUrl(row) {
  if (!row) return ''
  return row.audioUrl || row.mp3 || row.audio || ''
}

// ★ 试听按钮点击：emit 给父组件，由父组件调 playAudioUrl 统一管理音频实例
//  这样可以复用父组件的 activeAudio / playingAudioIndex 状态，不会多实例冲突
function onPlayClick(idx, row) {
  const url = getAudioUrl(row)
  if (!url) return
  emit('play-audio', { index: idx, url })
}

// 提取 row 的时长（单位：秒）
function getDuration(row) {
  // ★ 优先使用真实音频时长（如果有）
  if (row.audioDurationMs && row.audioDurationMs > 0) {
    return row.audioDurationMs / 1000
  }
  if (row.audioDuration && row.audioDuration > 0) return row.audioDuration
  if (row.estimatedDurationMs && row.estimatedDurationMs > 0) return row.estimatedDurationMs / 1000
  if (row.rowTimeline?.rowTotalDurationMs && row.rowTimeline.rowTotalDurationMs > 0) {
    return row.rowTimeline.rowTotalDurationMs / 1000
  }
  const textLen = (row.speech || '').length
  return Math.max(2.5, Number((textLen / 2.8).toFixed(1)))
}

// 提取板书内容是否存在
function hasBoard(row) {
  if (!row.board) return false
  if (typeof row.board === 'string') return Boolean(row.board.trim())
  const content = row.board.content || ''
  return Boolean(content.trim())
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
    accMs += d + 1500 // 包含默认 1.5s row gap
  }
  return accMs
}

// 计算块宽度弹性基准
function getBlockWidth(row) {
  const dur = getDuration(row)
  const basePx = Math.max(160, Math.min(260, Math.round(dur * 24)))
  return `${basePx}px`
}

// 总音频时长
const totalDurationSec = computed(() => {
  if (!props.rows.length) return '0.0'
  const total = props.rows.reduce((sum, r) => sum + getDuration(r), 0)
  return total.toFixed(1)
})

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
</script>

<style scoped>
.visual-timeline-root {
  background: var(--surface, #fffdf7);
  border: 1px solid var(--line, #d7ded5);
  border-radius: var(--card-radius, 18px);
  padding: 14px 16px 12px;
  margin-bottom: 14px;
  box-shadow: var(--card-shadow);
}

/* 顶部信息栏 */
.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line, #d7ded5);
}

.timeline-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeline-main-icon {
  font-size: 18px;
}
.timeline-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--ink-deep, #163b3d);
  letter-spacing: 0.2px;
}
.timeline-subtitle {
  font-size: 11.5px;
  color: var(--muted, #708786);
  margin-left: 4px;
}

/* 统计药丸 */
.timeline-summary-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}
.summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--surface-soft, #edf7f0);
  border: 1px solid var(--line, #d7ded5);
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11.5px;
  color: var(--ink, #31595a);
}
.summary-pill strong {
  color: var(--ink-deep, #163b3d);
  font-family: monospace;
}
.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.total-dot { background: var(--blue, #5c88b8); }
.audio-dot { background: var(--positive, #16856f); }
.board-dot { background: var(--warning, #9a6a18); }

/* 图例 */
.timeline-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: var(--muted, #708786);
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.legend-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.legend-badge.stage-question { background: var(--blue, #5c88b8); }
.legend-badge.stage-analysis { background: var(--sun, #f6c95f); }
.legend-badge.stage-solution { background: var(--positive, #16856f); }
.legend-badge.stage-summary { background: var(--danger, #d95f5f); }
.legend-divider {
  color: var(--line, #d7ded5);
}

/* 核心时间轴轨道容器 (支持左右平滑滚动) */
.timeline-track-container {
  overflow-x: auto;
  padding-top: 12px;
  padding-bottom: 6px;
  scrollbar-width: thin;
}
.timeline-track-container::-webkit-scrollbar {
  height: 6px;
}
.timeline-track-container::-webkit-scrollbar-thumb {
  background: var(--line-strong, #b9cdc5);
  border-radius: 3px;
}

.timeline-track {
  display: flex;
  gap: 12px;
  align-items: stretch;
  min-width: 100%;
}

/* 单个 Row 组映射的独立区块 */
.timeline-row-block {
  flex: 1 0 auto;
  background: var(--surface, #fffdf7);
  border: 1.5px solid var(--line, #d7ded5);
  border-radius: var(--control-radius, 12px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  position: relative;
}

.timeline-row-block:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(22, 59, 61, 0.08);
  border-color: var(--brand, #16856f);
}

.timeline-row-block.is-active {
  border-color: var(--brand, #16856f) !important;
  box-shadow: 0 0 0 2px rgba(22, 133, 111, 0.2), 0 6px 18px rgba(22, 133, 111, 0.15);
  background: var(--surface-soft, #edf7f0);
}

/* 环节主题特色色彩边框 */
.stage-theme-题目 { border-top: 3.5px solid var(--blue, #5c88b8); }
.stage-theme-分析 { border-top: 3.5px solid var(--sun, #f6c95f); }
.stage-theme-解答 { border-top: 3.5px solid var(--positive, #16856f); }
.stage-theme-总结 { border-top: 3.5px solid var(--danger, #d95f5f); }

/* 块顶部条 */
.block-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.block-index-badge {
  font-size: 12px;
  font-weight: 800;
  color: var(--ink-deep, #163b3d);
}
.block-stage-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 700;
}
.block-stage-pill.stage-题目 { background: var(--blue-pale, #e8f1fa); color: var(--blue, #5c88b8); }
.block-stage-pill.stage-分析 { background: var(--sun-pale, #fff2c7); color: var(--warning, #9a6a18); }
.block-stage-pill.stage-解答 { background: var(--positive-pale, #dff4ea); color: var(--positive-strong, #116b5b); }
.block-stage-pill.stage-总结 { background: var(--danger-pale, #ffe7e1); color: var(--danger, #d95f5f); }

/* 指标行 */
.block-metric-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface-soft, #edf7f0);
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 11px;
}
.audio-row {
  background: var(--positive-pale, #dff4ea);
  border: 1px solid var(--line-strong, #b9cdc5);
}

/* ★ 试听按钮（时间轴块内） */
.block-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  margin-top: 6px;
  padding: 5px 10px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
  color: #fff;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
  box-shadow: 0 2px 6px rgba(22, 163, 74, 0.28);
}
.block-play-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(22, 163, 74, 0.4);
}
.block-play-btn:active {
  transform: translateY(0);
}
.block-play-btn.is-playing {
  background: linear-gradient(135deg, #b45309 0%, #92400e 100%);
  box-shadow: 0 2px 6px rgba(180, 83, 9, 0.4);
  animation: tl-play-pulse 1.4s ease-in-out infinite;
}
@keyframes tl-play-pulse {
  0%, 100% { box-shadow: 0 2px 6px rgba(180, 83, 9, 0.4); }
  50%      { box-shadow: 0 4px 12px rgba(180, 83, 9, 0.65); }
}
.play-btn-icon {
  font-size: 12px;
  line-height: 1;
}
.play-btn-text {
  line-height: 1;
}
.block-play-btn-empty {
  background: var(--surface-soft, #edf7f0);
  border: 1px dashed var(--line, #d7ded5);
  box-shadow: none;
  cursor: not-allowed;
}
.play-btn-text-muted {
  color: var(--muted, #94a3b8);
  font-size: 10.5px;
  font-weight: 500;
}
.offset-row {
  background: var(--sun-pale, #fff2c7);
  border: 1px solid #fae69e;
}
.no-board-offset {
  background: var(--surface-soft, #edf7f0);
  border: 1px solid var(--line, #d7ded5);
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
