<script setup>
/**
 * @qh-core LANE=FEEDBACK POINT=EMPTY 空状态组件
 * 用法：<QhEmpty type="no-result|no-history|no-data" description="" />
 */
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'no-data' },
  description: { type: String, default: '' },
})

const TEXT_MAP = {
  'no-result': { title: '暂无识别结果', desc: '请先上传题目图片或输入题文' },
  'no-history': { title: '暂无历史存档', desc: '点击"开始讲题"后会自动保存' },
  'no-deliverable': { title: '暂无交付物', desc: '生成讲题后会自动出现在这里' },
  'no-data': { title: '暂无数据', desc: '' },
  'no-rows': { title: '暂无五字段行', desc: '点击"生成"按钮开始' },
}

const config = computed(() => TEXT_MAP[props.type] || TEXT_MAP['no-data'])
const displayDesc = computed(() => props.description || config.value.desc)
</script>

<template>
  <div class="qh-empty">
    <div class="qh-empty__icon">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <rect x="14" y="10" width="36" height="44" rx="3" stroke="#d9d9d9" stroke-width="2" fill="#fafafa"/>
        <line x1="22" y1="22" x2="42" y2="22" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
        <line x1="22" y1="30" x2="42" y2="30" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
        <line x1="22" y1="38" x2="34" y2="38" stroke="#d9d9d9" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="qh-empty__title">{{ config.title }}</div>
    <div v-if="displayDesc" class="qh-empty__desc">{{ displayDesc }}</div>
    <slot />
  </div>
</template>

<style scoped>
.qh-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 8px;
  text-align: center;
}
.qh-empty__title {
  font-size: 14px;
  font-weight: 500;
  color: #666;
}
.qh-empty__desc {
  font-size: 12px;
  color: #999;
}
</style>
