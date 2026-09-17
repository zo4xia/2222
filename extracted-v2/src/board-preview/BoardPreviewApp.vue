<script setup>
/* 教学板书 · 视频素材参数产物单页 / 全屏画布
 * 功能：
 *   1. 锁定 1726 × 980 画布比例，防止任何全屏或缩放畸变
 *   2. 呈现专业级参数框（题目信息、真画布四区落点坐标、讲题五字段时序表、下游流水线 JSON）
 *   3. 与服务端 /api/deliverable 深度接力，持久化文件存档，刷新永久不丢失
 *   4. 支持一键导出 JSON / 口播稿 / 分镜讲义，支持纯沉浸全屏模式切换
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  CheckCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  FileDoneOutlined,
  CompassOutlined,
  TableOutlined,
  CodeOutlined,
  RollbackOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  FundProjectionScreenOutlined,
  PictureOutlined,
  ShareAltOutlined,
  CloseCircleOutlined,
  SoundOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons-vue'
import {
  CANVAS_W as DESIGN_W,
  CANVAS_H as DESIGN_H,
} from '../utils/canvasCoords.js'
import { BOARD_LAYOUT } from '../utils/boardLayout.js'
import { renderProblemHtml } from '../utils/mathText.js'
import {
  exportSpeechMarkdown as doExportSpeechMarkdown,
  exportElementsMarkdown as doExportElementsMarkdown,
} from '../lib/speechMarkdown.js'
import {
  isLiveBoardPreviewUpdate,
  loadLiveBoardPreview,
  saveLiveBoardPreview,
} from './liveBoardPreview.js'

const RealBoardPreview = defineAsyncComponent(() => import('../components/RealBoardPreview.vue'))

const params = new URLSearchParams(window.location.search)

// 模式：'deliverable' (带参数信息单页) 或 'fullscreen' (纯画布沉浸) 或 'canvas' (纯画布背景嵌入模式)
const initialMode = params.get('mode')
const viewMode = ref(
  initialMode === 'canvas' || initialMode === 'embed' || initialMode === 'bg'
    ? 'canvas'
    : initialMode === 'fullscreen'
    ? 'fullscreen'
    : 'deliverable'
)
const loading = ref(false)

// 核心产物数据状态
const projectCode = ref(params.get('id') || '')
const createdAt = ref('')
const filename = ref('')
const problemText = ref('')
const topicLayout = ref(null)
const boardPlan = ref(null)
const sourceImageUrl = ref('')
const keepOriginal = ref(false)
const screenshotUrl = ref('')
const meta = ref({
  problemType: '小学数学题',
  boardFocus: '图文结合',
  gradeLevel: '小学阶段',
  knowledgeTitle: '核心知识点',
  canvasSize: { width: DESIGN_W, height: DESIGN_H },
})
const stats = ref({
  totalDuration: 0,
  totalDurationText: '0秒',
  stepCount: 0,
  charCount: 0,
  actionCount: 0,
})
const checkInfo = ref({
  checkApplied: false,
  changeCount: 0,
  asrPolished: false,
})
const rows = ref([])
const actionSpec = computed(() => rows.value.flatMap((row, rowIndex) => (
  Array.isArray(row?.actionSpec)
    ? row.actionSpec.map((action, actionIndex) => ({
      ...action,
      order: Number.isFinite(action?.order) ? action.order : rowIndex * 1000 + actionIndex,
    }))
    : []
)))

// 界面控制
const showGrid = ref(params.get('showGrid') === '1')
const showLabels = ref(params.get('showLabels') !== '0')
const showZones = ref(params.get('showZones') !== '0')
const activeTab = ref('rows')
const selectedStageFilter = ref('all')

// 全屏浮动工具栏
const showFloatToolbar = ref(true)
let toolbarTimer = null

function pingFloatToolbar() {
  showFloatToolbar.value = true
  clearTimeout(toolbarTimer)
  toolbarTimer = setTimeout(() => {
    showFloatToolbar.value = false
  }, 2500)
}

function onTopicLayoutUpdated(newLayout) {
  topicLayout.value = { ...(topicLayout.value || {}), ...newLayout }
  try {
    saveLiveBoardPreview({
      problemText: problemText.value,
      topicLayout: topicLayout.value,
      boardPlan: boardPlan.value,
      showGrid: showGrid.value,
      showLabels: showLabels.value,
      showZones: showZones.value,
      sourceImageUrl: sourceImageUrl.value,
      keepOriginal: keepOriginal.value,
    })
  } catch (err) { console.warn('[empty-catch:src/board-preview/BoardPreviewApp.vue]', err?.message || err) }
}

function onProblemTextUpdated(newText) {
  problemText.value = newText
  try {
    saveLiveBoardPreview({
      problemText: problemText.value,
      topicLayout: topicLayout.value,
      boardPlan: boardPlan.value,
      showGrid: showGrid.value,
      showLabels: showLabels.value,
      showZones: showZones.value,
      sourceImageUrl: sourceImageUrl.value,
      keepOriginal: keepOriginal.value,
    })
  } catch (err) { console.warn('[empty-catch:src/board-preview/BoardPreviewApp.vue]', err?.message || err) }
}

function applyDeliverablePayload(payload, code = null, created = null) {
  if (!payload) return
  if (code) projectCode.value = code
  else if (payload.projectCode) projectCode.value = payload.projectCode

  if (created) createdAt.value = created
  else if (payload.createdAt) createdAt.value = payload.createdAt

  if (payload.filename) filename.value = payload.filename
  if (payload.problemText != null) problemText.value = payload.problemText
  if (payload.topicLayout) topicLayout.value = payload.topicLayout
  if (payload.boardPlan) boardPlan.value = payload.boardPlan
  if (payload.sourceImageUrl != null) sourceImageUrl.value = payload.sourceImageUrl
  if (payload.keepOriginal != null) keepOriginal.value = Boolean(payload.keepOriginal)
  if (payload.screenshotUrl != null) screenshotUrl.value = payload.screenshotUrl

  if (payload.meta) {
    meta.value = { ...meta.value, ...payload.meta }
  }
  if (payload.stats) {
    stats.value = { ...stats.value, ...payload.stats }
  }
  if (payload.checkInfo) {
    checkInfo.value = { ...checkInfo.value, ...payload.checkInfo }
  }
  if (Array.isArray(payload.rows)) {
    rows.value = payload.rows
  }
}

// 从服务端或本地读取数据（带持久化保证，刷新不丢失）
async function fetchDeliverableData() {
  loading.value = true
  const queryId = params.get('id') || params.get('file')
  const apiUrl = queryId ? `/api/deliverable?id=${encodeURIComponent(queryId)}` : '/api/deliverable'

  try {
    const res = await fetch(apiUrl)
    if (res.ok) {
      const data = await res.json()
      if (data.ok && (data.deliverable || data.rows)) {
        applyDeliverablePayload(data.deliverable || data, data.projectCode, data.createdAt)
        loading.value = false
        return
      }
    }
  } catch (err) {
    console.warn('获取 /api/deliverable 失败，转为本地回退:', err)
  }

  // 服务端若暂无，则尝试回退 localStorage
  const local = loadLiveBoardPreview()
  if (local) {
    applyDeliverablePayload(local)
  }

  // URL fallback
  if (params.get('problemText')) {
    problemText.value = params.get('problemText')
  }
  if (params.get('sourceImage')) {
    sourceImageUrl.value = params.get('sourceImage')
  }

  loading.value = false
}

function onStorage(event) {
  if (isLiveBoardPreviewUpdate(event)) {
    applyDeliverablePayload(loadLiveBoardPreview())
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && viewMode.value === 'fullscreen') {
    viewMode.value = 'deliverable'
  }
}

function handleWindowMessage(event) {
  const data = event.data
  if (!data || typeof data !== 'object') return
  if (data.type === 'SET_DELIVERABLE' || data.type === 'set-deliverable') {
    applyDeliverablePayload(data.payload || data.deliverable)
  } else if (data.type === 'TOGGLE_GRID') {
    showGrid.value = Boolean(data.value)
  } else if (data.type === 'TOGGLE_LABELS') {
    showLabels.value = Boolean(data.value)
  } else if (data.type === 'TOGGLE_ZONES') {
    showZones.value = Boolean(data.value)
  }
}

onMounted(() => {
  fetchDeliverableData()
  pingFloatToolbar()
  window.addEventListener('storage', onStorage)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('message', handleWindowMessage)
  try {
    window.parent?.postMessage({ type: 'BOARD_PREVIEW_CANVAS_READY' }, '*')
  } catch (err) { console.warn('[empty-catch:src/board-preview/BoardPreviewApp.vue]', err?.message || err) }
})

onBeforeUnmount(() => {
  clearTimeout(toolbarTimer)
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('message', handleWindowMessage)
})

// 计算属性
const renderedProblemHtml = computed(() => renderProblemHtml(problemText.value || '暂无题目内容'))

// 舞台长宽比
const canvasAspectRatio = computed(() => `${DESIGN_W} / ${DESIGN_H}`)

// 过滤后的五字段行
const filteredRows = computed(() => {
  if (selectedStageFilter.value === 'all') return rows.value
  return rows.value.filter(r => r.stage === selectedStageFilter.value)
})

// 所有出现的教学阶段
const stageOptions = computed(() => {
  const set = new Set(rows.value.map(r => r.stage).filter(Boolean))
  return ['all', ...Array.from(set)]
})

// 四区绝对坐标与百分比对照
const fourZonesCoords = computed(() => {
  const plan = boardPlan.value || {}
  const layout = topicLayout.value || {}

  const q = plan.question || layout.question || BOARD_LAYOUT.question
  const an = plan.analysis || BOARD_LAYOUT.analysis
  const so = plan.solution || BOARD_LAYOUT.solution
  const sm = plan.summary || BOARD_LAYOUT.summary

  function toPx(pctObj) {
    const x = Number(pctObj.x || 0)
    const y = Number(pctObj.y || 0)
    const w = Number(pctObj.w || 0)
    const h = Number(pctObj.h || 0)
    return {
      xPct: x.toFixed(1) + '%',
      yPct: y.toFixed(1) + '%',
      wPct: w.toFixed(1) + '%',
      hPct: h ? h.toFixed(1) + '%' : '自适应',
      xPx: Math.round((x * DESIGN_W) / 100) + 'px',
      yPx: Math.round((y * DESIGN_H) / 100) + 'px',
      wPx: Math.round((w * DESIGN_W) / 100) + 'px',
      hPx: h ? Math.round((h * DESIGN_H) / 100) + 'px' : '高度自适应',
    }
  }

  return [
    { key: 'topic', name: '题目区 (Topic/Question)', tag: '题', label: '题目', ...toPx(q), desc: '承载题目文本与原图锚定（30px 微软雅黑，印刷体）' },
    { key: 'analysis', name: '分析区 (Analysis)', tag: '析', label: '分析', ...toPx(an), desc: '引导审题思路与关系拆解（约 35px 手写尖尖体 LikeJianJianTi）' },
    { key: 'solution', name: '解答区 (Solution)', tag: '解', label: '解答', ...toPx(so), desc: '核心规范算式与步骤推导（约 35px 手写尖尖体 LikeJianJianTi）' },
    { key: 'summary', name: '总结区 (Summary)', tag: '总', label: '总结', ...toPx(sm), desc: '作答闭环与方法结论沉淀（约 35px 手写尖尖体 LikeJianJianTi）' },
  ]
})

// 板书显示安全格式化（防止 [object Object]）
function formatBoardDisplay(board) {
  if (!board) return '(本步无新增板书)'
  if (typeof board === 'string') return board
  if (typeof board === 'object') return board.content || '(本步无新增板书)'
  return String(board)
}

// 格式化的下游视频流水线 JSON
const pipelineJsonString = computed(() => {
  const data = {
    deliverableId: projectCode.value || 'DELIV-' + Date.now(),
    generatedAt: createdAt.value || new Date().toISOString(),
    canvasSpec: {
      standard: '16:9 课件演播室',
      width: DESIGN_W,
      height: DESIGN_H,
      unit: 'px',
    },
    topicSpec: {
      problemText: problemText.value,
      keepOriginal: keepOriginal.value,
      sourceImageUrl: sourceImageUrl.value || null,
      screenshotUrl: screenshotUrl.value || null,
      topicLayout: topicLayout.value,
      boardPlan: boardPlan.value,
    },
    meta: meta.value,
    stats: stats.value,
    checkInfo: checkInfo.value,
    sequence: rows.value.map((row, idx) => ({
      step: idx + 1,
      stage: row.stage,
      // 有音频用真实时长；无音频明确标记为预估，并保留音频槽位。
      duration: row.audioDurationMs ?? row.duration ?? 0,
      durationLabel: row.audioDurationMs ? '真实音频时长' : '预估',
      audioUrl: row.audioUrl || '音频暂未生成',
      audioDurationMs: row.audioDurationMs ?? null,
      speech: row.speech,
      board: row.board,
      actionSpec: row.actionSpec,
    })),
  }
  return JSON.stringify(data, null, 2)
})

// 动作方法
function downloadPipelineJson() {
  message.info('推荐生成全部的语音后点击导出。当前仍可继续导出。')
  const blob = new Blob([pipelineJsonString.value], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pipeline-${projectCode.value || 'deliverable'}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success('已成功从状态树下载流水线规格 JSON')
}

function copyPipelineJson() {
  navigator.clipboard.writeText(pipelineJsonString.value).then(() => {
    message.success('已成功复制完整流水线参数 JSON 到剪贴板')
  }).catch(() => {
    message.error('复制失败，请手动在下方框中全选复制')
  })
}

function copyPageUrl() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    message.success('已复制单页永久链接')
  })
}

function exportSpeechMarkdown() {
  doExportSpeechMarkdown(rows.value, {
    problemText: problemText.value,
  })
  message.success('已导出口播讲义 MD (纯口播/TTS就绪/无控制标签)')
}

function exportElementsMarkdown() {
  doExportElementsMarkdown(rows.value, {
    title: '讲题五字段要素全量表',
    problemText: problemText.value,
    model: meta.value?.model,
    generatedAt: createdAt.value,
    handoffCanvasParams: meta.value?.canvasParams,
    handoffBoardPlan: boardPlan.value,
  })
  message.success('已导出五字段要素表 MD')
}

function printPage() {
  window.print()
}

// 客户端原生录屏（纯浏览器交互授权，录制画布/动作/音频，0 后台服务器消耗）
const isRecording = ref(false)
const recordingSeconds = ref(0)
let mediaRecorder = null
let recordedChunks = []
let recordingStream = null
let recordingTimerInterval = null

const recordingTimerText = computed(() => {
  const m = Math.floor(recordingSeconds.value / 60)
  const s = recordingSeconds.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

// 录屏交付前置就绪检查
const precheckModalOpen = ref(false)

// 模块 1：题目识别状态
const problemReadiness = computed(() => {
  const text = (problemText.value || '').trim()
  const isReady = text.length > 0
  return {
    key: 'problem',
    name: '题目识别状态',
    isReady,
    statusText: isReady ? '已就绪' : '未就绪',
    statusColor: isReady ? 'success' : 'error',
    description: isReady
      ? `题目文本已就绪（共 ${text.length} 字），画布题目区正常渲染展示。`
      : '尚未检测到题目文本或题目尚未在「第 1 步 贴题识别」中完成识别落位与确认。',
    guide: '请返回「第 1 步 贴题识别」页面，上传清晰题目截图或粘贴题文，完成落位并点击「确认使用此题」，确保交付微课具备完整题面板书。',
    actionText: '前往「第 1 步 贴题识别」',
    actionHref: '/',
  }
})

// 模块 2：TTS 音轨状态
const ttsReadiness = computed(() => {
  const totalSteps = rows.value.length
  if (totalSteps === 0) {
    return {
      key: 'tts',
      name: 'TTS 音轨状态',
      isReady: false,
      statusText: '未就绪 (无教学时序)',
      statusColor: 'error',
      description: '五字段教学时序表为空，尚未生成任何讲题口播与板书动作。',
      guide: '请在 Agent B 页面中先执行「五字段生成」，由 AI 建立讲题分步口播与板书时序，再进行语音合成。',
      actionText: '前往「Agent B 讲题五字段」',
      actionHref: '/',
      totalSteps: 0,
      readyCount: 0,
      missingCount: 0,
      missingSteps: [],
    }
  }

  const isRowAudioValid = (r) => Boolean(r?.audioUrl && r.audioUrl !== '音频暂未生成')
  const readyCount = rows.value.filter(isRowAudioValid).length
  const missingRows = rows.value
    .map((r, idx) => ({ step: idx + 1, valid: isRowAudioValid(r) }))
    .filter(item => !item.valid)
    .map(item => item.step)
  const isReady = readyCount === totalSteps

  return {
    key: 'tts',
    name: 'TTS 音轨状态',
    isReady,
    statusText: isReady ? `已就绪 (${totalSteps}/${totalSteps} 步已合成)` : `未就绪 (${readyCount}/${totalSteps} 步已合成)`,
    statusColor: isReady ? 'success' : 'error',
    description: isReady
      ? `全部 ${totalSteps} 步口播音轨均已就绪，录屏时音画同步将达到最佳效果。`
      : `当前五字段口播共 ${totalSteps} 步，已合成语音 ${readyCount} 步，尚有 ${totalSteps - readyCount} 步缺失音轨（未完成步骤：第 ${missingRows.slice(0, 8).join('、')}${missingRows.length > 8 ? ' 等' : ''} 步）。`,
    guide: '录屏交付需同步录制高品质口播音轨。请在 Agent B 讲题时序表格中，为缺失音轨的行点击「试听/生成语音」按钮（或调用 ASR 兜底），确保所有行均拥有有效音频。',
    actionText: '前往完善 TTS 音轨',
    actionHref: '/',
    totalSteps,
    readyCount,
    missingCount: totalSteps - readyCount,
    missingSteps: missingRows,
  }
})

// 预检查综合汇总
const precheckModules = computed(() => [problemReadiness.value, ttsReadiness.value])
const unreadyModules = computed(() => precheckModules.value.filter(m => !m.isReady))
const allModulesReady = computed(() => unreadyModules.value.length === 0)

// 刷新状态并重新检查
async function refreshPrecheckStatus() {
  await fetchDeliverableData()
  if (allModulesReady.value) {
    message.success('恭喜！题目识别与 TTS 音轨均已就绪！')
    precheckModalOpen.value = false
  } else {
    message.info(`已刷新：仍有 ${unreadyModules.value.length} 项模块未就绪，请参考指引完善。`)
  }
}

// 供开发者或测试快速录屏（放权原则）
function forceStartRecording() {
  precheckModalOpen.value = false
  message.warning('已跳过前置检查，启动测试录屏（视频可能缺少题文或语音）')
  startScreenRecording()
}

async function toggleScreenRecording() {
  if (isRecording.value) {
    stopScreenRecording()
    return
  }

  // 录屏交付预检查：如果题目识别状态或 TTS 音轨状态未就绪，弹窗展示未就绪列表与指引
  if (!allModulesReady.value) {
    precheckModalOpen.value = true
    return
  }

  await startScreenRecording()
}

async function startScreenRecording() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      message.error('您的浏览器当前不支持或禁用了屏幕录制 API (getDisplayMedia)。请使用 Chrome/Edge 浏览器打开。')
      return
    }

    let stream = null
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: 30 },
        audio: true,
      })
    } catch {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
      })
    }

    if (!stream) return
    recordingStream = stream

    let mimeType = 'video/webm;codecs=vp9,opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8,opus'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm'
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = ''

    recordedChunks = []
    const options = mimeType ? { mimeType } : undefined
    mediaRecorder = new MediaRecorder(stream, options)

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      cleanupRecordingUI()
      if (recordedChunks.length > 0) {
        const actualType = mimeType || 'video/webm'
        const blob = new Blob(recordedChunks, { type: actualType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `board-video-${projectCode.value || 'deliverable'}.webm`
        a.click()
        URL.revokeObjectURL(url)
        const sizeMb = (blob.size / (1024 * 1024)).toFixed(2)
        message.success(`🎉 演播录屏已保存！文件大小: ${sizeMb} MB`)
      }
    }

    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.onended = () => {
        if (isRecording.value) stopScreenRecording()
      }
    }

    mediaRecorder.start(1000)
    isRecording.value = true
    recordingSeconds.value = 0
    recordingTimerInterval = setInterval(() => {
      recordingSeconds.value++
    }, 1000)

    message.info('🔴 录屏已开始！请演播您的板书与动作')
  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      message.error('启动录屏失败: ' + (err.message || String(err)))
    }
  }
}

function stopScreenRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  if (recordingStream) {
    recordingStream.getTracks().forEach(t => t.stop())
  }
}

function cancelScreenRecording() {
  recordedChunks = []
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop()
  }
  if (recordingStream) {
    recordingStream.getTracks().forEach(t => t.stop())
  }
  cleanupRecordingUI()
  message.info('已取消本次录制')
}

function cleanupRecordingUI() {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null
  }
  isRecording.value = false
}

onBeforeUnmount(() => {
  cleanupRecordingUI()
  if (recordingStream) {
    recordingStream.getTracks().forEach(t => t.stop())
  }
})

function getStageTagColor(stage) {
  if (stage === '审题引入') return 'blue'
  if (stage === '知识链接') return 'cyan'
  if (stage === '深入探究') return 'purple'
  if (stage === '解答过程') return 'green'
  if (stage === '总结提升') return 'orange'
  return 'default'
}
</script>

<template>
  <div class="deliverable-page-wrapper" :class="{ 'mode-fullscreen': viewMode === 'fullscreen', 'mode-canvas': viewMode === 'canvas' }">
    <!-- 顶部状态与导航条 -->
    <header v-if="viewMode === 'deliverable'" class="deliverable-nav-header">
      <div class="nav-left">
        <div class="brand-title">
          <FundProjectionScreenOutlined class="brand-icon" />
          <span class="title-text">教学板书 · 视频素材交付单页</span>
        </div>
        <a-tag v-if="projectCode" color="cyan" class="code-badge">
          编号: {{ projectCode }}
        </a-tag>
        <a-tag color="success" class="status-tag">
          <CheckCircleOutlined /> 已固化存档 · 刷新不丢失
        </a-tag>
      </div>

      <div class="nav-center-toggles">
        <label class="toggle-chip">
          <input type="checkbox" v-model="showGrid" />
          <span>网格线</span>
        </label>
        <label class="toggle-chip">
          <input type="checkbox" v-model="showLabels" />
          <span>四标签</span>
        </label>
        <label class="toggle-chip">
          <input type="checkbox" v-model="showZones" />
          <span>分区辅助线</span>
        </label>
      </div>

      <div class="nav-right-actions">
        <!-- 客户端录屏按钮（拉起浏览器原生授权，0 后端消耗） -->
        <a-button
          size="small"
          class="btn-vue-record"
          :class="{ 'is-recording': isRecording }"
          @click="toggleScreenRecording"
          title="拉起浏览器录屏，录制画布演播与声音"
        >
          <span class="rec-dot-icon" :class="{ blink: isRecording }">●</span>
          <span>{{ isRecording ? `录制中 ${recordingTimerText}` : '录屏交付' }}</span>
        </a-button>
        <a-button size="small" @click="copyPageUrl">
          <template #icon><ShareAltOutlined /></template>
          分享链接
        </a-button>
        <a-button size="small" @click="copyPipelineJson">
          <template #icon><CopyOutlined /></template>
          复制流水线 JSON
        </a-button>
        <a-button size="small" type="primary" class="btn-toggle-fullscreen" @click="viewMode = 'fullscreen'">
          <template #icon><FullscreenOutlined /></template>
          纯画布全屏
        </a-button>
      </div>
    </header>

    <!-- 录屏状态置顶浮动条 -->
    <transition name="fade">
      <div v-if="isRecording" class="recording-floating-bar-vue">
        <span class="recording-pulse-vue"></span>
        <span style="font-weight: 600;">正在录制画布演播</span>
        <span class="recording-timer-vue">{{ recordingTimerText }}</span>
        <a-button size="small" type="primary" danger @click="stopScreenRecording">
          ⏹ 结束并下载
        </a-button>
        <a-button size="small" ghost @click="cancelScreenRecording">
          ✕ 取消
        </a-button>
      </div>
    </transition>

    <!-- 主展示区 -->
    <main class="deliverable-main-container" :class="{ 'canvas-only': viewMode === 'canvas' }">
      <!-- 1. 严格锁定 1726 × 980 比例的真画布视口 -->
      <section class="board-cinema-section" :class="{ 'stage-fullscreen': viewMode === 'fullscreen', 'stage-canvas': viewMode === 'canvas' }">
        <div class="board-ratio-lock-box">
          <RealBoardPreview
            :problem-text="problemText"
            :topic-layout="topicLayout"
            :board-plan="boardPlan"
            :show-grid="showGrid"
            :show-all-labels="showLabels"
            :show-zone-guides="showZones"
            :source-image-url="sourceImageUrl"
            :keep-original="keepOriginal"
            :board-rows="rows"
            :action-spec="actionSpec"
            :interactive="false"
            @update:topic-layout="onTopicLayoutUpdated"
            @update:problem-text="onProblemTextUpdated"
          />
        </div>

        <!-- 纯全屏浮动工具栏 -->
        <transition name="fade">
          <div
            v-if="viewMode === 'fullscreen' && showFloatToolbar"
            class="fullscreen-floating-toolbar"
            @mouseenter="pingFloatToolbar"
          >
            <!-- 全屏下录屏按钮 -->
            <a-button
              size="small"
              class="btn-vue-record"
              :class="{ 'is-recording': isRecording }"
              @click="toggleScreenRecording"
            >
              <span class="rec-dot-icon" :class="{ blink: isRecording }">●</span>
              <span>{{ isRecording ? `停止录制 (${recordingTimerText})` : '录屏交付' }}</span>
            </a-button>
            <span class="toolbar-divider"></span>
            <label>
              <input type="checkbox" v-model="showGrid" /> 网格
            </label>
            <label>
              <input type="checkbox" v-model="showLabels" /> 四标签
            </label>
            <label>
              <input type="checkbox" v-model="showZones" /> 分区线
            </label>
            <span class="toolbar-divider"></span>
            <span class="canvas-dimension">{{ DESIGN_W }} × {{ DESIGN_H }} (锁定 16:9)</span>
            <span class="toolbar-divider"></span>
            <a-button size="small" ghost @click="viewMode = 'deliverable'">
              <template #icon><FullscreenExitOutlined /></template>
              返回参数单页 (ESC)
            </a-button>
          </div>
        </transition>

        <div v-if="viewMode === 'fullscreen'" class="fullscreen-esc-hint" @mousemove="pingFloatToolbar">
          按 ESC 键或点击工具栏退出全屏
        </div>
      </section>

      <!-- 2. 下挖参数框 (教学视频制作核心参数看板) -->
      <section v-if="viewMode === 'deliverable'" class="params-dashboard-section">
        <!-- 统计指标概览条 -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon bg-emerald"><ClockCircleOutlined /></div>
            <div class="metric-content">
              <span class="metric-label">视频预估用时</span>
              <span class="metric-value">{{ stats.totalDurationText || (stats.totalDuration ? stats.totalDuration + '秒' : '约2分半') }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon bg-blue"><TableOutlined /></div>
            <div class="metric-content">
              <span class="metric-label">时序步数</span>
              <span class="metric-value">{{ rows.length ? rows.length + ' 步' : (stats.stepCount ? stats.stepCount + ' 步' : '8 步') }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon bg-purple"><FileTextOutlined /></div>
            <div class="metric-content">
              <span class="metric-label">口播总字数</span>
              <span class="metric-value">{{ stats.charCount ? stats.charCount + ' 字' : '约350字' }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon bg-amber"><CompassOutlined /></div>
            <div class="metric-content">
              <span class="metric-label">画布标准</span>
              <span class="metric-value">1726 × 980</span>
            </div>
          </div>
        </div>

        <!-- 标签页与参数详情 -->
        <div class="dashboard-tabs-container">
          <div class="tabs-header-bar">
            <div class="tabs-nav-list">
              <button
                class="tab-nav-btn"
                :class="{ active: activeTab === 'rows' }"
                @click="activeTab = 'rows'"
              >
                <TableOutlined /> 讲题五字段时序执行表 ({{ rows.length }}步)
              </button>
              <button
                class="tab-nav-btn"
                :class="{ active: activeTab === 'coords' }"
                @click="activeTab = 'coords'"
              >
                <CompassOutlined /> 真画布四大区域与规格规划
              </button>
              <button
                class="tab-nav-btn"
                :class="{ active: activeTab === 'json' }"
                @click="activeTab = 'json'"
              >
                <CodeOutlined /> 自动化视频流水线对接 (JSON)
              </button>
            </div>

            <div class="tab-header-actions">
              <template v-if="activeTab === 'rows'">
                <a-select
                  v-model:value="selectedStageFilter"
                  size="small"
                  style="width: 120px;"
                >
                  <a-select-option value="all">全部阶段</a-select-option>
                  <a-select-option v-for="st in stageOptions.filter(s => s !== 'all')" :key="st" :value="st">
                    {{ st }}
                  </a-select-option>
                </a-select>
                <a-button size="small" @click="exportSpeechMarkdown">
                  <template #icon><DownloadOutlined /></template>导出口播 MD (TTS就绪)
                </a-button>
                <a-button size="small" @click="exportElementsMarkdown">
                  <template #icon><DownloadOutlined /></template>导出要素表 MD
                </a-button>
              </template>

              <template v-if="activeTab === 'coords'">
                <span class="spec-hint-badge">画布物理基准: 1726 × 980 (16:9 课件演播室)</span>
              </template>

              <template v-if="activeTab === 'json'">
                <a-button size="small" type="primary" @click="downloadPipelineJson">
                  <template #icon><DownloadOutlined /></template>下载 JSON
                </a-button>
                <a-button size="small" @click="copyPipelineJson">
                  <template #icon><CopyOutlined /></template>一键复制 JSON
                </a-button>
              </template>
            </div>
          </div>

          <!-- TAB 1: 讲题五字段时序执行表 -->
          <div v-show="activeTab === 'rows'" class="tab-pane-content tab-rows-pane">
            <div v-if="!rows.length" class="empty-hint-card">
              <InfoCircleOutlined /> 暂无五字段生成数据，可在生成器中点击「生成产物单页」同步
            </div>

            <div v-else class="execution-table-wrap">
              <table class="execution-table">
                <thead>
                  <tr>
                    <th style="width: 54px;">序号</th>
                    <th style="width: 100px;">教学阶段</th>
                    <th style="width: 76px;">时长</th>
                    <th style="width: 44%;">口播文本 (Speech - 无TTS标签/数字已汉字化)</th>
                    <th>板书内容 (Board) 与动作规范 (actionSpec)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in filteredRows" :key="idx">
                    <td class="col-center index-num">{{ idx + 1 }}</td>
                    <td class="col-center">
                      <a-tag :color="getStageTagColor(row.stage)">{{ row.stage }}</a-tag>
                    </td>
                    <td class="col-center duration-tag">{{ row.duration }}</td>
                    <td class="col-speech">
                      <p class="speech-text">{{ row.speech }}</p>
                    </td>
                    <td class="col-board">
                      <div class="board-snippet">
                        <span class="snippet-label">板书:</span>
                        <span class="board-text">{{ formatBoardDisplay(row.board) }}</span>
                      </div>
                      <div v-if="row.actionSpec && row.actionSpec.length" class="actions-badge-list">
                        <span
                          v-for="(act, aIdx) in row.actionSpec"
                          :key="aIdx"
                          class="action-pill"
                          :title="JSON.stringify(act)"
                        >
                          ⚡ {{ act.tool || act.action || 'action' }}
                        </span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TAB 2: 真画布四大区域与落点坐标 -->
          <div v-show="activeTab === 'coords'" class="tab-pane-content tab-coords-pane">
            <div class="coords-two-col">
              <!-- 左侧：题目区原题与渲染 -->
              <div class="coords-card topic-preview-card">
                <div class="card-sub-header">
                  <span class="sub-title">📝 题目文本 (KaTeX 公式解析)</span>
                  <a-tag v-if="keepOriginal" color="orange">保留原题原图</a-tag>
                </div>
                <div class="problem-latex-box" v-html="renderedProblemHtml"></div>

                <div v-if="sourceImageUrl" class="source-image-strip">
                  <span class="sub-label">原图资产:</span>
                  <img :src="sourceImageUrl" class="source-thumb" alt="原题截图" />
                </div>
              </div>

              <!-- 右侧：四区规格与百分比绝对值对照表 -->
              <div class="coords-card zones-table-card">
                <div class="card-sub-header">
                  <span class="sub-title">🎯 四大区域规划参数 (1726 × 980 · 达芬奇手稿风格)</span>
                </div>
                <table class="zones-data-table">
                  <thead>
                    <tr>
                      <th>区域名称</th>
                      <th>相对百分比 (X%, Y%, W%, H%)</th>
                      <th>绝对像素坐标 (1726×980)</th>
                      <th>功能定义</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="z in fourZonesCoords" :key="z.key">
                      <td class="zone-name">
                        <span class="zone-tag-chip">{{ z.tag }}</span>
                        <strong>{{ z.name }}</strong>
                      </td>
                      <td class="zone-coords-pct">
                        X: {{ z.xPct }} | Y: {{ z.yPct }}<br />
                        W: {{ z.wPct }} | H: {{ z.hPct }}
                      </td>
                      <td class="zone-coords-px">
                        X: {{ z.xPx }} | Y: {{ z.yPx }}<br />
                        W: {{ z.wPx }} | H: {{ z.hPx }}
                      </td>
                      <td class="zone-desc">{{ z.desc }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- TAB 3: 自动化视频流水线对接 (JSON) -->
          <div v-show="activeTab === 'json'" class="tab-pane-content tab-json-pane">
            <div class="json-code-header">
              <span class="code-title">📦 下游渲染引擎消费规格 (Direct Pipeline Spec)</span>
              <a-button size="small" type="primary" ghost @click="copyPipelineJson">
                <template #icon><CopyOutlined /></template>复制 JSON
              </a-button>
            </div>
            <pre class="json-code-block"><code>{{ pipelineJsonString }}</code></pre>
          </div>
        </div>
      </section>
    </main>
    <!-- 录屏交付前置检查未就绪提示 Ant Design Modal -->
    <a-modal
      v-model:open="precheckModalOpen"
      title="录屏交付前置就绪检查"
      :width="640"
      :destroy-on-close="false"
      centered
      class="precheck-delivery-modal"
    >
      <div class="precheck-modal-body">
        <a-alert
          type="warning"
          show-icon
          class="precheck-warning-banner"
          message="检测到交付核心模块尚未就绪"
          description="录屏交付将把画布笔迹演播与口播音轨同步录制为最终交付微课。若模块未就绪，可能导致成品视频缺少题面板书或静音无声。请按照下方指引完成配置。"
        />

        <div class="unready-modules-section">
          <div class="unready-section-header">
            <span class="section-title">未就绪模块列表 ({{ unreadyModules.length }}/{{ precheckModules.length }})</span>
            <span class="section-sub">请逐项确认并完善后再启动录屏交付</span>
          </div>

          <div class="unready-modules-list">
            <div
              v-for="item in unreadyModules"
              :key="item.key"
              class="unready-module-card"
            >
              <div class="module-card-header">
                <div class="module-card-title-wrap">
                  <component
                    :is="item.key === 'problem' ? FileSearchOutlined : SoundOutlined"
                    class="module-type-icon"
                  />
                  <span class="module-title-text">{{ item.name }}</span>
                </div>
                <a-tag :color="item.statusColor" class="module-status-badge">
                  <CloseCircleOutlined /> {{ item.statusText }}
                </a-tag>
              </div>

              <div class="module-diagnosis">
                <span class="diagnosis-label">当前状态：</span>
                <span class="diagnosis-text">{{ item.description }}</span>
              </div>

              <div class="module-guide-box">
                <div class="guide-header">
                  <InfoCircleOutlined class="guide-icon" />
                  <span class="guide-title">完成指引：</span>
                </div>
                <p class="guide-content">{{ item.guide }}</p>
                <div class="guide-actions">
                  <a
                    :href="item.actionHref"
                    class="btn-guide-action"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {{ item.actionText }}
                    <ArrowRightOutlined />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="precheck-modal-footer">
          <a-button
            type="text"
            size="small"
            class="btn-force-record"
            @click="forceStartRecording"
            title="系统放权，不强制卡死。供开发者临时调试无音频画布录制"
          >
            仍要测试录屏 (可能缺少音轨/题文)
          </a-button>
          <div class="footer-primary-actions">
            <a-button @click="refreshPrecheckStatus">
              <template #icon><ReloadOutlined /></template>
              刷新就绪状态
            </a-button>
            <a-button type="primary" @click="precheckModalOpen = false">
              我知道了，去完成
            </a-button>
          </div>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<style scoped>
/* 根包装容器 */
.deliverable-page-wrapper {
  min-height: 100vh;
  background: #f8fafc;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  display: flex;
  flex-direction: column;
}

/* 顶部导航条 */
.deliverable-nav-header {
  height: 56px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 50;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.brand-icon {
  color: #059669;
  font-size: 18px;
}

.code-badge {
  font-family: monospace;
  font-size: 12px;
}

.nav-center-toggles {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #f1f5f9;
  padding: 4px 12px;
  border-radius: 999px;
}

.toggle-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

.toggle-chip input {
  cursor: pointer;
}

.nav-right-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-toggle-fullscreen {
  background: #0f172a !important;
  border-color: #0f172a !important;
}

/* 录屏专属样式 */
.btn-vue-record {
  border-color: #fca5a5 !important;
  background: #fff1f2 !important;
  color: #b91c1c !important;
  font-weight: 600 !important;
  transition: all 0.2s ease;
}
.btn-vue-record:hover {
  background: #ffe4e6 !important;
  border-color: #f87171 !important;
}
.btn-vue-record.is-recording {
  background: #fee2e2 !important;
  border-color: #ef4444 !important;
  color: #dc2626 !important;
  animation: pulse-ring 1.5s infinite;
}
.rec-dot-icon {
  display: inline-block;
  color: #ef4444;
  margin-right: 2px;
  font-size: 11px;
}
.rec-dot-icon.blink {
  animation: blink-rec 0.8s infinite alternate;
}
@keyframes blink-rec {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0.2; transform: scale(0.85); }
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15); }
}

/* 录屏状态置顶浮动条 (全屏与常规均置顶) */
.recording-floating-bar-vue {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  background: rgba(15, 23, 42, 0.94);
  backdrop-filter: blur(10px);
  color: #ffffff;
  padding: 7px 18px;
  border-radius: 30px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.4);
  border: 1.5px solid rgba(239, 68, 68, 0.65);
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.recording-pulse-vue {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 10px #ef4444;
  animation: blink-rec 0.7s infinite alternate;
}
.recording-timer-vue {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #fca5a5;
}

/* 主容器 */
.deliverable-main-container {
  flex: 1;
  max-width: 1480px;
  width: 100%;
  margin: 0 auto;
  padding: 20px 24px 60px;
  box-sizing: border-box;
}

/* 核心视口：严格锁定 1726 × 980 长宽比 */
.board-cinema-section {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
}

.board-ratio-lock-box {
  position: relative;
  /* 严格锁定 1726 / 980 长宽比，且绝不超过最大高度与容器宽度 */
  width: min(100%, calc(min(64vh, 880px) * (1726 / 980)));
  max-width: 100%;
  aspect-ratio: 1726 / 980;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid #cbd5e1;
}

/* 覆盖 RealBoardPreview 内部的自适应行为 */
.board-ratio-lock-box :deep(.real-board-wrap) {
  width: 100% !important;
  height: 100% !important;
}

.board-ratio-lock-box :deep(.board) {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
  aspect-ratio: 1726 / 980 !important;
  margin: 0 !important;
}

/* 纯全屏模式 */
.mode-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #0f172a;
}

/* 纯画布背景模式（供外部新建页面嵌入作为底层背景，绝不手搓，隔离 z-index） */
.mode-canvas {
  position: absolute;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  background: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: hidden !important;
}

.deliverable-main-container.canvas-only {
  max-width: 100% !important;
  width: 100% !important;
  height: 100% !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.board-cinema-section.stage-canvas {
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
}

.stage-canvas .board-ratio-lock-box {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  aspect-ratio: 1726 / 980 !important;
  border-radius: 0 !important;
  border: none !important;
  box-shadow: none !important;
  background: #ffffff !important;
}

.stage-canvas .board-ratio-lock-box :deep(.board) {
  border: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

.board-cinema-section.stage-fullscreen {
  position: fixed;
  inset: 0;
  margin: 0;
  padding: 16px;
  box-sizing: border-box;
  background: #0f172a;
  z-index: 10000;
}

.stage-fullscreen .board-ratio-lock-box {
  width: min(100%, calc((100vh - 32px) * (1726 / 980))) !important;
  max-height: calc(100vh - 32px) !important;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.fullscreen-floating-toolbar {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.92);
  backdrop-filter: blur(12px);
  color: #f8fafc;
  padding: 8px 20px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  z-index: 10001;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}

.fullscreen-floating-toolbar label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.toolbar-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.2);
}

.canvas-dimension {
  color: #94a3b8;
  font-size: 12px;
  font-family: monospace;
}

.fullscreen-esc-hint {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  z-index: 10001;
  pointer-events: none;
}

/* 参数信息框 ("挖个参数框") */
.params-dashboard-section {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05);
  overflow: hidden;
}

/* 指标栅格 */
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-bottom: 1px solid #e2e8f0;
  background: #fafafa;
}

.metric-card {
  padding: 18px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-right: 1px solid #e2e8f0;
}

.metric-card:last-child {
  border-right: none;
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #ffffff;
  flex-shrink: 0;
}

.bg-emerald { background: linear-gradient(135deg, #059669, #10b981); }
.bg-blue { background: linear-gradient(135deg, #2563eb, #3b82f6); }
.bg-purple { background: linear-gradient(135deg, #7c3aed, #8b5cf6); }
.bg-amber { background: linear-gradient(135deg, #d97706, #f59e0b); }

.metric-content {
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 2px;
}

.metric-value {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

/* 标签页与容器 */
.dashboard-tabs-container {
  padding: 0;
}

.tabs-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.tabs-nav-list {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-nav-btn {
  background: transparent;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab-nav-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}

.tab-nav-btn.active {
  color: #059669;
  background: #ecfdf5;
}

.tab-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.spec-hint-badge {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 6px;
}

/* 标签内容面板 */
.tab-pane-content {
  padding: 24px;
}

/* TAB 1: 时序表 */
.execution-table-wrap {
  overflow-x: auto;
}

.execution-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.execution-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  text-align: left;
  padding: 10px 14px;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.execution-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.col-center {
  text-align: center;
}

.index-num {
  font-weight: 600;
  color: #94a3b8;
}

.duration-tag {
  font-family: monospace;
  color: #059669;
  font-weight: 600;
}

.speech-text {
  margin: 0;
  color: #1e293b;
  line-height: 1.65;
  font-size: 13.5px;
}

.board-snippet {
  margin-bottom: 6px;
}

.snippet-label {
  font-weight: 600;
  color: #64748b;
  margin-right: 6px;
}

.board-text {
  color: #0f172a;
  font-family: monospace;
  font-size: 12.5px;
  background: #f8fafc;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
}

.actions-badge-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.action-pill {
  font-size: 11px;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
}

/* TAB 2: 四区坐标 */
.coords-two-col {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: 24px;
}

.coords-card {
  background: #fafafa;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 18px;
}

.card-sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}

.sub-title {
  font-weight: 700;
  color: #0f172a;
  font-size: 14px;
}

.problem-latex-box {
  background: #ffffff;
  padding: 14px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-size: 14px;
  line-height: 1.7;
  color: #1e293b;
  max-height: 280px;
  overflow-y: auto;
}

.source-image-strip {
  margin-top: 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.source-thumb {
  max-width: 140px;
  max-height: 90px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  object-fit: contain;
}

.zones-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.zones-data-table th {
  background: #f1f5f9;
  color: #475569;
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid #cbd5e1;
}

.zones-data-table td {
  padding: 10px;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
}

.zone-tag-chip {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  background: #0f172a;
  color: #ffffff;
  border-radius: 4px;
  font-size: 11px;
  margin-right: 6px;
}

.zone-coords-pct,
.zone-coords-px {
  font-family: monospace;
  font-size: 11.5px;
  color: #334155;
  line-height: 1.4;
}

.zone-desc {
  color: #64748b;
  font-size: 12px;
}

/* TAB 3: 流水线 JSON */
.json-code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.code-title {
  font-weight: 600;
  color: #475569;
  font-size: 13px;
}

.json-code-block {
  background: #0f172a;
  color: #38bdf8;
  padding: 16px;
  border-radius: 8px;
  font-family: "JetBrains Mono", Consolas, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: 460px;
  overflow-y: auto;
  border: 1px solid #1e293b;
}

.empty-hint-card {
  text-align: center;
  padding: 48px;
  color: #94a3b8;
  font-size: 14px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* 录屏交付前置检查 Modal 样式 */
.precheck-modal-body {
  padding: 4px 0 12px;
}

.precheck-warning-banner {
  margin-bottom: 16px;
  border-radius: 6px;
}

.unready-modules-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.unready-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
}

.unready-section-header .section-title {
  font-size: 13.5px;
  font-weight: 600;
  color: #1e293b;
}

.unready-section-header .section-sub {
  font-size: 12px;
  color: #64748b;
}

.unready-modules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.unready-module-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}

.module-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.module-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #0f172a;
}

.module-type-icon {
  font-size: 15px;
  color: #2563eb;
}

.module-status-badge {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
}

.module-diagnosis {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 10px;
}

.diagnosis-label {
  color: #64748b;
  font-weight: 500;
}

.diagnosis-text {
  color: #334155;
}

.module-guide-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
}

.guide-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-weight: 600;
  font-size: 12.5px;
  margin-bottom: 4px;
}

.guide-icon {
  font-size: 13px;
}

.guide-content {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: #334155;
}

.guide-actions {
  margin-top: 8px;
  display: flex;
  align-items: center;
}

.btn-guide-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #2563eb;
  font-weight: 500;
  text-decoration: none;
  padding: 3px 10px;
  background: #eff6ff;
  border-radius: 4px;
  border: 1px solid #bfdbfe;
  transition: all 0.2s ease;
}

.btn-guide-action:hover {
  background: #dbeafe;
  color: #1d4ed8;
  border-color: #93c5fd;
}

.precheck-modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-primary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-force-record {
  color: #94a3b8 !important;
  font-size: 12px !important;
}

.btn-force-record:hover {
  color: #64748b !important;
  text-decoration: underline;
}
</style>
