<script setup>
/**
 * @qh-core LANE=FEEDBACK POINT=LOADING 局部加载组件
 * 用法：<QhLoading mode="recognize" :inline="false" />
 */
import { computed } from 'vue'
import { LOADING_MODES } from './index.js'

const props = defineProps({
  mode: { type: String, default: 'default' },
  inline: { type: Boolean, default: false },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
})

const config = computed(() => LOADING_MODES[props.mode] || LOADING_MODES.default)
const displayTitle = computed(() => props.title || config.value.title)
const displayDesc = computed(() => props.desc || config.value.desc)
</script>

<template>
  <div :class="['qh-loading', inline ? 'qh-loading--inline' : 'qh-loading--block']">
    <div class="qh-loading__spinner">
      <div class="qh-loading__dot"></div>
      <div class="qh-loading__dot"></div>
      <div class="qh-loading__dot"></div>
    </div>
    <div class="qh-loading__text">
      <div class="qh-loading__title">{{ displayTitle }}</div>
      <div v-if="displayDesc" class="qh-loading__desc">{{ displayDesc }}</div>
    </div>
  </div>
</template>

<style scoped>
.qh-loading--block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 16px;
}
.qh-loading--inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
}
.qh-loading__spinner {
  display: flex;
  gap: 4px;
}
.qh-loading--inline .qh-loading__spinner {
  transform: scale(0.6);
}
.qh-loading__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5450dc;
  animation: qh-loading-bounce 1.4s infinite ease-in-out both;
}
.qh-loading__dot:nth-child(1) { animation-delay: -0.32s; }
.qh-loading__dot:nth-child(2) { animation-delay: -0.16s; }
@keyframes qh-loading-bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}
.qh-loading__title {
  font-size: 14px;
  font-weight: 500;
  color: #1f1f1f;
}
.qh-loading__desc {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}
</style>
