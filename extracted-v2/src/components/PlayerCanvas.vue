<script setup>
/**
 * @qh-core LANE=PLAYER POINT=PLAYER_CANVAS canvas-drawing-editor 画布组件
 *
 * 基于参考实现 https://typsusan-zzz.github.io/canvas-drawing-editor/
 * 用 canvas-drawing-editor Web Component 做画布编辑/导出/快照
 *
 * 不替代现有 rough.js + KaTeX 主渲染层，仅作为：
 * 1. 交付物导出场景的交互式编辑器
 * 2. PNG/JSON 导出工具
 * 3. 小 agent 微调的可视化反馈
 *
 * 用法：
 *   <PlayerCanvas
 *     :rows="deliverable.rows"
 *     :canvas-size="{ width: 1726, height: 980 }"
 *     @export-png="handleExportPng"
 *     @export-json="handleExportJson"
 *   />
 */
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CameraOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue'
import { CANVAS_SIZE } from '../services/stepHandoff.js'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  canvasSize: { type: Object, default: () => CANVAS_SIZE },
  initialData: { type: Object, default: null },
  readonly: { type: Boolean, default: false },
})

const emit = defineEmits(['export-png', 'export-json', 'play-all', 'ready'])

const editorRef = ref(null)
const isReady = ref(false)
const activeRowIndex = ref(-1)

/**
 * 导入 canvas-drawing-editor Web Component
 * 通过动态 import 避免影响主 bundle
 */
let editorLoaded = false
async function loadEditorModule() {
  if (editorLoaded) return
  try {
    await import('canvas-drawing-editor')
    editorLoaded = true
  } catch (err) {
    console.error('[PlayerCanvas] 加载 canvas-drawing-editor 失败:', err)
    message.warning('canvas-drawing-editor 加载失败，请检查依赖')
  }
}

onMounted(async () => {
  await loadEditorModule()
  // 等待 Web Component 注册并实例化
  setTimeout(() => {
    if (editorRef.value) {
      isReady.value = true
      emit('ready', editorRef.value)
      // 如有 initial data 则注入
      if (props.initialData) {
        injectInitialData(props.initialData)
      }
    }
  }, 100)
})

onBeforeUnmount(() => {
  isReady.value = false
})

watch(() => props.initialData, (newVal) => {
  if (newVal && isReady.value) {
    injectInitialData(newVal)
  }
})

function injectInitialData(data) {
  if (!editorRef.value) return
  try {
    editorRef.value.setAttribute('initial-data', JSON.stringify(data))
  } catch (err) {
    console.warn('[PlayerCanvas] 注入数据失败:', err)
  }
}

function handleExportPng() {
  if (!editorRef.value?.exportPNG) {
    message.warning('编辑器未就绪')
    return
  }
  editorRef.value.exportPNG(`board-${Date.now()}.png`)
  emit('export-png')
  message.success('PNG 已导出')
}

function handleExportJson() {
  if (!editorRef.value?.exportJSON) {
    message.warning('编辑器未就绪')
    return
  }
  const data = editorRef.value.exportJSON()
  emit('export-json', data)
  message.success('JSON 已导出')
}

async function handlePlayAll() {
  if (!props.rows?.length) {
    message.warning('暂无可播放的 rows')
    return
  }
  emit('play-all')
  // 简化版：按 row 顺序高亮显示
  for (let i = 0; i < props.rows.length; i++) {
    activeRowIndex.value = i
    const row = props.rows[i]
    const duration = row.estimatedDurationMs || 2000
    await new Promise(r => setTimeout(r, duration))
  }
  activeRowIndex.value = -1
  message.success('播放完成')
}

function handleClear() {
  if (!editorRef.value?.clearCanvas) return
  editorRef.value.clearCanvas()
  message.success('画布已清空')
}
</script>

<template>
  <div class="player-canvas">
    <div class="player-canvas__toolbar">
      <a-button-group>
        <a-button @click="handleExportPng" :disabled="!isReady">
          <template #icon><camera-outlined /></template>
          导出 PNG
        </a-button>
        <a-button @click="handleExportJson" :disabled="!isReady">
          <template #icon><download-outlined /></template>
          导出 JSON
        </a-button>
        <a-button @click="handlePlayAll" :disabled="!rows.length">
          <template #icon><play-circle-outlined /></template>
          播放全部
        </a-button>
        <a-button v-if="!readonly" @click="handleClear" :disabled="!isReady">
          <template #icon><reload-outlined /></template>
          清空
        </a-button>
      </a-button-group>
      <div class="player-canvas__meta">
        <span>{{ canvasSize.width }} × {{ canvasSize.height }} px</span>
        <span class="divider">·</span>
        <span>{{ rows.length }} 行</span>
      </div>
    </div>
    <div class="player-canvas__editor">
      <canvas-drawing-editor
        ref="editorRef"
        title="板书画布"
        lang="zh"
        theme-color="#5450dc"
        :enable-hotzone="false"
        :tool-config="JSON.stringify({
          pencil: !readonly,
          rectangle: !readonly,
          circle: !readonly,
          line: !readonly,
          arrow: !readonly,
          text: !readonly,
          image: !readonly,
          clear: !readonly,
          download: true,
          exportJson: true,
          zoom: true,
          layers: true,
          undoRedo: !readonly,
          select: true,
        })"
        style="width: 100%; height: 100%; background: #fff;"
      />
      <div v-if="!isReady" class="player-canvas__loading">
        <a-spin tip="画布加载中..." />
      </div>
    </div>
    <div v-if="rows.length" class="player-canvas__rows">
      <div
        v-for="(row, idx) in rows"
        :key="idx"
        :class="['player-canvas__row', { active: idx === activeRowIndex }]"
        @click="activeRowIndex = idx"
      >
        <span class="stage">{{ row.stage }}</span>
        <span class="speech">{{ (row.speech || '').slice(0, 60) }}{{ (row.speech || '').length > 60 ? '...' : '' }}</span>
        <span v-if="row.estimatedDurationMs" class="duration">
          {{ Math.round(row.estimatedDurationMs / 100) / 10 }}s
        </span>
      </div>
    </div>
  </div>
</template>

<script>
// 仅导出组件元信息（脚本逻辑在 script setup 中）
export default {
  name: 'PlayerCanvas',
}
</script>

<style scoped>
.player-canvas {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.player-canvas__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
}
.player-canvas__meta {
  font-size: 12px;
  color: #888;
  display: flex;
  gap: 6px;
}
.player-canvas__meta .divider {
  color: #ccc;
}
.player-canvas__editor {
  flex: 1;
  position: relative;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  overflow: hidden;
  min-height: 400px;
  background: #fff;
}
.player-canvas__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.8);
}
.player-canvas__rows {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 8px;
}
.player-canvas__row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s;
}
.player-canvas__row:hover {
  background: #f5f5f5;
}
.player-canvas__row.active {
  background: #f0f0ff;
}
.player-canvas__row .stage {
  flex: 0 0 60px;
  font-weight: 600;
  color: #5450dc;
}
.player-canvas__row .speech {
  flex: 1;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-canvas__row .duration {
  flex: 0 0 40px;
  text-align: right;
  color: #999;
}
</style>
