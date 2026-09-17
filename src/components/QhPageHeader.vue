<script setup>
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'

defineProps({
  stepLabel: { type: String, required: true },
  subtitle: { type: String, required: true },
  showBack: { type: Boolean, default: false },
  currentStep: { type: Number, default: 0 },
})

const emit = defineEmits(['back'])
</script>

<template>
  <a-layout-header class="qh-page-header">
    <div class="qh-brand">
      <a-button v-if="showBack" type="text" title="返回上一步" @click="emit('back')">
        <template #icon><ArrowLeftOutlined /></template>
      </a-button>
      <span class="qh-brand-mark">教学板书</span>
      <a-tag color="processing">{{ stepLabel }}</a-tag>
      <a-typography-text type="secondary">{{ subtitle }}</a-typography-text>
    </div>
    <div v-if="currentStep" class="qh-flow-steps" aria-label="整体流程">
      <span class="qh-flow-step" :class="{ active: currentStep === 1, done: currentStep > 1 }">
        <i class="qh-flow-dot">1</i>贴题识别
      </span>
      <span class="qh-flow-arrow">→</span>
      <span class="qh-flow-step" :class="{ active: currentStep === 2, done: currentStep > 2 }">
        <i class="qh-flow-dot">2</i>生成板书
      </span>
      <span class="qh-flow-arrow">→</span>
      <span class="qh-flow-step" :class="{ active: currentStep === 3 }">
        <i class="qh-flow-dot">3</i>播放页
      </span>
    </div>
    <a-space :size="8">
      <a-button class="qh-player-entry" type="primary" ghost size="small" href="/row-player.html" target="_blank" rel="noopener" title="打开播放页面（row-player）">
        <template #icon><PlayCircleOutlined /></template>
        播放页
      </a-button>
      <slot name="actions" />
    </a-space>
  </a-layout-header>
</template>

<style scoped>
/* 页头遵守全局视觉 token：品牌蓝为唯一强调色，步骤标签改用品牌色系 */
.qh-page-header :deep(.ant-tag) {
  margin-inline-end: 0;
  border-radius: var(--qh-radius-control);
  background: var(--qh-brand-soft);
  border-color: var(--qh-brand-border);
  color: var(--qh-brand);
  font-weight: 600;
}

.qh-page-header :deep(.ant-typography) {
  color: var(--qh-muted);
}

/* 整体流程引导条：① 贴题识别 → ② 生成板书 → ③ 播放页 */
.qh-flow-steps {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 16px;
}

.qh-flow-step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--qh-faint);
  white-space: nowrap;
}

.qh-flow-dot {
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--qh-border);
  font-size: 10px;
  font-weight: 600;
}

.qh-flow-arrow {
  color: var(--qh-border);
  font-size: 12px;
}

.qh-flow-step.active {
  color: var(--qh-brand);
  font-weight: 600;
}

.qh-flow-step.active .qh-flow-dot {
  background: var(--qh-brand);
  border-color: var(--qh-brand);
  color: #fff;
}

.qh-flow-step.done {
  color: var(--qh-muted);
}

.qh-flow-step.done .qh-flow-dot {
  background: var(--qh-brand-soft);
  border-color: var(--qh-brand-border);
  color: var(--qh-brand);
}

@media (max-width: 960px) {
  .qh-flow-steps {
    display: none;
  }
}
</style>
