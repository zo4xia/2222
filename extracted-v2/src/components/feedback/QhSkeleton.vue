<script setup>
/**
 * @qh-core LANE=FEEDBACK POINT=SKELETON 骨架屏组件
 * 用法：<QhSkeleton variant="topic|table|card" :rows="5" />
 */
const props = defineProps({
  variant: { type: String, default: 'card' },  // topic | table | card
  rows: { type: Number, default: 3 },
})
</script>

<template>
  <div class="qh-skeleton">
    <template v-if="variant === 'topic'">
      <div class="qh-skeleton__line" style="width: 60%; height: 24px;" />
      <div class="qh-skeleton__line" style="width: 80%; height: 16px;" />
      <div class="qh-skeleton__line" style="width: 75%; height: 16px;" />
    </template>
    <template v-else-if="variant === 'table'">
      <div v-for="i in rows" :key="i" class="qh-skeleton__row">
        <div class="qh-skeleton__cell" style="width: 60px;" />
        <div class="qh-skeleton__cell" style="flex: 1;" />
        <div class="qh-skeleton__cell" style="width: 80px;" />
      </div>
    </template>
    <template v-else>
      <div class="qh-skeleton__line" style="width: 100%; height: 20px;" />
      <div v-for="i in rows" :key="i" class="qh-skeleton__line" style="width: 90%; height: 14px;" />
    </template>
  </div>
</template>

<style scoped>
.qh-skeleton {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.qh-skeleton__line {
  background: linear-gradient(90deg, #f0f0f0 25%, #f5f5f5 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: qh-skeleton-shimmer 1.5s infinite;
  border-radius: 4px;
}
.qh-skeleton__row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.qh-skeleton__cell {
  background: linear-gradient(90deg, #f0f0f0 25%, #f5f5f5 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: qh-skeleton-shimmer 1.5s infinite;
  border-radius: 4px;
  height: 14px;
}
@keyframes qh-skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
