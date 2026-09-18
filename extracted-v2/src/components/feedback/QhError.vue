<script setup>
/**
 * @qh-core LANE=FEEDBACK POINT=ERROR 错误状态组件
 * 用法：<QhError title="" message="" :retry="handleRetry" />
 */
defineProps({
  title: { type: String, default: '加载失败' },
  message: { type: String, default: '' },
  retry: { type: Function, default: null },
})
const emit = defineEmits(['retry'])
</script>

<template>
  <div class="qh-error">
    <div class="qh-error__icon">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="20" stroke="#ff4d4f" stroke-width="2" fill="#fff1f0"/>
        <line x1="16" y1="16" x2="32" y2="32" stroke="#ff4d4f" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="32" y1="16" x2="16" y2="32" stroke="#ff4d4f" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="qh-error__title">{{ title }}</div>
    <div v-if="message" class="qh-error__message">{{ message }}</div>
    <button v-if="retry" class="qh-error__retry" @click="emit('retry')">
      重试
    </button>
  </div>
</template>

<style scoped>
.qh-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  gap: 12px;
  text-align: center;
}
.qh-error__title {
  font-size: 14px;
  font-weight: 500;
  color: #ff4d4f;
}
.qh-error__message {
  font-size: 12px;
  color: #666;
  max-width: 320px;
  word-break: break-word;
}
.qh-error__retry {
  padding: 6px 16px;
  background: #5450dc;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.qh-error__retry:hover {
  background: #3d3ab8;
}
</style>
