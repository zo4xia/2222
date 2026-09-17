<script setup>
/* @qh-core LANE=STEP1 POINT=UI_CONFIRM recognize+type+boardPlan+save handoff */
import { computed, nextTick, reactive, ref, watch } from 'vue'

const emit = defineEmits(['enter-board-draft'])
import { message } from 'ant-design-vue'
import { recognizeProblem, fileToDataUrl } from '../services/recognitionClient'
import { renderProblemHtml } from '../utils/mathText'
import { buildStep1Handoff, hasUsableAgentAKnowledge } from '../services/stepHandoff'
import { saveLiveBoardPreview } from '../board-preview/liveBoardPreview.js'
import { selectAgentARelatedKnowledge } from '../services/agentAKnowledge.js'
import {
  userApiConfig,
  saveUserApiConfig,
  isUserApiReady,
  subscribeUserApiConfig,
  parseApiKeys,
} from '../lib/userApiConfig.js'
import {
  checkAgentApiConfig,
  saveCheckAgentApiConfig,
  isCheckAgentApiReady,
} from '../lib/checkAgentApiConfig.js'
import {
  agentBApiConfig,
  saveAgentBApiConfig,
  isAgentBApiReady,
} from '../lib/agentBApiConfig.js'
import RealBoardPreview from './RealBoardPreview.vue'
import QhPageHeader from './QhPageHeader.vue'
import { planLabelsFromTopic } from '../utils/boardLayout'
import {
  CloudUploadOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  FullscreenOutlined,
} from '@ant-design/icons-vue'

// 生产车间第1步：真画布上贴题，不是假预览壳

const problemText = ref('')
const problemTextHtml = computed(() => renderProblemHtml(problemText.value))
const sourceImageUrl = ref('')
const sourceImageName = ref('')
const sourceImageDataUrl = ref('')
const sourceImagePreviewOpen = ref(false)
const keepOriginal = ref(false)
const recognizeStatus = ref('idle')
const layoutStatus = ref('idle') // idle | ready | regenerating
const layoutSeed = ref(0)
const isLandscape = ref(false)
const step1Confirmed = ref(false)
const boardPlan = ref(null)
const showGrid = ref(false)
const labelsPlanned = ref(false)
const topicMeasurement = ref({ bottomPct: null, heightPct: null })
// 截图存档：planBoardLabels 后截 .board-viewport，存 public/pic/，handoff 存 screenshotUrl
const previewCaptureRef = ref(null)
const screenshotUrl = ref('')
const screenshotPreviewOpen = ref(false)
const screenshotting = ref(false)
const SNAPSHOT_TIMEOUT_MS = 6000

const problemType = ref(undefined)
const boardFocus = ref(undefined)
const knowledgeStatus = ref('idle')
const relatedKnowledge = ref([])
const selectedKnowledge = ref(null)
const knowledgeError = ref('')
// Agent A 深度知识点分析结果（识别时由 LLM 直接产出，不再依赖本地 n-gram 浅匹配）
const knowledgeAnalysis = ref(null)
const suggestedGrade = ref('')
const uncertainItems = ref([])
const suggestedLayout = ref(null)

const AGENT_STORAGE_KEY = 'qinghuabu.step1.agentConfig'

const agentConfig = reactive({
  pageName: '第1步 · 贴题识别',
  capability: 'multimodal',
  autoRecognize: true,
})

const agentDrawerOpen = ref(false)
function loadAgentConfig() {
  try {
    const raw = localStorage.getItem(AGENT_STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    agentConfig.capability = saved.capability || agentConfig.capability
    agentConfig.autoRecognize = saved.autoRecognize !== false
  } catch (error) {
    // ignore bad local cache
  }
}

loadAgentConfig()

subscribeUserApiConfig(() => {})

const agentReady = computed(() => {
  // 本地过交互可不配 endpoint；要真识别再要求 apiKey+endpoint+model 齐备
  return Boolean(agentConfig.capability) && isUserApiReady()
})

const agentSummary = computed(() => {
  const model = userApiConfig.model || '未填模型'
  const ep = userApiConfig.endpoint ? '已填服务' : '服务未填'
  const key = userApiConfig.apiKey ? '· Key 已填' : '· Key 未填'
  return `${agentConfig.capability} · ${model} · ${ep} ${key}`
})

const problemTypeOptions = [
  { value: 'geometry', label: '几何题' },
  { value: 'calculation', label: '计算运算题' },
  { value: 'word', label: '应用题' },
  { value: 'other', label: '其他' },
]

const boardFocusOptions = [
  { value: 'geometry_diagram', label: '几何图解', forTypes: ['geometry'] },
  { value: 'calculation_process', label: '演算过程', forTypes: ['calculation'] },
  { value: 'relation_understanding', label: '关系理解（可画图）', forTypes: ['word'] },
  { value: 'mixed', label: '综合分析', forTypes: ['geometry', 'calculation', 'word', 'other'] },
]

// 题目层落位（相对 1726×980 百分比，来自已验证 demo 落点）
// 布局规则：图片题目区 = 左半(w≤44%) + 上半(y从标签下13.2%到50%) = maxH≈36%
// 文字题目：只填左侧文字，不走图片分支
const baseLayout = {
  topicLabel: { x: 5.7, y: 6.6, w: 7.1 },
  question: { x: 6.0, y: 13.2, w: 40.4 },
  image: { x: 6.0, y: 13.2, w: 38.0 },   // 高度由 limitTopicImageHeightPct 自适应到画布底，不写死 maxH
}

const customTopicLayout = ref(null)
try {
  const saved = localStorage.getItem('qinghuabu.customTopicLayout')
  if (saved) {
    customTopicLayout.value = JSON.parse(saved)
  }
} catch (_) {}

function onTopicLayoutUpdated(newLayout) {
  customTopicLayout.value = { ...(customTopicLayout.value || {}), ...newLayout }
  try {
    localStorage.setItem('qinghuabu.customTopicLayout', JSON.stringify(customTopicLayout.value))
  } catch (_) {}
  syncLiveBoardPreview()
}

function onProblemTextUpdated(newText) {
  problemText.value = newText
  try {
    localStorage.setItem('qinghuabu.problemText', newText)
  } catch (_) {}
  syncLiveBoardPreview()
}

const topicLayout = computed(() => {
  // 重新生成：只微调题目块，不乱动甲方底板
  const jitter = (layoutSeed.value % 3) * 0.4
  const fontBump = layoutSeed.value % 3
  const hasImage = Boolean(sourceImageUrl.value && keepOriginal.value)
  const auto = {
    topicLabel: { ...baseLayout.topicLabel },
    image: hasImage
      ? {
          x: baseLayout.image.x,
          y: baseLayout.image.y,
          // 横图(宽>高)上下布局：图片宽占满安全区（6%~94%）
          // 竖图(高>宽)左右布局：图片占左列，宽约44%
          // 高度均由 limitTopicImageHeightPct 自适应到画布底，不在这里限制
          w: isLandscape.value ? 88 : baseLayout.image.w - jitter * 0.3,
        }
      : null,
    question: {
      x: baseLayout.question.x,
      y: hasImage ? 42 + jitter : baseLayout.question.y + jitter * 0.3,
      w: baseLayout.question.w - jitter * 0.2,
      fontSize: hasImage ? 28 - fontBump : 30 - fontBump,
    },
  }

  if (customTopicLayout.value) {
    return {
      ...auto,
      ...customTopicLayout.value,
      question: {
        ...auto.question,
        ...(customTopicLayout.value.question || {}),
      },
      image: auto.image
        ? { ...auto.image, ...(customTopicLayout.value.image || {}) }
        : null,
      topicLabel: {
        ...auto.topicLabel,
        ...(customTopicLayout.value.topicLabel || {}),
      },
      blocks: customTopicLayout.value.blocks || auto.blocks,
    }
  }

  return auto
})

function liveBoardPreviewState() {
  return {
    problemText: problemText.value,
    topicLayout: topicLayout.value,
    boardPlan: boardPlan.value,
    showGrid: showGrid.value,
    showLabels: labelsPlanned.value,
    showZones: labelsPlanned.value,
    sourceImageUrl: sourceImageUrl.value,
    keepOriginal: keepOriginal.value,
  }
}

function syncLiveBoardPreview() {
  saveLiveBoardPreview(liveBoardPreviewState())
}

watch(
  () => [
    problemText.value,
    topicLayout.value,
    boardPlan.value,
    showGrid.value,
    labelsPlanned.value,
    sourceImageUrl.value,
    keepOriginal.value,
  ],
  syncLiveBoardPreview,
  { deep: true, immediate: true },
)

function openFullscreenBoardPreview() {
  syncLiveBoardPreview()
  window.open('/board-preview.html', 'qinghuabu-board-preview', 'noopener,noreferrer')
}

const hasBoardContent = computed(() => {
  return Boolean(problemText.value.trim() || sourceImageUrl.value)
})

const suggestedLayoutLabel = computed(() => ({
  left_right: '左右布局',
  top_bottom: '上下布局',
}[suggestedLayout.value?.layout] || suggestedLayout.value?.layout || '自动落座'))

const canQueryKnowledge = computed(() => {
  return (
    problemText.value.trim().length > 0 &&
    layoutStatus.value === 'ready' &&
    Boolean(problemType.value) &&
    Boolean(boardFocus.value) &&
    !step1Confirmed.value
  )
})

const canConfirm = computed(() => {
  return (
    hasBoardContent.value &&
    recognizeStatus.value !== 'loading' &&
    !step1Confirmed.value
  )
})

const confirming = ref(false)

async function safeFetchJson(url, options = {}, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, options)
      const contentType = resp.headers.get('content-type') || ''
      if (!resp.ok) {
        let errText = ''
        if (contentType.includes('application/json')) {
          const errJson = await resp.json().catch(() => null)
          errText = errJson?.error || errJson?.message || `HTTP ${resp.status}`
        } else {
          const raw = await resp.text().catch(() => '')
          errText = raw.slice(0, 120) || `HTTP ${resp.status}`
        }
        if (i < retries && (resp.status >= 500 || resp.status === 404 || resp.status === 429)) {
          const waitMs = resp.status === 429 ? 2500 : 1500
          console.warn(`[safeFetchJson] 请求 ${url} 遇到 HTTP ${resp.status}，等待 ${waitMs}ms 后重试...`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        return { ok: false, error: errText }
      }
      if (!contentType.includes('application/json')) {
        const raw = await resp.text().catch(() => '')
        return { ok: false, error: '服务端返回非 JSON 数据: ' + (raw.slice(0, 80) || '未知响应') }
      }
      const data = await resp.json()
      return data
    } catch (err) {
      if (i < retries) {
        console.warn(`[safeFetchJson] 请求 ${url} 异常，等待 1500ms 后重试...`, err?.message)
        await new Promise(r => setTimeout(r, 1500))
        continue
      }
      return { ok: false, error: err?.message || '网络连接异常' }
    }
  }
}

const statusText = computed(() => {
  if (step1Confirmed.value) return '第1步已确认：题目已落在甲方画布题目层。'
  if (recognizeStatus.value === 'loading') return '识别中，识别完直接贴上画布…'
  if (layoutStatus.value === 'regenerating') return '按画布重新落位…'
  if (!hasBoardContent.value) return '初始是空白甲方画布。贴题后，题目直接放上去。'
  if (sourceImageUrl.value && !keepOriginal.value && problemText.value.trim()) {
    return '纯文字题图已按文本处理：画布只放题文，不贴原图。核对题型后可确认。'
  }
  if (!problemType.value || !boardFocus.value) return '确认题型与板书侧重。'
  if (knowledgeStatus.value !== 'success') return '题型已确认，可查询知识关联点，也可直接进入下一步。'
  return '看缩略画布：识别对不对、放位对不对。不好就重新生成。'
})

function resetKnowledgeQuery() {
  knowledgeStatus.value = 'idle'
  relatedKnowledge.value = []
  knowledgeError.value = ''
  knowledgeAnalysis.value = null
}

function suggestFromText(text) {
  const raw = text || ''
  // 题型特征模式识别与侧重匹配：几何题核心特征（面积/周长/角度/边长等）
  const geometryHit =
    /梯形|平行四边形|矩形|正方形|菱形|三角|圆|扇形|几何|图形|如图|作图|证明|∠|°|底边|高|对角线|相似|全等|平行|垂直|面积|周长|体积|边长|长|宽|角度|求角|夹角|圆心角|半径|直径|弦|弧|面积是多少|边长是多少/.test(
      raw,
    )
  if (geometryHit) {
    return { type: 'geometry', focus: 'geometry_diagram' }
  }
  if (/方程|计算|求值|化简|运算|简便|竖式/.test(raw)) {
    return { type: 'calculation', focus: 'calculation_process' }
  }
  // 应用题：一般有场景（小船、鸡兔同笼、行程工程买卖等），暂粗判
  if (
    /应用题|场景|小船|顺水|逆水|鸡兔同笼|鸡|兔|行程|工程|速度|工作效率|买|卖|原价|折扣|余下|还剩|一共|多少人|多少钱|果园|工厂|水池/.test(
      raw,
    )
  ) {
    return { type: 'word', focus: 'relation_understanding' }
  }
  return { type: undefined, focus: undefined }
}

function detectLandscape(dataUrl) {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve(img.naturalWidth / (img.naturalHeight || 1) > 1.4)
    img.onerror = () => resolve(false)
    img.src = dataUrl
  })
}

function applySuggestion(text) {
  const suggestion = suggestFromText(text)
  if (suggestion.type && !problemType.value) problemType.value = suggestion.type
  if (suggestion.focus && !boardFocus.value) boardFocus.value = suggestion.focus
}

function onProblemTypeChange(value) {
  resetKnowledgeQuery()
  problemType.value = value
  const preferred = boardFocusOptions.find(
    (item) => item.forTypes.includes(value) && item.value !== 'mixed',
  )
  if (preferred) boardFocus.value = preferred.value
}

function markLayoutReady() {
  layoutStatus.value = hasBoardContent.value ? 'ready' : 'idle'
}

async function placeOnCanvas({ fromUpload = false } = {}) {
  if (!sourceImageUrl.value && !problemText.value.trim()) {
    message.warning('请先上传图片或输入题目')
    return
  }

  recognizeStatus.value = 'loading'
  layoutStatus.value = 'regenerating'
  resetKnowledgeQuery()
  step1Confirmed.value = false
    boardPlan.value = null
    labelsPlanned.value = false
    showGrid.value = false

  try {
    // 真车间：本页多模态识别完，直接往甲方画布题目层放
    const result = await recognizeProblem({
      problemText: problemText.value,
      imageDataUrl: sourceImageDataUrl.value,
      model: userApiConfig.model,
      endpoint: userApiConfig.endpoint,
      apiKey: userApiConfig.apiKey,
    })

    if (result.problemText) problemText.value = result.problemText
    uncertainItems.value = result.uncertainItems || []
    suggestedLayout.value = result.suggestedLayout || null
    suggestedGrade.value = result.knowledgeAnalysis?.suggestedGrade || ''

    // 题型以题目内容为准：本地几何信号可纠正模型误判
    const localGuess = suggestFromText(result.problemText || problemText.value)
    const nextType = result.problemType || localGuess.type
    const nextFocus = result.boardFocus || localGuess.focus
    if (nextType) problemType.value = nextType
    if (nextFocus) boardFocus.value = nextFocus

    // Agent A 深度知识点分析结果：识别时 LLM 已直接产出，保存备用
    if (hasUsableAgentAKnowledge(result.knowledgeAnalysis)) {
      knowledgeAnalysis.value = result.knowledgeAnalysis
      // 同步填充 relatedKnowledge 兼容现有 UI 展示（用 coreKnowledge 数组）
      relatedKnowledge.value = (result.knowledgeAnalysis.coreKnowledge || []).map((k) => ({
        ...(k.rawKnowledgeRecord || {}),
        编号: k.knowledgeId,
        知识点: k.knowledgePoint,
        考点: k.examinationPoint,
        策略方法: k.strategy,
        易错点: k.commonMistakes.join('；'),
        总结归纳: k.summary,
        _formula: k.formula,
      }))
      knowledgeStatus.value = 'success'
    }

    // 图像贴图边界：纯文字题图归文本，不贴原图；只有识别为 has_diagram 才贴原图
    const imageKind = String(result.imageKind || '').toLowerCase()
    if (imageKind === 'text_only' || imageKind === 'text') {
      keepOriginal.value = false
    } else if (imageKind === 'has_diagram' || imageKind === 'diagram' || imageKind === 'figure') {
      keepOriginal.value = true
    } else if (typeof result.keepOriginal === 'boolean') {
      // 模型没给 imageKind 时：有图输入也默认不贴，除非明确 keepOriginal=true 且题干像“如图”
      const textNow = result.problemText || problemText.value || ''
      const diagramHint = /如图|见图|下图|右图|左图|图中|示意图|图形如下|看图/.test(textNow)
      keepOriginal.value = Boolean(result.keepOriginal) && diagramHint
    } else {
      keepOriginal.value = false
    }

    // 若仍缺题型/侧重，本地再补
    applySuggestion(problemText.value)

    layoutSeed.value += 1
    recognizeStatus.value = 'done'
    markLayoutReady()
    const pureTextImage = Boolean(sourceImageUrl.value) && !keepOriginal.value
    message.success(
      pureTextImage
        ? '纯文字题图：已按文本处理，不贴原图'
        : fromUpload
          ? '图片已识别并贴上画布'
          : '题目已识别并贴上画布',
    )
  } catch (error) {
    recognizeStatus.value = 'error'
    layoutStatus.value = 'idle'
    message.error(error?.message || '识别/落位未完成')
  }
}

async function regenerateLayout() {
  if (!hasBoardContent.value) {
    message.warning('画布上还没有题目')
    return
  }
  if (step1Confirmed.value) {
    message.info('已确认。要重排先撤销')
    return
  }
  layoutStatus.value = 'regenerating'
  customTopicLayout.value = null
  try { localStorage.removeItem('qinghuabu.customTopicLayout') } catch (_) {}
  await new Promise((resolve) => setTimeout(resolve, 280))
  layoutSeed.value += 1
  layoutStatus.value = 'ready'
  message.success('已恢复自动落位并重新排列')
}

async function beforeUpload(file) {
  if (!String(file.type || '').startsWith('image/')) {
    message.error('请上传图片')
    return false
  }

  try {
    if (sourceImageUrl.value) URL.revokeObjectURL(sourceImageUrl.value)
    sourceImageUrl.value = URL.createObjectURL(file)
    sourceImageName.value = file.name
    sourceImageDataUrl.value = await fileToDataUrl(file)
    // 横版检测：宽高比 > 1.4 视为横向图片
    isLandscape.value = await detectLandscape(sourceImageDataUrl.value)
    step1Confirmed.value = false
    // 上传只是入口；是否贴原图由识别判定（纯文字图=文本，不贴原图）
    keepOriginal.value = false

    if (agentConfig.autoRecognize) await placeOnCanvas({ fromUpload: true })
    else markLayoutReady()
  } catch (error) {
    message.error(error?.message || '读取图片失败')
  }
  return false
}

function onTextInput() {
  resetKnowledgeQuery()
  step1Confirmed.value = false
  if (problemText.value.trim()) {
    applySuggestion(problemText.value)
    markLayoutReady()
  } else if (!sourceImageUrl.value) {
    layoutStatus.value = 'idle'
  }
}

async function queryRelatedKnowledge() {
  if (!canQueryKnowledge.value) {
    message.warning('请先确认题目识别结果和题型')
    return
  }

  knowledgeStatus.value = 'loading'
  knowledgeError.value = ''
  try {
    await Promise.resolve()
    relatedKnowledge.value = selectAgentARelatedKnowledge({
      problemText: problemText.value,
      problemType: problemType.value,
    })
    knowledgeStatus.value = 'success'
    message.success(
      relatedKnowledge.value.length
        ? `已找到 ${relatedKnowledge.value.length} 条知识关联点`
        : '本题暂无精确匹配，已记录为未匹配',
    )
  } catch (error) {
    knowledgeStatus.value = 'error'
    knowledgeError.value = error?.message || '关联知识查询失败'
    message.error(knowledgeError.value)
  }
}

function onTopicMeasured(measurement) {
  if (!Number.isFinite(Number(measurement?.bottomPct))) return
  topicMeasurement.value = {
    bottomPct: Number(measurement.bottomPct),
    heightPct: Number(measurement.heightPct || 0),
  }
}

/*
async function cacheGridPreview(dataUrl) {
  if (!dataUrl || !('caches' in window)) return
  const cache = await caches.open(GRID_PREVIEW_CACHE_NAME)
  await cache.put(GRID_PREVIEW_CACHE_KEY, await fetch(dataUrl))
}

async function readCachedGridPreview() {
  if (!('caches' in window)) return ''
  const response = await (await caches.open(GRID_PREVIEW_CACHE_NAME)).match(GRID_PREVIEW_CACHE_KEY)
  if (!response) return ''
  const blob = await response.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
*/

async function planBoardLabels() {
  if (!hasBoardContent.value) {
    message.warning('请先识别并贴上题目')
    return
  }
  // 题目锚已定：一次规划四标签 + 打开网格比例尺（复用甲方落点，按题块高度弹性下移分析区）
  boardPlan.value = planLabelsFromTopic(
    {
      topicLabel: topicLayout.value.topicLabel,
      question: topicLayout.value.question,
      image: topicLayout.value.image,
    },
    {
      isLandscape: isLandscape.value && Boolean(sourceImageUrl.value) && keepOriginal.value,
      topicBottomPct: topicMeasurement.value.bottomPct,
    },
  )
  labelsPlanned.value = true
  showGrid.value = true
  message.success('已在真画布上规划：分析 / 解答 / 总结，并打开网格')
  // 截图存档：画布出现网格线+四角标+刻度后，截 .board-viewport 存 public/pic/
  await captureAndSaveScreenshot()
}

async function captureAndSaveScreenshot() {
  screenshotting.value = true
  try {
    await nextTick()
    // 等两帧渲染：确保 Vue 更新 + RealBoardPreview 内部四标签定位计算完成
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    // 渲染缓冲
    await new Promise(resolve => window.setTimeout(resolve, 800))
    // 再等一帧确保所有元素渲染完成
    await new Promise(resolve => requestAnimationFrame(resolve))
    const target = previewCaptureRef.value
    const snapdom = window.snapdom
    if (!target || !snapdom?.toCanvas) {
      console.warn('截图跳过：snapdom 未加载或目标元素不存在')
      return
    }
    // snapdom toCanvas → canvas.toDataURL JPG quality 0.8，embedFonts: false 避免外部字体 fetch 跨域/阻断
    const canvas = await Promise.race([
      snapdom.toCanvas(target, { scale: 1, dpr: 1, backgroundColor: '#ffffff', embedFonts: false }),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error('snapdom 截图超时')), SNAPSHOT_TIMEOUT_MS)),
    ])
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    const result = await safeFetchJson('/api/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: dataUrl }),
    }, 1)
    if (result.ok) {
      screenshotUrl.value = result.urlPath
      console.log('截图已存档：', result.urlPath)
      message.success('画布截图已保存至本地')
    } else {
      console.warn('截图存档提示：', result.error)
      message.warning('截图存档提示：' + (result.error || '无法写入'))
    }
  } catch (error) {
    console.warn('截图异常：', error?.message || error)
    message.warning('截图提示：' + (error?.message || String(error)))
  } finally {
    screenshotting.value = false
  }
}

async function confirmStep1() {
  if (!canConfirm.value || confirming.value) {
    message.warning('请先让题目正确落在画布上，并确认题型侧重')
    return
  }

  confirming.value = true
  try {
    // handoff 实体文件存档：写 public/handoff/ + current.json 指针，B 从 GET /api/handoff 读
    // screenshotUrl 来自画布截图存档，写入 handoff 实体文件，并提供给 Agent B 作为视觉感知与排版留白依据
    if (!screenshotUrl.value && previewCaptureRef.value) {
      try {
        await captureAndSaveScreenshot()
      } catch { /* 容错 */ }
    }

    // 进入下一步信号：确定进入生成表 → 把参数交给板书参数书稿页 / 页面B agent
    // 注意：apiKey/endpoint/model 由全局 userApiConfig 维护，不再放进 handoff
    const payload = buildStep1Handoff({
      screenshotUrl: screenshotUrl.value,
      problemText: problemText.value,
      problemType: problemType.value,
      boardFocus: boardFocus.value,
      keepOriginal: keepOriginal.value,
      imageKind: keepOriginal.value ? 'has_diagram' : 'text_only',
      hasSourceImage: Boolean(sourceImageUrl.value),
      sourceImageName: sourceImageName.value,
      // B 图片传输冻结：原图只用于 Agent A 识图，不进入 A -> B handoff。
      topicLayout: {
        topicLabel: topicLayout.value.topicLabel,
        question: topicLayout.value.question,
        image: topicLayout.value.image || null,
        keepOriginal: keepOriginal.value,
        blocks: topicLayout.value.blocks || null,
      },
      boardPlan: boardPlan.value,
      showGrid: showGrid.value,
      // B 图片传输冻结：快照仍由第 1 步缓存，但不进入 A -> B handoff。
      suggestedGrade: suggestedGrade.value,
      uncertainItems: uncertainItems.value,
      suggestedLayout: suggestedLayout.value,
      agentPageName: agentConfig.pageName,
      agentCapability: agentConfig.capability,
      // Agent A 深度知识点分析结果（识别时 LLM 已直接产出，传给 Agent B 作为参考素材）
      knowledgeAnalysis: knowledgeAnalysis.value,
      relatedKnowledge: knowledgeStatus.value === 'success' ? relatedKnowledge.value : null,
    })

    // 写 handoff 实体文件（失败必须阻断：文件即真相源，写失败不能继续）
    const result = await safeFetchJson('/api/handoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff: payload }),
    }, 1)

    if (result.ok) {
      step1Confirmed.value = true
      message.success('已进入板书参数书稿：题目 / 题型 / 侧重已交接')
      emit('enter-board-draft', payload)
    } else {
      console.error('handoff 写文件失败：', result.error)
      message.error(`题目信息保存失败：${result.error || '服务响应异常'}，请重试`)
    }
  } catch (error) {
    console.error('handoff 写文件异常：', error?.message || error)
    message.error(`题目信息保存失败：${error?.message || '网络异常'}，请重试或刷新页面`)
  } finally {
    confirming.value = false
  }
}

function resetConfirm() {
  step1Confirmed.value = false
}

function clearImage() {
  if (sourceImageUrl.value) URL.revokeObjectURL(sourceImageUrl.value)
  sourceImageUrl.value = ''
  sourceImageName.value = ''
  sourceImageDataUrl.value = ''
  step1Confirmed.value = false
  isLandscape.value = false
  markLayoutReady()
}

function saveAgentConfig() {
  saveUserApiConfig()
  saveAgentBApiConfig()
  saveCheckAgentApiConfig()
  localStorage.setItem(
    AGENT_STORAGE_KEY,
    JSON.stringify({
      capability: agentConfig.capability,
      autoRecognize: agentConfig.autoRecognize,
    }),
  )
  agentDrawerOpen.value = false
  message.success('Agent A、B、C 配置已分别保存')
}

function pct(style) {
  return {
    left: `${style.x}%`,
    top: `${style.y}%`,
    width: `${style.w}%`,
  }
}
</script>

<template>
  <a-layout class="qh-page">
    <QhPageHeader step-label="第 1 步 · 生产车间" subtitle="识别 → 真画布落位">
      <template #actions>
        <a-tag :color="userApiConfig.endpoint ? 'purple' : 'default'">{{ agentSummary }}</a-tag>
        <a-tooltip title="全屏画布预览">
          <a-button type="text" shape="circle" aria-label="全屏画布预览" @click="openFullscreenBoardPreview">
            <template #icon><FullscreenOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="本页 Agent 配置">
          <a-button type="text" shape="circle" aria-label="本页 Agent 配置" @click="agentDrawerOpen = true">
            <template #icon><SettingOutlined /></template>
          </a-button>
        </a-tooltip>
      </template>
    </QhPageHeader>
    <a-layout-content class="qh-page-content">
      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :lg="10">
          <a-card title="创建一道题" class="main-card qh-surface-card" :bordered="false">
            <div class="agent-a-params">
              <div class="param-head">
                <div>
                  <div class="param-title">Agent A 识别参数</div>
                  <div class="param-subtitle">确认后作为情报交给 Agent B</div>
                </div>
                <a-space size="small" wrap>
                  <a-tag>{{ suggestedLayoutLabel }}</a-tag>
                  <a-tag :color="knowledgeAnalysis?.coreKnowledge?.length ? 'blue' : 'default'">
                    知识 {{ knowledgeAnalysis?.coreKnowledge?.length || 0 }} 条
                  </a-tag>
                </a-space>
              </div>

              <div class="param-field param-field-wide">
                <div class="field-label">题目文本</div>
                <a-textarea
                  v-model:value="problemText"
                  :rows="6"
                  :disabled="step1Confirmed"
                  placeholder="支持文本输入；也可上传图片识别后落到这里"
                  @input="onTextInput"
                />
              </div>

              <div class="param-grid">
                <div class="param-field">
                  <div class="field-label">题目类型</div>
                  <a-select
                    v-model:value="problemType"
                    allow-clear
                    placeholder="参考类型"
                    style="width: 100%"
                    :disabled="step1Confirmed"
                    :options="problemTypeOptions"
                    @change="onProblemTypeChange"
                  />
                </div>
                <div class="param-field">
                  <div class="field-label">板书侧重</div>
                  <a-select
                    v-model:value="boardFocus"
                    allow-clear
                    placeholder="参考侧重"
                    style="width: 100%"
                    :disabled="step1Confirmed"
                    :options="boardFocusOptions.map((i) => ({ value: i.value, label: i.label }))"
                  />
                </div>
                <div class="param-field">
                  <div class="field-label">参考年级</div>
                  <a-input
                    v-model:value="suggestedGrade"
                    :disabled="step1Confirmed"
                    placeholder="如 5-6年级"
                  />
                </div>
              </div>

              <div v-if="uncertainItems.length" class="uncertain-row">
                <span class="uncertain-label">识别备注</span>
                <a-tag v-for="item in uncertainItems" :key="item" color="gold"  style="width: 100%">{{ item }}</a-tag>
              </div>
            </div>

            <div class="upload-actions">
              <a-upload
                :disabled="step1Confirmed"
                :show-upload-list="false"
                :before-upload="beforeUpload"
                accept="image/*"
              >
                <a-button :disabled="step1Confirmed">
                  <template #icon><CloudUploadOutlined /></template>
                  支持上传图片
                </a-button>
              </a-upload>
            </div>

            <div v-if="sourceImageUrl" class="image-mini">
              <img
                :src="sourceImageUrl"
                :alt="sourceImageName || '题目图片'"
                class="image-mini-thumb"
                title="点击查看题目原图"
                @click="sourceImagePreviewOpen = true"
              />
              <div class="image-mini-meta">
                <a-typography-text :content="sourceImageName" :ellipsis="{ tooltip: sourceImageName }" />
                <a-space size="small">
                  <a-switch v-model:checked="keepOriginal" size="small" :disabled="step1Confirmed" />
                  <a-typography-text type="secondary">原图入题（仅含图才开）</a-typography-text>
                  <a-typography-text v-if="sourceImageUrl && !keepOriginal" type="warning" style="font-size:11px">
                    纯文字图：归文本，不贴原图
                  </a-typography-text>
                  <a-button type="link" size="small" :disabled="step1Confirmed" @click="clearImage">移除</a-button>
                </a-space>
              </div>
            </div>

            <div class="actions">
              <a-button
                :loading="recognizeStatus === 'loading'"
                :disabled="step1Confirmed || (!sourceImageUrl && !problemText.trim())"
                @click="placeOnCanvas({ fromUpload: Boolean(sourceImageUrl) })"
              >
                识别并贴上画布
              </a-button>
              <a-button v-if="step1Confirmed" @click="resetConfirm">撤销确认</a-button>
            </div>

            <a-typography-text type="secondary" class="status">{{ statusText }}</a-typography-text>
          </a-card>
        </a-col>

        <a-col :xs="24" :lg="14">
          <a-card class="preview-card qh-surface-card" :bordered="false">
            <template #title>
              <span>预览</span>
              <a-typography-text type="secondary" class="preview-sub">
                缩小的真画布 · 初始空白 · 现做现产
              </a-typography-text>
            </template>
            <template #extra>
              <a-space>
                <a-button
                  size="small"
                  :loading="layoutStatus === 'regenerating'"
                  :disabled="!hasBoardContent || step1Confirmed"
                  @click="regenerateLayout"
                >
                  <template #icon><ReloadOutlined /></template>
                  重新生成落位
                </a-button>
                <a-button size="small" :disabled="!hasBoardContent" @click="openFullscreenBoardPreview">
                  全屏画布
                </a-button>
              </a-space>
            </template>

            <div class="board-viewport" ref="previewCaptureRef">
              <RealBoardPreview
                :problem-text="problemText"
                :topic-layout="topicLayout"
                :board-plan="boardPlan"
                :show-all-labels="labelsPlanned"
                :show-grid="showGrid"
                :show-zone-guides="labelsPlanned"
                :source-image-url="sourceImageUrl"
                :keep-original="keepOriginal"
                :interactive="labelsPlanned"
                @topic-measured="onTopicMeasured"
                @update:topic-layout="onTopicLayoutUpdated"
                @layout-change="onTopicLayoutUpdated"
                @update:problem-text="onProblemTextUpdated"
              />
              <div v-if="layoutStatus === 'regenerating'" class="board-mask-outer">落位中…</div>
            </div>

            <div class="preview-tools" v-if="hasBoardContent">
              <a-space wrap align="center">
                <a-button
                  size="small"
                  type="primary"
                  ghost
                  :disabled="step1Confirmed"
                  @click="planBoardLabels"
                >
                  {{ labelsPlanned ? '重新规划四标签+网格' : '规划四标签 + 网格' }}
                </a-button>
                <a-button
                  size="small"
                  :disabled="!labelsPlanned || step1Confirmed"
                  @click="showGrid = !showGrid"
                >
                  {{ showGrid ? '关闭网格' : '打开网格' }}
                </a-button>
                <a-button
                  size="small"
                  :disabled="!hasBoardContent"
                  @click="openFullscreenBoardPreview"
                >
                  全屏预览
                </a-button>
                <a-button
                  id="btn-shot-canvas"
                  size="small"
                  :disabled="!hasBoardContent"
                  :loading="screenshotting"
                  @click="captureAndSaveScreenshot"
                >
                  截取快照
                </a-button>
                <span v-if="screenshotUrl" class="screenshot-status">
                  <CheckCircleOutlined style="color: #52c41a" />
                  <span class="screenshot-url" @click="screenshotPreviewOpen = true">{{ screenshotUrl }}</span>
                </span>
              </a-space>
            </div>

            <a-typography-paragraph type="secondary" class="thumb-tip">
              客户看这里：字识对了没有、有没有放对地方。第1步没有技巧，纯粹识别 + 落画布。
            </a-typography-paragraph>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]" style="margin-top: 0">
        <a-col :xs="24">
          <a-card title="知识关联点" class="knowledge-card qh-surface-card" :bordered="false">
            <a-alert
              type="info"
              show-icon
              message="关联建议，不是唯一答案"
            />

            <a-space class="knowledge-actions" wrap>
              <a-button
                :loading="knowledgeStatus === 'loading'"
                :disabled="!canQueryKnowledge"
                @click="queryRelatedKnowledge"
              >
                <template #icon><SearchOutlined /></template>
                <span>查询知识关联点</span>
              </a-button>
              <a-typography-text type="secondary">可选步骤，不作为进入下一步的门槛</a-typography-text>
            </a-space>

            <a-alert
              v-if="knowledgeStatus === 'error'"
              class="knowledge-state"
              type="error"
              show-icon
              :message="knowledgeError"
            />

            <a-empty
              v-else-if="knowledgeStatus === 'success' && relatedKnowledge.length === 0"
              class="knowledge-state"
              :image="null"
              description="暂未匹配到明确关联点，Agent B 仍可继续处理"
            />

            <div
              v-else-if="relatedKnowledge.length"
              class="knowledge-chips"
            >
              <a-tag
                v-for="item in relatedKnowledge"
                :key="item['编号'] || item['知识点']"
                color="blue"
                class="knowledge-chip"
                @click="selectedKnowledge = item"
              >
                {{ item['知识点'] || '未命名知识点' }}
              </a-tag>
            </div>

            <a-divider />
            <a-space wrap>
              <a-button type="primary" :loading="confirming" :disabled="!canConfirm || confirming" @click="confirmStep1">
                <template #icon><CheckCircleOutlined /></template>
                确定进入生成表
              </a-button>
              <a-typography-text v-if="knowledgeStatus === 'success'" type="secondary">
                将携带 {{ relatedKnowledge.length }} 条关联建议交给 Agent B
              </a-typography-text>
            </a-space>
          </a-card>
          <a-modal
            :open="Boolean(selectedKnowledge)"
            :title="selectedKnowledge?.['知识点'] || '知识点详情'"
            width="720px"
            :footer="null"
            @cancel="selectedKnowledge = null"
          >
            <a-descriptions v-if="selectedKnowledge" bordered size="small" :column="1" class="knowledge-detail-table">
              <a-descriptions-item label="编号">{{ selectedKnowledge['编号'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="学段 / 系列 / 类型">
                {{ [selectedKnowledge['学段'], selectedKnowledge['系列'], selectedKnowledge['类型']].filter(Boolean).join(' / ') || '未提供' }}
              </a-descriptions-item>
              <a-descriptions-item label="经典样题">{{ selectedKnowledge['经典样题'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="考点">{{ selectedKnowledge['考点'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="策略方法">{{ selectedKnowledge['策略方法'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="讲解要点">{{ selectedKnowledge['讲解要点举例'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="易错点">{{ selectedKnowledge['易错点'] || '未提供' }}</a-descriptions-item>
              <a-descriptions-item label="公式">{{ selectedKnowledge._formula || '按本题判断' }}</a-descriptions-item>
              <a-descriptions-item label="总结归纳">{{ selectedKnowledge['总结归纳'] || '未提供' }}</a-descriptions-item>
            </a-descriptions>
          </a-modal>
        </a-col>
      </a-row>
    </a-layout-content>

    <a-drawer
      v-model:open="agentDrawerOpen"
      title="本页 Agent 配置"
      placement="right"
      width="min(480px, 100vw)"
    >
      <a-form layout="vertical" class="agent-form">
        <div class="param-title">Agent A · 题目识别</div>
        <div class="param-subtitle">自定义 OpenAI 兼容模型；接口地址必须是完整 Chat Completions URL。</div>
        <a-form-item label="能力">
          <a-select
            v-model:value="agentConfig.capability"
            :options="[
              { value: 'multimodal', label: '多模态（图+文）' },
              { value: 'text', label: '纯文本' },
              { value: 'vision', label: '偏视觉' },
            ]"
          />
        </a-form-item>
        <a-form-item label="接口地址（仅支持 OpenAI 兼容协议 API）">
          <a-input-password
            v-model:value="userApiConfig.endpoint"
            placeholder="https://api.example.com/v1/chat/completions"
            :visibility-toggle="false"
          />
          <a-typography-text type="secondary" style="font-size:11px">
            填完整请求地址，服务端不会自动拼接 /chat/completions
          </a-typography-text>
        </a-form-item>
        <a-form-item label="模型名称">
          <a-input
            v-model:value="userApiConfig.model"
            placeholder="输入支持多模态的模型名称"
          />
          <a-typography-text type="secondary" style="font-size:11px">
            ⚠ 不能用 gpt-5.4 等纯文本模型；要支持 image_url 输入
          </a-typography-text>
        </a-form-item>
        <a-form-item label="API Key">
          <a-input-password
            v-model:value="userApiConfig.apiKey"
            placeholder="输入 API Key（多个用英文逗号,隔开轮询）"
            autocomplete="off"
            :visibility-toggle="false"
          />
          <a-typography-text type="secondary" style="font-size:11px; display:block; margin-top:3px;">
            <span v-if="parseApiKeys(userApiConfig.apiKey).length > 1" style="color:#10b981; font-weight:600;">
              ✓ 已检测到 {{ parseApiKeys(userApiConfig.apiKey).length }} 个密钥，自动轮询并支持故障转移
            </span>
            <span v-else>
              💡 支持多个密钥（用英文小写逗号 <code>,</code> 隔开），请求时自动轮询
            </span>
          </a-typography-text>
        </a-form-item>
        <a-form-item label="选图后自动识别并贴画布">
          <a-switch v-model:checked="agentConfig.autoRecognize" />
        </a-form-item>
        <a-space wrap>
          <a-tag :color="isUserApiReady() ? 'success' : 'default'">
            {{ isUserApiReady() ? `Agent A 可调用 (${parseApiKeys(userApiConfig.apiKey).length} Key)` : '请填完整接口地址、API Key、模型名称' }}
          </a-tag>
        </a-space>

        <a-divider />
        <div class="param-title">Agent B · 添加自定义模型</div>
        <div class="param-subtitle">只接 OpenAI 兼容协议 API；接口地址必须是完整 Chat Completions URL。</div>
        <a-form-item label="模型厂商">
          <a-select
            :value="'custom'"
            :options="[
              { value: 'custom', label: '自定义' },
            ]"
            disabled
          />
        </a-form-item>
        <a-form-item label="接口地址（仅支持 OpenAI 兼容协议 API）">
          <a-input-password
            v-model:value="agentBApiConfig.endpoint"
            placeholder="https://api.example.com/v1/chat/completions"
            :visibility-toggle="false"
          />
        </a-form-item>
        <a-form-item label="API Key">
          <a-input-password
            v-model:value="agentBApiConfig.apiKey"
            placeholder="输入 API Key（多个用英文逗号,隔开轮询）"
            autocomplete="off"
            :visibility-toggle="false"
          />
          <a-typography-text type="secondary" style="font-size:11px; display:block; margin-top:3px;">
            <span v-if="parseApiKeys(agentBApiConfig.apiKey).length > 1" style="color:#10b981; font-weight:600;">
              ✓ 已检测到 {{ parseApiKeys(agentBApiConfig.apiKey).length }} 个密钥，自动轮询并支持故障转移
            </span>
            <span v-else>
              💡 支持多个密钥（用英文小写逗号 <code>,</code> 隔开），请求时自动轮询
            </span>
          </a-typography-text>
        </a-form-item>
        <a-form-item label="模型名称">
          <a-input
            v-model:value="agentBApiConfig.model"
            placeholder="输入模型名称"
          />
        </a-form-item>
        <a-tag :color="isAgentBApiReady() ? 'success' : 'default'">
          {{ isAgentBApiReady() ? `Agent B 可调用 (${parseApiKeys(agentBApiConfig.apiKey).length} Key)` : '请填完整接口地址、API Key、模型名称' }}
        </a-tag>

        <a-divider />
        <div class="param-title">Agent C · 内容检查</div>
        <div class="param-subtitle">自定义 OpenAI 兼容模型；接口地址必须是完整 Chat Completions URL。</div>
        <a-form-item label="接口地址（仅支持 OpenAI 兼容协议 API）">
          <a-input-password
            v-model:value="checkAgentApiConfig.endpoint"
            placeholder="https://api.example.com/v1/chat/completions"
            :visibility-toggle="false"
          />
        </a-form-item>
        <a-form-item label="模型名称">
          <a-input v-model:value="checkAgentApiConfig.model" placeholder="输入模型名称" />
        </a-form-item>
        <a-form-item label="API Key">
          <a-input-password
            v-model:value="checkAgentApiConfig.apiKey"
            placeholder="输入 API Key（多个用英文逗号,隔开轮询）"
            autocomplete="off"
            :visibility-toggle="false"
          />
          <a-typography-text type="secondary" style="font-size:11px; display:block; margin-top:3px;">
            <span v-if="parseApiKeys(checkAgentApiConfig.apiKey).length > 1" style="color:#10b981; font-weight:600;">
              ✓ 已检测到 {{ parseApiKeys(checkAgentApiConfig.apiKey).length }} 个密钥，自动轮询并支持故障转移
            </span>
            <span v-else>
              💡 支持多个密钥（用英文小写逗号 <code>,</code> 隔开），请求时自动轮询
            </span>
          </a-typography-text>
        </a-form-item>
        <a-tag :color="isCheckAgentApiReady() ? 'success' : 'default'">
          {{ isCheckAgentApiReady() ? `Check Agent 可调用 (${parseApiKeys(checkAgentApiConfig.apiKey).length} Key)` : '请填完整接口地址、API Key、模型名称' }}
        </a-tag>
      </a-form>
      <template #footer>
        <a-button type="primary" block @click="saveAgentConfig">保存配置</a-button>
      </template>
    </a-drawer>

    <a-modal
      v-model:open="screenshotPreviewOpen"
      title="画布截图预览"
      :footer="null"
      width="80%"
      :destroy-on-close="true"
    >
      <img :src="screenshotUrl" alt="画布截图" style="width: 100%; display: block;" />
    </a-modal>

    <a-modal
      v-model:open="sourceImagePreviewOpen"
      :title="sourceImageName || '题目原图预览'"
      :footer="null"
      :width="640"
      :destroy-on-close="true"
      centered
    >
      <div style="text-align: center; max-height: 70vh; overflow: auto; padding: 8px 0;">
        <img
          :src="sourceImageUrl"
          :alt="sourceImageName || '题目原图'"
          style="max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);"
        />
      </div>
    </a-modal>
  </a-layout>
</template>

<style scoped>
.knowledge-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.knowledge-chips .ant-tag {
  margin: 0;
  line-height: 22px;
}

/* 壳层宽度/顶栏见 style.css：--page-max-width 等 */

.preview-card {
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  min-height: 560px;
}

.main-card {
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
}

.field-label {
  margin: 0 0 6px;
  color: #475569;
  font-size: 12.5px;
  font-weight: 500;
}

.agent-a-params {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.param-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  margin-bottom: 14px;
}

.param-title {
  color: #0f172a;
  font-size: 13.5px;
  font-weight: 600;
}

.param-subtitle {
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
}

.param-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 0.8fr;
  gap: 12px;
  margin-top: 12px;
}

.param-field {
  min-width: 0;
}

.uncertain-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 12px;
}

.uncertain-label {
  color: #b45309;
  font-size: 11px;
  font-weight: 500;
}

.upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}

.image-mini {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.image-mini-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  cursor: pointer;
  background: #ffffff;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.image-mini-thumb:hover {
  transform: scale(1.03);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1);
}

.image-mini-meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
}

.status {
  display: block;
  margin-top: 10px;
  font-size: 12px;
  color: #64748b;
}

.preview-sub {
  margin-left: 8px;
  font-size: 11.5px;
  color: #64748b;
}

.board-viewport {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 420px;
  padding: 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.board-mask-outer {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.75);
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
  backdrop-filter: blur(2px);
}

.thumb-tip {
  margin: 12px 0 0;
  font-size: 11.5px;
  color: #64748b;
}

.screenshot-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
}

.screenshot-url {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.screenshot-url:hover {
  color: #1d4ed8;
}

.knowledge-card {
  margin-top: 16px;
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
}

.knowledge-actions {
  margin-top: 14px;
}

.knowledge-state,
.knowledge-list {
  margin-top: 12px;
}

.knowledge-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.knowledge-chip {
  margin: 0;
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.knowledge-chip:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12);
}

.knowledge-detail-table :deep(.ant-descriptions-item-label) {
  width: 132px;
  color: #49627c;
  background: #f6faff;
}

.knowledge-list :deep(.ant-list-item-meta-description) {
  color: #595959;
}

.knowledge-card :deep(.ant-divider-horizontal) {
  margin: 11px 0;
}

.agent-form {
  max-width: 100%;
}

@media (max-width: 768px) {
  .param-head,
  .param-grid {
    grid-template-columns: 1fr;
  }

  .preview-card {
    min-height: auto;
  }

  .board-viewport {
    min-height: 260px;
  }
}
</style>
