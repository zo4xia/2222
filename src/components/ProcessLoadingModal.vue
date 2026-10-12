<template>
  <div v-if="visible" class="process-loading-overlay">
    <div class="process-loading-card">
      <!-- 动态呼吸光晕外环 -->
      <div class="glow-orb-wrapper">
        <div class="glow-pulse-ring ring-outer"></div>
        <div class="glow-pulse-ring ring-inner"></div>
        <div class="ai-core-orb">
          <div class="core-sparkle">
            <svg class="sparkle-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
      </div>

      <!-- 动态主标题与跳动动效 -->
      <div class="process-header">
        <h3 class="process-title">
          {{ title || 'AI 教学引擎正在运算中' }}
          <span class="animated-dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </h3>
        <p class="process-subtitle">{{ currentStageText }}</p>
      </div>

      <!-- 阶段步骤流转进度条 -->
      <div class="stage-track-wrapper">
        <div class="stage-progress-bar">
          <div class="stage-progress-fill" :style="{ width: `${progressPct}%` }"></div>
          <div class="progress-light-gleam" :style="{ left: `${progressPct}%` }"></div>
        </div>
        <div class="stage-meta-row">
          <span class="stage-step-tag">步骤 {{ currentStageIndex + 1 }} / {{ totalStages }}</span>
          <span class="elapsed-timer">已耗时 {{ elapsedSec }} 秒</span>
        </div>
      </div>

      <!-- 阶段列表流转指示 -->
      <div class="stages-indicator-list">
        <div
          v-for="(st, idx) in stages"
          :key="idx"
          class="stage-indicator-item"
          :class="{
            'is-active': idx === currentStageIndex,
            'is-done': idx < currentStageIndex,
            'is-pending': idx > currentStageIndex
          }"
        >
          <div class="stage-dot">
            <span v-if="idx < currentStageIndex" class="check-icon">✓</span>
            <span v-else-if="idx === currentStageIndex" class="active-pulse"></span>
            <span v-else class="pending-num">{{ idx + 1 }}</span>
          </div>
          <span class="stage-name">{{ st.label }}</span>
        </div>
      </div>

      <!-- 底部教学贴士 / 解耦规范小提醒 -->
      <div class="loading-footer-tip">
        <div class="tip-icon">💡</div>
        <div class="tip-text">{{ currentTip }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '数据分析与教学编排中' },
  mode: { type: String, default: 'agent-b' }, // 'agent-b' | 'check' | 'step1' | 'speech'
  customStages: { type: Array, default: () => [] }
})

const DEFAULT_STAGES_MAP = {
  'agent-b': [
    { label: '研读题目条件与知识支架', durationSec: 3 },
    { label: '解构数量关系与思维引导路径', durationSec: 6 },
    { label: '推导启发式分步教学口播脚本', durationSec: 7 },
    { label: '规划黑板四区与单手动作互斥时序', durationSec: 8 },
    { label: '组装五字段标准音画交付模型', durationSec: 15 }
  ],
  'check': [
    { label: '第二双眼睛开启双盲审阅', durationSec: 2 },
    { label: '逐行润色口播断句与标点节奏', durationSec: 5 },
    { label: '校验 ASR 中文数字及专有名词', durationSec: 6 },
    { label: '严格校验板书与动作互斥时间线', durationSec: 6 },
    { label: '整合双向差分与质检修复建议', durationSec: 10 }
  ],
  'step1': [
    { label: '载入题板快照与原始板书', durationSec: 2 },
    { label: 'OCR 解析题干文本与约束条件', durationSec: 4 },
    { label: '智能测算黑板四区黄金排版比例', durationSec: 5 },
    { label: '构建教学底图与落位元数据', durationSec: 8 }
  ],
  'speech': [
    { label: '预处理口播文本与中文发音规则', durationSec: 2 },
    { label: '调用高品质拟真 TTS 语音合成', durationSec: 6 },
    { label: '音频本地持久化与媒体时序对其', durationSec: 6 }
  ]
}

const TIPS = [
  '动作时间定量 1~2 秒，作为口播中的标点停顿，绝不与板书重叠并发。',
  '每个 row 为一组独立单元，语音贯穿全程，板书与动作二者绝对互斥。',
  '四区黑板架构：题目区、分析区、解答区、总结区，彼此物理隔离不挤压。',
  '板书按教学内容自然换行，保留老师现场书写的留白层次。',
  '交付数据已深度解耦，附带标准 API 协议，供下游课件与画布 Agent 直接消费。'
]

const elapsedSec = ref(0)
const tipIndex = ref(0)
let timer = null
let tipTimer = null

const stages = computed(() => {
  if (props.customStages && props.customStages.length > 0) return props.customStages
  return DEFAULT_STAGES_MAP[props.mode] || DEFAULT_STAGES_MAP['agent-b']
})

const totalStages = computed(() => stages.value.length)

// 根据耗时动态计算当前进行到的阶段
const currentStageIndex = computed(() => {
  let accum = 0
  for (let i = 0; i < stages.value.length; i++) {
    accum += stages.value[i].durationSec || 5
    if (elapsedSec.value < accum) {
      return i
    }
  }
  return stages.value.length - 1
})

const currentStageText = computed(() => {
  const current = stages.value[currentStageIndex.value]
  return current ? current.label : '正在处理核心运算...'
})

const progressPct = computed(() => {
  const totalPlanned = stages.value.reduce((sum, s) => sum + (s.durationSec || 5), 0)
  if (totalPlanned <= 0) return 30
  // 渐进缓慢逼近 96%，在完成前不卡满 100%
  const pct = Math.min(96, Math.round((elapsedSec.value / totalPlanned) * 90) + 6)
  return pct
})

const currentTip = computed(() => TIPS[tipIndex.value % TIPS.length])

function startTiming() {
  stopTiming()
  elapsedSec.value = 0
  tipIndex.value = Math.floor(Math.random() * TIPS.length)
  timer = setInterval(() => {
    elapsedSec.value += 1
  }, 1000)
  tipTimer = setInterval(() => {
    tipIndex.value = (tipIndex.value + 1) % TIPS.length
  }, 5000)
}

function stopTiming() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (tipTimer) {
    clearInterval(tipTimer)
    tipTimer = null
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    startTiming()
  } else {
    stopTiming()
  }
}, { immediate: true })

onBeforeUnmount(() => {
  stopTiming()
})
</script>

<style scoped>
.process-loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: overlayFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes overlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.process-loading-card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8);
  padding: 32px 28px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
  animation: cardSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes cardSlideUp {
  from { opacity: 0; transform: translateY(16px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 顶部光晕呼吸动效 */
.glow-orb-wrapper {
  position: relative;
  width: 84px;
  height: 84px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.glow-pulse-ring {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.ring-outer {
  width: 84px;
  height: 84px;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(99, 102, 241, 0.04) 70%, transparent 100%);
  animation: pulseOuter 2.4s ease-in-out infinite;
}

.ring-inner {
  width: 64px;
  height: 64px;
  border: 1.5px dashed rgba(59, 130, 246, 0.4);
  animation: spinSlow 12s linear infinite;
}

@keyframes pulseOuter {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}

@keyframes spinSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ai-core-orb {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  z-index: 2;
  animation: floatOrb 3s ease-in-out infinite;
}

@keyframes floatOrb {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

.sparkle-svg {
  width: 26px;
  height: 26px;
  animation: sparkTwinkle 2s ease-in-out infinite;
}

@keyframes sparkTwinkle {
  0%, 100% { transform: scale(1); opacity: 0.95; }
  50% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.8)); }
}

/* 标题与描述 */
.process-header {
  text-align: center;
  margin-bottom: 20px;
}

.process-title {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.animated-dots span {
  display: inline-block;
  animation: dotBlink 1.4s infinite;
  opacity: 0;
  font-weight: 800;
  color: #3b82f6;
}

.animated-dots span:nth-child(1) { animation-delay: 0s; }
.animated-dots span:nth-child(2) { animation-delay: 0.25s; }
.animated-dots span:nth-child(3) { animation-delay: 0.5s; }

@keyframes dotBlink {
  0% { opacity: 0; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-2px); }
  60%, 100% { opacity: 0; transform: translateY(0); }
}

.process-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #475569;
  min-height: 22px;
  transition: all 0.3s ease;
}

/* 进度条 */
.stage-track-wrapper {
  width: 100%;
  margin-bottom: 20px;
}

.stage-progress-bar {
  width: 100%;
  height: 7px;
  background: #f1f5f9;
  border-radius: 9999px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.stage-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6);
  border-radius: 9999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-light-gleam {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 24px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
  transform: translateX(-50%);
  transition: left 0.4s ease;
  pointer-events: none;
}

.stage-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  font-variant-numeric: tabular-nums;
}

.stage-step-tag {
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
}

.elapsed-timer {
  color: #94a3b8;
}

/* 阶段列表 */
.stages-indicator-list {
  width: 100%;
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stage-indicator-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  transition: all 0.25s ease;
}

.stage-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.stage-indicator-item.is-pending {
  color: #94a3b8;
}

.stage-indicator-item.is-pending .stage-dot {
  background: #e2e8f0;
  color: #64748b;
}

.stage-indicator-item.is-active {
  color: #1e40af;
  font-weight: 600;
}

.stage-indicator-item.is-active .stage-dot {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

.active-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ffffff;
  animation: activeDotBlink 1s ease-in-out infinite;
}

@keyframes activeDotBlink {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.stage-indicator-item.is-done {
  color: #059669;
}

.stage-indicator-item.is-done .stage-dot {
  background: #10b981;
  color: #ffffff;
}

.check-icon {
  font-size: 10px;
}

.stage-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 底部温馨小贴士 */
.loading-footer-tip {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fdf6ec;
  border: 1px solid #f9ece0;
  border-radius: 8px;
  color: #b45309;
  font-size: 12px;
  line-height: 1.45;
  transition: all 0.3s ease;
}

.tip-icon {
  flex-shrink: 0;
  font-size: 14px;
}

.tip-text {
  flex: 1;
}
</style>
