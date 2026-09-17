<script setup>
/**
 * @qh-core LANE=PLAYER POINT=PLAYER_PAGE 完整 player 页面
 *
 * 双入口接入 canvas-drawing-editor：
 * 1. BoardPreviewApp 内嵌使用（作为可选导出/快照工具）
 * 2. 独立 player.html 入口（替代缺失的 handdraw-player.html）
 *
 * 三栏布局：左侧画布 / 右侧小 agent 对话面板 / 底部步骤列表
 */
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import PlayerCanvas from './PlayerCanvas.vue'
import MicroAgentChat from './MicroAgentChat.vue'
import { api } from '../services/apiClient.js'

const props = defineProps({
  deliverableId: { type: String, default: '' },
  initialDeliverable: { type: Object, default: null },
  showBack: { type: Boolean, default: true },
})

const emit = defineEmits(['back'])

const deliverable = ref(props.initialDeliverable || null)
const loading = ref(!props.initialDeliverable)
const error = ref('')

const rows = computed(() => deliverable.value?.rows || [])

async function loadDeliverable(id) {
  loading.value = true
  error.value = ''
  try {
    const res = await api.deliverable.get(id || undefined)
    if (res.ok && res.deliverable) {
      deliverable.value = res.deliverable
    } else {
      error.value = res.error || '未找到交付物'
    }
  } catch (err) {
    error.value = err.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!props.initialDeliverable) {
    loadDeliverable(props.deliverableId)
  }
})

function handleApplyPatch(patch) {
  message.success(`已应用微调：第${(patch.rowIndex || 0) + 1}行`)
}

function handleUpdateDeliverable(newDeliverable) {
  deliverable.value = newDeliverable
}

function handleBack() {
  emit('back')
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back()
  }
}

function handleExportPng() {
  message.success('PNG 已导出')
}

function handleExportJson(data) {
  message.success('JSON 已导出')
}
</script>

<template>
  <div class="player-page">
    <header class="player-page__header">
      <a-button v-if="showBack" @click="handleBack" type="text">
        <template #icon><arrow-left-outlined /></template>
        返回
      </a-button>
      <h1 class="player-page__title">
        🎬 板书微课演播
        <span class="player-page__subtitle">canvas-drawing-editor + 小 agent 对话微调</span>
      </h1>
      <div class="player-page__actions">
        <a-button @click="loadDeliverable(deliverableId)" :loading="loading">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
    </header>

    <main class="player-page__main">
      <div v-if="loading" class="player-page__loading">
        <a-spin tip="加载交付物..." />
      </div>

      <div v-else-if="error" class="player-page__error">
        <a-empty :description="error">
          <template #image>
            <span style="font-size: 48px;">📦</span>
          </template>
        </a-empty>
      </div>

      <template v-else>
        <div class="player-page__canvas">
          <PlayerCanvas
            :rows="rows"
            :initial-data="deliverable"
            @export-png="handleExportPng"
            @export-json="handleExportJson"
          />
        </div>

        <div class="player-page__chat">
          <MicroAgentChat
            :deliverable="deliverable"
            @apply-patch="handleApplyPatch"
            @update:deliverable="handleUpdateDeliverable"
          />
        </div>
      </template>
    </main>
  </div>
</template>

<script>
// 仅导出组件元信息（脚本逻辑在 script setup 中）
export default {
  name: 'PlayerPage',
}
</script>

<style scoped>
.player-page {
  display: grid;
  grid-template-rows: 56px 1fr;
  height: 100vh;
  background: #f5f5f5;
}
.player-page__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}
.player-page__title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #1f1f1f;
  margin: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.player-page__subtitle {
  font-size: 11px;
  font-weight: 400;
  color: #999;
}
.player-page__actions {
  display: flex;
  gap: 8px;
}
.player-page__main {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 0;
  overflow: hidden;
}
.player-page__canvas {
  padding: 16px;
  overflow: auto;
  background: #fafafa;
}
.player-page__chat {
  background: #fff;
  border-left: 1px solid #e5e5e5;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.player-page__loading,
.player-page__error {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

@media (max-width: 980px) {
  .player-page__main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  .player-page__chat {
    border-left: none;
    border-top: 1px solid #e5e5e5;
    max-height: 320px;
  }
}
</style>
