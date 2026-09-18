import fs from 'node:fs'
import path from 'node:path'
import { AGENT_B_V2_SYSTEM_PROMPT } from '../src/agent-b-v2/prompt.js'
import { getSkillById, DEFAULT_SKILL_ID } from '../src/agent-b-v2/skills/index.js'
import { parseAgentBV2Response, normalizeAgentBV2BoardCells, sanitizeRowLayout, AGENT_B_V2_STAGES } from '../src/agent-b-v2/contract.js'
import { writeResultFile } from './boardResultStore.js'
// 画布参数唯一真源：src/services/stepHandoff.js
import { CANVAS_SIZE, QUESTION_FONT_SIZE, BOARD_FONT_RATIO_TEXT } from '../src/services/stepHandoff.js'
import {
  isOptions,
  readJsonBody,
  requestAnthropicMessage,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
  getChatMessageText,
} from './http.js'

// ---------- 软降级：尽量从模型输出中提取可用的 rows ----------
function parseJsonObjectLoose(text) {
  const source = String(text || '').trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || source
  try { return JSON.parse(candidate) } catch { /* fall through */ }
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

function extractClosedRows(text) {
  const source = String(text || '').replace(/^\s*```(?:json)?\s*/i, '')
  const rowsStart = source.search(/"rows"\s*:\s*\[/i)
  if (rowsStart < 0) return []
  const arrayStart = source.indexOf('[', rowsStart)
  const rows = []
  let objectStart = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = arrayStart + 1; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      if (depth === 0) objectStart = index
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && objectStart >= 0) {
        try {
          const row = JSON.parse(source.slice(objectStart, index + 1))
          if (row && typeof row === 'object' && !Array.isArray(row)) rows.push(row)
        } catch { /* ignore the malformed row and keep earlier complete rows */ }
        objectStart = -1
      }
    }
    if (depth < 0) break
  }
  return rows
}

function tryExtractFallbackRows(text) {
  const parsed = parseJsonObjectLoose(text)
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : extractClosedRows(text)
  if (!rows.length) return null

  // 用 contract 的归一化函数提取能用的行
  // 非法 stage 会被兜底修正，非法 actionSpec 会被过滤掉
  const normalized = normalizeAgentBV2BoardCells(rows)
  return normalized.length ? normalized : null
}

const AGENT_B_SYSTEM_MESSAGE = AGENT_B_V2_SYSTEM_PROMPT
// ⚠️⚠️⚠️ 发给 Agent B 的白名单字段，只有这里列出的字段才会发给 B ⚠️⚠️⚠️
// 排除前端纯界面控制或时间戳字段（confirmedAt, showGrid, agentPageName, agentCapability）
const HANDOFF_TEXT_FIELDS = [
  'handoffVersion',
  'problemText',
  'problemType',
  'boardFocus',
  'relatedKnowledge',
  'knowledgeAnalysis',
  'suggestedGrade',
  'uncertainItems',
  'suggestedLayout',
  'imageKind',
  'keepOriginal',
  'coordinateSpec',
  'zoneAnchors',
  'topicLayout',
  'boardPlan',
  'canvasParams',
  'essence',
  'stageRatioSuggestion',
  '环节配比占比',
  'screenshotUrl',
  'knowledgeBasePath',
]

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

// handoff 字段注释：和数据一起发给模型，模型读 JSON 时第一眼就看到每个字段干嘛的
// 注释字段以 _ 开头，放在对应数据字段的紧前面（像代码注释一样）
const HANDOFF_FIELD_NOTES = {
  problemText: '题目原文，一字不改，所有分析的基础',
  problemType: '【题目类型】分类指南（计算确定/方法确定/答案不确定/建模推导/概念确定等），指导解题策略',
  boardFocus: '【板书侧重点】本题板书必须重点书写的核心步骤、关键算式与推导结论',
  relatedKnowledge: '【参考】关联知识点+解题思路，按需取用，不要硬塞不要照抄；和本题无关的不用；用的时候用自己的话讲出来',
  knowledgeAnalysis: '【重要】A 侧深度知识点分析\n' +
    '  · teachingFocus：教学方向锚点，整道题的讲解和总结围绕这个核心展开，别因为口语化就把重点讲散了\n' +
    '  · keyFormulaList：关键公式清单，解题真正用到的公式，分析区至少写一次\n' +
    '  · formulaHints：公式提示（公式名+内容+适用场景），cue 公式时参考\n' +
    '  · commonMistakes：易错点清单，讲解过程中顺嘴提一句做提醒（"这里行不行呀？""容易错哈！"），不是单独列出来逐条讲\n' +
    '  · coreKnowledge：知识库完整匹配记录，参考用',
  knowledgeBasePath: '【知识库基准】知识库文件路径（如 doc/knowledge-a.compact.json），作为官方知识点映射基准',
  boardPlan: '【四个标签区域】四区布局规划：题目区、分析区、解答区、总结区。（重要：板书不可以溢出画布，区域坐标仅仅为大概区域，实际遇到题目内容多，板书可以自己调节一下，整体风格像老师上课草算演示，微微达芬奇手稿的style）',
  zoneAnchors: '区域锚点【区域感知 + 动作落点】：只用于感知各区位置与 actionSpec 落点；板书文字不输出起手坐标，由渲染层按区域自然排版（可超出本区，但不得与其他板书重叠、不得溢出画布）',
  canvasParams: `【画布舞台参数】尺寸画布 ${CANVAS_SIZE.width}×${CANVAS_SIZE.height}px，题目字号 ${QUESTION_FONT_SIZE}px 微软雅黑，正文板书（分析/解答/总结）字号${BOARD_FONT_RATIO_TEXT}。以此为绝对物理基准感知舞台规格与垂直跨度`,
  screenshotUrl: '【图片题目请看这个】本次画布舞台的截图地址/URL。若题目带有图形、几何配图或示意图，请直接看此图片做视觉识别，直观感知题目排布与真实留白，据此判断该写什么、避开图中已有内容（具体落点由渲染层排版）',
  coordinateSpec: '坐标系说明（百分比坐标 0—100，原点左上），实际输出格式由 coordinateMode 决定',
  suggestedGrade: '【建议年级】建议学段（1~3年级注重启蒙温柔引导与短问题链；4~6年级加深逻辑探究与问题链深度）',
  suggestedLayout: '建议布局，仅参考，以 boardPlan 为准',
  essence: '【核心精髓与教学灵魂】整道题的讲解主线与灵魂定位（如：解答绝对主体、分析≈解答试错链、边画边讲等），必须贯穿全题始终',
  stageRatioSuggestion: '【环节配比占比（重要！）】各 stage（读题、分析、解答、总结）时间与行数占比建议，必须严格依此安排讲解深度与行数规模',
  '环节配比占比': '【环节配比占比（重要！）】各 stage（读题、分析、解答、总结）时间与行数占比建议，必须严格依此安排讲解深度与行数规模',
  topicLayout: '【冗余兼容字段】题目区布局，优先用 boardPlan.question 和 zoneAnchors.question',
}

function normalizeAgentBPromptHandoff(payload = {}) {
  const source = isRecord(payload) ? payload : {}
  const entries = []
  for (const key of HANDOFF_TEXT_FIELDS) {
    if (source[key] === undefined) continue
    // 在数据字段前面加注释字段（像代码注释一样，第一眼就能看到）
    if (HANDOFF_FIELD_NOTES[key]) {
      entries.push([`_${key}_说明`, HANDOFF_FIELD_NOTES[key]])
    }
    entries.push([key, source[key]])
  }
  return Object.fromEntries(entries)
}

function toAnthropicContent(content) {
  return content.flatMap((item) => {
    if (item.type === 'text') return [{ type: 'text', text: item.text }]
    const url = item.image_url?.url
    const dataUrl = typeof url === 'string' && url.match(/^data:([^;]+);base64,(.+)$/)
    if (dataUrl) {
      return [{
        type: 'image',
        source: { type: 'base64', media_type: dataUrl[1], data: dataUrl[2] },
      }]
    }
    if (typeof url === 'string') {
      return [{ type: 'image', source: { type: 'url', url } }]
    }
    return []
  })
}

export async function handleAgentBV2Request(req, res) {
  if (isOptions(req, res)) return true
  if (req.method !== 'POST') return false

  try {
    const body = await readJsonBody(req)
    let credentials
    try {
      credentials = resolveUserCredentials(body)
    } catch (error) {
      return sendJson(req, res, 400, {
        ok: false,
        error: error.message,
      })
    }
    const handoff = body.handoff || {}
    // system prompt 优先级：用户自定义 > 指定 skill > 默认 v2 prompt
    let systemMessage
    if (typeof body.systemPrompt === 'string' && body.systemPrompt.trim()) {
      systemMessage = body.systemPrompt.trim()
    } else {
      const skillId = body.skillId || DEFAULT_SKILL_ID
      const skill = getSkillById(skillId)
      systemMessage = skill ? skill.buildSystemPrompt() : AGENT_B_SYSTEM_MESSAGE
    }
    const promptHandoff = normalizeAgentBPromptHandoff(handoff)
    const userContent = [
      { type: 'text', text: `【Agent A handoff】\nfile: handoff.json\n${JSON.stringify(promptHandoff, null, 2)}` },
    ]
    // coordinateMode 只约束 actionSpec 的绘图坐标，板书文字由渲染层排版。
    if (body.canvasParams?.coordinateMode) {
      userContent.push({ type: 'text', text: `【动作坐标格式】\ncoordinateMode: ${body.canvasParams.coordinateMode}\n说明：仅 actionSpec 的 start/end 坐标按此模式输出；boards 数组每项只输出 startDelay（数字秒，触发兜底）与 content。percentage = 百分比 0-100，pixel = 像素。` })
    }

    // 明确告知本次画布舞台配置与视觉参考（canvasParams, boardPlan, zoneAnchors, screenshotUrl）
    const stageSummary = []
    stageSummary.push(`- 画布舞台规格(canvasParams)：尺寸画布 ${CANVAS_SIZE.width}×${CANVAS_SIZE.height}px，题目字号 ${QUESTION_FONT_SIZE}px 微软雅黑，正文板书（分析/解答/总结）字号${BOARD_FONT_RATIO_TEXT}（以此为准感知舞台物理边界）`)
    if (promptHandoff.boardPlan) {
      stageSummary.push(`- 四个标签区域规划(boardPlan)：题目区(question)、分析区(analysis)、解答区(solution)、总结区(summary)。（注意：板书不可以溢出画布，区域坐标仅仅为大概区域，实际遇到题目内容多，板书可以自己调节一下，整体风格像老师上课草算演示，微微达芬奇手稿的style）`)
    }
    if (promptHandoff.zoneAnchors) {
      stageSummary.push(`- 区域锚点(zoneAnchors)：各区位置感知与 actionSpec 落点参考；板书文字不输出坐标，由渲染层自然排版`)
    }
    if (promptHandoff.screenshotUrl) {
      stageSummary.push(`- 题目截图参考(screenshotUrl)：${promptHandoff.screenshotUrl}【图片题目请看这个！若有几何图形或示意图，直接参考获取题图信息并做视觉避让】`)
    }
    if (promptHandoff.knowledgeBasePath) {
      stageSummary.push(`- 知识库基准(knowledgeBasePath)：${promptHandoff.knowledgeBasePath}`)
    }
    if (promptHandoff.problemType) {
      stageSummary.push(`- 题目类型(problemType)：${promptHandoff.problemType}`)
    }
    if (promptHandoff.boardFocus) {
      stageSummary.push(`- 板书侧重点(boardFocus)：${promptHandoff.boardFocus}`)
    }
    if (promptHandoff.suggestedGrade) {
      stageSummary.push(`- 建议年级(suggestedGrade)：${promptHandoff.suggestedGrade}（结合学段适配启发语气与问题链层级）`)
    }
    const essenceVal = promptHandoff.essence || promptHandoff['环节配比占比']?.essence || promptHandoff.stageRatioSuggestion?.essence
    if (essenceVal) {
      stageSummary.push(`- 核心教学精髓(essence)：${essenceVal}【全题教学主线与核心灵魂】`)
    }
    const ratioData = promptHandoff['环节配比占比'] || promptHandoff.stageRatioSuggestion
    if (ratioData) {
      const sr = ratioData.suggestedRatio || ratioData
      stageSummary.push(`- 环节配比占比(重要！)：分析 ${sr.analysis || '35%'}，解答 ${sr.solution || '40%'}，总结 ${sr.summary || '15%'}，开收场 ${sr.introAndClosing || '10%'}（类型：${ratioData.type || ratioData.category || '综合题'}）`)
    }
    stageSummary.push(`- 板书排版：只提供本教学时刻要写的内容；真实渲染层按 stage、自然换行和内容高度自由排版，允许超出所属领地但不得与其他板书重叠。`)
    stageSummary.push(`- 板书风格：像老师上课草算演示，带自然留白和轻微手写感，不套用固定坐标、行高或横向错位规则。`)

    userContent.push({
      type: 'text',
      text: `【画布舞台感知与内容排版提醒】\n${stageSummary.join('\n')}`,
    })

    // 支持视觉识别的模型：若有本地截图文件，安全提供视觉多模态输入
    let screenshotDataUrl = null
    if (promptHandoff.screenshotUrl) {
      try {
        const rawUrl = String(promptHandoff.screenshotUrl).trim()
        if (rawUrl.startsWith('data:image/')) {
          screenshotDataUrl = rawUrl
        } else {
          const cleanPath = rawUrl.replace(/^\//, '')
          const fullPath = path.resolve(process.cwd(), 'public', cleanPath)
          if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase().slice(1) || 'jpeg'
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
            const base64 = fs.readFileSync(fullPath).toString('base64')
            screenshotDataUrl = `data:${mime};base64,${base64}`
          }
        }
      } catch (err) {
        console.warn('[Agent B] 截图读取跳过:', err.message)
      }
    }
    const isAnthropic = body.apiType === 'anthropic-messages'
    const modelLower = String(credentials.model || '').toLowerCase()
    const isVisionModel = isAnthropic || modelLower.includes('vision') || modelLower.includes('4o') || modelLower.includes('claude') || modelLower.includes('gemini')
    if (screenshotDataUrl && isVisionModel) {
      userContent.push({
        type: 'image_url',
        image_url: { url: screenshotDataUrl },
      })
    }

    // 格式不对不直接报错结束：把本次的具体错误回灌给模型，让它自己修缮后重出一次。
    // 唯一真相源：话术按 parsed.code / 截断信号对症生成，不能对所有错误都发 stage 同义词那一句。
    // 截断判定看括号是否真的没闭合（带引号转义），不能只看结尾字符 —— Markdown fence 结尾会被误判
    function looksTruncated(text) {
      const s = String(text || '').trim()
      if (!s) return false
      let depth = 0
      let inStr = false
      let esc = false
      for (let i = 0; i < s.length; i += 1) {
        const c = s[i]
        if (inStr) {
          if (esc) esc = false
          else if (c === '\\') esc = true
          else if (c === '"') inStr = false
          continue
        }
        if (c === '"') inStr = true
        else if (c === '{' || c === '[') depth += 1
        else if (c === '}' || c === ']') depth -= 1
      }
      return depth > 0
    }
    function buildRepairHint(failed, badText, finishReason) {
      const code = String(failed?.code || '')
      const reason = String(failed?.error || '').trim()
      const truncated = finishReason === 'length' || looksTruncated(badText)
      const lines = [`【上一次输出未通过格式校验】${reason || '返回内容无法解析为合规 JSON'}。`]
      if (code === 'INVALID_STAGE') {
        lines.push('请只使用"题目""分析""解答""总结"四种 stage 值，禁止"思路""讲解""过程""步骤""方法""计算""答案"等同义词。')
      } else if (truncated) {
        lines.push('上一次输出在 JSON 闭合前就被截断了：请压缩口播与板书长度（可减行、缩短每行），确保输出是一个完整闭合的 JSON 对象。')
      } else {
        lines.push('请直接输出一个完整的 JSON 对象（不要 Markdown 代码 fence、不要前后解释文字），顶层必须是 {"rows":[...]}，每行含 stage / mp3（固定空字符串""） / speech（用**加粗**标记boards触发锚点） / boards（数组，每项含 startDelay 与 content） / actionSpec 五个字段。')
      }
      lines.push('请基于上面的错误重新输出完整表格，不要只输出被指出错误的那几行。')
      const tail = String(badText || '').trim().slice(-600)
      if (tail) lines.push(`【上一次输出的结尾片段，供你定位问题】\n${tail}`)
      return lines.join('\n')
    }

    const MAX_RETRIES = 1
    let parsed = null
    let lastText = ''
    let lastData = null
    let lastFinishReason = ''
    let attemptsUsed = 0

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const currentUserContent = attempt === 0
        ? userContent
        : [
            ...userContent,
            { type: 'text', text: buildRepairHint(parsed, lastText, lastFinishReason) },
          ]

      const { response, data } = isAnthropic
        ? await requestAnthropicMessage({
            ...credentials,
            timeoutMs: 90000,
            body: {
              system: systemMessage,
              max_tokens: 8192,
              temperature: Number(body.temperature ?? 0.7),
              messages: [{ role: 'user', content: toAnthropicContent(currentUserContent) }],
            },
          })
        : await requestChatCompletion({
            ...credentials,
            timeoutMs: 300000,
            body: {
              temperature: Number(body.temperature ?? 0.7),
              stream: false,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: currentUserContent },
              ],
            },
          })

      if (!response.ok) {
        return sendJson(req, res, response.status, {
          ok: false,
          error: data?.error?.message || data?.message || `上游失败 ${response.status}`,
        })
      }

      lastText = isAnthropic
        ? getChatMessageText(data)
        : getChatMessageText(data?.choices?.[0]?.message)
      lastData = data
      lastFinishReason = String((isAnthropic ? data?.stop_reason : data?.choices?.[0]?.finish_reason) || '')
      attemptsUsed = attempt + 1
      parsed = parseAgentBV2Response(lastText, {
        problemType: handoff?.problemType,
        allowSynonyms: attempt === MAX_RETRIES,
        boardPlan: handoff?.boardPlan,
        canvasParams: handoff?.canvasParams,
        coordinateMode: body.canvasParams?.coordinateMode,
      })

      if (parsed.ok) break
      // 合同解析失败统一重试一次；网络、鉴权等上游错误在前面直接返回。
      if (attempt >= MAX_RETRIES) break
      console.warn(`[Agent B] 第 ${attempt + 1} 次输出未通过合同校验（${parsed.code || 'CONTRACT_INVALID'}）：${parsed.error}；已回灌错误要求模型修缮后重出`)
    }

    if (!parsed.ok) {
      // 软降级：解析失败时尽量提取能用的 rows，不直接报错
      // 只有完全拿不到 rows 时才返回错误
      const rawFallback = tryExtractFallbackRows(lastText)
      if (rawFallback && rawFallback.length) {
        const fallbackRows = sanitizeRowLayout(rawFallback, {
          boardPlan: handoff?.boardPlan,
          canvasParams: handoff?.canvasParams,
          coordinateMode: body.canvasParams?.coordinateMode,
        })
        const resultPayload = {
          rows: fallbackRows,
          model: credentials.model,
          skillId: body.skillId || DEFAULT_SKILL_ID,
          handoff: handoff || null,
          usage: lastData?.usage || null,
          finishReason: lastData?.stop_reason || lastData?.choices?.[0]?.finish_reason || '',
          createdAt: new Date().toISOString(),
          degraded: true,
          degradeReason: parsed.error,
          degradeCode: parsed.code || 'AGENT_B_V2_CONTRACT_INVALID',
        }
        const { projectCode, filename } = writeResultFile(resultPayload)
        return sendJson(req, res, 200, {
          ok: true,
          model: credentials.model,
          rows: fallbackRows,
          projectCode,
          filename,
          finishReason: lastData?.stop_reason || lastData?.choices?.[0]?.finish_reason || '',
          usage: lastData?.usage || null,
          degraded: true,
          degradeReason: parsed.error,
          degradeCode: parsed.code || 'AGENT_B_V2_CONTRACT_INVALID',
          warning: 'Agent B 输出格式不完全符合规范，已尽力提取可用内容，建议检查或重新生成',
        })
      }
      // 完全提取不出来才返回错误
      return sendJson(req, res, 422, {
        ok: false,
        code: parsed.code || 'AGENT_B_V2_CONTRACT_INVALID',
        error: parsed.error,
        finishReason: lastData?.stop_reason || lastData?.choices?.[0]?.finish_reason || '',
        usage: lastData?.usage || null,
        diagnostic: { rawTextHead: lastText.slice(0, 500), retried: attemptsUsed > 1, attempts: attemptsUsed, finishReason: lastFinishReason },
      })
    }
    // 写入实体文件存档（B 生成结果的唯一真相源）
    const resultPayload = {
      rows: parsed.value,
      model: credentials.model,
      skillId: body.skillId || DEFAULT_SKILL_ID,
      handoff: handoff || null,
      usage: lastData?.usage || null,
      finishReason: lastData?.stop_reason || lastData?.choices?.[0]?.finish_reason || '',
      createdAt: new Date().toISOString(),
    }
    const { projectCode, filename } = writeResultFile(resultPayload)
    return sendJson(req, res, 200, {
      ok: true,
      model: credentials.model,
      rows: parsed.value,
      projectCode,
      filename,
      finishReason: lastData?.stop_reason || lastData?.choices?.[0]?.finish_reason || '',
      usage: lastData?.usage || null,
    })
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : 500
    return sendJson(req, res, status, {
      ok: false,
      error: error?.name === 'AbortError' ? 'Agent B 上游大模型响应超时（已为您持续等待 300 秒），请检查网络或更换响应更快的大模型' : error?.message || String(error),
    })
  }
}

export function agentBV2ProxyPlugin() {
  return {
    name: 'agent-b-v2-direct-proxy',
    configureServer(server) {
      server.middlewares.use('/api/agent-b-v2/generate', (req, res, next) => {
        Promise.resolve(handleAgentBV2Request(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
