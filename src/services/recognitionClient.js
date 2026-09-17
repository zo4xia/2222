/**
 * 第1步本页多模态识别客户端
 * 浏览器只打本地 /api/recognition/problem
 * 真 apiKey / endpoint / model 全部由前端用户在「Agent 配置」里填写，
 * 通过 userApiConfig 统一管理；不再从服务端 .env 读取。
 */
import { getUserApiSnapshot } from '../lib/userApiConfig.js'
import { showGlobalLoading, hideGlobalLoading } from './globalLoading.js'

export async function recognizeProblem({
  problemText = '',
  imageDataUrl = '',
  model = '',
  endpoint = '',
  apiKey = '',
} = {}) {
  const snapshot = getUserApiSnapshot()
  const finalApiKey = String(apiKey || snapshot.apiKey || '').trim()
  const finalEndpoint = String(endpoint || snapshot.endpoint || '').trim()
  const finalModel = String(model || snapshot.model || '').trim()

  if (!finalApiKey) {
    throw new Error('缺少 apiKey：请先在前端「Agent 配置」里填写用户自己的 API Key')
  }
  if (!/^https?:\/\/.+\/chat\/completions\/?$/i.test(finalEndpoint)) {
    throw new Error('接口地址必须是完整 Chat Completions URL，例如 https://api.example.com/v1/chat/completions')
  }
  if (!finalModel) {
    throw new Error('缺少模型名称：请先在前端「Agent 配置」里填写模型名')
  }

  showGlobalLoading('数据分析中...', '正在深度解析题目结构、几何图形与知识点...')
  let response
  let data
  try {
    response = await fetch('/api/recognition/problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemText,
        imageDataUrl,
        model: finalModel,
        endpoint: finalEndpoint,
        apiKey: finalApiKey,
      }),
    })

    data = await response.json().catch(() => ({}))
  } finally {
    hideGlobalLoading()
  }
  if (!response.ok || !data.ok) {
    throw new Error(data.error || `识别失败 ${response.status}`)
  }

  const result = data.result || {}
  const imageKind = normalizeImageKind(result.imageKind, result.keepOriginal)
  return {
    model: data.model,
    problemText: String(result.problemText || problemText || '').trim(),
    problemType: normalizeType(result.problemType),
    boardFocus: normalizeFocus(result.boardFocus, result.problemType),
    imageKind,
    keepOriginal: imageKind === 'has_diagram',
    uncertainItems: Array.isArray(result.uncertainItems) ? result.uncertainItems : [],
    suggestedLayout: result.suggestedLayout || null,
    // Agent A 深度知识点检索结果（含核心知识点+公式+考点+策略+易错点+知识库原始字段）
    knowledgeAnalysis: normalizeKnowledgeAnalysis(result.knowledgeAnalysis),
    rawText: data.rawText || '',
  }
}

/**
 * 规范化 Agent A 返回的知识点深度分析结果。
 * 即使 LLM 没返回或格式异常，也保证结构稳定，避免下游报错。
 */
function normalizeKnowledgeAnalysis(ka) {
  if (!ka || typeof ka !== 'object') {
    return {
      suggestedGrade: '',
      coreKnowledge: [],
      teachingFocus: '',
      keyFormulaList: [],
    }
  }
  const core = Array.isArray(ka.coreKnowledge) ? ka.coreKnowledge : []
  return {
    suggestedGrade: String(ka.suggestedGrade || '').trim(),
    coreKnowledge: core.map((item) => ({
      knowledgeId: String(item?.knowledgeId || '').trim(),
      knowledgePoint: String(item?.knowledgePoint || '').trim(),
      formula: String(item?.formula || '').trim(),
      examinationPoint: String(item?.examinationPoint || '').trim(),
      strategy: String(item?.strategy || '').trim(),
      commonMistakes: Array.isArray(item?.commonMistakes)
        ? item.commonMistakes.map((m) => String(m || '').trim()).filter(Boolean)
        : String(item?.commonMistakes || '').trim()
          ? [String(item.commonMistakes).trim()]
          : [],
      summary: String(item?.summary || '').trim(),
      rawKnowledgeRecord: typeof item?.rawKnowledgeRecord === 'string'
        ? item.rawKnowledgeRecord
        : item?.rawKnowledgeRecord && typeof item.rawKnowledgeRecord === 'object'
          ? item.rawKnowledgeRecord
          : {},
    })),
    teachingFocus: String(ka.teachingFocus || '').trim(),
    keyFormulaList: Array.isArray(ka.keyFormulaList)
      ? ka.keyFormulaList.map((f) => String(f || '').trim()).filter(Boolean)
      : [],
  }
}

function normalizeImageKind(kind, keepOriginal) {
  const v = String(kind || '').toLowerCase()
  if (['has_diagram', 'diagram', 'figure', 'geometry_figure', 'has_graphic', 'graphic', 'image'].includes(v)) {
    return 'has_diagram'
  }
  if (['text_only', 'text', 'pure_text', 'no_graphic', 'no_diagram'].includes(v)) return 'text_only'
  if (keepOriginal === true) return 'has_diagram'
  // 没给图形判断时，保持文本路径，避免误贴原图
  return 'text_only'
}

function normalizeType(value) {
  const v = String(value || '').toLowerCase()
  if (['geometry', 'calculation', 'word', 'other'].includes(v)) return v
  if (/几何|图形|平面几何|梯形|平行四边|三角|圆|面积|周长|体积|边长|角度|长|宽|高|底边/.test(v)) return 'geometry'
  if (/计算|运算|化简|求值/.test(v)) return 'calculation'
  if (/应用|行程|工程/.test(v)) return 'word'
  return undefined
}

function normalizeFocus(focus, type) {
  const v = String(focus || '').toLowerCase()
  if (
    ['geometry_diagram', 'calculation_process', 'relation_understanding', 'mixed'].includes(v)
  ) {
    return v
  }
  const t = normalizeType(type)
  if (t === 'geometry') return 'geometry_diagram'
  if (t === 'calculation') return 'calculation_process'
  if (t === 'word') return 'relation_understanding'
  return undefined
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
