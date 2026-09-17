<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  BOARD_LAYOUT,
  limitTopicImageHeightPct,
  pctBox,
} from '../utils/boardLayout'
import { renderProblemHtml } from '../utils/mathText'
import { buildGridLines } from '../utils/canvasCoords'
// 画布参数唯一真源：src/services/stepHandoff.js
import { QUESTION_FONT_SIZE, CANVAS_SIZE } from '../services/stepHandoff.js'

const props = defineProps({
  problemText: { type: String, default: '' },
  boardPlan: { type: Object, default: null },
  topicLayout: { type: Object, default: null },
  showGrid: { type: Boolean, default: false },
  showAllLabels: { type: Boolean, default: false },
  showZoneGuides: { type: Boolean, default: false },
  sourceImageUrl: { type: String, default: '' },
  keepOriginal: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
})

const emit = defineEmits([
  'topic-measured',
  'update:topic-layout',
  'layout-change',
  'update:problem-text',
  'problem-text-change',
])
const layerRef = ref(null)
const topicContentRef = ref(null)
const grid = buildGridLines()
let topicObserver = null

// 本地可拖拽文本块坐标、文本内容与尺寸状态管理
const localBlockCoords = reactive(new Map())
const localBlockTexts = reactive(new Map())
const localBlockWidths = reactive(new Map())
const blockRealSizes = reactive(new Map())
const activeDrag = ref(null)
const activeResize = ref(null)
const editingBlockId = ref(null)
const editingText = ref('')
const editTextareaRef = ref(null)
const hoveredBlockId = ref(null)
const isEmittingProblemText = ref(false)
const blockElementObservers = new Map()

const plan = computed(() => {
  const base = {
    topicLabel: props.topicLayout?.topicLabel || props.boardPlan?.topicLabel || BOARD_LAYOUT.topicLabel,
    question: props.topicLayout?.question || props.boardPlan?.question || BOARD_LAYOUT.question,
    image: props.topicLayout?.image || props.boardPlan?.image || null,
    analysisLabel: props.boardPlan?.analysisLabel || BOARD_LAYOUT.analysisLabel,
    analysis: props.boardPlan?.analysis || BOARD_LAYOUT.analysis,
    solutionLabel: props.boardPlan?.solutionLabel || BOARD_LAYOUT.solutionLabel,
    solution: props.boardPlan?.solution || BOARD_LAYOUT.solution,
    summaryLabel: props.boardPlan?.summaryLabel || BOARD_LAYOUT.summaryLabel,
    summary: props.boardPlan?.summary || BOARD_LAYOUT.summary,
  }
  return base
})

// 将题目文本拆分为识别出的文本块（支持单文本块和多文本段落块）
const identifiedBlocks = computed(() => {
  const text = String(props.problemText || '').trim()
  if (!text && localBlockTexts.size === 0) return []

  // 若上游传入了显式的 blocks 列表，优先复用
  if (Array.isArray(props.topicLayout?.blocks) && props.topicLayout.blocks.length > 0) {
    return props.topicLayout.blocks.map((b, idx) => {
      const blockId = b.id || `tb-${idx}`
      const savedCoord = localBlockCoords.get(blockId)
      const currentText = localBlockTexts.has(blockId) ? localBlockTexts.get(blockId) : (b.text || '')
      const currentW = localBlockWidths.has(blockId) ? localBlockWidths.get(blockId) : (b.w ?? plan.value.question.w)
      return {
        id: blockId,
        text: currentText,
        html: renderProblemHtml(currentText),
        x: savedCoord?.x ?? (b.x ?? plan.value.question.x),
        y: savedCoord?.y ?? (b.y ?? plan.value.question.y + idx * 7.5),
        w: currentW,
        fontSize: b.fontSize ?? plan.value.question.fontSize ?? QUESTION_FONT_SIZE,
      }
    })
  }

  // 默认按换行切分段落文本块；若只有一段则为单块
  const rawSegments = text ? text.split(/\n+/).map(s => s.trim()).filter(Boolean) : []
  const segments = rawSegments.length > 0 ? rawSegments : (text ? [text] : [])

  return segments.map((seg, idx) => {
    const blockId = `block-${idx}`
    const savedCoord = localBlockCoords.get(blockId)
    const currentText = localBlockTexts.has(blockId) ? localBlockTexts.get(blockId) : seg
    const currentW = localBlockWidths.has(blockId) ? localBlockWidths.get(blockId) : plan.value.question.w
    const defaultY = +(plan.value.question.y + idx * 8.2).toFixed(1)
    return {
      id: blockId,
      text: currentText,
      html: renderProblemHtml(currentText),
      x: savedCoord?.x ?? plan.value.question.x,
      y: savedCoord?.y ?? defaultY,
      w: currentW,
      fontSize: plan.value.question.fontSize || QUESTION_FONT_SIZE,
    }
  })
})

// 监听外部 topicLayout 的变更并同步到本地坐标与宽度映射
watch(() => props.topicLayout, (newLayout) => {
  if (!newLayout) return
  if (Array.isArray(newLayout.blocks)) {
    newLayout.blocks.forEach((b, idx) => {
      const blockId = b.id || `block-${idx}`
      if (b.x != null && b.y != null) {
        localBlockCoords.set(blockId, { x: Number(b.x), y: Number(b.y) })
      }
      if (b.w != null && !localBlockWidths.has(blockId)) {
        localBlockWidths.set(blockId, Number(b.w))
      }
    })
  } else if (newLayout.question) {
    localBlockCoords.set('block-0', { x: Number(newLayout.question.x), y: Number(newLayout.question.y) })
    if (newLayout.question.w != null && !localBlockWidths.has('block-0')) {
      localBlockWidths.set('block-0', Number(newLayout.question.w))
    }
  }
  if (newLayout.image) {
    localBlockCoords.set('topic-image', { x: Number(newLayout.image.x), y: Number(newLayout.image.y) })
  }
  if (newLayout.topicLabel) {
    localBlockCoords.set('topic-label', { x: Number(newLayout.topicLabel.x), y: Number(newLayout.topicLabel.y) })
  }
}, { immediate: true, deep: true })

// 监听外部 problemText 变更：若非自身发出且非正在编辑，同步重置
watch(() => props.problemText, () => {
  if (isEmittingProblemText.value) {
    isEmittingProblemText.value = false
    return
  }
  if (!editingBlockId.value) {
    localBlockTexts.clear()
  }
})

const showExtraLabels = computed(() => props.showAllLabels || Boolean(props.boardPlan?.analysisLabel))
const topicImageMaxHeight = computed(() => limitTopicImageHeightPct(plan.value.image))

// 拖拽处理：支持鼠标/触控拖动任意文本块或原题图/标签
function startDrag(e, targetType, targetId, initialX, initialY) {
  if (!props.draggable) return
  // 如果当前文本块正处于编辑状态，且点击在其内部，不拦截拖拽以允许文本选择
  if (editingBlockId.value === targetId) return

  e.preventDefault()
  e.stopPropagation()

  const layer = layerRef.value
  if (!layer) return
  const layerRect = layer.getBoundingClientRect()
  if (!layerRect.width || !layerRect.height) return

  activeDrag.value = {
    targetType, // 'textBlock' | 'image' | 'label'
    targetId,
    startPointerX: e.clientX,
    startPointerY: e.clientY,
    initialX: Number(initialX),
    initialY: Number(initialY),
    currentX: Number(initialX),
    currentY: Number(initialY),
    layerWidth: layerRect.width,
    layerHeight: layerRect.height,
    hasMoved: false,
  }

  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e) {
  const drag = activeDrag.value
  if (!drag) return
  e.preventDefault()

  const dist = Math.hypot(e.clientX - drag.startPointerX, e.clientY - drag.startPointerY)
  if (dist > 3) {
    drag.hasMoved = true
  }

  const deltaXPct = ((e.clientX - drag.startPointerX) / drag.layerWidth) * 100
  const deltaYPct = ((e.clientY - drag.startPointerY) / drag.layerHeight) * 100

  // 限制在画布安全视口内（0.5% ~ 92%）
  const newX = Math.max(0.5, Math.min(92, +(drag.initialX + deltaXPct).toFixed(1)))
  const newY = Math.max(0.5, Math.min(92, +(drag.initialY + deltaYPct).toFixed(1)))

  drag.currentX = newX
  drag.currentY = newY

  localBlockCoords.set(drag.targetId, { x: newX, y: newY })
}

function onPointerUp() {
  const drag = activeDrag.value
  if (!drag) return

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)

  const wasClick = !drag.hasMoved
  const targetId = drag.targetId
  const targetType = drag.targetType
  const finalX = drag.currentX
  const finalY = drag.currentY

  activeDrag.value = null

  // 若为普通点击文本块，触发直接在画布上进入编辑状态！
  if (wasClick && targetType === 'textBlock') {
    const targetBlock = identifiedBlocks.value.find(b => b.id === targetId)
    if (targetBlock) {
      enterEdit(targetBlock)
      return
    }
  }

  localBlockCoords.set(targetId, { x: finalX, y: finalY })
  syncAll()
}

// 宽度拉伸调整（实时改变拖拽块的尺寸）
function startResize(e, blockId, initialW) {
  e.preventDefault()
  e.stopPropagation()

  const layer = layerRef.value
  if (!layer) return
  const layerRect = layer.getBoundingClientRect()
  if (!layerRect.width) return

  activeResize.value = {
    blockId,
    startPointerX: e.clientX,
    initialW: Number(initialW || plan.value.question.w),
    layerWidth: layerRect.width,
  }

  window.addEventListener('pointermove', onResizeMove, { passive: false })
  window.addEventListener('pointerup', onResizeUp)
  window.addEventListener('pointercancel', onResizeUp)
}

function onResizeMove(e) {
  const res = activeResize.value
  if (!res) return
  e.preventDefault()

  const deltaXPct = ((e.clientX - res.startPointerX) / res.layerWidth) * 100
  const newW = Math.max(15, Math.min(95, +(res.initialW + deltaXPct).toFixed(1)))
  localBlockWidths.set(res.blockId, newW)

  if (editingBlockId.value === res.blockId) {
    autoGrowTextarea()
  }
}

function onResizeUp() {
  const res = activeResize.value
  if (!res) return

  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
  window.removeEventListener('pointercancel', onResizeUp)

  activeResize.value = null
  syncAll()
}

// 进入编辑状态
function enterEdit(block) {
  if (editingBlockId.value === block.id) return
  editingBlockId.value = block.id
  const currentText = localBlockTexts.get(block.id) ?? block.text ?? ''
  editingText.value = currentText

  nextTick(() => {
    autoGrowTextarea()
    if (editTextareaRef.value) {
      editTextareaRef.value.focus()
      const len = editTextareaRef.value.value.length
      editTextareaRef.value.setSelectionRange(len, len)
    }
  })
}

// 自动撑开 textarea 高度，让拖拽块尺寸实时包裹最新文本内容
function autoGrowTextarea() {
  const textarea = editTextareaRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.max(36, textarea.scrollHeight)}px`
}

// 实时修改题目文本内容
function onBlockInput(blockId) {
  autoGrowTextarea()
  localBlockTexts.set(blockId, editingText.value)
  syncAll()
}

// 完成编辑
function finishEdit() {
  if (!editingBlockId.value) return
  editingBlockId.value = null
  syncAll()
  nextTick(measureTopic)
}

function onTextareaBlur() {
  setTimeout(() => {
    if (editingBlockId.value) {
      finishEdit()
    }
  }, 140)
}

// 同步题目内容与布局至父组件及本地持久化
function syncAll() {
  const blocks = identifiedBlocks.value

  // 1. 拼接所有文本块内容生成完整题目字符串
  if (blocks && blocks.length > 0) {
    const fullText = blocks
      .map(b => (localBlockTexts.has(b.id) ? localBlockTexts.get(b.id) : b.text))
      .join('\n')

    isEmittingProblemText.value = true
    emit('update:problem-text', fullText)
    emit('problem-text-change', fullText)
    try {
      localStorage.setItem('qinghuabu.problemText', fullText)
    } catch (err) { console.warn('[empty-catch:src/components/BoardContentLayer.vue]', err?.message || err) }
  }

  // 2. 构建最新的 updatedLayout
  const updatedLayout = JSON.parse(JSON.stringify(props.topicLayout || {}))
  if (blocks && blocks.length > 0) {
    const updatedBlocks = blocks.map(b => ({
      id: b.id,
      text: localBlockTexts.has(b.id) ? localBlockTexts.get(b.id) : b.text,
      x: localBlockCoords.get(b.id)?.x ?? b.x,
      y: localBlockCoords.get(b.id)?.y ?? b.y,
      w: localBlockWidths.get(b.id) ?? b.w,
      fontSize: b.fontSize,
    }))
    updatedLayout.blocks = updatedBlocks

    if (updatedBlocks[0]) {
      updatedLayout.question = {
        ...(updatedLayout.question || plan.value.question),
        x: updatedBlocks[0].x,
        y: updatedBlocks[0].y,
        w: updatedBlocks[0].w,
      }
    }
  }

  // 同步四个角标拖拽后的最新坐标
  const badgeTargets = ['topic', 'analysis', 'solution', 'summary']
  for (const t of badgeTargets) {
    const targetId = `${t}-label`
    if (localBlockCoords.has(targetId)) {
      const c = localBlockCoords.get(targetId)
      const labelKey = `${t}Label`
      updatedLayout[labelKey] = {
        ...(updatedLayout[labelKey] || plan.value[labelKey] || BOARD_LAYOUT[labelKey]),
        x: c.x,
        y: c.y,
      }
    }
  }

  try {
    localStorage.setItem('qinghuabu.topicLayout', JSON.stringify(updatedLayout))
  } catch (err) { console.warn('[empty-catch:src/components/BoardContentLayer.vue]', err?.message || err) }

  emit('update:topic-layout', updatedLayout)
  emit('layout-change', updatedLayout)

  nextTick(measureTopic)
}

// 观察单个 block 元素的实际渲染尺寸，实现实时测量
function setBlockElementRef(el, blockId) {
  if (!el) {
    const prevObs = blockElementObservers.get(blockId)
    if (prevObs) {
      prevObs.disconnect()
      blockElementObservers.delete(blockId)
    }
    return
  }

  if (blockId === 'block-0' || blockId === identifiedBlocks.value[0]?.id) {
    topicContentRef.value = el
  }

  if (!blockElementObservers.has(blockId)) {
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect()
        const layer = layerRef.value
        const layerRect = layer ? layer.getBoundingClientRect() : null
        const layerW = layerRect?.width || CANVAS_SIZE.width
        const layerH = layerRect?.height || CANVAS_SIZE.height

        blockRealSizes.set(blockId, {
          wPx: Math.round(rect.width),
          hPx: Math.round(rect.height),
          wPct: Number(((rect.width / layerW) * 100).toFixed(1)),
          hPct: Number(((rect.height / layerH) * 100).toFixed(1)),
        })
      }
      measureTopic()
    })
    obs.observe(el)
    blockElementObservers.set(blockId, obs)
  }
}

function getBlockSizeText(blockId) {
  const size = blockRealSizes.get(blockId)
  const widthVal = localBlockWidths.get(blockId) ?? identifiedBlocks.value.find(b => b.id === blockId)?.w ?? plan.value.question.w
  if (size) {
    return `宽 ${widthVal}% (${size.wPx}px) × 高 ${size.hPx}px`
  }
  return `宽 ${widthVal}%`
}

function onMouseLeaveBlock(id) {
  if (hoveredBlockId.value === id) {
    hoveredBlockId.value = null
  }
}

function getBlockStyle(block) {
  const coord = localBlockCoords.get(block.id) || { x: block.x, y: block.y }
  const widthVal = localBlockWidths.get(block.id) ?? block.w
  return {
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    width: `${widthVal}%`,
    fontSize: `calc(${block.fontSize || 30} * 1cqw / 17.26)`,
  }
}

function getImageStyle() {
  const coord = localBlockCoords.get('topic-image') || { x: plan.value.image?.x ?? 6, y: plan.value.image?.y ?? 13.2 }
  return {
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    width: `${plan.value.image?.w ?? 38}%`,
    maxHeight: topicImageMaxHeight.value + '%',
  }
}

function getBadgeStyle(target) {
  const labelKey = `${target}Label`
  const defaultBox = plan.value[labelKey] || BOARD_LAYOUT[labelKey] || { x: 5, y: 5, w: 7.1 }
  const targetId = `${target}-label`
  const coord = localBlockCoords.get(targetId) || { x: defaultBox.x, y: defaultBox.y }
  return {
    left: `${coord.x}%`,
    top: `${coord.y}%`,
    width: `${defaultBox.w ?? 7.1}%`,
  }
}

function getLabelStyle() {
  return getBadgeStyle('topic')
}

function measureTopic() {
  const layer = layerRef.value
  const topic = topicContentRef.value
  if (!layer || !topic) return

  const layerRect = layer.getBoundingClientRect()
  const topicRect = topic.getBoundingClientRect()
  if (!layerRect.height) return

  emit('topic-measured', {
    bottomPct: Number((((topicRect.bottom - layerRect.top) / layerRect.height) * 100).toFixed(2)),
    heightPct: Number(((topicRect.height / layerRect.height) * 100).toFixed(2)),
  })
}

function observeTopic() {
  topicObserver?.disconnect()
  topicObserver = null
  if (!topicContentRef.value) return

  topicObserver = new ResizeObserver(measureTopic)
  topicObserver.observe(topicContentRef.value)
  measureTopic()
}

onMounted(() => nextTick(observeTopic))
watch(
  () => [props.problemText, props.sourceImageUrl, props.keepOriginal, props.topicLayout, props.boardPlan],
  () => nextTick(observeTopic),
  { deep: true },
)
onBeforeUnmount(() => {
  topicObserver?.disconnect()
  blockElementObservers.forEach((obs) => obs.disconnect())
  blockElementObservers.clear()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
  window.removeEventListener('pointercancel', onResizeUp)
})
</script>

<template>
  <div ref="layerRef" class="board-content-layer" data-board-layer="L2">
    <!-- 四个角标 (支持鼠标直接拖拽排版) -->
    <div
      v-if="problemText.trim() || showExtraLabels"
      id="badge-topic"
      class="badge board-item label draggable-item"
      data-target="topic"
      :class="{ 'is-dragging': activeDrag?.targetId === 'topic-label' }"
      :style="getBadgeStyle('topic')"
      title="拖动调整「题目」角标位置"
      @pointerdown="startDrag($event, 'label', 'topic-label', localBlockCoords.get('topic-label')?.x ?? plan.topicLabel.x, localBlockCoords.get('topic-label')?.y ?? plan.topicLabel.y)"
    >
      <img src="/topic.png" onerror="this.src='https://i.ibb.co/bMwPqBpN/topic.png'" alt="题目" draggable="false" />
      <div v-if="activeDrag?.targetId === 'topic-label'" class="coord-badge">
        {{ activeDrag.currentX.toFixed(1) }}%, {{ activeDrag.currentY.toFixed(1) }}%
      </div>
    </div>

    <!-- 原题图片：支持拖拽 -->
    <div
      v-if="keepOriginal && sourceImageUrl && plan.image"
      ref="topicContentRef"
      class="board-item topic-image draggable-item"
      :class="{ 'is-dragging': activeDrag?.targetId === 'topic-image' }"
      :style="getImageStyle()"
      title="按住鼠标可自由拖拽原题图"
      @pointerdown="startDrag($event, 'image', 'topic-image', localBlockCoords.get('topic-image')?.x ?? plan.image.x, localBlockCoords.get('topic-image')?.y ?? plan.image.y)"
    >
      <img :src="sourceImageUrl" alt="原题" draggable="false" @load="measureTopic" />
      <div v-if="activeDrag?.targetId === 'topic-image'" class="coord-badge">
        {{ activeDrag.currentX.toFixed(1) }}%, {{ activeDrag.currentY.toFixed(1) }}%
      </div>
    </div>

    <!-- 每一个识别出的文本块：点击进入编辑、自由拖拽与实时尺寸更新 -->
    <template v-if="problemText.trim() && !(keepOriginal && sourceImageUrl)">
      <div
        v-for="block in identifiedBlocks"
        :key="block.id"
        :ref="el => setBlockElementRef(el, block.id)"
        class="board-item topic-text draggable-item"
        :class="{
          'is-dragging': activeDrag?.targetId === block.id,
          'is-editing': editingBlockId === block.id,
          'is-resizing': activeResize?.blockId === block.id,
        }"
        :style="getBlockStyle(block)"
        data-board-region="question"
        data-typography="approved-printed-question"
        :title="editingBlockId === block.id ? '正在编辑题目文字' : '按住拖动布局 / 单击进入画布编辑'"
        @mouseenter="hoveredBlockId = block.id"
        @mouseleave="onMouseLeaveBlock(block.id)"
        @dblclick="enterEdit(block)"
        @pointerdown="startDrag($event, 'textBlock', block.id, localBlockCoords.get(block.id)?.x ?? block.x, localBlockCoords.get(block.id)?.y ?? block.y)"
      >
        <!-- 拖拽与点击编辑把手提示 -->
        <div class="drag-handle-hint" title="可按住拖拽排版 / 单击进入编辑">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
          </svg>
          <span class="hint-text">拖动 / 单击编辑</span>
        </div>

        <!-- 悬停时快捷操作栏与尺寸实时反馈 -->
        <div
          v-if="editingBlockId !== block.id && hoveredBlockId === block.id"
          class="block-hover-toolbar"
          @pointerdown.stop
        >
          <button
            class="action-pill-btn edit-btn"
            title="点击直接在画布上修改题目文字"
            @pointerdown.stop.prevent="enterEdit(block)"
          >
            ✏️ 编辑文字
          </button>
          <span class="size-tag" title="拖拽块实时尺寸">
            {{ getBlockSizeText(block.id) }}
          </span>
        </div>

        <!-- 编辑模式：内嵌多行文本框（高度根据输入内容实时撑开，边框实时包裹） -->
        <div
          v-if="editingBlockId === block.id"
          class="block-editor-container"
          @pointerdown.stop
        >
          <div class="editor-header">
            <span class="editor-status-badge">✏️ 正在编辑题目内容</span>
            <span class="editor-size-badge" title="拖拽块实时尺寸">{{ getBlockSizeText(block.id) }}</span>
            <button
              class="save-btn"
              title="完成并保存修改 (或按 Esc)"
              @pointerdown.stop.prevent="finishEdit"
            >
              ✓ 完成
            </button>
          </div>
          <textarea
            ref="editTextareaRef"
            v-model="editingText"
            class="inline-block-textarea"
            placeholder="直接在画布上修改题目文字..."
            rows="1"
            @input="onBlockInput(block.id)"
            @keydown.esc="finishEdit"
            @blur="onTextareaBlur"
          />
        </div>

        <!-- 浏览展示模式：排版并渲染数学公式与符号 -->
        <div v-else class="block-content-body" v-html="block.html" />

        <!-- 拖动坐标指示 -->
        <div v-if="activeDrag?.targetId === block.id" class="coord-badge">
          X: {{ activeDrag.currentX.toFixed(1) }}% | Y: {{ activeDrag.currentY.toFixed(1) }}%
          <span class="coord-size-sub">({{ getBlockSizeText(block.id) }})</span>
        </div>

        <!-- 右侧宽度调整手柄：拉伸改变拖拽块尺寸，并实时重排文字 -->
        <div
          class="block-resize-handle"
          title="左右拖动调节拖拽块宽度"
          @pointerdown.stop="startResize($event, block.id, localBlockWidths.get(block.id) ?? block.w)"
        >
          <div class="resize-handle-bar" />
        </div>
      </div>
    </template>

    <template v-if="showExtraLabels">
      <div
        id="badge-analysis"
        class="badge board-item label draggable-item"
        data-target="analysis"
        :class="{ 'is-dragging': activeDrag?.targetId === 'analysis-label' }"
        :style="getBadgeStyle('analysis')"
        title="拖动调整「分析」角标位置"
        @pointerdown="startDrag($event, 'label', 'analysis-label', localBlockCoords.get('analysis-label')?.x ?? plan.analysisLabel.x, localBlockCoords.get('analysis-label')?.y ?? plan.analysisLabel.y)"
      >
        <img src="/analysis.png" onerror="this.src='https://i.ibb.co/9mHsQPSx/analysis.png'" alt="分析" draggable="false" />
        <div v-if="activeDrag?.targetId === 'analysis-label'" class="coord-badge">
          {{ activeDrag.currentX.toFixed(1) }}%, {{ activeDrag.currentY.toFixed(1) }}%
        </div>
      </div>
      <div
        id="badge-solution"
        class="badge board-item label draggable-item"
        data-target="solution"
        :class="{ 'is-dragging': activeDrag?.targetId === 'solution-label' }"
        :style="getBadgeStyle('solution')"
        title="拖动调整「解答」角标位置"
        @pointerdown="startDrag($event, 'label', 'solution-label', localBlockCoords.get('solution-label')?.x ?? plan.solutionLabel.x, localBlockCoords.get('solution-label')?.y ?? plan.solutionLabel.y)"
      >
        <img src="/solution.png" onerror="this.src='https://i.ibb.co/MxXq10wz/solution.png'" alt="解答" draggable="false" />
        <div v-if="activeDrag?.targetId === 'solution-label'" class="coord-badge">
          {{ activeDrag.currentX.toFixed(1) }}%, {{ activeDrag.currentY.toFixed(1) }}%
        </div>
      </div>
      <div
        id="badge-summary"
        class="badge board-item label draggable-item"
        data-target="summary"
        :class="{ 'is-dragging': activeDrag?.targetId === 'summary-label' }"
        :style="getBadgeStyle('summary')"
        title="拖动调整「总结」角标位置"
        @pointerdown="startDrag($event, 'label', 'summary-label', localBlockCoords.get('summary-label')?.x ?? plan.summaryLabel.x, localBlockCoords.get('summary-label')?.y ?? plan.summaryLabel.y)"
      >
        <img src="/summary.png" onerror="this.src='https://i.ibb.co/Ld4qjwW9/summary.png'" alt="总结" draggable="false" />
        <div v-if="activeDrag?.targetId === 'summary-label'" class="coord-badge">
          {{ activeDrag.currentX.toFixed(1) }}%, {{ activeDrag.currentY.toFixed(1) }}%
        </div>
      </div>
    </template>

    <template v-if="showZoneGuides && showExtraLabels">
      <div class="guide analysis" :style="pctBox(plan.analysis)" />
      <div class="guide solution" :style="pctBox(plan.solution)" />
      <div class="guide summary" :style="pctBox(plan.summary)" />
    </template>

    <div v-if="showGrid" class="grid-layer">
      <div v-for="g in grid.minor" :key="'vm'+g.p" class="grid-line v minor" :style="{ left: g.p + '%' }" />
      <div v-for="g in grid.major" :key="'vM'+g.p" class="grid-line v major" :style="{ left: g.p + '%' }">
        <span class="tick">{{ g.p }}</span>
      </div>
      <div v-for="g in grid.minor" :key="'hm'+g.p" class="grid-line h minor" :style="{ top: g.p + '%' }" />
      <div v-for="g in grid.major" :key="'hM'+g.p" class="grid-line h major" :style="{ top: g.p + '%' }">
        <span class="tick y">{{ g.p }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-content-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: transparent;
  pointer-events: none;
}
.board-item { position: absolute; z-index: 3; }
.badge { display: block; }
.label img, .badge img { display: block; width: 100%; height: auto; pointer-events: none; }
.topic-image { overflow: hidden; z-index: 3; background: transparent; }
.topic-image img {
  display: block; width: 100%; max-height: 100%; object-fit: contain;
  object-position: left top;
  filter: grayscale(1) contrast(1.05); pointer-events: none;
}
.topic-text {
  /* line-height 1.65 = 题目区印刷体行高，真源 src/services/stepHandoff.js QUESTION_LINE_HEIGHT */
  z-index: 4; color: #1f1f1f; line-height: 1.65; white-space: pre-wrap; word-break: break-word;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; font-weight: 500;
}
.topic-text :deep(.katex) { font-size: 1.0em; }

/* 可拖拽文本块及元素的交互视觉 */
.draggable-item {
  pointer-events: auto;
  cursor: grab;
  user-select: none;
  touch-action: none;
  border-radius: 6px;
  border: 1.5px dashed transparent;
  transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  position: absolute;
}
.draggable-item:hover {
  border-color: rgba(37, 99, 235, 0.5);
  background: rgba(37, 99, 235, 0.035);
}
.draggable-item:hover .drag-handle-hint {
  opacity: 1;
}
.draggable-item.is-dragging {
  cursor: grabbing;
  z-index: 99 !important;
  border-color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.22);
}
.draggable-item.is-resizing {
  cursor: ew-resize;
  z-index: 99 !important;
  border-color: #0284c7;
  background: rgba(2, 132, 199, 0.06);
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.18);
}
.draggable-item.is-editing {
  cursor: default;
  user-select: text;
  z-index: 100 !important;
  border: 2px solid #2563eb !important;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.98) !important;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18), 0 10px 28px rgba(0, 0, 0, 0.14);
  padding: 8px 10px;
}

.drag-handle-hint {
  position: absolute;
  top: -20px;
  left: -2px;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  padding: 1px 5px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.drag-handle-hint .hint-text {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.draggable-item.is-editing .drag-handle-hint {
  display: none;
}

/* 悬停快捷工具条 */
.block-hover-toolbar {
  position: absolute;
  top: -24px;
  right: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 20;
  pointer-events: auto;
}
.action-pill-btn {
  background: #ffffff;
  border: 1px solid #93c5fd;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.14);
  transition: all 0.15s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 3px;
}
.action-pill-btn:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  transform: translateY(-1px);
}
.size-tag {
  font-size: 10px;
  color: #475569;
  background: rgba(248, 250, 252, 0.95);
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 2px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 内嵌编辑容器 */
.block-editor-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
  user-select: none;
}
.editor-status-badge {
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 2px 6px;
  border-radius: 4px;
}
.editor-size-badge {
  font-size: 11px;
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, monospace;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}
.save-btn {
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);
}
.save-btn:hover {
  background: #1d4ed8;
}

/* 内嵌无边框文本框 */
.inline-block-textarea {
  width: 100%;
  border: none;
  background: transparent;
  padding: 2px 0;
  resize: none;
  overflow: hidden;
  font-family: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  color: #0f172a;
  outline: none;
  box-sizing: border-box;
}
.inline-block-textarea::placeholder {
  color: #94a3b8;
  font-weight: normal;
}

/* 拖拽块右侧拉伸调整手柄 */
.block-resize-handle {
  position: absolute;
  right: -7px;
  top: 0;
  bottom: 0;
  width: 14px;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 15;
  touch-action: none;
}
.resize-handle-bar {
  width: 4px;
  height: 38%;
  background: #94a3b8;
  border-radius: 2px;
  transition: all 0.15s ease;
  opacity: 0;
}
.draggable-item:hover .resize-handle-bar,
.draggable-item.is-resizing .resize-handle-bar,
.draggable-item.is-editing .resize-handle-bar {
  opacity: 1;
  background: #2563eb;
  height: 65%;
  box-shadow: 0 0 6px rgba(37, 99, 235, 0.4);
}

.coord-badge {
  position: absolute;
  bottom: -26px;
  left: 0;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #1e40af;
  border-radius: 4px;
  padding: 2px 7px;
  white-space: nowrap;
  pointer-events: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-shadow: 0 4px 10px rgba(30, 64, 175, 0.35);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 5px;
}
.coord-size-sub {
  font-weight: 400;
  opacity: 0.9;
}

.block-content-body {
  pointer-events: none;
  width: 100%;
}

.guide {
  position: absolute; z-index: 2; border: 1px dashed rgba(14,165,233,.35);
  background: transparent; border-radius: 8px; pointer-events: none;
}
.guide.solution { border-color: rgba(16,185,129,.35); }
.guide.summary { border-color: rgba(168,85,247,.35); }
.grid-layer { position: absolute; inset: 0; z-index: 5; pointer-events: none; }
.grid-line { position: absolute; }
.grid-line.v { top: 0; bottom: 0; width: 0; border-left: 1px solid rgba(15,23,42,.05); }
.grid-line.h { left: 0; right: 0; height: 0; border-top: 1px solid rgba(15,23,42,.05); }
.grid-line.major.v { border-left-color: rgba(22,119,255,.22); }
.grid-line.major.h { border-top-color: rgba(22,119,255,.22); }
.tick {
  position: absolute; top: 2px; left: 2px; font-size: 9px; color: #2563eb;
  background: rgba(255,255,255,.7); padding: 0 2px;
}
.tick.y { top: auto; }
</style>

