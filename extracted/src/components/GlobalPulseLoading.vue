<template>
  <Transition name="pulse-fade">
    <div
      v-if="globalLoadingState.visible"
      id="global-pulse-loading-mask"
      class="global-pulse-overlay"
      role="status"
      aria-live="polite"
    >
      <div
        id="global-pulse-loading-card"
        class="pulse-card"
      >
        <!-- 轻微脉冲动效核心 -->
        <div class="pulse-beacon-container">
          <div class="pulse-beacon-outer" />
          <div class="pulse-beacon-inner" />
          <div class="pulse-beacon-core">
            <svg
              class="pulse-icon-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <!-- 数据分析 / 波动信号矢量图形 -->
              <path d="M3 12h3l3-8 4 16 3-8h5" />
              <circle
                cx="19"
                cy="12"
                r="1.5"
                fill="currentColor"
              />
            </svg>
          </div>
        </div>

        <!-- 主文案与动态省略号 -->
        <div class="pulse-text-wrap">
          <h4 class="pulse-title">
            <span>{{ displayMainText }}</span>
            <span class="pulse-animated-dots">
              <span class="dot d1">.</span>
              <span class="dot d2">.</span>
              <span class="dot d3">.</span>
            </span>
          </h4>
          <p
            v-if="globalLoadingState.subtext"
            class="pulse-subtext"
          >
            {{ globalLoadingState.subtext }}
          </p>
        </div>

        <!-- 细密平滑的脉冲微光进度流动条 -->
        <div class="pulse-gleam-track">
          <div class="pulse-gleam-bar" />
        </div>

        <!-- 关怀计时与超时取消提示 -->
        <div
          v-if="elapsedSeconds >= 8"
          class="pulse-timeout-action"
        >
          <span class="elapsed-badge">已处理 {{ elapsedSeconds }}s</span>
          <button
            v-if="globalLoadingState.cancelable"
            id="global-pulse-loading-close-btn"
            type="button"
            class="pulse-dismiss-btn"
            title="关闭遮罩层"
            @click="handleManualDismiss"
          >
            关闭遮罩
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { globalLoadingState, hideGlobalLoading } from '../services/globalLoading.js'

const elapsedSeconds = ref(0)
let timer = null

const displayMainText = computed(() => {
  const t = (globalLoadingState.text || '').trim()
  // 移除末尾已有的省略号以使用独立带脉冲动画的省略号
  return t.replace(/\.{3,}$/, '').replace(/…$/, '') || '数据分析中'
})

function startTimer() {
  stopTimer()
  elapsedSeconds.value = 0
  timer = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function handleManualDismiss() {
  hideGlobalLoading(true)
}

watch(
  () => globalLoadingState.visible,
  (val) => {
    if (val) {
      startTimer()
    } else {
      stopTimer()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  stopTimer()
})
</script>

<style scoped>
.global-pulse-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: auto;
}

.pulse-card {
  width: 100%;
  max-width: 380px;
  background: #ffffff;
  border-radius: 18px;
  padding: 30px 24px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  overflow: hidden;
  box-shadow:
    0 20px 35px -10px rgba(15, 23, 42, 0.22),
    0 0 0 1px rgba(226, 232, 240, 0.95);
  transform: translateY(0);
  animation: cardPopup 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes cardPopup {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 脉冲光标核心动效 */
.pulse-beacon-container {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
}

/* 外层微弱扩散呼吸环 */
.pulse-beacon-outer {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, rgba(99, 102, 241, 0.05) 65%, transparent 100%);
  animation: beaconPulseOuter 2.2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes beaconPulseOuter {
  0% {
    transform: scale(0.85);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.22);
    opacity: 0.9;
  }
  100% {
    transform: scale(0.85);
    opacity: 0.4;
  }
}

/* 内层轻微脉冲环 */
.pulse-beacon-inner {
  position: absolute;
  inset: 2px;
  border-radius: 50%;
  border: 1.5px solid rgba(59, 130, 246, 0.35);
  animation: beaconPulseInner 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes beaconPulseInner {
  0% {
    transform: scale(0.92);
    opacity: 0.6;
    border-color: rgba(59, 130, 246, 0.25);
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
    border-color: rgba(99, 102, 241, 0.6);
  }
  100% {
    transform: scale(0.92);
    opacity: 0.6;
    border-color: rgba(59, 130, 246, 0.25);
  }
}

/* 核心能量图标球体 */
.pulse-beacon-core {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  z-index: 2;
  animation: beaconCoreBreath 2.2s ease-in-out infinite;
}

@keyframes beaconCoreBreath {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.38);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 8px 22px rgba(79, 70, 229, 0.52);
  }
}

.pulse-icon-svg {
  width: 22px;
  height: 22px;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  animation: iconWiggle 3s ease-in-out infinite;
}

@keyframes iconWiggle {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-1.5px);
  }
}

/* 文案展示 */
.pulse-text-wrap {
  text-align: center;
  margin-bottom: 18px;
}

.pulse-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.01em;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  line-height: 1.4;
}

.pulse-animated-dots {
  display: inline-flex;
  margin-left: 2px;
}

.pulse-animated-dots .dot {
  display: inline-block;
  font-weight: 700;
  color: #2563eb;
  animation: dotFadeBlink 1.4s infinite;
  opacity: 0.2;
}

.pulse-animated-dots .d1 { animation-delay: 0s; }
.pulse-animated-dots .d2 { animation-delay: 0.22s; }
.pulse-animated-dots .d3 { animation-delay: 0.44s; }

@keyframes dotFadeBlink {
  0% { opacity: 0.1; transform: translateY(0); }
  35% { opacity: 1; transform: translateY(-1.5px); }
  70%, 100% { opacity: 0.1; transform: translateY(0); }
}

.pulse-subtext {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  max-width: 290px;
}

/* 底部极细微流光条 */
.pulse-gleam-track {
  width: 100%;
  height: 3px;
  background: #f1f5f9;
  border-radius: 9999px;
  position: relative;
  overflow: hidden;
}

.pulse-gleam-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 45%;
  background: linear-gradient(90deg, transparent 0%, #3b82f6 50%, #8b5cf6 100%);
  border-radius: 9999px;
  animation: streamGlide 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes streamGlide {
  0% {
    left: -45%;
  }
  100% {
    left: 100%;
  }
}

/* 超时辅助功能 */
.pulse-timeout-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.elapsed-badge {
  font-size: 11px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.pulse-dismiss-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.pulse-dismiss-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

/* 渐入渐出动画 */
.pulse-fade-enter-active,
.pulse-fade-leave-active {
  transition: opacity 0.25s ease;
}

.pulse-fade-enter-from,
.pulse-fade-leave-to {
  opacity: 0;
}
</style>
