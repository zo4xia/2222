<script setup>
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons-vue'

defineProps({
  stepLabel: { type: String, required: true },
  subtitle: { type: String, required: true },
  showBack: { type: Boolean, default: false },
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
</style>
