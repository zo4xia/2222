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

  const REQUEST_TIMEOUT_MS = 130000   // ★ 客户端超时（2026-10-13）：服务端 110s 超时 + 缓冲；到点主动断，绝不无限等

  showGlobalLoading('数据分析中...', '正在深度解析题目结构、几何图形与知识点...')
  let response
  let data
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    response = await fetch('/api/recognition/problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        problemText,
        imageDataUrl,
        model: finalModel,
        endpoint: finalEndpoint,
        apiKey: finalApiKey,
      }),
    })

    data = await response.json().catch(() => ({}))
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`识别请求超时（${Math.round(REQUEST_TIMEOUT_MS / 1000)} 秒）——网络或上游模型过慢，请重试或换更快的模型`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
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

/** 上传前压缩（2026-10-13）：手机原图直传 base64 常到 4~10MB——上传慢、超 Vercel 函数体 4.5MB 上限、
 *  上游视觉模型也用不着原尺寸。长边≤1600px、JPEG 0.85，一般压到 200~600KB。
 *  非位图/解码失败一律回退原图，绝不让上传死在压缩上。 */
export async function compressImageToDataUrl(file, { maxLongEdge = 1600, quality = 0.85 } = {}) {
  const readOriginal = () => fileToDataUrl(file)
  if (!String(file?.type || '').startsWith('image/')) return readOriginal()
  try {
    const origDataUrl = await readOriginal()
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('图片解码失败'))
      el.src = origDataUrl
    })
    const long = Math.max(img.naturalWidth || 0, img.naturalHeight || 0)
    if (!long || long <= maxLongEdge) return origDataUrl            // 已够小，原样直传
    const scale = maxLongEdge / long
    const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale))
    const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    const out = c.toDataURL('image/jpeg', quality)
    return out.length < origDataUrl.length ? out : origDataUrl
  } catch (_) {
    return readOriginal()                                          // 压缩失败回退原图
  }
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}
