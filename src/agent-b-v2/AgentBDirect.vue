<script setup>
/* @qh-core LANE=B-V2 POINT=UI_WORKBENCH five-field table primary */
import { computed, ref, toRaw, watch, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import {
  CheckCircleOutlined,
  WarningOutlined,
  DownloadOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  PlusOutlined,
  DeleteOutlined,
  RollbackOutlined,
  SoundOutlined,
  SafetyCertificateOutlined,
  FieldTimeOutlined,
  EyeOutlined,
  ReloadOutlined,
  FileDoneOutlined,
  HolderOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  CopyOutlined,
  PauseCircleOutlined,
  KeyOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons-vue'
import QhPageHeader from '../components/QhPageHeader.vue'
import ProcessLoadingModal from '../components/ProcessLoadingModal.vue'
import { getAgentBoardToolCatalog } from '../board-tools/boardToolCatalog.js'
import { BOARD_MARK_COLORS } from '../board-tools/roughNotationTool.js'
import { ROUGH_DRAWING_COLORS } from '../board-tools/roughDrawingTool.js'
import { saveLiveBoardPreview } from '../board-preview/liveBoardPreview.js'
import { generateAgentBV2Rows } from './service.js'
import { applyAgentBV2Timeline, computeRowGroupTimeline, countCharacters, estimateSpeechDurationMs, AGENT_B_V2_SPEECH_RATE } from './timing.js'
import { listSkills, DEFAULT_SKILL_ID } from './skills/index.js'
import { checkAgentRows, applyCheckResult } from '../check-agent/service.js'
import { batchPolishRowsMathAsr } from '../lib/mathAsrConverter.js'
import {
  agentBApiConfig,
  saveAgentBApiConfig,
  isAgentBApiReady,
  parseApiKeys as parseAgentBApiKeys,
} from '../lib/agentBApiConfig.js'
import { userApiConfig } from '../lib/userApiConfig.js'
// ★ 2026-10-14：refine/apply 原为全 App 仅剩的裸 fetch+resp.json()——平台网关切断/代理吐
// HTML 错误页时直接炸 SyntaxError（夏夏实测"点优化确认出现 json 报错"）。换共享安全封装。
import { safeJsonFetch } from '../lib/safeJsonFetch.js'
import { exportSpeechMarkdown, exportStoryboardMarkdown } from '../lib/speechMarkdown.js'
import VisualTimeline from '../components/VisualTimeline.vue'
import { showGlobalLoading, hideGlobalLoading } from '../services/globalLoading.js'
// 画布参数唯一真源：src/services/stepHandoff.js
// ★ Task 10: 引入完整常量避免硬编码字号/字体/行高
import {
  QUESTION_FONT_SIZE,
  QUESTION_LINE_HEIGHT,
  CANVAS_SIZE,
  buildCanvasParams,
} from '../services/stepHandoff.js'
// ponytail: 拆分 composables (从 AgentBDirect.vue 抽出纯逻辑)
import { useBCache } from './composables/useBCache.js'

const props = defineProps({
  initialHandoff: { type: Object, required: true },
})
const emit = defineEmits(['back-to-step1'])

// 安全深拷贝：规避 Vue reactive proxy 循环引用与不可序列化对象抛错导致的白屏
function safeDeepClone(val, fallback = {}) {
  try {
    if (val === undefined || val === null) return fallback
    return JSON.parse(JSON.stringify(toRaw(val)))
  } catch (err) {
    console.warn('[safeDeepClone] 数据深拷贝异常，已启用安全浅拷贝降级:', err)
    return (val && typeof val === 'object') ? { ...val } : fallback
  }
}

const localHandoff = ref(safeDeepClone(props.initialHandoff))
const handoff = computed(() => localHandoff.value)
// props 变化时同步更新 localHandoff（父组件重新传入 handoff 时）
watch(() => props.initialHandoff, (val) => {
  if (val) localHandoff.value = safeDeepClone(val)
}, { deep: true })

// 智能教研优雅思考步骤（分散等待时长，直观感知深度创作进程）
const GENERATING_STEPS = [
  { icon: '🔍', title: '研读题意与条件', desc: '正在解析关键已知条件、未知量与四区板书空间规划...' },
  { icon: '💡', title: '搭建儿童思维支架', desc: '正在唤醒核心知识点，梳理温柔循序的提问链与易错点...' },
  { icon: '✍️', title: '规划板书内容与节拍', desc: '正在推导板书核心算式，按教学内容安排自然留白...' },
  { icon: '🎙️', title: '润色专属口播文案', desc: '正在推敲由浅入深、温润自然的口播发音节奏与标点停顿...' },
  { icon: '✨', title: '对齐讲学时序分镜', desc: '正在校验口播语速与画布动作执行轴，五字段讲义即将呈现...' },
]
const generatingStepIndex = ref(0)
let generatingTimer = null
const handoffDetailsExpanded = ref(true)

function startGeneratingTimer() {
  generatingStepIndex.value = 0
  clearInterval(generatingTimer)
  generatingTimer = setInterval(() => {
    generatingStepIndex.value = (generatingStepIndex.value + 1) % GENERATING_STEPS.length
  }, 2800)
}

function stopGeneratingTimer() {
  clearInterval(generatingTimer)
  generatingTimer = null
}

onMounted(async () => {
  if (!localHandoff.value || !localHandoff.value.canvasParams || !localHandoff.value.zoneAnchors || !localHandoff.value.screenshotUrl) {
    try {
      const res = await fetch('/api/handoff')
      const data = await res.json()
      if (data?.ok && data?.handoff) {
        localHandoff.value = safeDeepClone(data.handoff)
      }
    } catch {
      // 容错降级
    }
  }
})

onUnmounted(() => {
  stopGeneratingTimer()
  stopCurrentAudio()
})
const rows = ref([])
const state = ref('idle')
const errorText = ref('')
const generatedModel = ref('')
const checkState = ref('idle')
const checkChanges = ref([])
const checkSource = ref('check_agent') // 'check_agent' | 'math_asr'
const pendingCheckRows = ref(null)
const checkResultOpen = ref(false)
const checkFailedFallback = ref(false)
const deliverableGenerating = ref(false)
const deliverableResult = ref(null)
const deliverableModalOpen = ref(false)
const toolsOpen = ref(false)
const refineLoading = ref(false)
const refineApplying = ref(false)
const refineResultOpen = ref(false)
const refineResult = ref(null)
const refineAppliedAt = ref('')
const skillList = listSkills()
const selectedSkillId = ref(DEFAULT_SKILL_ID)
// ponytail: a-select 风格切换下拉的 options (替代旧"提示词"按钮, 不查看提示词内容)
const skillOptions = skillList.map(s => ({ value: s.id, label: s.name || s.id }))
function onSkillChange(val) {
  selectedSkillId.value = val
  message.success(`已切换讲课风格：${skillList.find(s => s.id === val)?.name || val}`)
}
const apiConfigOpen = ref(false)
const cleanupLoading = ref(false)

async function cleanupGeneratedFiles() {
  cleanupLoading.value = true
  try {
    const res = await fetch('/api/cleanup', { method: 'POST' })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || '清理失败')
    const size = data.bytes >= 1024 * 1024
      ? `${(data.bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.round(data.bytes / 1024)} KB`
    message.success(data.count ? `已清理 ${data.count} 个文件，释放 ${size}` : '没有可清理的垃圾文件')
    if ('caches' in window) {
      for (const key of await window.caches.keys()) await window.caches.delete(key)
    }
  } catch (error) {
    message.error(`清理失败：${error?.message || String(error)}`)
  } finally {
    cleanupLoading.value = false
  }
}

function onSaveApiConfig() {
  saveAgentBApiConfig()
  const keyCount = parseAgentBApiKeys(agentBApiConfig.apiKey).length
  if (keyCount > 1) {
    message.success(`Agent B 配置已保存，已配置 ${keyCount} 个密钥轮询使用`)
  } else {
    message.success('Agent B API 配置已保存')
  }
  apiConfigOpen.value = false
}
// ★ Task 13：死功能链砍除——自定义提示词弹窗无 UI 入口（promptEditOpen 恒 false，
// customSystemPrompt 恒空串），整链（ref→弹窗→useBCache 键位→service 传参→server 分支）全砍
const currentSkillName = computed(() => {
  const skill = skillList.find(s => s.id === selectedSkillId.value)
  return skill?.name || selectedSkillId.value
})
let checkRunId = 0
const toolCatalog = getAgentBoardToolCatalog()
const checkFieldLabels = {
  stage: '环节',
  speech: '口播稿',
  board: '板书内容',
  board_timing: '板书落笔时机',
  actionSpec: '板书动作',
  answer_error: '数学核验',
  structure: '结构精简',
}

const toolLabels = {
  underline: '下划线',
  highlight: '高亮',
  circle: '画圈', // 2026-10-13 第七轮：circle 接入白名单后的弹层中文标签
  'rough-line': '辅助线',
  'rough-arrow': '箭头',
}

function formatToolFields(schema) {
  return Object.entries(schema).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }))
}

function formatToolExample(example) {
  return JSON.stringify({ action: example }, null, 2)
}

const toolReferenceRows = toolCatalog.tools.flatMap((tool) => {
  if (tool.actions) {
    return tool.actions.map((item) => ({
      key: item.action,
      tool: tool.id,
      label: toolLabels[item.action] || item.action,
      summary: item.description,
      fields: formatToolFields({ ...tool.actionSchema, action: item.action }),
      example: formatToolExample(item.example),
    }))
  }
  return [{
    key: tool.id,
    tool: tool.id,
    label: toolLabels[tool.id] || tool.id,
    summary: tool.purpose,
    fields: formatToolFields(tool.actionSchema),
    example: formatToolExample(tool.example),
  }]
})

// 画布参数配置（导出时跟着要素表一起导出）
const canvasParams = ref({
  coordinateMode: 'percentage',
  questionFontSize: QUESTION_FONT_SIZE,
  questionFontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  questionLineHeight: QUESTION_LINE_HEIGHT,
  rowGapMs: 1500,
  speechSpeed: 160,
})

// board 列编辑状态：-1 表示无编辑，>=0 表示正在编辑的行索引
const editingBoardIndex = ref(-1)

// 解析 board 字段，兼容历史坐标前缀和当前对象格式。
// ponytail: parseBoard 归并到 contract.js#normalizeBoard 唯一真源
// 保留 parseBoard 名字兼容模板 6 处调用，内部委托 normalizeBoard
// 差异: null startDelay（无显式值时） vs normalizeBoard 的 0，模板里 v-if/.value 都按 falsy 处理
import { normalizeBoard } from './contract.js'
function parseBoard(board) {
  const n = normalizeBoard(board)
  // 把 0 还原为 null 以保持原模板显示语义（避免 +0s）
  return { content: n.content, startDelay: n.startDelay || null }
}

// ponytail: 板书列渲染 — 先过 superFilter 清洗, 再用 KaTeX 渲染, v-html 前转义
import { normalizeBoardLine } from '../utils/superFilter.js'
function renderBoardContent(board) {
  const { content } = parseBoard(board)
  if (!content) return ''
  // 每行先过 superFilter 10 步清洗 (×→x, ÷→/, $删除, LaTeX→Unicode 等)
  let result = content.split('\n')
    .map(line => normalizeBoardLine(line))
    .filter(line => line.length)
    .join('\n')
  if (!result) return ''
  // 处理 $$...$$（display mode）
  result = result.replace(/\$\$([\s\S]+?)\$\$/g, (match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true, strict: 'ignore' })
    } catch { return match }
  })
  // 处理 $...$（inline mode）
  result = result.replace(/\$([^$\n]+?)\$/g, (match, expr) => {
    try {
      return katex.renderToString(expr.trim(), { throwOnError: false, strict: 'ignore' })
    } catch { return match }
  })
  // 处理裸 LaTeX（包含 \frac \begin \sqrt 等）
  if (/\\(frac|begin|sqrt|sum|int|lim|boxed|times|div|cdot|leq|geq|neq|approx|pm|infty|alpha|beta|gamma|delta|theta|lambda|pi|perp|parallel|angle|triangle|odot|text|mathrm|mathbf|mathcal|mathbb|operatorname|over)/.test(result)) {
    try {
      return katex.renderToString(result, { throwOnError: false, strict: 'ignore' })
    } catch { return result }
  }
  return result
}

// 列空间合理分配与自由折叠模式（支持按需折叠每列，超大留白，杜绝劣质滑动条）
const layoutPreset = ref('standard') // 'standard' | 'speech_focus' | 'board_focus' | 'custom'
const collapsedCols = ref({
  speech: false,
  board: false,
  actionSpec: false,
})

// ponytail: 4 分支 if/else 改表驱动（shrink -5 行）
const LAYOUT_PRESETS = {
  standard:     { speech: false, board: false, actionSpec: false },
  speech_focus: { speech: false, board: true,  actionSpec: true  },
  board_focus:  { speech: true,  board: false, actionSpec: false },
}
function setLayoutPreset(preset) {
  layoutPreset.value = preset
  Object.assign(collapsedCols.value, LAYOUT_PRESETS[preset] || {})
}

function toggleColumn(colKey) {
  layoutPreset.value = 'custom'
  collapsedCols.value[colKey] = !collapsedCols.value[colKey]
}

const columns = computed(() => {
  const isSpeechCol = collapsedCols.value.speech
  const isBoardCol = collapsedCols.value.board
  const isActionCol = collapsedCols.value.actionSpec

  return [
    {
      title: '排序',
      key: 'index',
      width: 70,
      align: 'center',
    },
    {
      title: '教学环节',
      key: 'stage',
      width: 86,
      align: 'center',
    },
    {
      title: isSpeechCol ? '口播 (已折叠)' : '演播室口播稿 (Speech)',
      key: 'speech',
      width: isSpeechCol ? 78 : (isBoardCol && isActionCol ? '72%' : isBoardCol ? '58%' : '46%'),
      minWidth: isSpeechCol ? 78 : 280,
    },
    {
      title: isBoardCol ? '板书 (已折叠)' : '课堂同步板书 (Board)',
      key: 'board',
      width: isBoardCol ? 78 : (isSpeechCol && isActionCol ? '72%' : isSpeechCol ? '58%' : '38%'),
      minWidth: isBoardCol ? 78 : 220,
    },
    {
      title: isActionCol ? '动作' : '板书动作',
      key: 'actionSpec',
      width: isActionCol ? 64 : 106,
      align: 'center',
    },
    {
      title: '行操作',
      key: 'operations',
      width: 106,
      align: 'center',
    },
  ]
})

// ponytail: 唯一字数+时长真源来自 timing.js (countCharacters 剥标点 + estimateSpeechDurationMs 含 1500ms 下限 + 标点停顿)
function getRowEstimatedSeconds(speech) {
  const charCount = countCharacters(speech)
  const sec = Math.max(1, Math.round(estimateSpeechDurationMs(speech, { speed: canvasParams.value?.speechSpeed || AGENT_B_V2_SPEECH_RATE }) / 1000))
  return { charCount, seconds: sec }
}

// 计算全表总预估时长与总字数
const totalEstimatedStats = computed(() => {
  if (!rows.value.length) return { charCount: 0, text: '0秒', seconds: 0 }
  let totalChars = 0
  let totalSpeechMs = 0
  rows.value.forEach((r) => {
    totalChars += countCharacters(r.speech)
    totalSpeechMs += estimateSpeechDurationMs(r.speech, { speed: canvasParams.value?.speechSpeed || AGENT_B_V2_SPEECH_RATE })
  })
  const totalGapMs = (rows.value.length - 1) * (canvasParams.value?.rowGapMs || 1500)
  const totalSec = Math.round((totalSpeechMs + totalGapMs) / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const timeStr = `${m > 0 ? `${m}分` : ''}${s}秒`
  return { charCount: totalChars, text: timeStr, seconds: totalSec }
})

// 计算全表板书动作规范总数
const totalActionCount = computed(() => {
  if (!rows.value.length) return 0
  return rows.value.reduce((acc, r) => acc + (Array.isArray(r.actionSpec) ? r.actionSpec.length : 0), 0)
})

// ponytail: 合并所有行的 actionSpec 给画布预览播放
// 纯前端本地数学算式口播兜底秒级转换（双保险核心）
function runInstantMathAsrPolish() {
  if (!rows.value.length) {
    message.warning('请先生成五字段执行表后再进行 ASR 兜底转换')
    return
  }
  const result = batchPolishRowsMathAsr(rows.value)
  if (!result.changes.length) {
    message.success('当前口播稿已全部符合数学自然读音规范，无需调整 ╰(๑◕ ▿ ◕๑)╯')
    return
  }
  pendingCheckRows.value = result.rows
  checkChanges.value = result.changes
  checkSource.value = 'math_asr'
  checkState.value = 'ready'
  checkResultOpen.value = true
  checkFailedFallback.value = false
  message.success(`已完成数学算式纯前端兜底分析，共发现 ${result.changes.length} 处规范化建议，已打开对比弹窗`)
}

let rowKeySeq = 1
const rowKeyWeakMap = new WeakMap()

const tableRows = computed(() =>
  rows.value.map((row, index) => {
    let key = rowKeyWeakMap.get(row)
    if (!key) {
      key = `row-uid-${rowKeySeq++}-${index}`
      rowKeyWeakMap.set(row, key)
    }
    return { ...row, _rowKey: key }
  })
)
const problemTypeLabel = computed(() => ({
  geometry: '几何题',
  calculation: '计算题',
  word: '应用题',
}[handoff.value?.problemType] || handoff.value?.problemType || '未确认'))
const pureTextLabel = computed(() => (handoff.value?.imageKind || 'text_only') === 'text_only' ? '是' : '否')
const boardFocusLabel = computed(() => ({
  geometry_diagram: '几何图解',
  calculation_process: '演算过程',
  relation_understanding: '关系理解',
  mixed: '综合分析',
}[handoff.value?.boardFocus] || handoff.value?.boardFocus || '未确认'))
const relatedKnowledge = computed(() => Array.isArray(handoff.value?.relatedKnowledge)
  ? handoff.value.relatedKnowledge
  : [])
const knowledgeAnalysis = computed(() => handoff.value?.knowledgeAnalysis || null)
const coreKnowledge = computed(() => Array.isArray(knowledgeAnalysis.value?.coreKnowledge)
  ? knowledgeAnalysis.value.coreKnowledge
  : [])
const selectedKnowledge = ref(null)
const keyFormulaList = computed(() => Array.isArray(knowledgeAnalysis.value?.keyFormulaList)
  ? knowledgeAnalysis.value.keyFormulaList
  : [])
const uncertainItems = computed(() => Array.isArray(handoff.value?.uncertainItems)
  ? handoff.value.uncertainItems
  : [])
const suggestedLayoutLabel = computed(() => ({
  left_right: '左右布局',
  top_bottom: '上下布局',
}[handoff.value?.suggestedLayout?.layout] || handoff.value?.suggestedLayout?.layout || '无'))
const confirmedAtLabel = computed(() => formatDisplayTime(handoff.value?.confirmedAt))
const zoneParameterRows = computed(() => {
  const anchors = handoff.value?.zoneAnchors || {}
  const labels = { question: '题目区', analysis: '分析区', solution: '解答区', summary: '总结区' }
  return Object.entries(labels).map(([key, label]) => ({
    key,
    label,
    value: formatRegion(anchors[key]?.regionStartCoord),
  }))
})
const handoffFlowSteps = computed(() => [
  { title: '识别题目', status: 'finish', description: '第1步已确认' },
  { title: '判断题型', status: handoff.value?.problemType ? 'finish' : 'wait', description: problemTypeLabel.value },
  { title: '画布排版', status: handoff.value?.boardPlan ? 'finish' : 'wait', description: '真画布与四区布局' },
  {
    title: '知识关联',
    status: relatedKnowledge.value.length ? 'finish' : 'wait',
    description: relatedKnowledge.value.length ? `${relatedKnowledge.value.length} 条可选参考` : '可选，按题目判断',
  },
  { title: '组装输入', status: 'finish', description: '题目、图片、布局、工具' },
  {
    title: '待发送生成',
    status: state.value === 'generating' ? 'process' : rows.value.length ? 'finish' : 'wait',
    description: state.value === 'generating'
      ? '正在生成 Agent B 五字段'
      : rows.value.length
        ? `已生成 ${rows.value.length} 行`
        : '准备就绪 · 点击生成',
  },
])

function formatDisplayTime(value) {
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.valueOf()) ? String(value || '') : date.toLocaleString('zh-CN', { hour12: false })
}

function displayValue(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function formatRegion(region) {
  if (!region) return '未规划'
  const pct = (value) => Number(Number(value).toFixed(2))
  const size = region.w == null ? '' : `，宽 ${pct(region.w)}%${region.h == null ? '' : `，高 ${pct(region.h)}%`}`
  return `起点 (${pct(region.x)}%, ${pct(region.y)}%)${size}`
}

function invalidateCheck() {
  checkRunId += 1
  checkState.value = 'idle'
  pendingCheckRows.value = null
}

function updateRow(index, field, value) {
  invalidateCheck()
  rows.value[index] = { ...rows.value[index], [field]: value }
  if (field === 'speech' || field === 'stage') rows.value = applyAgentBV2Timeline(rows.value)
}

// 编辑 board.content，布局由渲染层负责。
function updateBoardContent(index, content) {
  invalidateCheck()
  const current = parseBoard(rows.value[index].board)
  rows.value[index] = {
    ...rows.value[index],
    board: { content, startDelay: current.startDelay },
  }
}

// 视觉时间轴事件：点击某 Row 组定位并高亮表格对应行
function onSelectRowFromTimeline(index) {
  editingBoardIndex.value = index
  const allRows = document.querySelectorAll('.studio-table .ant-table-row')
  if (allRows && allRows[index]) {
    allRows[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// ★ 时序全景时间轴块的试听按钮回调：复用 playAudioUrl 统一管理音频实例
//  payload: { index, url }
function onPlayAudioFromTimeline({ index, url } = {}) {
  if (typeof index !== 'number' || !url) return
  playAudioUrl(url, index)
}

// ========= 口播语音 TTS 控制（Fish Audio 接口）=========
const rowAudioCache = ref({})
const playingAudioIndex = ref(null)
const synthesizingRowIndex = ref(null)
const regeneratingRowIndex = ref(null)
const savingLocalRowIndex = ref(null)
let activeAudio = null

function stopCurrentAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.currentTime = 0
    } catch (_err) {
      // ignore
    }
    activeAudio = null
  }
  playingAudioIndex.value = null
}

function readAudioDuration(url) {
  if (!url || typeof window === 'undefined' || !window.Audio) return Promise.resolve(null)
  return new Promise((resolve) => {
    const audio = new window.Audio()
    const finish = (value) => {
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('error', onError)
      resolve(Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : null)
    }
    const onMetadata = () => finish(audio.duration)
    const onError = () => finish(null)
    audio.addEventListener('loadedmetadata', onMetadata, { once: true })
    audio.addEventListener('error', onError, { once: true })
    audio.src = url
  })
}

async function recordAudioMetadata(index, record, url) {
  const durationMs = await readAudioDuration(url)
  if (durationMs) {
    record.audioDurationMs = durationMs
    rows.value = applyAgentBV2Timeline(rows.value)
  }
}

async function playAudioUrl(url, index) {
  if (!url) return
  if (playingAudioIndex.value === index && activeAudio) {
    stopCurrentAudio()
    return
  }
  stopCurrentAudio()

  if (typeof window === 'undefined' || !window.Audio) return
  const audio = new window.Audio(url)
  audio.preload = 'auto'
  // 关键修复：开头吞字根因 = 浏览器在 canplay 时缓冲不够就开始播，前几十毫秒还在解码。
  // 三个对策：
  //  (a) 用 canplaythrough 替代 canplay，等"足够播完整条"再开始
  //  (b) play 前 audio.currentTime = 0 强制回到最开头（防止上次残留进度）
  //  (c) play 前再 await 一个 120ms 的预热 tick，让解码管线充满
  activeAudio = audio
  playingAudioIndex.value = index

  audio.addEventListener('ended', () => {
    if (playingAudioIndex.value === index) {
      playingAudioIndex.value = null
      activeAudio = null
      // ★ 试听完立刻把缓存回填到表单（防止后续被误判"没 mp3 地址 / 没自然音频时长"）
      backfillAudioToRow(index, url)
    }
  })
  audio.addEventListener('error', () => {
    message.error('音频加载或播放失败')
    if (playingAudioIndex.value === index) {
      playingAudioIndex.value = null
      activeAudio = null
    }
  })

  try {
    // 只由原生 ended 事件结束本次试听，不使用预估时长或定时器切换。
    await new Promise((resolve, reject) => {
      const onCanPlayThrough = () => {
        audio.removeEventListener('canplaythrough', onCanPlayThrough)
        audio.removeEventListener('error', onLoadError)
        resolve()
      }
      const onLoadError = (event) => {
        audio.removeEventListener('canplaythrough', onCanPlayThrough)
        audio.removeEventListener('error', onLoadError)
        reject(event)
      }
      // canplaythrough = 浏览器认为已缓冲足够连续播完整条；比 canplay 更稳，几乎不会吞开头
      audio.addEventListener('canplaythrough', onCanPlayThrough, { once: true })
      audio.addEventListener('error', onLoadError, { once: true })
      audio.load()
    })
    // 强制回 0，避免某些浏览器复用 element 时残留 currentTime > 0
    try { audio.currentTime = 0 } catch (_) {}
    // 120ms 预热 tick：让音频解码管线充满，避免首帧被截
    await new Promise((r) => setTimeout(r, 120))
    await audio.play()
  } catch (err) {
    console.warn('播放被浏览器安全策略阻止或中断:', err)
    playingAudioIndex.value = null
  }
}

// ★ 试听完立刻回填表单：把缓存的 audioUrl + 真实时长落到 record + rowAudioCache，
//   防止后续被误判"没 mp3 地址 / 没自然音频时长"。即使 record.audioUrl 已存在也补一遍双保险。
async function backfillAudioToRow(index, url) {
  if (typeof index !== 'number' || !url) return
  const record = rows.value?.[index]
  if (!record) return
  let changed = false
  // 1. 双保险回填 audioUrl
  if (!record.audioUrl) {
    record.audioUrl = url
    changed = true
  }
  // 2. rowAudioCache 同步
  if (rowAudioCache.value[index] !== url) {
    rowAudioCache.value[index] = url
    changed = true
  }
  // 3. 没真实时长就立刻读一次（loadedmetadata）落上 audioDurationMs
  if (!record.audioDurationMs || record.audioDurationMs <= 0) {
    try {
      const dur = await readAudioDuration(url)
      if (dur && dur > 0) {
        record.audioDurationMs = dur
        changed = true
      }
    } catch (_) {}
  }
  if (changed) {
    rows.value = applyAgentBV2Timeline(rows.value)
    // 轻量 toast 提示（不打扰）
    message.success({ content: `第 ${index + 1} 行音频已回填 (mp3 地址 + 自然时长)`, duration: 1.6 })
  } else {
    // 即使 changed=false，也悄悄确认一次时长，确保 rowAudioCache 一定有
    rowAudioCache.value[index] = url
  }
}

// 1. 小喇叭：手动生成本内容语音 / 试听播放
async function handlePlayOrSynthesizeSpeech(index, record) {
  const currentUrl = record.audioUrl || rowAudioCache.value[index]
  if (currentUrl) {
    playAudioUrl(currentUrl, index)
    return
  }

  const text = (record.speech || '').trim()
  if (!text) {
    message.warning('请先输入本行的口播文案内容')
    return
  }

  synthesizingRowIndex.value = index
  showGlobalLoading('数据分析中...', `正在合成第 ${index + 1} 步拟真口播语音...`)
  try {
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        referenceId: 'fcee4dd834844f28a92b246e0d996104',
        model: 's2.1-pro-free',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok || !data.audioUrl) {
      throw new Error(data.error || '语音合成失败')
    }
    record.audioUrl = data.audioUrl
    rowAudioCache.value[index] = data.audioUrl
    await recordAudioMetadata(index, record, data.audioUrl)
    message.success(`第 ${index + 1} 步口播语音生成成功`)
    playAudioUrl(data.audioUrl, index)
  } catch (err) {
    message.error(`语音生成失败: ${err.message || String(err)}`)
  } finally {
    hideGlobalLoading()
    synthesizingRowIndex.value = null
  }
}

// 2. 重新生成语音
async function handleRegenerateSpeech(index, record) {
  const text = (record.speech || '').trim()
  if (!text) {
    message.warning('请先输入本行的口播文案内容')
    return
  }

  regeneratingRowIndex.value = index
  stopCurrentAudio()
  showGlobalLoading('数据分析中...', `正在重新生成第 ${index + 1} 步口播语音...`)
  try {
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        referenceId: 'fcee4dd834844f28a92b246e0d996104',
        model: 's2.1-pro-free',
        forceRefresh: true,
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok || !data.audioUrl) {
      throw new Error(data.error || '重新生成语音失败')
    }
    record.audioUrl = data.audioUrl
    rowAudioCache.value[index] = data.audioUrl
    await recordAudioMetadata(index, record, data.audioUrl)
    message.success(`第 ${index + 1} 步口播语音已重新生成`)
    playAudioUrl(data.audioUrl, index)
  } catch (err) {
    message.error(`重新生成失败: ${err.message || String(err)}`)
  } finally {
    hideGlobalLoading()
    regeneratingRowIndex.value = null
  }
}

// 3. 保存本地并记录下载URL（与截图同规范配套存入 public/audio/ 与 public/pic/）
async function handleSaveLocalSpeech(index, record) {
  const text = (record.speech || '').trim()
  if (!text) {
    message.warning('请先输入本行的口播文案内容')
    return
  }

  savingLocalRowIndex.value = index
  showGlobalLoading('数据分析中...', `正在保存第 ${index + 1} 步音频至配套目录...`)
  try {
    const res = await fetch('/api/tts/save-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        referenceId: 'fcee4dd834844f28a92b246e0d996104',
        model: 's2.1-pro-free',
        stepIndex: index,
        audioUrl: record.audioUrl || rowAudioCache.value[index] || null,
        projectCode: deliverableResult.value?.projectCode || handoff.value?.projectCode || '',
      }),
    })
    const data = await res.json()
    if (!res.ok || !data.ok || !data.urlPath) {
      throw new Error(data.error || '保存本地语音失败')
    }
    record.audioUrl = data.urlPath
    rowAudioCache.value[index] = data.urlPath
    await recordAudioMetadata(index, record, data.urlPath)
    message.success(`语音已保存至本地配套目录，并已记录下载 URL: ${data.urlPath}`)
  } catch (err) {
    message.error(`保存本地失败: ${err.message || String(err)}`)
  } finally {
    hideGlobalLoading()
    savingLocalRowIndex.value = null
  }
}

function getAudioFilename(url) {
  if (!url) return 'speech-audio.mp3'
  const segs = String(url).split('/')
  return segs[segs.length - 1] || 'speech-audio.mp3'
}

function copyAudioUrl(url) {
  if (!url) return
  const fullUrl = typeof window !== 'undefined' ? (window.location.origin + url) : url
  if (typeof window !== 'undefined' && window.navigator?.clipboard?.writeText) {
    window.navigator.clipboard.writeText(fullUrl).then(() => {
      message.success(`已复制下载URL: ${fullUrl}`)
    }).catch(() => {
      message.info(`下载URL: ${fullUrl}`)
    })
  } else {
    message.info(`下载URL: ${fullUrl}`)
  }
}

function insertRowAfter(index) {
  invalidateCheck()
  const newRow = {
    stage: rows.value[index]?.stage || '分析',
    speech: '',
    board: { content: '' },
    actionSpec: [],
  }
  rows.value.splice(index + 1, 0, newRow)
  rows.value = applyAgentBV2Timeline(rows.value)
  message.success('已在下方插入空白行，快来写下补充内容吧 ╰(๑◕ ▿ ◕๑)╯')
}

function deleteRow(index) {
  if (rows.value.length <= 1) {
    message.warning('不能全部删完哦，最少要保留一行内容哈 ฅ(⌯꒦ິ³꒦ິ⌯)ฅ')
    return
  }
  invalidateCheck()
  rows.value.splice(index, 1)
  rows.value = applyAgentBV2Timeline(rows.value)
  message.success('已成功删除该行 ٩(｡•ω•｡)و')
}

// Row 组手动拖拽排序与时间轴自动重算
const draggingIndex = ref(-1)
const dragOverIndex = ref(-1)
const dropPosition = ref('') // 'before' | 'after' | ''

function cleanupDrag() {
  draggingIndex.value = -1
  dragOverIndex.value = -1
  dropPosition.value = ''
}

function onHandleDragStart(event, index) {
  draggingIndex.value = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    const tr = event.target?.closest?.('tr')
    if (tr && event.dataTransfer.setDragImage) {
      event.dataTransfer.setDragImage(tr, 30, 20)
    }
  }
}

function onRowDragOver(event, index) {
  if (draggingIndex.value === -1) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }

  if (draggingIndex.value === index) {
    dragOverIndex.value = -1
    dropPosition.value = ''
    return
  }

  dragOverIndex.value = index
  const rect = event.currentTarget.getBoundingClientRect()
  const offset = event.clientY - rect.top
  dropPosition.value = offset < rect.height / 2 ? 'before' : 'after'
}

function onRowDragLeave(event, index) {
  if (event.currentTarget && event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) {
    return
  }
  if (dragOverIndex.value === index) {
    dragOverIndex.value = -1
    dropPosition.value = ''
  }
}

function onRowDrop(event, index) {
  event.preventDefault()
  const sourceIndex = draggingIndex.value
  if (sourceIndex === -1 || sourceIndex === index) {
    cleanupDrag()
    return
  }

  // ponytail: 4 分支 if/else 改三元链（shrink -7 行）
  // after+source<index 或 before+source>index → target = index
  // after+source>index → target = index+1
  // before+source<index → target = index-1
  // dropPos==''（无明确位） → target = index
  const isAfter = dropPosition.value === 'after'
  const isBefore = dropPosition.value === 'before'
  const targetIndex = Math.max(0, Math.min(rows.value.length - 1,
    (isAfter && sourceIndex > index) ? index + 1 :
    (isBefore && sourceIndex < index) ? index - 1 : index
  ))

  if (sourceIndex !== targetIndex) {
    moveRow(sourceIndex, targetIndex)
  }
  cleanupDrag()
}

function onRowDragEnd() {
  cleanupDrag()
}

function customRow(record, index) {
  return {
    class: {
      'table-row-dragging': draggingIndex.value === index,
      'table-row-dragover-top': dragOverIndex.value === index && dropPosition.value === 'before',
      'table-row-dragover-bottom': dragOverIndex.value === index && dropPosition.value === 'after',
    },
    onDragover: (e) => onRowDragOver(e, index),
    onDragleave: (e) => onRowDragLeave(e, index),
    onDrop: (e) => onRowDrop(e, index),
  }
}

function moveRow(fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
  if (fromIndex >= rows.value.length || toIndex >= rows.value.length) return

  invalidateCheck()
  const list = [...rows.value]
  const [movedItem] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, movedItem)

  // 重新规范化 actionSpec 中的全局 order（单手一维递增，保证全局动作编号与时间线播放顺序严格一致）
  let globalOrder = 1
  list.forEach((r) => {
    if (Array.isArray(r.actionSpec)) {
      r.actionSpec.forEach((item) => {
        if (item?.action && typeof item.action === 'object') {
          item.action.order = globalOrder++
        }
      })
    }
  })

  // 核心：在拖拽完成后自动重新计算整个视频的时间轴序列
  rows.value = applyAgentBV2Timeline(list, {
    rowGapMs: canvasParams.value?.rowGapMs || 1500,
  })

  message.success(`已调整行顺序（第 ${fromIndex + 1} 行 ➔ 第 ${toIndex + 1} 行），并已自动重新计算全片视频时间轴 ╰(๑◕ ▿ ◕๑)╯`)
}

// 监听演播室 Row 间隔与语速参数变化，实时重新计算全片时间轴
watch(
  () => [canvasParams.value?.rowGapMs, canvasParams.value?.speechSpeed],
  () => {
    if (rows.value.length) {
      rows.value = applyAgentBV2Timeline(rows.value, {
        rowGapMs: canvasParams.value?.rowGapMs || 1500,
      })
    }
  }
)

function actionLabel(entry) {
  const action = entry?.action
  if (!action) return '能力缺口'
  return [action.tool, action.action].filter(Boolean).join(' · ')
}

function actionContent(entry) {
  if (entry?.capabilityGap) return entry.capabilityGap.need
  const action = entry?.action || {}
  return action.content || action.target?.exactText || ''
}

// B 生成缓存：localStorage，24小时过期，Shift+点击强制刷新
// ponytail: 抽到 composables/useBCache.js，传 getter 避免循环依赖
const { bCacheKey, bCacheGet, bCacheSet } = useBCache({
  getHandoff: () => handoff.value,
  getSelectedSkillId: () => selectedSkillId.value,
  // ★ R8-⑤：模型进缓存键——env 预设/用户改配置后旧缓存失效（bCacheGet 另有比对防御）
  getModel: () => agentBApiConfig.model || '',
})

async function generateRows(force = false) {
  if (state.value === 'generating') return
  if (!force) {
    const cached = bCacheGet()
    if (cached) {
      rows.value = cached.rows
      generatedModel.value = cached.model
      state.value = 'ready'
      message.info(`已使用缓存结果（${cached.rows.length}行），Shift+点击可强制刷新`)
      return
    }
  }
  invalidateCheck()
  state.value = 'generating'
  errorText.value = ''
  startGeneratingTimer()
  try {
    // B 生成只请求剧本；不加载板书字体或发起字体网络请求。
    const result = await generateAgentBV2Rows({
      handoff: handoff.value,
      skillId: selectedSkillId.value,
      rowGapMs: canvasParams.value.rowGapMs,
      canvasParams: { ...canvasParams.value },
    })
    rows.value = result.rows
    generatedModel.value = result.model
    state.value = 'ready'
    bCacheSet(result.rows, result.model)
    message.success(`已生成 ${rows.value.length} 行五字段执行表`)
    // 歧义弹窗：检测到弃用字段时提示用户（v2.0 startCoord / triggerAt / durationMs 等）
    if (Array.isArray(result.deprecationWarnings) && result.deprecationWarnings.length) {
      result.deprecationWarnings.forEach(w => message.warning(w, 5))
    }
  } catch (error) {
    state.value = 'error'
    errorText.value = error?.message || String(error)
    // ponytail: 静默软提示 — 不直接弹 message.error，改为 console.warn + 可展开的 errorText 条
    // 用户看到的是红色状态条(errorText ref 已绑定到模板上的 a-alert)，不是突兀的弹出框
    console.warn('[Agent B 生成失败]', errorText.value)
  } finally {
    stopGeneratingTimer()
  }
}

async function checkRows(mode = 'standard') {
  if (!rows.value.length || checkState.value === 'checking') return
  const runId = ++checkRunId
  checkState.value = 'checking'
  errorText.value = ''
  checkChanges.value = []
  try {
    const result = await checkAgentRows({
      rows: rows.value,
      mode,
    })
    if (runId !== checkRunId) return
    pendingCheckRows.value = result.rows
    checkChanges.value = result.changes
    checkSource.value = 'check_agent'
    checkState.value = 'ready'
    checkResultOpen.value = true
    checkFailedFallback.value = result.checkStatus === 'failed_fallback'
    if (result.checkStatus === 'local_asr_polished') {
      message.success(result.changes.length ? `ASR 规范优化完成，发现 ${result.changes.length} 处口播/板书改进` : 'ASR 检查完成，当前内容已符合规范')
    } else if (checkFailedFallback.value) {
      message.warning(`Check Agent 返回格式异常，已回退原表（${result.checkError || '未提供错误详情'}）。当前显示的是原表，未做任何修改。`)
    } else {
      message.success(result.changes.length ? `Check 完成，发现 ${result.changes.length} 处建议` : 'Check 完成，未发现需要修正的内容')
    }
  } catch (error) {
    if (runId !== checkRunId) return
    checkState.value = 'error'
    errorText.value = error?.message || String(error)
    // ponytail: 静默软提示 — 不直接弹
    console.warn('[Check Agent 失败]', errorText.value)
  }
}

function applyCheckChanges() {
  if (!pendingCheckRows.value || !checkChanges.value.length) return
  const changeCount = checkChanges.value.length
  const isAsr = checkSource.value === 'math_asr'
  rows.value = applyAgentBV2Timeline(pendingCheckRows.value, {
    rowGapMs: canvasParams.value?.rowGapMs || 1500,
  })
  if (!isAsr) {
    // Check Agent 结果同步写回服务端文件（文件即真相源）
    applyCheckResult(pendingCheckRows.value).catch(() => {
      message.warning('本地已应用，但保存到服务端失败，刷新后会恢复为原版本')
    })
  }
  pendingCheckRows.value = null
  checkChanges.value = []
  checkState.value = 'idle'
  checkResultOpen.value = false
  checkFailedFallback.value = false
  message.success(isAsr ? `已应用 ${changeCount} 处数学读音口播规范化修改` : `已应用 ${changeCount} 处 Check 修改`)
}

function discardCheckChanges() {
  pendingCheckRows.value = null
  checkResultOpen.value = false
  checkFailedFallback.value = false
}

function exportSpeech() {
  if (!rows.value.length) return
  exportSpeechMarkdown(rows.value, {
    problemText: handoff.value?.problemText || '',
    model: generatedModel.value || agentBApiConfig.model || '',
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    handoffCanvasParams: handoff.value?.canvasParams || null,
  })
  message.success('口播稿 MD 已导出')
}

function exportStoryboard() {
  if (!rows.value.length) return
  const ratioData = handoff.value?.stageRatioSuggestion || handoff.value?.['环节配比占比'] || null
  exportStoryboardMarkdown(rows.value, {
    problemText: handoff.value?.problemText || '',
    model: generatedModel.value || agentBApiConfig.model || '',
    generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    canvasParams: JSON.parse(JSON.stringify(canvasParams.value)),
    handoffCanvasParams: handoff.value?.canvasParams || null,
    handoffBoardPlan: handoff.value?.boardPlan || null,
    screenshotUrl: handoff.value?.screenshotUrl || '',
    problemType: handoff.value?.problemType || '',
    relatedKnowledge: relatedKnowledge.value || [],
    teachingFocus: knowledgeAnalysis.value?.teachingFocus || '',
    keyFormulaList: keyFormulaList.value || [],
    zoneAnchors: handoff.value?.zoneAnchors || null,
    stageRatioSuggestion: ratioData,
    stageRatios: ratioData?.suggestedRatio || null,
  })
  message.success('分镜表 MD 已导出')
}

// 严格从当前应用运行时的响应式状态树实时序列化最新板书与时序数据（绝不读取 HTML 源码，绝不使用旧缓存）
function serializeCurrentDeliverableState() {
  const code = deliverableResult.value?.projectCode || handoff.value?.projectCode || `deliverable-${Date.now()}`
  const hcp = handoff.value?.canvasParams || buildCanvasParams()
  const fallbackBoardPlan = {
    question: { x: 6, y: 13.32, w: 40.32, h: '' },
    analysis: { x: 6, y: 40.62, w: 44, h: 54.38 },
    solution: { x: 54, y: 14, w: 40, h: 44 },
    summary: { x: 54, y: 69.5, w: 40, h: 22 },
  }
  const hbp = handoff.value?.boardPlan || handoff.value?.zoneAnchors || fallbackBoardPlan
  const ratioData = handoff.value?.stageRatioSuggestion || handoff.value?.['环节配比占比'] || null
  // ★ 第八轮关联性归一：配比随题型动态判断（detectStageRatio 五类 a/b/c/d/e），
  // 缺数据时逐字段"未提供"，不臆造固定比例污染导出产物（旧值 35/40/15/10 为臆造）
  const suggestedRatio = ratioData?.suggestedRatio || {}

  // 逐行深层清洗并计算单手互斥执行计划（动作定量 1-2 秒作为标点停顿，绝不与板书重叠）
  const cleanRows = (rows.value || []).map((r, idx) => {
    const parsedBoard = parseBoard(r.board)
    // ★ 用户硬约束: board 字段与 actionSpec 映射必须自带 stage，让 deliverable JSON 自描述
    //  - row.stage 仍然存在（行级 stage）
    //  - board.stage = 行级 stage（板书自描述，下游消费板书时不必反查 row）
    //  - 每个 actionSpec[i].stage = 行级 stage（动作映射自描述，下游消费动作时不必反查 row）
    //  这样即使 row 顺序变化或下游只取局部字段，board 与 actionSpec 仍然知道属于哪个 stage
    const rowStage = r.stage || (idx === 0 ? '题目' : '分析')
    const normalizedRow = {
      // ponytail: duration 统一为秒 (row-player 合同是秒, 不是毫秒)
      duration: Number(r.audioDurationMs) > 0
        ? Math.round(Number(r.audioDurationMs) / 1000 * 10) / 10  // ms → 秒, 保留1位小数
        : (Number(r.duration) || 0),
      durationLabel: Number(r.audioDurationMs) > 0 ? '真实音频时长' : '预估',
      stage: rowStage,
      speech: r.speech != null ? String(r.speech) : '',
      audioUrl: r.audioUrl || '音频暂未生成',
      audioDurationMs: Number(r.audioDurationMs) > 0 ? Math.round(Number(r.audioDurationMs)) : null,
      board: {
        // ★ 必须带 stage：板书字段自描述属于哪个 stage (题目/分析/解答/总结)
        stage: rowStage,
        content: parsedBoard.content || '',
        startDelay: typeof parsedBoard.startDelay === 'number' && !isNaN(parsedBoard.startDelay)
          ? parsedBoard.startDelay
          : 0,
      },
      // ★ 必须带 stage：actionSpec 映射里每个 action 自带 stage (与 row.stage 一致)
      //  - 原有 region 字段保留不动（是 B 给的英文 zone 名 question/analysis/solution/summary）
      //  - 新增 stage 字段为中文 stage 名 (题目/分析/解答/总结)，便于下游双重校验
      //  - 如果某条 actionSpec 已自带 stage 就尊重它（罕见，但允许跨 stage 动作）
      //  - safeDeepClone 先克隆, 再加 stage, 避免污染 Vue 响应式 state
      actionSpec: Array.isArray(r.actionSpec)
        ? safeDeepClone(r.actionSpec).map(a => {
            if (!a || typeof a !== 'object') return a
            // 容错: actionSpec 项可能是 { action: {...} } 或直接 {...}
            // 优先给外层加 stage
            if (!a.stage) a.stage = rowStage
            // 若内层 action 子对象也没 stage, 顺便补上 (双保险)
            if (a.action && typeof a.action === 'object' && !a.action.stage) {
              a.action.stage = rowStage
            }
            return a
          })
        : [],
    }
    const computed = computeRowGroupTimeline(normalizedRow)
    return {
      ...normalizedRow,
      estimatedDurationMs: computed.rowTotalDurationMs,
      exclusiveExecutionPlan: computed.exclusiveExecutionPlan,
      timingPolicy: 'speech-full-board-action-mutually-exclusive',
    }
  })

  return {
    apiSpecVersion: '2.0.0',
    specificationSummary: '每个 row 为一组原子单元；语音全程；板书与动作二者绝对互斥；动作时长定量 1~2 秒作为标点停顿。供下游课件制作与画布 Agent 直接消费。',
    specAnnotation: `画布规格批注：尺寸 ${CANVAS_SIZE.width}x${CANVAS_SIZE.height}、比例、题目/板书字号、stage 四区坐标落座区间、越界与手稿风格。`,
    projectCode: code,
    problemText: handoff.value?.problemText || '',
    sourceImageUrl: handoff.value?.sourceImageDataUrl || handoff.value?.sourceImageUrl || '',
    keepOriginal: Boolean(handoff.value?.keepOriginal),
    screenshotUrl: handoff.value?.screenshotUrl || '',
    topicLayout: handoff.value?.topicLayout || null,
    // ★ 2026-10-13 归一化：删掉手写 canvasParams 副本（fontSize/lineHeight/boardSpeed 等
    // 全被 ...hcp 覆盖 = 死值陷阱，canvasWidth/Height 异名键全仓零消费）
    // 真源唯一 = stepHandoff.buildCanvasParams（hcp 的 fallback 本身就是它）
    canvasParams: {
      source: 'handoff (Agent A 根据题目实时判断，为唯一真相源)',
      ...hcp,
    },
    // handoff 四区布局（真相源）+ Label 坐标（row-player 标签贴纸位置真源）
    boardPlan: {
      canvas: { w: CANVAS_SIZE.width, h: CANVAS_SIZE.height },
      topicLabel: hbp.topicLabel || { x: 5.7, y: 6.6, w: 7.1 },
      question: { x: hbp.question?.x ?? 6, y: hbp.question?.y ?? 13.32, w: hbp.question?.w ?? 40.32, h: hbp.question?.h ?? '' },
      analysisLabel: hbp.analysisLabel || { x: 5.7, y: 34.5, w: 7.2 },
      analysis: { x: hbp.analysis?.x ?? 6, y: hbp.analysis?.y ?? 40.62, w: hbp.analysis?.w ?? 44, h: hbp.analysis?.h ?? 54.38 },
      solutionLabel: hbp.solutionLabel || { x: 53.7, y: 6.6, w: 7.4 },
      solution: { x: hbp.solution?.x ?? 54, y: hbp.solution?.y ?? 14, w: hbp.solution?.w ?? 40, h: hbp.solution?.h ?? 44 },
      summaryLabel: hbp.summaryLabel || { x: 53.7, y: 62.0, w: 7.2 },
      summary: { x: hbp.summary?.x ?? 54, y: hbp.summary?.y ?? 69.5, w: hbp.summary?.w ?? 40, h: hbp.summary?.h ?? 22 },
      image: hbp.image || null,
    },
    // UI 可调参数（B 页面设置）
    uiSettings: {
      coordinateMode: '百分比',
      questionFontSize: `${QUESTION_FONT_SIZE}px`,
      questionFontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
      audioSpeedPolicy: '（若有音频url的，以音频自然播放时间为时间，一组一组自然播放即可，如果没有音频url信息的，用填充演示数据占位，）速度计算 160字/分',
    },
    // 题目信息与环节配比
    problemInfo: {
      screenshotUrl: handoff.value?.screenshotUrl || '',
      problemType: handoff.value?.problemType || '未提供',
      relatedKnowledge: relatedKnowledge.value || [],
      teachingFocus: knowledgeAnalysis.value?.teachingFocus || '',
      keyFormulaList: keyFormulaList.value || [],
      zoneAnchors: handoff.value?.zoneAnchors || {
        question: { x: 6, y: 13.32, w: 40.32 },
        analysis: { x: 6, y: 40.62, w: 44, h: 54.38 },
        solution: { x: 54, y: 14, w: 40, h: 44 },
        summary: { x: 54, y: 69.5, w: 40, h: 22 },
      },
      stageRatios: {
        analysis: suggestedRatio.analysis || '未提供',
        solution: suggestedRatio.solution || '未提供',
        summary: suggestedRatio.summary || '未提供',
        introAndClosing: suggestedRatio.introAndClosing || '未提供',
      },
      stageRatioSuggestion: ratioData,
    },
    meta: {
      // ★ Task 14 政策同型补刀：臆造 fallback（'小学数学题'/'图文结合'/'小学阶段'/'核心知识点'）清零，
      // problemType/boardFocus 缺失写"未提供"；gradeLevel 真源=handoff.suggestedGrade；
      // knowledgeTitle 真源=relatedKnowledge[0] 的「知识点」字段
      problemType: handoff.value?.problemType || '未提供',
      boardFocus: handoff.value?.boardFocus || '未提供',
      gradeLevel: handoff.value?.suggestedGrade || '未提供',
      knowledgeTitle: handoff.value?.relatedKnowledge?.[0]?.['知识点'] || '未提供',
      canvasSize: { width: CANVAS_SIZE.width, height: CANVAS_SIZE.height },
    },
    stats: {
      totalDuration: totalEstimatedStats.value?.seconds || 0,
      totalDurationText: totalEstimatedStats.value?.text || '0秒',
      stepCount: cleanRows.length,
      charCount: totalEstimatedStats.value?.charCount || 0,
      actionCount: totalActionCount.value || 0,
    },
    checkInfo: {
      checkApplied: checkState.value === 'ready' || checkChanges.value.length > 0,
      changeCount: checkChanges.value.length,
    },
    rows: cleanRows,
  }
}

// ★ Task 13：useApiSpecDrawer 整套砍除——抽屉指向的 DELIVERABLE_API_SPEC.md / deliverable.schema.json
// 全仓从未存在（6 处引用全 404 的幽灵契约链），下游规范入口收敛到导出 JSON 本体 + README

// 固化生成最终交付产物单页：写入 public/deliverable/ 永久文件，刷新不丢失
async function generateDeliverablePage() {
  if (!rows.value.length) {
    message.warning('当前无生成内容，请先生成五字段后再固化产物单页')
    return
  }
  deliverableGenerating.value = true
  try {
    // 严格从当前运行时状态树序列化最新数据
    const payload = serializeCurrentDeliverableState()

    const res = await fetch('/api/deliverable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliverable: payload }),
    })
    const data = await res.json()
    if (data.ok) {
      deliverableResult.value = data
      // 同步本地预览缓存作为双重保险
      // ★ Task 9 修复: 必须把 canvasParams 与 meta 一起写入 localStorage,
      //  否则 BoardPreviewApp 打开时 RealBoardPreview 拿不到 canvasParams
      //  (字号/字体/行高/画布尺寸全部丢失, 预览画布降级为静态常量)
      saveLiveBoardPreview({
        problemText: payload.problemText,
        topicLayout: payload.topicLayout,
        boardPlan: payload.boardPlan,
        sourceImageUrl: payload.sourceImageUrl,
        keepOriginal: payload.keepOriginal,
        rows: payload.rows,
        projectCode: data.projectCode,
        // ★ 必须带 canvasParams: 真相源 = handoff.canvasParams 或 buildCanvasParams()
        canvasParams: payload.canvasParams || handoff.value?.canvasParams || null,
        // ★ 必须带 meta: BoardPreviewApp.applyDeliverablePayload 从 payload.meta 读 canvasParams/model 等
        meta: {
          canvasParams: payload.canvasParams || handoff.value?.canvasParams || null,
          model: generatedModel.value || agentBApiConfig.model || '',
          generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
          handoffCanvasParams: handoff.value?.canvasParams || null,
          handoffBoardPlan: handoff.value?.boardPlan || null,
          problemType: handoff.value?.problemType || '',
          stageRatioSuggestion: handoff.value?.stageRatioSuggestion || handoff.value?.['环节配比占比'] || null,
        },
        // ★ 同时带 screenshotUrl 与 problemText 等下游消费字段
        screenshotUrl: payload.screenshotUrl || handoff.value?.screenshotUrl || '',
        problemType: handoff.value?.problemType || '',
      })
      deliverableModalOpen.value = true
      message.success('教学视频素材产物单页已成功生成并归档！')
    } else {
      message.error(`生成产物单页失败：${data.error || '未知错误'}`)
    }
  } catch (err) {
    message.error(`生成产物单页网络异常：${err.message || String(err)}`)
  } finally {
    deliverableGenerating.value = false
  }
}

function openDeliverablePage() {
  if (deliverableResult.value?.url) {
    window.open(deliverableResult.value.url, '_blank')
    return
  }
  openHanddrawPlayer()
}

async function openHanddrawPlayer() {
  const payload = serializeCurrentDeliverableState()
  window._LATEST_AGENT_B_RESULT = payload

  // 1. 同步写入 localStorage，作为离线/无网络/直开双保险
  try {
    localStorage.setItem('agent-b-deliverable', JSON.stringify(payload))
  } catch (e) {
    console.warn('[openHanddrawPlayer] localStorage 写入失败', e)
  }

  // 2. 先归档再打开（★ Task 13 竞态修复）：await POST 落盘完成后再开窗，
  //    避免 row-player 优先 fetch 服务端 current 时播到上一题；归档失败不阻断（走 localStorage 兑底）
  try {
    await fetch('/api/deliverable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (e) {
    console.warn('[openHanddrawPlayer] 后端归档失败，将走 localStorage 兑底', e)
  }

  // 3. 打开 row-player.html 页面，传入 ?deliverable=/api/deliverable
  window.open('/row-player.html?deliverable=/api/deliverable', '_blank')
}

function downloadDeliverableJson() {
  if (!rows.value.length) {
    message.warning('当前无板书数据，请先生成或添加板书后再导出 JSON')
    return
  }
  // 1. 严格从当前应用运行时的响应式状态树（state tree）实时序列化，绝不从已归档的旧快照中读取，更绝不发起网络请求获取 HTML
  const deliverableData = serializeCurrentDeliverableState()
  const code = deliverableData.projectCode || 'deliverable'

  // 2. 序列化为规范格式化 JSON 字符串
  const jsonContent = JSON.stringify(deliverableData, null, 2)

  // 3. 严格使用客户端原生 Blob 触发下载，指定纯净 application/json;charset=utf-8，确保 100% 纯正实体 JSON
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `deliverable-${code}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  message.success(`已成功从当前状态树导出并下载配套 JSON：deliverable-${code}.json`)
}

// 知识点修缮：手动触发，调 POST /api/knowledge/refine，成功后弹结果弹窗，用户点应用才更新
async function refineKnowledge() {
  if (refineLoading.value) return
  refineLoading.value = true
  try {
    // ★ 2026-10-14：裸 fetch+resp.json() → safeJsonFetch（非 JSON 响应/超时/连接中断
    // 都给可读报错，不再吐裸 "Unexpected token" 解析错误）；客户端 100s 超时覆盖
    // 服务端单次上游 60s 预算（服务端已改超时不重试，总时长 ≤ 61s）
    const result = await safeJsonFetch('/api/knowledge/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: userApiConfig.endpoint,
        model: userApiConfig.model,
        apiKey: userApiConfig.apiKey,
      }),
    }, { label: '知识点优化', timeoutMs: 100000 })
    if (result.ok && result.handoff) {
      // ★ 2026-10-13：降级响应（refineOk=false）时透出 warning，用户能看到"已保留原知识库"的原因
      if (result.warning) message.warning(result.warning)
      // ★ R8-① A 方案：result 仅是修缮提案，服务端活档此刻仍是原文——
      // 点「应用修缮」才会 POST /apply 落盘，点「保留原文」两端都零改动
      refineResult.value = result
      refineResultOpen.value = true
    } else {
      message.error(result.error || '优化失败')
    }
  } catch (error) {
    message.error(error?.message || '优化异常')
  } finally {
    refineLoading.value = false
  }
}

// 应用修缮结果：★ R8-① A 方案——先 POST /api/knowledge/apply 落盘确认，成功后才更新页面。
// 服务端以当前活档为基底做白名单重合并（防提案过期卷回别环修缮），返回值即存档真容，无需二次拉档
async function applyRefine() {
  if (refineApplying.value) return
  if (!refineResult.value?.handoff) return
  // refineResult 被 Vue ref 代理，handoff 对象带 ReactiveEffect 循环引用
  // 必须 toRaw + 安全深拷贝脱壳后再发请求，杜绝潜在的不可序列化对象抛错
  const proposal = safeDeepClone(refineResult.value.handoff)
  refineApplying.value = true
  try {
    // ★ 2026-10-14：apply 同换 safeJsonFetch（与 refine 同源的裸 resp.json() 隐患）
    const data = await safeJsonFetch('/api/knowledge/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoff: proposal }),
    }, { label: '应用修缮', timeoutMs: 30000 })
    if (!data?.ok) {
      message.error(data?.error || '应用失败')
      return // 弹窗保留，可重试或改选保留原文
    }
    localHandoff.value = data.handoff ? safeDeepClone(data.handoff) : proposal
    refineAppliedAt.value = new Date().toISOString()
    refineResultOpen.value = false
    refineResult.value = null
    message.success('知识点修缮已确认落盘，活档与页面已同步')
  } catch (error) {
    message.error(error?.message || '应用异常，活档未改动')
  } finally {
    refineApplying.value = false
  }
}

// 保留原文：★ R8-① A 方案后名副其实——refine 从未落盘，关弹窗即两端零改动，
// B（前端态）与 Check（活档）保持同一基准，不再分叉
function keepOriginalRefine() {
  refineResultOpen.value = false
  refineResult.value = null
}

function formatRefineField(value) {
  if (value == null) return '（无）'
  if (Array.isArray(value)) return value.map((item, i) => `${i + 1}. ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n')
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

// 比较修缮前后字段是否有变化
function isRefineFieldEqual(original, refined) {
  if (original == null && refined == null) return true
  if (original == null || refined == null) return false
  return JSON.stringify(original) === JSON.stringify(refined)
}

</script>

<template>
  <a-layout class="qh-page">
    <QhPageHeader
      step-label="第 2 步 · Agent B"
      subtitle="题目信息 → 五字段"
      show-back
      @back="emit('back-to-step1')"
    >
      <template #actions>
        <a-popconfirm
          title="清理历史缓存和运行产物？"
          description="当前 handoff、当前交付物和源码不会被删除。"
          ok-text="清理"
          cancel-text="取消"
          @confirm="cleanupGeneratedFiles"
        >
          <a-button title="清理垃圾" :loading="cleanupLoading" danger>
            <template #icon><DeleteOutlined /></template>
            清理垃圾
          </a-button>
        </a-popconfirm>
        <a-button
          title="可用工具"
          @click="toolsOpen = !toolsOpen"
        >
          <template #icon>
            <ToolOutlined />
          </template>
          工具
        </a-button>
      </template>
    </QhPageHeader>

    <a-layout-content class="qh-page-content">
      <a-space
        direction="vertical"
        size="middle"
        style="width:100%"
      >
        <!-- ponytail: 交接状态进度条独立放在交接台卡片之外（用户要求） -->
        <div class="handoff-progress-strip">
          <span class="handoff-summary-label">交接状态</span>
          <a-steps
            class="qh-handoff-steps"
            size="small"
            :items="handoffFlowSteps"
          />
        </div>

        <a-card
          class="qh-surface-card handoff-workbench-card"
          size="small"
        >
          <template #title>
            <div class="handoff-card-title">
              <span class="handoff-title-badge">📋</span>
              <span class="handoff-title-text">输入交接台</span>
              <span class="handoff-title-sub">已同步 Agent A 识别与四区排版参数</span>
            </div>
          </template>
          <template #extra>
            <a-space size="small">
              <a-tooltip title="可以点击这里，对问题进行优化校准哦" placement="bottom">
                <a-button
                  type="primary"
                  size="large"
                  class="btn-refine-confirm"
                  :loading="refineLoading"
                  @click="refineKnowledge"
                >
                  <span class="refine-pulse-dot"></span>
                  优化确认
                </a-button>
              </a-tooltip>
              <a-button
                size="small"
                @click="handoffDetailsExpanded = !handoffDetailsExpanded"
              >
                {{ handoffDetailsExpanded ? '收起交接参数 ▲' : '展开参数明细 ▼' }}
              </a-button>
            </a-space>
          </template>

          <div class="handoff-stats-chips" style="margin-bottom: 0;">
            <span class="handoff-stat-tag">题目 1 道</span>
            <span class="handoff-stat-tag">画布分区 {{ handoff?.boardPlan ? 4 : 0 }} 个</span>
            <span class="handoff-stat-tag">知识参考 {{ relatedKnowledge.length }} 条</span>
            <span class="handoff-stat-tag">建议年级 {{ handoff?.suggestedGrade || '未判断' }}</span>
            <span class="handoff-stat-tag">标准真画布 {{ CANVAS_SIZE.width }}×{{ CANVAS_SIZE.height }}</span>
          </div>


          <div v-show="handoffDetailsExpanded" class="handoff-details-collapsible" style="margin-top: 14px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
          <!-- ponytail: 三大板块改 a-tabs 切换（消除横向滑动条 + 卡片高度不齐的分合感） -->
          <a-card class="qh-surface-card handoff-block-card" :bordered="false" size="small">
            <a-tabs type="card" size="small" class="handoff-tri-tabs">
              <a-tab-pane key="ratio" tab="📊 配比提示 + 参数信息">
                <div v-if="handoff?.stageRatioSuggestion || handoff?.['环节配比占比']" class="stage-ratio-suggestion">
                  <a-descriptions
                    bordered
                    size="small"
                    :column="2"
                    class="handoff-descriptions"
                  >
                    <a-descriptions-item label="题型分类">
                      <div class="field-val-box">
                        <div class="field-val-main">
                          <a-tag color="purple">
                            {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).cuCode }} · {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).type }}
                          </a-tag>
                          <a-tag v-if="(handoff.stageRatioSuggestion || handoff['环节配比占比']).confidence === 'high'" color="green">高置信</a-tag>
                          <a-tag v-else-if="(handoff.stageRatioSuggestion || handoff['环节配比占比']).confidence === 'medium'" color="orange">中置信</a-tag>
                        </div>
                        <span class="qh-field-key">cuCode</span>
                      </div>
                    </a-descriptions-item>
                    <a-descriptions-item label="环节配比占比">
                      <div class="ratio-bars-wrap">
                        <span class="ratio-pill analysis">分析 {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).suggestedRatio.analysis }}</span>
                        <span class="ratio-pill solution">解答 {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).suggestedRatio.solution }}</span>
                        <span class="ratio-pill summary">总结 {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).suggestedRatio.summary }}</span>
                        <span class="ratio-pill intro">开收场 {{ (handoff.stageRatioSuggestion || handoff['环节配比占比']).suggestedRatio.introAndClosing }}</span>
                      </div>
                    </a-descriptions-item>
                  </a-descriptions>
                </div>
                <a-descriptions
                  bordered
                  size="small"
                  :column="2"
                  class="handoff-descriptions"
                  style="margin-top: 10px;"
                >
                  <a-descriptions-item label="题目类型">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ problemTypeLabel }}</span>
                      <span class="qh-field-key">problemType</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="建议年级">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ handoff?.suggestedGrade || '未判断' }}</span>
                      <span class="qh-field-key">suggestedGrade</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="板书侧重">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ boardFocusLabel }}</span>
                      <span class="qh-field-key">boardFocus</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="建议布局">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ suggestedLayoutLabel }}</span>
                      <span class="qh-field-key">suggestedLayout</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="画布参数" :span="2">
                    <div v-if="handoff?.canvasParams" class="canvas-params-desc-box">
                      <div class="canvas-params-chips-wrap">
                        <span class="canvas-param-chip">
                          <span class="chip-k">尺寸</span>
                          <span class="chip-v">{{ handoff.canvasParams.canvasSize.width }}×{{ handoff.canvasParams.canvasSize.height }}px</span>
                        </span>
                        <span class="canvas-param-chip">
                          <span class="chip-k">题目字号</span>
                          <span class="chip-v">{{ handoff.canvasParams.fontSize.question.px }}px</span>
                        </span>
                        <span class="canvas-param-chip">
                          <span class="chip-k">正文字号</span>
                          <span class="chip-v">{{ handoff.canvasParams.fontSize.analysis.px }}px</span>
                        </span>
                        <span class="canvas-param-chip">
                          <span class="chip-k">行高</span>
                          <span class="chip-v">题{{ handoff.canvasParams.lineHeight.question }} / 文{{ handoff.canvasParams.lineHeight.others }}</span>
                        </span>
                      </div>
                      <span class="qh-field-key">canvasParams</span>
                    </div>
                    <span v-else class="param-empty-text">未携带画布参数</span>
                  </a-descriptions-item>
                  <a-descriptions-item label="四区参数" :span="2">
                    <div class="field-val-box wrap-box">
                      <div class="field-val-main">
                        <div class="zone-tags-grid">
                          <div
                            v-for="zone in zoneParameterRows"
                            :key="zone.key"
                            class="zone-param-chip"
                          >
                            <span class="zone-chip-label">{{ zone.label }}</span>
                            <span class="zone-chip-val">{{ zone.value }}</span>
                          </div>
                        </div>
                      </div>
                      <span class="qh-field-key">zoneAnchors</span>
                    </div>
                  </a-descriptions-item>
                </a-descriptions>
              </a-tab-pane>

              <a-tab-pane key="meta" tab="📦 交接元数据">
                <a-descriptions
                  bordered
                  size="small"
                  :column="2"
                  class="handoff-descriptions"
                >
                  <a-descriptions-item label="交接来源">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ handoff?.agentPageName || 'Agent A' }} · {{ handoff?.agentCapability || '未声明能力' }} · v{{ handoff?.handoffVersion || 1 }}</span>
                      <span class="qh-field-key">agentMeta</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="交接时间">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ confirmedAtLabel }}</span>
                      <span class="qh-field-key">confirmedAt</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="是否纯文本">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ pureTextLabel }}</span>
                      <span class="qh-field-key">imageKind</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="画布截图">
                    <div class="field-val-box">
                      <span v-if="handoff?.screenshotUrl" class="meta-path-val">
                        {{ handoff.screenshotUrl }}
                      </span>
                      <span v-else class="param-empty-text">暂无截图</span>
                      <span class="qh-field-key">screenshotUrl</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="知识库地址">
                    <div class="field-val-box">
                      <span class="meta-path-val">
                        {{ handoff?.knowledgeBasePath || 'doc/knowledge-a.compact.json' }}
                      </span>
                      <span class="qh-field-key">knowledgeBasePath</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="四区布局">
                    <div class="field-val-box">
                      <span class="field-val-main">
                        <a-badge :status="handoff?.boardPlan ? 'success' : 'default'" :text="handoff?.boardPlan ? '已确认（标准四区网格）' : '未确认'" />
                      </span>
                      <span class="qh-field-key">boardPlan</span>
                    </div>
                  </a-descriptions-item>
                </a-descriptions>
              </a-tab-pane>

              <a-tab-pane key="kg" tab="💡 题目分析 + 知识点">
                <a-alert
                  v-if="refineAppliedAt"
                  type="success"
                  show-icon
                  class="refine-applied-alert"
                  :message="`本次修缮已写入当前 handoff（${new Date(refineAppliedAt).toLocaleTimeString()}）`"
                />
                <a-descriptions
                  bordered
                  size="small"
                  :column="2"
                  :class="['handoff-descriptions', { 'refine-applied-fields': refineAppliedAt }]"
                >
                  <a-descriptions-item label="知识分析">
                    <div class="field-val-box">
                      <span class="field-val-main">{{ coreKnowledge.length }} 个核心知识点 · {{ keyFormulaList.length }} 条公式</span>
                      <span class="qh-field-key">knowledgeAnalysis</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item label="知识关联点" :span="2">
                    <div class="field-val-box wrap-box">
                      <div class="field-val-main">
                        <a-space wrap size="small">
                          <a-tag v-if="relatedKnowledge.length === 0" color="default">未优化</a-tag>
                          <a-tag
                            v-for="(item, idx) in relatedKnowledge"
                            :key="typeof item === 'string' ? idx : (item['编号'] || item['知识点'])"
                            color="blue"
                            class="knowledge-point-tag"
                          >
                            {{ typeof item === 'string' ? item : (item['知识点'] || '未命名知识点') }}
                          </a-tag>
                        </a-space>
                      </div>
                      <span class="qh-field-key">relatedKnowledge</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item
                    v-if="knowledgeAnalysis?.teachingFocus"
                    label="教学重点"
                    :span="2"
                  >
                    <div class="field-val-box">
                      <span class="field-val-main font-medium">{{ knowledgeAnalysis.teachingFocus }}</span>
                      <span class="qh-field-key">teachingFocus</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item
                    v-if="keyFormulaList.length"
                    label="关键公式"
                    :span="2"
                  >
                    <div class="field-val-box wrap-box">
                      <div class="field-val-main">
                        <a-space wrap size="small">
                          <a-tag
                            v-for="formula in keyFormulaList"
                            :key="formula"
                            color="cyan"
                            class="formula-tag"
                          >
                            {{ formula }}
                          </a-tag>
                        </a-space>
                      </div>
                      <span class="qh-field-key">keyFormulaList</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item
                    v-if="uncertainItems.length"
                    label="待确认项"
                    :span="2"
                  >
                    <div class="field-val-box wrap-box">
                      <div class="field-val-main">
                        <a-space wrap size="small">
                          <a-tag
                            v-for="item in uncertainItems"
                            :key="displayValue(item)"
                            color="orange"
                          >
                            {{ displayValue(item) }}
                          </a-tag>
                        </a-space>
                      </div>
                      <span class="qh-field-key">uncertainItems</span>
                    </div>
                  </a-descriptions-item>
                  <a-descriptions-item
                    v-if="handoff?.knowledgeAnalysis?.commonMistakes?.length"
                    label="易错点"
                    :span="2"
                  >
                    <div class="field-val-box wrap-box">
                      <div class="field-val-main">
                        <a-space wrap size="small">
                          <a-tag
                            v-for="(mistake, mi) in handoff.knowledgeAnalysis.commonMistakes"
                            :key="mi"
                            color="red"
                          >
                            {{ typeof mistake === 'string' ? mistake : (mistake.point || mistake.title || JSON.stringify(mistake)) }}
                          </a-tag>
                        </a-space>
                      </div>
                      <span class="qh-field-key">commonMistakes</span>
                    </div>
                  </a-descriptions-item>
                </a-descriptions>
                <div
                  v-if="coreKnowledge.length"
                  class="knowledge-chips"
                >
                  <a-tag
                    v-for="item in coreKnowledge"
                    :key="item.knowledgeId || item.knowledgePoint"
                    color="blue"
                    class="knowledge-chip"
                    @click="selectedKnowledge = item"
                  >
                    {{ item.knowledgePoint || '未命名知识点' }}
                  </a-tag>
                </div>
              </a-tab-pane>
            </a-tabs>
          </a-card>
          </div>
        </a-card>

        <a-alert
          v-if="errorText"
          type="error"
          show-icon
          :message="errorText"
        />


        <!-- ponytail: 删已确认题目卡片（进入B页后不需重复展示，仅UI删除不动逻辑参数） -->
        <a-card class="qh-surface-card studio-workbench-card" :bordered="false">
          <template #title>
            <div class="workbench-title-box">
              <div class="workbench-title-left">
                <span class="workbench-main-title">五字段执行表</span>
                <span class="workbench-tag tag-type">{{ problemTypeLabel }}</span>
                <span class="workbench-tag tag-skill" title="当前讲课风格">{{ currentSkillName }}</span>
                <span v-if="generatedModel" class="workbench-tag tag-model">{{ generatedModel }}</span>
                <span v-if="rows.length" class="workbench-tag tag-rows">{{ rows.length }} 行</span>
              </div>
              <div v-if="rows.length" class="workbench-stat-pill">
                <FieldTimeOutlined style="margin-right: 4px; color: #0284c7;" />
                <span>总字数 {{ totalEstimatedStats.charCount }} 字 · 预估用时 {{ totalEstimatedStats.text }}</span>
              </div>
            </div>
          </template>

          <template #extra>
            <div class="studio-actions-container">
              <!-- ponytail: 精简为 5 个必须按钮, 删掉 yagni/dead 的 -->

              <!-- ① 生成五字段 -->
              <a-button
                type="primary"
                class="btn-main-generate"
                :loading="state === 'generating'"
                title="Shift+点击强制刷新缓存"
                @click="(e) => generateRows(e.shiftKey)"
              >
                <template #icon><ThunderboltOutlined /></template>
                {{ rows.length ? '重新生成' : '生成五字段' }}
              </a-button>

              <!-- ② ASR 优化 -->
              <a-button
                type="primary"
                class="btn-asr-fallback"
                :disabled="!rows.length || state === 'generating'"
                title="纯前端本地数学算式语音优化（分数/未知数/幂运算/括号混合）"
                @click="runInstantMathAsrPolish"
              >
                <template #icon><SafetyCertificateOutlined /></template>
                ASR 优化
              </a-button>

              <!-- ③ Check Agent -->
              <a-button
                :disabled="!rows.length || state === 'generating'"
                :loading="checkState === 'checking'"
                class="btn-check-agent"
                title="调用 Check Agent 对口播与板书做语义与节奏润色"
                @click="checkRows('standard')"
              >
                <template #icon><CheckCircleOutlined /></template>
                Check Agent
              </a-button>

              <!-- ④ 教学微课演播（含生成板书html播放录制页面） -->
              <a-button
                type="primary"
                class="btn-open-handdraw-player"
                :disabled="!rows.length"
                style="background: #2563eb; font-weight: 600;"
                title="在统一演播单页中播放音画微课、录制导出视频、交付物展示"
                @click="openHanddrawPlayer"
              >
                <template #icon><VideoCameraOutlined /></template>
                🎬 演播录制
              </a-button>

              <!-- ⑤ 生成交付单页 (固化 HTML + JSON 归档) -->
              <a-button
                class="btn-generate-deliverable"
                :disabled="!rows.length || state === 'generating'"
                :loading="deliverableGenerating"
                title="固化生成或更新最终教学视频素材参数单页与 JSON（写入 public/deliverable/ 永久存档）"
                @click="generateDeliverablePage"
              >
                <template #icon><FileDoneOutlined /></template>
                {{ deliverableResult ? '固化归档' : '生成交付单页' }}
              </a-button>

              <!-- ⑥ 导出下拉（口播稿 / 画布分镜总表 / 下游API参数说明 / 完整规格JSON） -->
              <a-dropdown :disabled="!rows.length">
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="speech" @click="exportSpeech">
                      <DownloadOutlined /> 口播稿件 MD（纯语音用）
                    </a-menu-item>
                    <a-menu-item key="storyboard" @click="exportStoryboard">
                      <DownloadOutlined /> 画布分镜总表 MD（导入剪辑器用）
                    </a-menu-item>
                    <a-menu-divider />
                    <a-menu-item key="json" @click="downloadDeliverableJson">
                      <DownloadOutlined /> 完整规格 JSON（板书+时序状态树）
                    </a-menu-item>
                  </a-menu>
                </template>
                <a-button :disabled="!rows.length" class="btn-export-dropdown">
                  <template #icon><DownloadOutlined /></template>
                  导出
                </a-button>
              </a-dropdown>

              <!-- 配置组 -->
              <a-button
                class="btn-settings"
                title="配置 Agent B API 密钥"
                @click="apiConfigOpen = true"
              >
                <template #icon><KeyOutlined /></template>
              </a-button>

              <a-select
                v-model:value="selectedSkillId"
                class="skill-style-select"
                style="width: 160px;"
                placeholder="切换讲课风格"
                :options="skillOptions"
                @change="(val) => onSkillChange(val)"
              />

            </div>
          </template>

          <!-- 演播室标准规范面板（时序与节奏由真实音频和系统底层基准自动驱动，不再暴露手动微调配置） -->
          <div class="studio-params-panel">
            <div class="params-panel-header">
              <span class="params-panel-title">📐 演播室标准画布规格</span>
              <span class="params-panel-hint">画布规格与字号忠实继承自 Agent A，时序与行停顿由系统及真实音频自适应驱动</span>
            </div>
            <div class="params-panel-controls">
              <div class="param-control-item">
                <span class="param-coord-pill">
                  📐 标准真画布 {{ CANVAS_SIZE.width }}×{{ CANVAS_SIZE.height }} (16:9) · 四区百分比坐标系
                </span>
              </div>

              <div class="param-control-item">
                <span class="param-coord-pill secondary">
                  🔤 题 {{ handoff?.canvasParams?.fontSize?.question?.px || 30 }}px / 文 {{ handoff?.canvasParams?.fontSize?.analysis?.px || 24 }}px
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="!rows.length"
            class="workbench-empty-state"
          >
            <div class="empty-icon-box">📐</div>
            <div class="empty-text-title">题目信息与四区排版已就绪</div>
            <div class="empty-text-sub">点击右上角「生成 Agent B 五字段」按钮，即可为小朋友生成由浅入深、温润启发式的讲课剧本</div>
            <a-button
              type="primary"
              size="large"
              class="btn-empty-generate"
              :loading="state === 'generating'"
              @click="(e) => generateRows(e.shiftKey)"
            >
              <template #icon>
                <ThunderboltOutlined />
              </template>
              开始生成五字段执行表
            </a-button>
          </div>

          <div v-else class="studio-table-container">
            <!-- 视觉时间轴组件：映射每个 Row 组为独立区块，展示 MP3 时长与板书起手时机（由音频和系统语义自动驱动） -->
            <VisualTimeline
              :rows="rows"
              :active-index="editingBoardIndex"
              :playing-index="playingAudioIndex === null ? -1 : playingAudioIndex"
              @select-row="onSelectRowFromTimeline"
              @play-audio="onPlayAudioFromTimeline"
            />

            <!-- 列空间合理分配与自由折叠工具条 -->
            <div class="studio-col-layout-bar">
              <div class="col-layout-left">
                <span class="col-layout-label">分列布局:</span>
                <div class="preset-btn-group">
                  <button
                    type="button"
                    :class="['preset-btn', { active: layoutPreset === 'standard' }]"
                    title="标准全景：口播与板书舒适并列，空间均衡分配"
                    @click="setLayoutPreset('standard')"
                  >
                    🌟 标准全景
                  </button>
                  <button
                    type="button"
                    :class="['preset-btn', { active: layoutPreset === 'speech_focus' }]"
                    title="专注口播：折叠板书与动作，口播稿占超宽阔视野，沉浸打磨讲课录音文案"
                    @click="setLayoutPreset('speech_focus')"
                  >
                    🎙️ 专注口播
                  </button>
                  <button
                    type="button"
                    :class="['preset-btn', { active: layoutPreset === 'board_focus' }]"
                    title="专注板书：折叠口播与动作，板书占超宽阔视野，沉浸推导公式与推演几何"
                    @click="setLayoutPreset('board_focus')"
                  >
                    ✍️ 专注板书
                  </button>
                </div>
              </div>

              <div class="col-layout-right">
                <span class="col-layout-sublabel">每列折叠:</span>
                <button
                  type="button"
                  :class="['col-toggle-chip', { collapsed: collapsedCols.speech }]"
                  :title="collapsedCols.speech ? '点击展开口播列' : '点击折叠收起口播列'"
                  @click="toggleColumn('speech')"
                >
                  <span :class="['chip-dot', { off: collapsedCols.speech }]"></span>
                  🎙️ 口播稿 {{ collapsedCols.speech ? '(已折叠)' : '' }}
                </button>
                <button
                  type="button"
                  :class="['col-toggle-chip', { collapsed: collapsedCols.board }]"
                  :title="collapsedCols.board ? '点击展开板书列' : '点击折叠收起板书列'"
                  @click="toggleColumn('board')"
                >
                  <span :class="['chip-dot', { off: collapsedCols.board }]"></span>
                  ✍️ 课堂板书 {{ collapsedCols.board ? '(已折叠)' : '' }}
                </button>
                <button
                  type="button"
                  :class="['col-toggle-chip', { collapsed: collapsedCols.actionSpec }]"
                  :title="collapsedCols.actionSpec ? '点击展开动作列' : '点击折叠收起动作列'"
                  @click="toggleColumn('actionSpec')"
                >
                  <span :class="['chip-dot', { off: collapsedCols.actionSpec }]"></span>
                  ⚡ 板书动作 {{ collapsedCols.actionSpec ? '(已折叠)' : '' }}
                </button>
              </div>
            </div>

            <a-table
              :columns="columns"
              :data-source="tableRows"
              row-key="_rowKey"
              :pagination="false"
              class="studio-table"
              :bordered="false"
              :custom-row="customRow"
            >
            <!-- 表头自定义渲染：支持直接在表头点击折叠/展开每列 -->
            <template #headerCell="{ column }">
              <div v-if="column.key === 'speech'" class="col-header-flex">
                <span>{{ column.title }}</span>
                <button
                  type="button"
                  class="col-fold-trigger"
                  :title="collapsedCols.speech ? '点击展开口播稿列' : '点击折叠收起口播稿列，为板书腾出超大视野'"
                  @click.stop="toggleColumn('speech')"
                >
                  {{ collapsedCols.speech ? '展开 ◀▶' : '折叠' }}
                </button>
              </div>
              <div v-else-if="column.key === 'board'" class="col-header-flex">
                <span>{{ column.title }}</span>
                <button
                  type="button"
                  class="col-fold-trigger"
                  :title="collapsedCols.board ? '点击展开课堂板书列' : '点击折叠收起课堂板书列，为口播腾出超大视野'"
                  @click.stop="toggleColumn('board')"
                >
                  {{ collapsedCols.board ? '展开 ◀▶' : '折叠' }}
                </button>
              </div>
              <div v-else-if="column.key === 'actionSpec'" class="col-header-flex center">
                <span>{{ column.title }}</span>
                <button
                  type="button"
                  class="col-fold-trigger"
                  :title="collapsedCols.actionSpec ? '点击展开动作列' : '点击折叠收起动作列'"
                  @click.stop="toggleColumn('actionSpec')"
                >
                  {{ collapsedCols.actionSpec ? '展开' : '折叠' }}
                </button>
              </div>
              <span v-else>{{ column.title }}</span>
            </template>

            <template #bodyCell="{ column, record, index }">
              <!-- 序号与拖拽把手列 -->
              <div v-if="column.key === 'index'" class="cell-index-box">
                <div class="index-badge-row">
                  <div
                    class="row-drag-handle"
                    draggable="true"
                    title="按住鼠标拖拽此行调整顺序"
                    @dragstart="onHandleDragStart($event, index)"
                    @dragend="onRowDragEnd"
                  >
                    <HolderOutlined />
                  </div>
                  <span class="studio-row-badge">{{ index + 1 }}</span>
                  <!-- ★ 行打勾图标：试听完/已生成音频时立刻出现绿色勾，视觉反馈"这行备好了" -->
                  <span
                    v-if="record.audioUrl || rowAudioCache[index]"
                    class="row-audio-check"
                    :title="`第 ${index + 1} 行已有音频 · 真实时长 ${record.audioDurationMs ? (Math.round(record.audioDurationMs / 100) / 10) + 's' : '读取中'}`"
                  >
                    <CheckCircleOutlined />
                  </span>
                  <span
                    v-else
                    class="row-audio-pending"
                    title="本行尚未生成或试听过音频"
                  >○</span>
                </div>
              </div>

              <!-- 环节列 (Stage) -->
              <div v-else-if="column.key === 'stage'" class="cell-stage-box">
                <a-popover trigger="click" placement="bottomLeft" :overlayStyle="{ minWidth: '120px' }">
                  <template #content>
                    <div class="stage-picker-title">切换环节</div>
                    <a-space direction="vertical" size="4" style="display: flex;">
                      <a-button
                        v-for="opt in ['题目', '分析', '解答', '总结']"
                        :key="opt"
                        size="small"
                        :type="record.stage === opt ? 'primary' : 'text'"
                        class="stage-picker-btn"
                        @click="updateRow(index, 'stage', opt)"
                      >
                        {{ opt }}
                      </a-button>
                    </a-space>
                  </template>
                  <div :class="['stage-capsule', 'stage-' + record.stage]" title="点击切换教学环节">
                    <span class="stage-capsule-dot" />
                    <span class="stage-capsule-text">{{ record.stage }}</span>
                  </div>
                </a-popover>
              </div>

              <!-- 口播稿列 (Speech) -->
              <div v-else-if="column.key === 'speech'" class="cell-speech-box">
                <!-- 口播列折叠态：精巧微缩胶囊，点击一键展开 -->
                <div
                  v-if="collapsedCols.speech"
                  class="collapsed-cell-card speech-collapsed"
                  title="口播稿已折叠，点击展开"
                  @click="toggleColumn('speech')"
                >
                  <SoundOutlined class="collapsed-icon" />
                  <span class="collapsed-text">{{ getRowEstimatedSeconds(record.speech).charCount }}字</span>
                  <span v-if="record.audioUrl" class="collapsed-audio-dot" title="已记录音频">🎵</span>
                  <span class="collapsed-tip">展开</span>
                </div>
                <!-- 口播列展开态：舒展大卡片 -->
                <div v-else class="speech-textarea-card">
                  <a-textarea
                    :value="record.speech"
                    :auto-size="{ minRows: 2, maxRows: 8 }"
                    class="studio-speech-input"
                    placeholder="请输入老师口播文案（支持自然标点停顿）..."
                    @change="(event) => updateRow(index, 'speech', event.target.value)"
                  />
                  <div class="speech-stat-footer">
                    <div class="speech-stat-left">
                      <span class="speech-stat-chars">{{ getRowEstimatedSeconds(record.speech).charCount }} 字</span>
                      <span class="speech-stat-divider">·</span>
                      <span class="speech-stat-time">
                        {{ record.audioDurationMs ? `真实音频 ${Math.round(record.audioDurationMs / 100) / 10} 秒` : `预估 ${getRowEstimatedSeconds(record.speech).seconds} 秒` }}
                      </span>
                    </div>

                    <!-- 语音控制按钮组：小喇叭(生成/试听) · 重新生成 · 保存本地并记录下载URL -->
                    <div class="speech-audio-actions">
                      <!-- 1. 手动生成本内容语音的小喇叭按钮 -->
                      <a-button
                        size="small"
                        class="speech-btn-horn"
                        :type="playingAudioIndex === index ? 'primary' : 'default'"
                        :loading="synthesizingRowIndex === index"
                        :title="playingAudioIndex === index ? '暂停播放' : (record.audioUrl || rowAudioCache[index] ? '播放试听' : '手动生成本内容语音')"
                        @click="handlePlayOrSynthesizeSpeech(index, record)"
                      >
                        <template #icon>
                          <PauseCircleOutlined v-if="playingAudioIndex === index" />
                          <SoundOutlined v-else :class="{ 'horn-has-audio': record.audioUrl || rowAudioCache[index] }" />
                        </template>
                        <span>{{ playingAudioIndex === index ? '暂停' : (record.audioUrl || rowAudioCache[index] ? '试听' : '生成语音') }}</span>
                      </a-button>

                      <!-- 2. 播放预览（仅音频URL已记录时）与重新生成（常驻）共存 -->
                      <a-button
                        v-if="record.audioUrl"
                        size="small"
                        class="speech-btn-preview"
                        :type="playingAudioIndex === index ? 'primary' : 'default'"
                        title="播放预览已保存记录的本地音频，检查合成效果"
                        @click="playAudioUrl(record.audioUrl, index)"
                      >
                        <template #icon>
                          <PauseCircleOutlined v-if="playingAudioIndex === index" />
                          <PlayCircleOutlined v-else />
                        </template>
                        <span>{{ playingAudioIndex === index ? '暂停预览' : '播放预览' }}</span>
                      </a-button>
                      <!-- ★ 修复：原 v-else 排他——audioUrl 一记录（含小喇叭首次生成成功 L730
                           即回填），"重新生成"就被顶掉，用户失去重合成入口（speech 改稿后/
                           合成不满意时无路可走）。重新生成走 forceRefresh: true 强制刷新
                           （handleRegenerateSpeech L762），与已有音频不冲突，常驻共展示。 -->
                      <a-button
                        size="small"
                        class="speech-btn-regen"
                        :loading="regeneratingRowIndex === index"
                        title="重新请求 Fish Audio 接口合成当前最新口播内容（已有音频也会强制刷新重合成）"
                        @click="handleRegenerateSpeech(index, record)"
                      >
                        <template #icon><ReloadOutlined /></template>
                        <span>重新生成</span>
                      </a-button>

                      <!-- 3. 保存本地并记录下载URL按钮 -->
                      <a-button
                        size="small"
                        class="speech-btn-savelocal"
                        :loading="savingLocalRowIndex === index"
                        title="保存到本地配套目录（与截图命名规范一致）并记录下载URL"
                        @click="handleSaveLocalSpeech(index, record)"
                      >
                        <template #icon><SaveOutlined /></template>
                        <span>保存本地并记录URL</span>
                      </a-button>
                    </div>
                  </div>

                  <!-- 已记录本地下载URL标签 -->
                  <div v-if="record.audioUrl" class="speech-audio-pill">
                    <span class="audio-pill-label">🎵 本地音频:</span>
                    <span class="audio-pill-url" :title="'点击复制: ' + record.audioUrl" @click="copyAudioUrl(record.audioUrl)">{{ record.audioUrl }}</span>
                    <a-button
                      type="link"
                      size="small"
                      class="audio-pill-btn"
                      title="复制下载URL"
                      @click="copyAudioUrl(record.audioUrl)"
                    >
                      <CopyOutlined />
                    </a-button>
                    <a
                      :href="record.audioUrl"
                      :download="getAudioFilename(record.audioUrl)"
                      class="audio-pill-dl-link"
                      title="下载音频文件到本地"
                    >
                      <DownloadOutlined />
                    </a>
                  </div>
                </div>
              </div>

              <!-- 板书内容列 (Board) -->
              <div v-else-if="column.key === 'board'" class="cell-board-box">
                <!-- 板书列折叠态：精巧微缩胶囊，点击一键展开 -->
                <div
                  v-if="collapsedCols.board"
                  class="collapsed-cell-card board-collapsed"
                  title="板书内容已折叠，点击展开"
                  @click="toggleColumn('board')"
                >
                  <span class="collapsed-icon">✍️</span>
                  <span class="collapsed-text">{{ parseBoard(record.board).content.slice(0, 12) || '板书' }}</span>
                  <span class="collapsed-tip">展开</span>
                </div>
                <!-- 板书列展开态 -->
                <div v-else-if="editingBoardIndex !== index" class="board-card-view" @click="editingBoardIndex = index">
                  <div class="board-card-topbar">
                    <div class="board-tags-left">
                      <span
                        v-if="parseBoard(record.board).startDelay"
                        class="board-delay-tag"
                        :title="`本行语音播放 +${parseBoard(record.board).startDelay}s 后动笔写板书`"
                      >
                        +{{ parseBoard(record.board).startDelay }}s
                      </span>
                    </div>
                    <span class="board-edit-hint">点击编辑板书</span>
                  </div>
                  <div class="board-math-render" v-html="renderBoardContent(record.board) || '<span class=\'board-empty-hint\'>（无板书内容）</span>'" />
                </div>

                <div v-else class="board-card-edit">
                  <div class="board-edit-label">板书内容 (支持 KaTeX):</div>
                  <a-textarea
                    :value="parseBoard(record.board).content"
                    :auto-size="{ minRows: 2, maxRows: 8 }"
                    class="board-content-input"
                    @change="(event) => updateBoardContent(index, event.target.value)"
                  />
                  <div class="board-edit-actions">
                    <a-button size="small" type="primary" class="board-done-btn" @click="editingBoardIndex = -1">
                      完成
                    </a-button>
                  </div>
                </div>
              </div>

              <!-- 板书动作列 (ActionSpec) -->
              <div v-else-if="column.key === 'actionSpec'" class="cell-action-box">
                <!-- 动作列折叠态：极细胶囊 -->
                <div v-if="collapsedCols.actionSpec" class="collapsed-action-wrap">
                  <a-popover
                    v-if="record.actionSpec && record.actionSpec.length"
                    trigger="click"
                    placement="left"
                  >
                    <template #content>
                      <div class="action-popover-title">当前行板书动作详情</div>
                      <a-list
                        :data-source="record.actionSpec"
                        size="small"
                        style="width: 360px; max-height: 400px; overflow: auto"
                      >
                        <template #renderItem="{ item }">
                          <a-list-item>
                            <a-space direction="vertical" size="small" style="width: 100%;">
                              <a-space :size="4" wrap>
                                <a-tag v-if="item.action?.order" color="blue">#{{ item.action.order }}</a-tag>
                                <a-tag color="cyan">{{ actionLabel(item) }}</a-tag>
                              </a-space>
                              <div class="action-popover-content">{{ actionContent(item) }}</div>
                            </a-space>
                          </a-list-item>
                        </template>
                      </a-list>
                    </template>
                    <div class="collapsed-action-pill" title="点击查看动作指令参数">
                      <span class="action-badge-icon">⚡</span>
                      <span class="action-badge-num">{{ record.actionSpec.length }}</span>
                    </div>
                  </a-popover>
                  <span v-else class="action-empty-dash">—</span>
                </div>

                <!-- 动作列展开态 -->
                <a-popover
                  v-else-if="record.actionSpec && record.actionSpec.length"
                  trigger="click"
                  placement="left"
                >
                  <template #content>
                    <div class="action-popover-title">当前行板书动作详情</div>
                    <a-list
                      :data-source="record.actionSpec"
                      size="small"
                      style="width: 360px; max-height: 400px; overflow: auto"
                    >
                      <template #renderItem="{ item }">
                        <a-list-item>
                          <a-space direction="vertical" size="small" style="width: 100%;">
                            <a-space :size="4" wrap>
                              <a-tag v-if="item.action?.order" color="blue">#{{ item.action.order }}</a-tag>
                              <a-tag color="cyan">{{ actionLabel(item) }}</a-tag>
                            </a-space>
                            <div class="action-popover-content">{{ actionContent(item) }}</div>
                          </a-space>
                        </a-list-item>
                      </template>
                    </a-list>
                  </template>
                  <div class="action-badge-pill active" title="点击查看动作指令参数">
                    <span class="action-badge-icon">⚡</span>
                    <span>{{ record.actionSpec.length }} 个动作</span>
                  </div>
                </a-popover>
                <span v-else class="action-empty-dash">—</span>
              </div>

              <!-- 操作列 (Operations) -->
              <div v-else-if="column.key === 'operations'" class="cell-ops-box">
                <a-space :size="4">
                  <a-button
                    type="text"
                    size="small"
                    class="btn-op-move"
                    :disabled="index === 0"
                    title="上移此行"
                    @click="moveRow(index, index - 1)"
                  >
                    <template #icon><ArrowUpOutlined /></template>
                  </a-button>
                  <a-button
                    type="text"
                    size="small"
                    class="btn-op-move"
                    :disabled="index === rows.length - 1"
                    title="下移此行"
                    @click="moveRow(index, index + 1)"
                  >
                    <template #icon><ArrowDownOutlined /></template>
                  </a-button>
                  <a-button
                    type="primary"
                    shape="circle"
                    size="small"
                    class="btn-op-add"
                    title="在下方新增一行"
                    @click="insertRowAfter(index)"
                  >
                    <template #icon><PlusOutlined /></template>
                  </a-button>
                  <a-popconfirm
                    title="确定要删除这一行吗？"
                    ok-text="确定删除"
                    cancel-text="取消"
                    @confirm="deleteRow(index)"
                  >
                    <a-button
                      type="text"
                      danger
                      shape="circle"
                      size="small"
                      class="btn-op-del"
                      title="删除这一行"
                    >
                      <template #icon><DeleteOutlined /></template>
                    </a-button>
                  </a-popconfirm>
                </a-space>
              </div>
            </template>
          </a-table>
        </div>
      </a-card>
        <a-card
          v-if="toolsOpen"
          title="可用工具说明"
          class="qh-surface-card qh-tool-card"
          size="small"
        >
          <template #extra>
            <a-typography-text type="secondary">
              单手串行 · 随口播触发 · 坐标单位百分比
            </a-typography-text>
          </template>
          <a-row :gutter="[12, 12]">
            <a-col
              v-for="item in toolReferenceRows"
              :key="item.key"
              :span="24"
            >
              <a-card
                size="small"
                class="qh-tool-item"
              >
                <a-row
                  :gutter="12"
                  align="top"
                >
                  <a-col :span="6">
                    <div class="qh-tool-preview">
                      <svg
                        v-if="item.key === 'underline'"
                        viewBox="0 0 120 40"
                        width="100%"
                        height="40"
                      >
                        <text
                          x="10"
                          y="18"
                          font-size="14"
                          fill="#263238"
                          font-family="serif"
                        >标记的文字</text>
                        <path
                          d="M8 26 Q 60 38 112 26"
                          :stroke="BOARD_MARK_COLORS.red"
                          stroke-width="2"
                          fill="none"
                          stroke-linecap="round"
                        />
                      </svg>
                      <svg
                        v-else-if="item.key === 'highlight'"
                        viewBox="0 0 120 40"
                        width="100%"
                        height="40"
                      >
                        <rect
                          x="6"
                          y="8"
                          width="108"
                          height="22"
                          :fill="BOARD_MARK_COLORS.yellow"
                          opacity="0.4"
                          rx="3"
                        />
                        <text
                          x="10"
                          y="24"
                          font-size="14"
                          fill="#263238"
                          font-family="serif"
                        >高亮的文字</text>
                      </svg>
                      <svg
                        v-else-if="item.key === 'rough-line'"
                        viewBox="0 0 120 40"
                        width="100%"
                        height="40"
                      >
                        <path
                          d="M10 20 Q 60 18 110 22"
                          :stroke="ROUGH_DRAWING_COLORS.ink"
                          stroke-width="2"
                          fill="none"
                          stroke-linecap="round"
                        />
                      </svg>
                      <svg
                        v-else-if="item.key === 'rough-arrow'"
                        viewBox="0 0 120 40"
                        width="100%"
                        height="40"
                      >
                        <path
                          d="M10 20 Q 60 18 100 22"
                          :stroke="ROUGH_DRAWING_COLORS.red"
                          stroke-width="2"
                          fill="none"
                          stroke-linecap="round"
                        />
                        <path
                          d="M100 22 L 110 16 M 100 22 L 108 28"
                          :stroke="ROUGH_DRAWING_COLORS.red"
                          stroke-width="2"
                          fill="none"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        />
                      </svg>
                    </div>
                  </a-col>
                  <a-col :span="18">
                    <div class="qh-tool-title">
                      <a-tag color="blue">
                        {{ item.label }}
                      </a-tag>
                      <span class="qh-tool-tool-id">{{ item.tool }}</span>
                    </div>
                    <div class="qh-tool-summary">
                      {{ item.summary }}
                    </div>
                    <div class="qh-tool-fields">
                      <div
                        v-for="f in item.fields"
                        :key="f.name"
                        class="qh-tool-field"
                      >
                        <code class="qh-field-name">{{ f.name }}</code>
                        <span class="qh-field-value">{{ f.value }}</span>
                      </div>
                    </div>
                  </a-col>
                </a-row>
                <div
                  v-if="item.example"
                  class="qh-tool-example"
                >
                  <div class="qh-tool-example-label">
                    示例
                  </div>
                  <pre class="qh-tool-example-code">{{ item.example }}</pre>
                </div>
              </a-card>
            </a-col>
          </a-row>
          <a-divider style="margin: 12px 0" />
          <a-row :gutter="12">
            <a-col :span="12">
              <a-typography-title :level="5">
                通用参数
              </a-typography-title>
              <div class="qh-tool-common">
                <div><b>action.order</b>：全表唯一正整数，按播放顺序递增</div>
                <div><b>标记颜色</b>：下划线红色；高亮浅黄色</div>
                <div>
                  <b>直线 / 箭头颜色</b>：<a-tag color="default">
                    ink
                  </a-tag> <a-tag color="red">
                    red
                  </a-tag>
                </div>
                <div><b>笔画 strokeWidthId</b>：normal（细）/ emphasis（粗）</div>
              </div>
            </a-col>
            <a-col :span="12">
              <a-typography-title :level="5">
                可用区域
              </a-typography-title>
              <div class="qh-tool-common">
                <div>
                  <a-tag>question 题目区</a-tag> <a-tag color="orange">
                    analysis 分析区
                  </a-tag>
                </div>
                <div>
                  <a-tag color="green">
                    solution 解答区
                  </a-tag> <a-tag color="purple">
                    summary 总结区
                  </a-tag>
                </div>
                <div style="margin-top:6px;color:#8c8c8c;font-size:12px">
                  绘图工具四个区域都可以画；文字标记只能标记已有的文字
                </div>
              </div>
            </a-col>
          </a-row>
        </a-card>
      </a-space>
    </a-layout-content>
    <a-modal
      :open="Boolean(selectedKnowledge)"
      :title="selectedKnowledge?.knowledgePoint || '知识点详情'"
      width="720px"
      :footer="null"
      @cancel="selectedKnowledge = null"
    >
      <a-descriptions
        v-if="selectedKnowledge"
        bordered
        size="small"
        :column="1"
        class="knowledge-detail-table"
      >
        <a-descriptions-item label="编号">
          {{ selectedKnowledge.knowledgeId || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="学段 / 系列 / 类型">
          {{ [selectedKnowledge.rawKnowledgeRecord?.学段, selectedKnowledge.rawKnowledgeRecord?.系列, selectedKnowledge.rawKnowledgeRecord?.类型].filter(Boolean).join(' / ') || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="经典样题">
          {{ selectedKnowledge.rawKnowledgeRecord?.经典样题 || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="考点">
          {{ selectedKnowledge.examinationPoint || selectedKnowledge.rawKnowledgeRecord?.考点 || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="策略方法">
          {{ selectedKnowledge.strategy || selectedKnowledge.rawKnowledgeRecord?.策略方法 || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="讲解要点">
          {{ selectedKnowledge.rawKnowledgeRecord?.讲解要点举例 || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="易错点">
          {{ selectedKnowledge.commonMistakes?.join('；') || selectedKnowledge.rawKnowledgeRecord?.易错点 || '未提供' }}
        </a-descriptions-item>
        <a-descriptions-item label="公式">
          {{ selectedKnowledge.formula || '按本题判断' }}
        </a-descriptions-item>
        <a-descriptions-item label="总结归纳">
          {{ selectedKnowledge.summary || selectedKnowledge.rawKnowledgeRecord?.总结归纳 || '未提供' }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
    <a-modal
      v-model:open="checkResultOpen"
      :title="checkSource === 'math_asr' ? 'ASR 纯前端数学算式语音转换建议' : 'Check Agent 独立督导润色结果'"
      :width="760"
      @cancel="discardCheckChanges"
    >
      <div
        v-if="checkFailedFallback"
        class="qh-check-empty"
      >
        <WarningOutlined style="color: #faad14;" />
        <div>
          <strong>Check Agent 返回格式异常，已回退原表</strong>
          <p>当前五字段执行表保持原样，未做任何修改。</p>
        </div>
      </div>
      <div
        v-else-if="!checkChanges.length"
        class="qh-check-empty"
      >
        <CheckCircleOutlined />
        <div>
          <strong>未发现需要润色的内容</strong>
          <p>当前五字段执行表保持原样。</p>
        </div>
      </div>
      <a-list
        v-else
        bordered
        :data-source="checkChanges"
        class="qh-check-list"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <div class="qh-check-change">
              <a-space
                wrap
                size="small"
              >
                <a-tag color="blue">
                  第 {{ item.row || '?' }} 行
                </a-tag>
                <a-tag>{{ checkFieldLabels[item.field] || item.field }}</a-tag>
                <a-typography-text type="secondary">
                  {{ item.reason }}
                </a-typography-text>
              </a-space>
              <div class="qh-check-diff">
                <div>
                  <span>原文</span>
                  <p>{{ item.before || '（空）' }}</p>
                </div>
                <div>
                  <span>修正后</span>
                  <p>{{ item.after || '（空）' }}</p>
                </div>
              </div>
            </div>
          </a-list-item>
        </template>
      </a-list>
      <template #footer>
        <a-button @click="discardCheckChanges">
          保留原文
        </a-button>
        <a-button
          v-if="checkChanges.length"
          type="primary"
          @click="applyCheckChanges"
        >
          应用 {{ checkChanges.length }} 处修改
        </a-button>
      </template>
    </a-modal>

    <a-modal
      v-model:open="refineResultOpen"
      title="知识点修缮对比"
      :footer="null"
      width="900px"
      :destroy-on-close="true"
    >
      <a-alert
        v-if="refineResult?.refineOk === false"
        type="warning"
        :message="refineResult?.warning || 'AI 这次没返回标准格式，已保留原内容，可重试'"
        show-icon
        style="margin-bottom: 16px"
      />
      <div v-else>
        <div style="margin-bottom: 12px">
          <a-typography-text type="secondary" style="font-size: 12px">
            左侧为 Agent A 自动匹配结果，右侧为教研 Agent 提炼优化。对比后选择是否应用。
          </a-typography-text>
        </div>
        <a-descriptions
          bordered
          size="small"
          :column="1"
        >
          <a-descriptions-item label="关联知识点">
            <div class="refine-compare-row">
              <div class="refine-compare-col refine-col-original">
                <div class="refine-compare-label">
                  机筛原文
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(handoff?.relatedKnowledge) }}</pre>
              </div>
              <div class="refine-compare-col refine-col-refined">
                <div class="refine-compare-label">
                  教研修缮
                  <a-tag v-if="!isRefineFieldEqual(handoff?.relatedKnowledge, refineResult?.handoff?.relatedKnowledge)" color="green" size="small" style="margin-left: 6px">已优化</a-tag>
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(refineResult?.handoff?.relatedKnowledge) }}</pre>
              </div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="教学重点">
            <div class="refine-compare-row">
              <div class="refine-compare-col refine-col-original">
                <div class="refine-compare-label">
                  机筛原文
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(handoff?.knowledgeAnalysis?.teachingFocus) }}</pre>
              </div>
              <div class="refine-compare-col refine-col-refined">
                <div class="refine-compare-label">
                  教研修缮
                  <a-tag v-if="!isRefineFieldEqual(handoff?.knowledgeAnalysis?.teachingFocus, refineResult?.handoff?.knowledgeAnalysis?.teachingFocus)" color="green" size="small" style="margin-left: 6px">已优化</a-tag>
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(refineResult?.handoff?.knowledgeAnalysis?.teachingFocus) }}</pre>
              </div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="关键公式">
            <div class="refine-compare-row">
              <div class="refine-compare-col refine-col-original">
                <div class="refine-compare-label">
                  机筛原文
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(handoff?.knowledgeAnalysis?.keyFormulaList) }}</pre>
              </div>
              <div class="refine-compare-col refine-col-refined">
                <div class="refine-compare-label">
                  教研修缮
                  <a-tag v-if="!isRefineFieldEqual(handoff?.knowledgeAnalysis?.keyFormulaList, refineResult?.handoff?.knowledgeAnalysis?.keyFormulaList)" color="green" size="small" style="margin-left: 6px">已优化</a-tag>
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(refineResult?.handoff?.knowledgeAnalysis?.keyFormulaList) }}</pre>
              </div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="公式提示">
            <div class="refine-compare-row">
              <div class="refine-compare-col refine-col-original">
                <div class="refine-compare-label">
                  机筛原文
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(handoff?.knowledgeAnalysis?.formulaHints) }}</pre>
              </div>
              <div class="refine-compare-col refine-col-refined">
                <div class="refine-compare-label">
                  教研修缮
                  <a-tag v-if="!isRefineFieldEqual(handoff?.knowledgeAnalysis?.formulaHints, refineResult?.handoff?.knowledgeAnalysis?.formulaHints)" color="green" size="small" style="margin-left: 6px">已优化</a-tag>
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(refineResult?.handoff?.knowledgeAnalysis?.formulaHints) }}</pre>
              </div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item label="常见错误">
            <div class="refine-compare-row">
              <div class="refine-compare-col refine-col-original">
                <div class="refine-compare-label">
                  机筛原文
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(handoff?.knowledgeAnalysis?.commonMistakes) }}</pre>
              </div>
              <div class="refine-compare-col refine-col-refined">
                <div class="refine-compare-label">
                  教研修缮
                  <a-tag v-if="!isRefineFieldEqual(handoff?.knowledgeAnalysis?.commonMistakes, refineResult?.handoff?.knowledgeAnalysis?.commonMistakes)" color="green" size="small" style="margin-left: 6px">已优化</a-tag>
                </div>
                <pre class="refine-compare-content">{{ formatRefineField(refineResult?.handoff?.knowledgeAnalysis?.commonMistakes) }}</pre>
              </div>
            </div>
          </a-descriptions-item>
        </a-descriptions>
      </div>
      <div class="refine-modal-footer">
        <a-space>
          <a-button @click="keepOriginalRefine">
            保留原文
          </a-button>
          <a-button
            type="primary"
            :loading="refineApplying"
            @click="applyRefine"
          >
            应用修缮
          </a-button>
        </a-space>
      </div>
    </a-modal>

    <!-- Agent B API 配置与多密钥轮询弹窗 -->
    <a-modal
      v-model:open="apiConfigOpen"
      title="Agent B · API 服务与多密钥配置"
      :width="600"
      @ok="onSaveApiConfig"
    >
      <div style="margin-bottom: 12px;">
        <a-typography-paragraph type="secondary" style="font-size: 12px; margin-bottom: 8px;">
          在此配置生成板书五字段所调用的上游大模型 API。支持多密钥自动轮询与故障重试。
        </a-typography-paragraph>
      </div>

      <a-form layout="vertical">
        <a-form-item label="接口地址（Chat Completions URL）">
          <a-input-password
            v-model:value="agentBApiConfig.endpoint"
            placeholder="https://api.example.com/v1/chat/completions"
            :visibility-toggle="false"
          />
        </a-form-item>

        <a-form-item label="API Key（支持多个密钥用逗号,或，隔开）">
          <a-input-password
            v-model:value="agentBApiConfig.apiKey"
            placeholder="输入 API Key，多填用英文小写逗号,隔开"
            autocomplete="off"
            :visibility-toggle="false"
          />
          <div style="margin-top: 6px; font-size: 12px;">
            <span
              v-if="parseAgentBApiKeys(agentBApiConfig.apiKey).length > 1"
              style="color: #10b981; font-weight: 600;"
            >
              ✓ 已识别到 {{ parseAgentBApiKeys(agentBApiConfig.apiKey).length }} 个密钥：请求时自动轮询负载均衡，遇限流/失效无缝故障转移！
            </span>
            <span v-else style="color: #64748b;">
              💡 填入多个密钥（用英文小写逗号 <code>,</code> 隔开），系统发起请求时将自动轮询并处理限流重试。
            </span>
          </div>
        </a-form-item>

        <a-form-item label="模型名称（Model）">
          <a-input
            v-model:value="agentBApiConfig.model"
            placeholder="输入模型名，如 agnes-2.0-flash / gpt-4o 等"
          />
        </a-form-item>
      </a-form>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
        <a-tag :color="isAgentBApiReady() ? 'success' : 'default'">
          {{ isAgentBApiReady() ? `✓ 就绪 (可用 ${parseAgentBApiKeys(agentBApiConfig.apiKey).length} 个 Key)` : '请填写完整接口地址、API Key 与模型' }}
        </a-tag>
        <span style="font-size: 11px; color: #94a3b8;">配置即时生效并保存至浏览器</span>
      </div>
    </a-modal>

    <!-- 产物单页生成成功弹窗 -->
    <a-modal
      v-model:open="deliverableModalOpen"
      title="🎉 教学视频素材参数产物单页已生成"
      :width="620"
      :footer="null"
    >
      <div class="deliverable-modal-body">
        <a-result
          status="success"
          title="参数已固化为最终交付单页"
          :sub-title="`已归档至 public/deliverable/ · HTML 落地实体页面与 JSON 规格成对生成`"
        >
          <template #extra>
            <a-space size="middle" wrap>
              <a-button type="primary" size="large" class="btn-modal-open-deliverable" @click="openDeliverablePage">
                <template #icon><EyeOutlined /></template>
                立即打开 HTML 产物单页
              </a-button>
              <a-button size="large" @click="downloadDeliverableJson">
                <template #icon><DownloadOutlined /></template>
                下载配套 JSON 文件
              </a-button>
              <a-button size="large" @click="deliverableModalOpen = false">
                留在当前页面
              </a-button>
            </a-space>
          </template>
        </a-result>
        <div class="deliverable-modal-meta">
          <div class="meta-item">
            <span class="meta-label">交付项目编号:</span>
            <span class="meta-value code-font">{{ deliverableResult?.projectCode }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">实体 HTML 页面:</span>
            <span class="meta-value text-emerald font-mono">public/deliverable/deliverable-{{ deliverableResult?.projectCode }}.html</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">配套 JSON 文件:</span>
            <span class="meta-value text-slate font-mono">public/deliverable/deliverable-{{ deliverableResult?.projectCode }}.json</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">真画布规格:</span>
            <span class="meta-value">{{ CANVAS_SIZE.width }} × {{ CANVAS_SIZE.height }} (16:9 标准比例锁定)</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">已固化时序:</span>
            <span class="meta-value">{{ rows.length }} 步 (含五字段完整时序、纯净口播与动作规范)</span>
          </div>
        </div>
      </div>
    </a-modal>

    <!-- 极具科技美感与情感化的高端生成中动画弹窗（全流程多阶段呼吸轮播） -->
    <ProcessLoadingModal
      :visible="state === 'generating'"
      title="AI 教学引擎正在分析与编排微课..."
      mode="agent-b"
    />

    <!-- 第二双眼睛独立质检 Loading 弹窗 -->
    <ProcessLoadingModal
      :visible="checkState === 'checking'"
      title="第二双眼睛 AI 深度质检中..."
      mode="check"
    />
  </a-layout>
</template>

<style scoped>
/* ★ Task 13：下游 Agent 规范抽屉样式已随 useApiSpecDrawer 幽灵契约链整块移除 */


/* 页面工作台自适应放宽，保证演播室表格宽阔舒展 */
:deep(.qh-page-content) {
  max-width: 1480px;
  padding-left: 24px;
  padding-right: 24px;
}


.workbench-title-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12px;
}

.workbench-title-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.workbench-main-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink-deep, #163b3d);
  letter-spacing: -0.01em;
}

.workbench-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
}

.tag-type {
  background: var(--positive-pale, #dff4ea);
  color: var(--positive-strong, #116b5b);
  border: 1px solid var(--line-strong, #b9cdc5);
}

.tag-skill {
  background: #fdf2f8;
  color: #db2777;
  border: 1px solid #fce7f3;
}

.tag-model {
  background: var(--sun-pale, #fff2c7);
  color: var(--warning, #9a6a18);
  border: 1px solid #fde68a;
}

.tag-rows {
  background: var(--surface-soft, #edf7f0);
  color: var(--ink, #31595a);
  border: 1px solid var(--line, #d7ded5);
}

.workbench-stat-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--positive-strong, #116b5b);
  background: var(--positive-pale, #dff4ea);
  border: 1px solid var(--line-strong, #b9cdc5);
  padding: 3px 12px;
  border-radius: 9999px;
}

/* 操作栏分组 */
.studio-actions-container {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ASR 兜底暖金按钮 */
.btn-asr-fallback {
  background: var(--sun, #f6c95f) !important;
  border-color: #eab308 !important;
  box-shadow: 0 2px 6px rgba(234, 179, 8, 0.25) !important;
  font-weight: 600 !important;
  color: #5c4308 !important;
  border-radius: var(--control-radius, 12px) !important;
  transition: all 0.16s ease !important;
}

.btn-asr-fallback:hover:not(:disabled) {
  background: #eab308 !important;
  border-color: #ca8a04 !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 10px rgba(234, 179, 8, 0.3) !important;
}

.btn-check-agent {
  border-color: var(--line, #d7ded5);
  color: var(--ink, #31595a);
  background: var(--surface, #fffdf7);
  border-radius: var(--control-radius, 12px);
  transition: all 0.16s ease;
}

.btn-check-agent:hover:not(:disabled) {
  border-color: var(--brand, #16856f);
  color: var(--positive-strong, #116b5b);
  background: var(--positive-pale, #dff4ea);
  transform: translateY(-1px);
}

.btn-export-dropdown {
  border-color: var(--line, #d7ded5);
  color: var(--ink, #31595a);
  border-radius: var(--control-radius, 12px);
}

.btn-settings {
  border-color: var(--line, #d7ded5);
  color: var(--muted, #708786);
  border-radius: var(--control-radius, 12px);
}

.btn-settings:hover {
  border-color: var(--brand, #16856f);
  color: var(--ink-deep, #163b3d);
  background: var(--surface-soft, #edf7f0);
}

/* 主生成按钮：可爱的治愈系深林翡翠绿 */
.btn-main-generate {
  background: var(--positive-strong, #116b5b) !important;
  border: 1px solid var(--positive-strong, #116b5b) !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  border-radius: var(--control-radius, 12px) !important;
  box-shadow: 0 4px 14px rgba(17, 107, 91, 0.28) !important;
  transition: all 0.16s ease !important;
}

.btn-main-generate:hover:not(:disabled) {
  background: var(--positive, #16856f) !important;
  border-color: var(--positive, #16856f) !important;
  transform: translateY(-1px) !important;
  box-shadow: 0 6px 18px rgba(17, 107, 91, 0.35) !important;
}

/* 画布与演播室参数面板 */
.studio-params-panel {
  background: var(--surface-soft, #edf7f0);
  border: 1px solid var(--line, #d7ded5);
  border-radius: var(--control-radius, 12px);
  padding: 10px 16px;
  margin-bottom: 14px;
}

.params-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.params-panel-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-deep, #163b3d);
}

.params-panel-hint {
  font-size: 11px;
  color: var(--muted, #708786);
}

.params-panel-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.param-control-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

.param-control-item:hover {
  background: var(--surface, #fffdf7);
  border-color: var(--line, #d7ded5);
  box-shadow: 0 2px 8px rgba(22, 59, 61, 0.05);
  transform: translateY(-1px);
}

.param-coord-pill {
  font-size: 11px;
  color: var(--positive-strong, #116b5b);
  background: var(--positive-pale, #dff4ea);
  border: 1px solid var(--line-strong, #b9cdc5);
  padding: 2px 8px;
  border-radius: 9999px;
  font-weight: 600;
}

/* 空状态：可爱手账治愈系 */
.workbench-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 52px 24px;
  text-align: center;
  background: var(--surface-soft, #edf7f0);
  border: 2px dashed var(--line-strong, #b9cdc5);
  border-radius: var(--card-radius, 18px);
  margin: 14px 0;
}

.empty-icon-box {
  font-size: 40px;
  margin-bottom: 12px;
  filter: drop-shadow(0 4px 8px rgba(22, 59, 61, 0.12));
}

.empty-text-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--ink-deep, #163b3d);
  margin-bottom: 6px;
}

.empty-text-sub {
  font-size: 13.5px;
  color: var(--muted, #708786);
  max-width: 480px;
  line-height: 1.65;
  margin-bottom: 20px;
}

.btn-empty-generate {
  height: 42px;
  padding: 0 28px;
  border-radius: var(--control-radius, 12px);
  font-weight: 700;
  background: var(--positive-strong, #116b5b);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 14px rgba(17, 107, 91, 0.3);
  transition: all 0.16s ease;
}

.btn-empty-generate:hover {
  background: var(--positive, #16856f);
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(17, 107, 91, 0.38);
}

/* 列空间合理分配与自由折叠工具条 */
.studio-col-layout-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  background: var(--surface-soft, #edf7f0);
  border: 1px solid var(--line, #d7ded5);
  border-radius: var(--control-radius, 12px);
  padding: 8px 14px;
  margin-bottom: 12px;
}


.col-layout-left,
.col-layout-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.col-layout-label,
.col-layout-sublabel {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.preset-btn-group {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #edf2f7;
  padding: 2px;
  border-radius: 6px;
}

.preset-btn {
  border: none;
  background: transparent;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 500;
  color: #475569;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.preset-btn:hover {
  color: #1e293b;
  background: rgba(255, 255, 255, 0.6);
}

.preset-btn.active {
  background: #ffffff;
  color: #2563eb;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.col-toggle-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 9px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  cursor: pointer;
  transition: all 0.18s ease;
}

.col-toggle-chip:hover {
  border-color: #3b82f6;
  color: #2563eb;
}

.col-toggle-chip.collapsed {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #94a3b8;
}

.chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  transition: background 0.2s ease;
}

.chip-dot.off {
  background: #cbd5e1;
}

/* 表头折叠切换按钮 */
.col-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
}

.col-header-flex.center {
  justify-content: center;
}

.col-fold-trigger {
  border: none;
  background: #e2e8f0;
  color: #475569;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.col-fold-trigger:hover {
  background: #2563eb;
  color: #ffffff;
}

/* 折叠态单元格小卡片 */
.collapsed-cell-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 4px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.collapsed-cell-card:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.collapsed-cell-card .collapsed-icon {
  font-size: 14px;
}

.collapsed-cell-card .collapsed-text {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 64px;
}

.collapsed-cell-card .collapsed-tip {
  font-size: 9px;
  color: #3b82f6;
  opacity: 0.8;
}

/* 动作列折叠态 */
.collapsed-action-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
}

.collapsed-action-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.collapsed-action-pill:hover {
  background: #dbeafe;
  transform: scale(1.05);
}

/* 针对演播室表格滑动条的微质感轻量化设置 */
.studio-table :deep(.ant-table-body),
.studio-table :deep(.ant-table-content),
.studio-table :deep(.ant-table-scroll) {
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.16) transparent;
}

.studio-table :deep(.ant-table-body)::-webkit-scrollbar,
.studio-table :deep(.ant-table-content)::-webkit-scrollbar,
.studio-table :deep(.ant-table-scroll)::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

.studio-table :deep(.ant-table-body)::-webkit-scrollbar-track,
.studio-table :deep(.ant-table-content)::-webkit-scrollbar-track,
.studio-table :deep(.ant-table-scroll)::-webkit-scrollbar-track {
  background: transparent;
}

.studio-table :deep(.ant-table-body)::-webkit-scrollbar-thumb,
.studio-table :deep(.ant-table-content)::-webkit-scrollbar-thumb,
.studio-table :deep(.ant-table-scroll)::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.16);
  border-radius: 999px;
}

.studio-table :deep(.ant-table-body)::-webkit-scrollbar-thumb:hover,
.studio-table :deep(.ant-table-content)::-webkit-scrollbar-thumb:hover,
.studio-table :deep(.ant-table-scroll)::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.32);
}

/* 五字段表格美化：治愈手账风格 */
.studio-table {
  border-radius: var(--card-radius, 18px);
  overflow: hidden;
  border: 1px solid var(--line, #d7ded5);
}

.studio-table :deep(.ant-table-thead > tr > th) {
  background: var(--surface-soft, #edf7f0);
  color: var(--ink-deep, #163b3d);
  font-size: 13px;
  font-weight: 700;
  padding: 12px 14px;
  border-bottom: 1px solid var(--line, #d7ded5);
}

.studio-table :deep(.ant-table-tbody > tr) {
  transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.studio-table :deep(.ant-table-tbody > tr > td) {
  padding: 14px 16px;
  border-bottom: 1px solid #edf1eb;
  vertical-align: top;
  background: var(--surface, #fffdf7);
  transition: background-color 0.24s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.24s cubic-bezier(0.4, 0, 0.2, 1),
              border-color 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

.studio-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f4faf6 !important;
  border-bottom-color: var(--line-strong, #b9cdc5);
}

.studio-table :deep(.ant-table-tbody > tr:hover > td:first-child) {
  box-shadow: inset 4px 0 0 0 var(--positive, #16856f);
}

.studio-table :deep(.ant-table-tbody > tr:hover .studio-row-badge) {
  background: var(--positive-pale, #dff4ea);
  color: var(--positive-strong, #116b5b);
  transform: scale(1.08);
  box-shadow: 0 2px 8px rgba(17, 107, 91, 0.2);
}

.studio-table :deep(.ant-table-tbody > tr:hover .speech-textarea-card) {
  border-color: var(--line-strong, #b9cdc5);
  box-shadow: 0 2px 10px rgba(22, 59, 61, 0.06);
}

.studio-table :deep(.ant-table-tbody > tr:hover .board-card-view) {
  border-color: var(--line-strong, #b9cdc5);
  background: var(--surface, #fffdf7);
  box-shadow: 0 2px 10px rgba(22, 59, 61, 0.06);
}

/* 序号徽章与拖拽手柄 */
.cell-index-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 3px;
  padding-top: 3px;
}

.index-badge-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.row-drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 22px;
  border-radius: 4px;
  color: var(--muted, #708786);
  cursor: grab;
  font-size: 13px;
  transition: all 0.15s ease;
  user-select: none;
}

.row-drag-handle:hover {
  color: var(--positive, #16856f);
  background: var(--positive-pale, #dff4ea);
}

.row-drag-handle:active {
  cursor: grabbing;
}

/* 表格行拖拽交互样式 */
.studio-table :deep(.table-row-dragging td) {
  opacity: 0.45 !important;
  background-color: var(--surface-soft, #edf7f0) !important;
}

.studio-table :deep(.table-row-dragover-top td) {
  border-top: 3px solid var(--positive, #16856f) !important;
  background-color: var(--positive-pale, #dff4ea) !important;
}

.studio-table :deep(.table-row-dragover-bottom td) {
  border-bottom: 3px solid var(--positive, #16856f) !important;
  background-color: var(--positive-pale, #dff4ea) !important;
}

.studio-row-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 800;
  background: var(--surface-soft, #edf7f0);
  color: var(--ink-deep, #163b3d);
  border: 1px solid var(--line, #d7ded5);
  transition: all 0.24s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ★ 行音频打勾图标（试听完/已生成音频时绿色勾显眼反馈） */
.row-audio-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 14px;
  color: #16a34a;
  background: rgba(22, 163, 74, 0.12);
  animation: row-audio-check-pop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  margin-left: 2px;
}

.row-audio-pending {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 11px;
  color: var(--muted, #94a3b8);
  margin-left: 2px;
  opacity: 0.55;
}

@keyframes row-audio-check-pop {
  0%   { transform: scale(0.4); opacity: 0; }
  60%  { transform: scale(1.18); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

/* 教学环节胶囊：治愈马卡龙色系 */
.cell-stage-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 4px;
}

.stage-capsule {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.stage-capsule-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.stage-题目 {
  background: var(--blue-pale, #e8f1fa);
  color: var(--blue, #5c88b8);
  border: 1px solid #c7dcf1;
}
.stage-题目 .stage-capsule-dot {
  background: var(--blue, #5c88b8);
}

.stage-分析 {
  background: var(--sun-pale, #fff2c7);
  color: var(--warning, #9a6a18);
  border: 1px solid #fae69e;
}
.stage-分析 .stage-capsule-dot {
  background: var(--sun, #f6c95f);
}

.stage-解答 {
  background: var(--positive-pale, #dff4ea);
  color: var(--positive-strong, #116b5b);
  border: 1px solid var(--line-strong, #b9cdc5);
}
.stage-解答 .stage-capsule-dot {
  background: var(--positive, #16856f);
}

.stage-总结 {
  background: var(--danger-pale, #ffe7e1);
  color: var(--danger, #d95f5f);
  border: 1px solid #fecdd3;
}
.stage-总结 .stage-capsule-dot {
  background: var(--danger, #d95f5f);
}

.stage-capsule:hover {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 4px 10px rgba(22, 59, 61, 0.08);
}

.stage-picker-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-deep, #163b3d);
  margin-bottom: 4px;
  padding: 0 4px;
}

.stage-picker-btn {
  text-align: left;
  justify-content: flex-start;
  width: 100%;
}

/* 口播稿单元格 */
.speech-textarea-card {
  position: relative;
  background: var(--surface, #fffdf7);
  border-radius: var(--control-radius, 12px);
  border: 1px solid var(--line, #d7ded5);
  transition: all 0.2s ease;
}

.speech-textarea-card:focus-within {
  border-color: var(--brand, #16856f);
  box-shadow: 0 0 0 3px rgba(22, 133, 111, 0.18);
}

.studio-speech-input {
  border: none !important;
  box-shadow: none !important;
  padding: 10px 12px 6px !important;
  font-size: 13.5px !important;
  line-height: 1.7 !important;
  color: var(--ink-deep, #163b3d) !important;
  background: transparent !important;
  resize: none !important;
}

.speech-stat-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px 6px;
  font-size: 11px;
  color: #94a3b8;
  border-top: 1px dashed #f1f5f9;
}

.speech-stat-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.speech-audio-actions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.speech-btn-horn,
.speech-btn-regen,
.speech-btn-preview,
.speech-btn-savelocal {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px !important;
  height: 24px !important;
  padding: 0 7px !important;
  border-radius: 4px !important;
  transition: all 0.2s ease;
}

.speech-btn-horn {
  border-color: #bfdbfe !important;
  color: #1d4ed8 !important;
  background: #eff6ff !important;
}

.speech-btn-horn:hover {
  background: #dbeafe !important;
  border-color: #3b82f6 !important;
  color: #1e40af !important;
}

.horn-has-audio {
  color: #059669;
}

.speech-btn-preview {
  border-color: #c7d2fe !important;
  color: #4338ca !important;
  background: #eef2ff !important;
}

.speech-btn-preview:hover {
  background: #e0e7ff !important;
  border-color: #6366f1 !important;
  color: #3730a3 !important;
}

.speech-btn-regen {
  border-color: #e2e8f0 !important;
  color: #475569 !important;
  background: #f8fafc !important;
}

.speech-btn-regen:hover {
  background: #f1f5f9 !important;
  border-color: #cbd5e1 !important;
  color: #0f172a !important;
}

.speech-btn-savelocal {
  border-color: #bbf7d0 !important;
  color: #15803d !important;
  background: #f0fdf4 !important;
}

.speech-btn-savelocal:hover {
  background: #dcfce7 !important;
  border-color: #22c55e !important;
  color: #166534 !important;
}

.speech-audio-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 8px 6px;
  padding: 2px 8px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 4px;
  font-size: 11px;
  color: #15803d;
}

.audio-pill-label {
  font-weight: 600;
  white-space: nowrap;
}

.audio-pill-url {
  font-family: monospace;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  color: #047857;
  text-decoration: underline dotted;
}

.audio-pill-url:hover {
  color: #065f46;
}

.audio-pill-btn {
  padding: 0 2px !important;
  height: 18px !important;
  color: #15803d !important;
}

.audio-pill-dl-link {
  display: inline-flex;
  align-items: center;
  color: #15803d;
  font-size: 12px;
  transition: transform 0.15s ease;
}

.audio-pill-dl-link:hover {
  color: #047857;
  transform: translateY(1px);
}

.collapsed-audio-dot {
  font-size: 11px;
  margin-left: 2px;
}

.speech-stat-chars {
  font-weight: 500;
}

.speech-stat-divider {
  opacity: 0.6;
}

.speech-stat-time {
  color: #64748b;
}

/* 板书内容单元格与行间距布局 */
.cell-board-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.board-card-view {
  background: var(--surface, #fffdf7);
  border: 1px solid var(--line, #d7ded5);
  border-radius: var(--control-radius, 12px);
  padding: 10px 14px;
  min-height: 52px;
  cursor: pointer;
  transition: all 0.18s ease;
  margin: 3px 0;
}

.board-card-view:hover {
  background: var(--surface-soft, #edf7f0);
  border-color: var(--brand, #16856f);
  box-shadow: 0 2px 8px rgba(22, 59, 61, 0.06);
}

.board-card-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.board-tags-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.board-delay-tag {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  color: #7c3aed;
  background: #f3e8ff;
  padding: 2px 8px;
  border-radius: 9999px;
  border: 1px solid #e9d5ff;
}

.board-edit-hint {
  font-size: 11px;
  color: var(--muted, #708786);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.board-card-view:hover .board-edit-hint {
  opacity: 1;
  color: var(--positive, #16856f);
}

.board-math-render {
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--ink-deep, #163b3d);
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 4px;
}

.board-empty-hint {
  font-size: 12px;
  color: var(--muted, #708786);
  font-style: italic;
}

/* 板书编辑状态 */
.board-card-edit {
  background: var(--surface, #fffdf7);
  border: 1px solid var(--brand, #16856f);
  box-shadow: 0 0 0 3px rgba(22, 133, 111, 0.18);
  border-radius: var(--control-radius, 12px);
  padding: 10px;
}

.board-edit-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-deep, #163b3d);
  margin-bottom: 2px;
}

.board-content-input {
  font-size: 12px;
  line-height: 1.5;
}

.board-edit-actions {
  margin-top: 6px;
  text-align: right;
}

.board-done-btn {
  font-size: 11px;
  height: 26px;
  padding: 0 12px;
  border-radius: 6px;
}

/* 板书动作胶囊 */
.cell-action-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 4px;
}

.action-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 9999px;
  background: var(--surface-soft, #edf7f0);
  color: var(--positive-strong, #116b5b);
  border: 1px solid var(--line-strong, #b9cdc5);
  cursor: pointer;
  transition: all 0.18s ease;
}

.action-badge-pill:hover {
  background: var(--positive-pale, #dff4ea);
  border-color: var(--positive, #16856f);
  transform: translateY(-1px) scale(1.04);
}

.action-badge-icon {
  font-size: 10px;
}

.action-empty-dash {
  color: var(--muted, #94a3b8);
  font-size: 12px;
  font-weight: 600;
}

.action-popover-title {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid #f1f5f9;
}

.action-popover-content {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
}

/* 操作列按钮 */
.cell-ops-box {
  display: flex;
  justify-content: center;
  align-items: center;
  padding-top: 4px;
}

.btn-op-move {
  color: #64748b;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.btn-op-move:hover:not(:disabled) {
  color: #1677ff !important;
  background: #eff6ff !important;
}

.btn-op-move:disabled {
  color: #cbd5e1 !important;
  cursor: not-allowed;
}

.btn-op-add {
  background: #f0fdf4 !important;
  color: #16a34a !important;
  border: 1px solid #bbf7d0 !important;
  box-shadow: none !important;
}

.btn-op-add:hover {
  background: #16a34a !important;
  color: #ffffff !important;
}

.btn-op-del {
  color: #94a3b8;
  transition: color 0.15s ease;
}

.btn-op-del:hover {
  color: #ef4444 !important;
  background: #fef2f2 !important;
}

/* KaTeX 渲染优化 */
.board-math-render :deep(.katex) {
  font-size: 1.1em;
}

.board-math-render :deep(.katex-display) {
  margin: 4px 0;
}

.knowledge-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 11px;
}

.knowledge-chip {
  margin: 0;
  padding: 3px 11px;
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.knowledge-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 119, 255, 0.16);
}

.knowledge-detail-table :deep(.ant-descriptions-item-label) {
  width: 132px;
  color: #49627c;
  background: #f6faff;
}

.qh-check-empty {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 22px 4px;
  color: #1677ff;
  font-size: 20px;
}

.qh-check-empty p {
  margin: 4px 0 0;
  color: #666;
  font-size: 12px;
}

.qh-check-change {
  width: 100%;
}

.qh-check-diff {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.qh-check-diff > div {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  background: #fafafa;
}

.qh-check-diff > div:last-child {
  border-color: #b7ebc6;
  background: #f6ffed;
}

.qh-check-diff span {
  color: #8c8c8c;
  font-size: 11px;
}

.qh-check-diff p {
  margin: 5px 0 0;
  color: #262626;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 720px) {
  .qh-check-diff {
    grid-template-columns: 1fr;
  }
}

.refine-compare-row {
  display: flex;
  gap: 12px;
}
.refine-compare-col {
  flex: 1;
  min-width: 0;
}
.refine-compare-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 4px;
}
.refine-col-original .refine-compare-label {
  color: #8c8c8c;
}
.refine-col-refined .refine-compare-label {
  color: #52c41a;
  font-weight: 500;
}
.refine-col-original .refine-compare-content {
  background: #fafafa;
  border: 1px solid #f0f0f0;
}
.refine-col-refined .refine-compare-content {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}
.refine-compare-content {
  padding: 8px 10px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
}
.refine-modal-footer {
  text-align: right;
  margin-top: 16px;
}

/* 参数表与交接台高质感排版 */
.handoff-workbench-card {
  border-radius: 12px !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.04) !important;
  overflow: hidden;
  background: #ffffff !important;
}

.handoff-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.handoff-title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 13px;
  background: #f1f5f9;
  border-radius: 6px;
}

.handoff-title-text {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.handoff-title-sub {
  font-size: 11px;
  font-weight: 400;
  color: #64748b;
  margin-left: 2px;
}

.btn-refine-confirm {
  border-radius: 8px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  padding: 6px 18px !important;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25) !important;
  transition: all 0.2s ease !important;
  position: relative;
}
.btn-refine-confirm:hover {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35) !important;
}

/* ponytail: 优化确认按钮呼吸小红点 — 比旧 refine-btn-dot 更醒目 */
.refine-pulse-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #ef4444;
  border-radius: 50%;
  margin-right: 8px;
  position: relative;
  animation: refine-pulse 1.5s ease-in-out infinite;
}
.refine-pulse-dot::after {
  content: '';
  position: absolute;
  top: -4px; left: -4px;
  width: 18px; height: 18px;
  border-radius: 50%;
  border: 2px solid #ef4444;
  animation: refine-pulse-ring 1.5s ease-out infinite;
}
@keyframes refine-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.7; transform: scale(0.85); }
}
@keyframes refine-pulse-ring {
  0%   { opacity: 0.6; transform: scale(0.8); }
  100% { opacity: 0;   transform: scale(1.8); }
}

.handoff-summary-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  border-radius: 8px;
  margin-bottom: 8px;
}

.handoff-summary-label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
}

.handoff-stats-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.handoff-stat-tag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #475569;
  font-weight: 500;
}

.qh-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  margin: 14px 0 6px;
  letter-spacing: 0.01em;
}

.qh-section-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 12px;
  background: #3b82f6;
  border-radius: 2px;
}

.qh-section-title:first-of-type {
  margin-top: 2px;
}

/* ponytail: 表头棕色稍大字号（题目信息/知识点等），让人看出整体层次 */
.qh-section-title.brown {
  font-size: 16px;
  font-weight: 700;
  color: #92400e;
}
.qh-section-title.brown::before {
  background: #b45309;
  height: 16px;
}

/* ponytail: 交接状态进度条外置（表外上方, 一打开就有"在执行"感） */
.handoff-progress-strip {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: linear-gradient(90deg, #fff7ed 0%, #fef3c7 50%, #fff7ed 100%);
  border: 1px solid #fde68a;
  border-radius: 12px;
  margin-bottom: 14px;
  box-shadow: 0 1px 4px rgba(180, 83, 9, 0.08);
  animation: handoff-progress-pulse 3s ease-in-out infinite;
}
@keyframes handoff-progress-pulse {
  0%, 100% { box-shadow: 0 1px 4px rgba(180, 83, 9, 0.08); }
  50%      { box-shadow: 0 2px 10px rgba(180, 83, 9, 0.16); }
}
.handoff-progress-strip .handoff-summary-label {
  font-size: 13px;
  font-weight: 700;
  color: #92400e;
}
.handoff-progress-strip .qh-handoff-steps {
  flex: 1;
  min-width: 0;
}

/* ponytail: 画布预览卡片 */

/* ponytail: 三大板块改 a-tabs（消除横向滑动条 + 卡内滚动条，不再分合感） */
.handoff-tri-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 12px;
}
.handoff-tri-tabs :deep(.ant-tabs-tab) {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  position: relative;
}
/* ponytail: 三个 tab 头呼吸小红点 — 让用户注意到可切换 */
.handoff-tri-tabs :deep(.ant-tabs-tab)::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  background: #ef4444;
  border-radius: 50%;
  margin-right: 7px;
  animation: tab-dot-breathe 2s ease-in-out infinite;
  box-shadow: 0 0 4px rgba(239, 68, 68, 0.5);
}
@keyframes tab-dot-breathe {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.4; transform: scale(0.7); }
}
.handoff-tri-tabs :deep(.ant-tabs-tab-active) {
  color: #b45309;
}
.handoff-block-card {
  margin-bottom: 14px;
}

/* ponytail: 步骤徽章 (1/2/3/4 引导用户先按什么再干什么) */
.step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: #fff;
  color: #1d4ed8;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  margin-right: 4px;
  border: 1.5px solid #1d4ed8;
}
.btn-step-1 .step-badge { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
.btn-step-2 .step-badge,
.btn-step-3 .step-badge,
.btn-step-4 .step-badge { background: #fff; color: #475569; border-color: #94a3b8; }

/* ponytail: 风格切换下拉 (替代旧"提示词"按钮) */
.skill-style-select :deep(.ant-select-selector) {
  border-radius: 6px !important;
}

/* 参数表描述列表样式穿透与质感微调 */
:deep(.handoff-descriptions.ant-descriptions-bordered) {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e8edf5;
}

:deep(.handoff-descriptions .ant-descriptions-row) {
  transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.handoff-descriptions .ant-descriptions-item-label) {
  background: #f8fafc !important;
  color: #475569 !important;
  font-size: 12px !important;
  font-weight: 600 !important;
  padding: 7px 12px !important;
  border-color: #f1f5f9 !important;
  width: 96px !important;
  min-width: 96px !important;
  transition: background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1),
              color 0.22s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

:deep(.handoff-descriptions .ant-descriptions-item-content) {
  background: #ffffff !important;
  padding: 7px 12px !important;
  border-color: #f1f5f9 !important;
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  transition: background-color 0.22s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

/* 参数表表格行 hover 提升感 */
:deep(.handoff-descriptions .ant-descriptions-row:hover .ant-descriptions-item-label) {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}

:deep(.handoff-descriptions .ant-descriptions-row:hover .ant-descriptions-item-content) {
  background: #fafcff !important;
}

:deep(.handoff-descriptions .ant-descriptions-row:hover .qh-field-key) {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #1e293b;
  opacity: 1;
}

:deep(.handoff-descriptions .ant-descriptions-row:hover .canvas-param-chip),
:deep(.handoff-descriptions .ant-descriptions-row:hover .zone-param-chip) {
  background: #ffffff;
  border-color: #cbd5e1;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.05);
}

/* 单元格大字与小小字布局容器 */
.field-val-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  width: 100%;
}

.field-val-box.wrap-box {
  align-items: flex-start;
  flex-wrap: wrap;
}

.field-val-main {
  font-size: 12.5px;
  color: #0f172a;
  line-height: 1.5;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.field-val-main.font-medium {
  font-weight: 600;
  color: #1e293b;
}

.field-val-main.text-secondary {
  color: #64748b;
  font-size: 12px;
}

/* 小小字段名徽标（优雅的微徽标，不撑爆表格） */
.qh-field-key {
  display: inline-flex;
  align-items: center;
  font-size: 9.5px;
  line-height: 14px;
  height: 16px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.01em;
  white-space: nowrap;
  flex-shrink: 0;
  opacity: 0.85;
  user-select: all;
  transition: all 0.15s ease;
}

.qh-field-key:hover {
  background: #e2e8f0;
  color: #334155;
  border-color: #cbd5e1;
  opacity: 1;
}

/* 画布参数结构化展示芯片 */
.canvas-params-desc-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;
}

.canvas-params-chips-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.canvas-param-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  padding: 2px 7px;
  background: #f8fafc;
  border: 1px solid #e8edf5;
  border-radius: 6px;
  color: #334155;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.canvas-param-chip:hover {
  background: #ffffff;
  border-color: #3b82f6;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.12);
  transform: translateY(-1px);
}

.canvas-param-chip .chip-k {
  color: #64748b;
  font-size: 10.5px;
}

.canvas-param-chip .chip-v {
  font-weight: 600;
  color: #0f172a;
}

/* 四区参数网格 */
.zone-tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  width: 100%;
}

.zone-param-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11.5px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: default;
}

.zone-param-chip:hover {
  background: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12);
  transform: translateY(-1px);
}

.zone-chip-label {
  color: #2563eb;
  font-weight: 600;
}

.zone-chip-val {
  color: #475569;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

/* 题型配比进度胶囊 */
.ratio-bars-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.ratio-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 600;
}

.ratio-pill.analysis {
  background: #fff1f0;
  color: #cf1322;
  border: 1px solid #ffa39e;
}

.ratio-pill.solution {
  background: #e6f4ff;
  color: #0958d9;
  border: 1px solid #91caff;
}

.ratio-pill.summary {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.ratio-pill.intro {
  background: #f5f5f5;
  color: #595959;
  border: 1px solid #d9d9d9;
}

.meta-path-val {
  font-size: 11.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #2563eb;
  word-break: break-all;
}

.param-empty-text {
  font-size: 11.5px;
  color: #94a3b8;
  font-style: italic;
}

.handoff-usage-note {
  font-size: 12px;
  color: #64748b;
  line-height: 1.6;
}

.knowledge-point-tag {
  border-radius: 4px;
  font-size: 11.5px;
  padding: 1px 7px;
}

.formula-tag {
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  padding: 1px 7px;
}

/* 最终交付产物单页按钮样式 */
.group-deliverable {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-generate-deliverable {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
  border-color: #059669 !important;
  color: #ffffff !important;
  font-weight: 600 !important;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.28) !important;
  transition: all 0.2s ease !important;
}

.btn-generate-deliverable:hover:not(:disabled) {
  background: linear-gradient(135deg, #047857 0%, #059669 100%) !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
  transform: translateY(-1px);
}

.btn-generate-deliverable:disabled {
  opacity: 0.6 !important;
  box-shadow: none !important;
}

/* 极简轻量级播放器按钮 */
/* 产物单页弹窗内容 */
.deliverable-modal-body {
  padding: 8px 0;
}

.btn-modal-open-deliverable {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
  border-color: #059669 !important;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3) !important;
}

.deliverable-modal-meta {
  margin-top: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.meta-label {
  color: #64748b;
}

.meta-value {
  color: #0f172a;
  font-weight: 500;
}

.meta-value.code-font {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #2563eb;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
}

.meta-value.text-emerald {
  color: #059669;
}

.knowledge-section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
}

.refine-applied-alert {
  margin: -4px 0 10px;
}

.refine-applied-fields {
  border-left: 3px solid #52c41a;
}
</style>
