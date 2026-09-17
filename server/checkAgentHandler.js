/* Check Agent — 独立模块，只做 4 件事：
   1. 口播/板书字符转义 & ASR 发音校正
   2. 答案数学正确性校验（只报告，不自己改答案）
   3. 废话合并：重复啰嗦、没有实质前进的行合并/精简
   4. 语气衔接去课后答案腔

   数据来源：从 boardResultStore 读当前 B 生成结果（文件即真相源）
   修改方式：生成建议版本，写回独立文件，前端弹窗让用户确认后才应用
*/

import fs from 'node:fs'
import path from 'node:path'
import { CHECK_AGENT_SYSTEM_PROMPT } from '../src/check-agent/prompt.js'
import { polishRowsASR } from '../src/check-agent/asrPolish.js'
import {
  readCurrentResult,
  overwriteCurrentResult,
  saveOriginalBackup,
  loadOriginalBackup,
  hasOriginalBackup,
} from './boardResultStore.js'
import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
  getChatMessageText,
} from './http.js'

// ---------- JSON 解析 ----------
function parseJsonObject(text) {
  const source = String(text || '').trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidate = fenced || source
  try { return JSON.parse(candidate) } catch { /* fall through */ }
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(candidate.slice(start, end + 1)) } catch { return null }
}

// ---------- boards / actionSpec 规范化（借用 B 的合同，2026-09-17 五字段契约） ----------
import { normalizeBoardsField, normalizeAgentBV2ActionSpec } from '../src/agent-b-v2/contract.js'

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatBoardsItem(item) {
  if (item && typeof item === 'object' && ('startDelay' in item || 'content' in item)) {
    const delayStr = Number.isFinite(Number(item.startDelay)) ? `+${Number(item.startDelay).toFixed(1)}s` : '+0.0s'
    return `落笔兜底 ${delayStr} · 内容: ${item.content || '（无）'}`
  }
  return typeof item === 'string' ? item : JSON.stringify(item ?? '')
}

function formatBoardsDelay(boards) {
  return (Array.isArray(boards) ? boards : [])
    .map((b) => `+${Number(b?.startDelay || 0).toFixed(1)}s`)
    .join(' / ') || '[]'
}

function formatChangeValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map(formatBoardsItem).join(' ｜ ') : '[]'
  }
  if (value && typeof value === 'object' && ('startDelay' in value || 'content' in value)) {
    return formatBoardsItem(value)
  }
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}

// ---------- 解析 Check Agent 返回 ----------
const ALLOWED_FIELDS = new Set(['speech', 'boards', 'board_timing', 'actionSpec', 'answer_error', 'common_mistake'])

function parseCheckResponse(text, originalRows) {
  const parsed = parseJsonObject(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '返回内容不是 JSON 对象' }
  }
  if (!Array.isArray(parsed.rows) || !parsed.rows.length) {
    return { ok: false, error: '返回的 rows 为空' }
  }

  // 校验 stage 顺序不变（允许行数减少，但 stage 出现顺序必须和原始一致）
  const originalStageSeq = originalRows.map(r => r.stage)
  const newStageSeq = parsed.rows.map(r => r.stage)
  let origIdx = 0
  for (const stage of newStageSeq) {
    while (origIdx < originalStageSeq.length && originalStageSeq[origIdx] !== stage) {
      origIdx++
    }
    if (origIdx >= originalStageSeq.length) {
      return { ok: false, error: `stage 顺序被打乱或出现了未知 stage：${stage}` }
    }
    origIdx++
  }

  // 契约定案（2026-09-17）：row 五字段 {stage, mp3, speech, boards, actionSpec}
  // boards 数组优先；旧 board 单对象/字符串兼容归一；mp3/音频信息原样透传
  const rows = parsed.rows.map((row, index) => ({
    ...originalRows[index],
    stage: row?.stage || originalRows[index]?.stage || '',
    mp3: typeof row?.mp3 === 'string' ? row.mp3 : (originalRows[index]?.mp3 ?? ''),
    speech: typeof row?.speech === 'string' ? row.speech : (originalRows[index]?.speech || ''),
    boards: (row?.boards !== undefined || row?.board !== undefined)
      ? normalizeBoardsField(row.boards, row.board)
      : normalizeBoardsField(originalRows[index]?.boards, originalRows[index]?.board),
    actionSpec: Array.isArray(row?.actionSpec)
      ? normalizeAgentBV2ActionSpec(row.actionSpec)
      : (originalRows[index]?.actionSpec || []),
    ...(typeof row?.audioUrl === 'string' && row.audioUrl ? { audioUrl: row.audioUrl } : {}),
    ...(Number.isFinite(Number(row?.audioDurationMs)) && Number(row.audioDurationMs) > 0
      ? { audioDurationMs: Math.round(Number(row.audioDurationMs)) }
      : {}),
  }))
  // 旧 board 字段已被 boards 归一取代，避免同一行残留两份板书
  rows.forEach((row) => { delete row.board })

  // 生成 changes 报告
  const reportedChanges = (Array.isArray(parsed.changes) ? parsed.changes : [])
    .map((c) => ({
      row: Number.isFinite(Number(c?.row)) ? Math.max(1, Math.round(Number(c.row))) : null,
      field: String(c?.field || '').trim(),
      before: c?.before !== undefined ? String(c.before) : '',
      after: c?.after !== undefined ? String(c.after) : '',
      reason: String(c?.reason || '').trim(),
    }))
    .filter((c) => ALLOWED_FIELDS.has(c.field) && c.reason)

  const changes = []

  // 1. 模型报告的 changes（speech / board / actionSpec / answer_error）
  //    优先用模型自己的描述，信息最准确
  for (const rc of reportedChanges) {
    changes.push(rc)
  }

  // 2. 兜底：逐行对比，补上模型改了但没报告的变化
  //    （模型可能漏写 changes 数组，但 rows 里已经改了内容）
  const reportedKeys = new Set(
    reportedChanges
      .filter(c => c.row !== null && c.field !== 'answer_error')
      .map(c => `${c.row}:${c.field === 'board_timing' ? 'boards' : c.field}`)
  )
  const minLen = Math.min(originalRows.length, rows.length)
  for (let i = 0; i < minLen; i++) {
    const orig = originalRows[i]
    const chk = rows[i]
    for (const field of ['speech', 'boards', 'actionSpec']) {
      const key = `${i + 1}:${field}`
      if (reportedKeys.has(key)) continue // 模型已经报告过了，跳过
      const origVal = field === 'boards'
        ? normalizeBoardsField(orig?.boards, orig?.board)
        : orig?.[field]
      const chkVal = chk?.[field]
      if (!valuesMatch(origVal, chkVal)) {
        // 仅 startDelay 兜底变化、板书内容不变 → 归并为 board_timing 时机校准
        const isOnlyTiming = field === 'boards' &&
          Array.isArray(origVal) && Array.isArray(chkVal) &&
          origVal.length === chkVal.length &&
          origVal.every((b, bi) => (b?.content || '') === (chkVal[bi]?.content || '')) &&
          origVal.some((b, bi) => (b?.startDelay ?? 0) !== (chkVal[bi]?.startDelay ?? 0))

        changes.push({
          row: i + 1,
          field: isOnlyTiming ? 'board_timing' : field,
          before: isOnlyTiming ? formatBoardsDelay(origVal) : formatChangeValue(origVal),
          after: isOnlyTiming ? formatBoardsDelay(chkVal) : formatChangeValue(chkVal),
          reason: isOnlyTiming
            ? '校准板书时机：startDelay 兜底延迟调整（触发真源仍为 speech 加粗锚点）'
            : '内容优化（模型未标注原因）',
        })
      }
    }
  }

  // 3. 行数变化（合并/删除）
  if (rows.length !== originalRows.length) {
    changes.push({
      row: null,
      field: 'structure',
      before: `${originalRows.length} 行`,
      after: `${rows.length} 行`,
      reason: `合并/精简了 ${originalRows.length - rows.length} 行`,
    })
  }

  return { ok: true, value: { rows, changes } }
}

// ---------- HTTP handler ----------
export async function handleCheckAgentRequest(req, res) {
  if (isOptions(req, res)) return true
  if (req.method !== 'POST') return false

  let originalRows = null

  try {
    const body = await readJsonBody(req)

    // 优先用前端传来的 rows（用户可能手动改过），没有就从真相源读
    if (Array.isArray(body.currentRows) && body.currentRows.length) {
      originalRows = body.currentRows
    } else {
      const current = readCurrentResult()
      originalRows = current?.result?.rows
    }
    if (!Array.isArray(originalRows) || !originalRows.length) {
      return sendJson(req, res, 400, {
        ok: false,
        error: '没有可检查的 Agent B 生成内容，请先生成',
      })
    }

    // 如果客户端明确请求快速本地 ASR 优化，或者没有配置 API credentials，直接使用本地引擎
    if (body.mode === 'asr_fast' || !body.apiKey || !body.endpoint || !body.model) {
      const localResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: 'local-asr-engine',
        rows: localResult.rows,
        changes: localResult.changes,
        usage: null,
      })
    }

    let credentials
    try {
      credentials = resolveUserCredentials(body)
    } catch {
      // credentials 无效时无缝降级到本地 ASR
      const localResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: 'local-asr-engine',
        rows: localResult.rows,
        changes: localResult.changes,
        usage: null,
      })
    }

    // 从 handoff 取 boardPlan、易错点与核心知识参照
    const handoff = readCurrentResult()?.result?.handoff
    const boardPlan = handoff?.boardPlan || null
    const coordinateMode = handoff?.canvasParams?.coordinateMode || 'percentage'
    const problemText = handoff?.problemText || ''
    const knowledgeAnalysis = handoff?.knowledgeAnalysis || {}
    let commonMistakes = Array.isArray(knowledgeAnalysis?.commonMistakes) ? [...knowledgeAnalysis.commonMistakes] : []
    const teachingFocus = knowledgeAnalysis?.teachingFocus || ''
    const keyFormulaList = Array.isArray(knowledgeAnalysis?.keyFormulaList) ? knowledgeAnalysis.keyFormulaList : []

    // 若易错点为空，且存在 knowledgeBasePath 本地文件，尝试检索相关易错点作为专业补充
    if (commonMistakes.length === 0 && handoff?.knowledgeBasePath) {
      try {
        const kbPath = path.resolve(process.cwd(), handoff.knowledgeBasePath)
        if (fs.existsSync(kbPath)) {
          const raw = fs.readFileSync(kbPath, 'utf8')
          const kbData = JSON.parse(raw)
          const coreRows = Array.isArray(kbData?.rows) ? kbData.rows : []
          // 查找匹配的核心考点
          const matched = coreRows.find((item) => {
            const name = item.k || item.knowledgePoint || ''
            return name && (problemText.includes(name) || (handoff.problemType && String(handoff.problemType).includes(name)))
          })
          if (matched && Array.isArray(matched.m)) {
            commonMistakes = matched.m
          }
        }
      } catch (_e) {
        // 读取失败不阻断流程
      }
    }

    const userContent = [
      {
        type: 'text',
        text: `【坐标输出模式】\n${coordinateMode}`,
      },
      {
        type: 'text',
        text: `【参考 boardPlan】\n${JSON.stringify(boardPlan, null, 2)}\n\n（仅用于理解 stage 区域与动作边界；板书文字由真实渲染层自然排版，不修改 stage 顺序）`,
      },
      {
        type: 'text',
        text: `【本题题干与易错点清单 (commonMistakes) 把关指南】\n` +
          `- 题目原文：${problemText || '（以原步骤第一行题目为准）'}\n` +
          `- 教学重点(teachingFocus)：${teachingFocus || '抓牢核心算理与解题逻辑'}\n` +
          `- 关键公式(keyFormulaList)：${JSON.stringify(keyFormulaList)}\n` +
          `- 易错点清单(commonMistakes)：${JSON.stringify(commonMistakes.length > 0 ? commonMistakes : ['单位换算是否统一', '计算乘除先后顺序', '括号内外符号变化', '审题遗漏关键条件'])}\n\n` +
          `【修缮把关硬性要求】：\n` +
          `1. 检查口播中是否在易错步骤顺嘴做出了启发式防坑提醒（例如“这里行不行呀？”、“注意单位统一了没有”）。\n` +
          `2. 严密排查老师自身的推导与算式是否踩了上述易错坑！若老师自己算错，在 changes 数组中作为 answer_error 报警并详细说明原因！`,
      },
      {
        type: 'text',
        text: `【当前 B 生成结果五字段】\n${JSON.stringify(originalRows, null, 2)}`,
      },
    ]

    // 超时时间缩短到 25 秒，防止长时间挂起导致前端 90s 超时报错
    let response
    let data
    try {
      const completion = await requestChatCompletion({
        ...credentials,
        timeoutMs: 25000,
        body: {
          temperature: 0.3,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: CHECK_AGENT_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
        },
      })
      response = completion.response
      data = completion.data
    } catch (llmError) {
      // 大模型调用超时或网络错误：自动无缝降级到本地确定性 ASR 润色引擎，绝不报 504 错误！
      const localResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: credentials.model,
        rows: localResult.rows,
        changes: localResult.changes,
        note: `大模型响应超时（已自动触发本地 ASR 优化引擎）：${llmError?.message || '超时'}`,
        usage: null,
      })
    }

    if (!response.ok) {
      // 上游模型报错时也降级到本地 ASR
      const localResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: credentials.model,
        rows: localResult.rows,
        changes: localResult.changes,
        note: `上游模型接口返回 ${response.status}，已自动采用本地 ASR 规范引擎润色`,
        usage: null,
      })
    }

    const text = getChatMessageText(data?.choices?.[0]?.message)
    const parsed = parseCheckResponse(text, originalRows)

    if (!parsed.ok) {
      // 解析失败时使用本地 ASR 规范化处理原表
      const localResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: credentials.model,
        rows: localResult.rows,
        changes: localResult.changes,
        usage: data?.usage || null,
      })
    }

    // 模型成功返回后保持其原始修正；本地规则只用于模型失败时的明确回退，避免二次改写。
    return sendJson(req, res, 200, {
      ok: true,
      checkStatus: 'model_checked',
      model: credentials.model,
      rows: parsed.value.rows,
      changes: parsed.value.changes,
      usage: data?.usage || null,
    })
  } catch (error) {
    // 任何异常情况下均兜底返回本地 ASR 优化结果，绝不中断用户体验
    if (Array.isArray(originalRows) && originalRows.length) {
      const fallbackResult = polishRowsASR(originalRows)
      return sendJson(req, res, 200, {
        ok: true,
        checkStatus: 'local_asr_polished',
        model: 'local-asr-engine',
        rows: fallbackResult.rows,
        changes: fallbackResult.changes,
        usage: null,
      })
    }
    return sendJson(req, res, 500, {
      ok: false,
      error: error?.message || String(error),
    })
  }
}

// 还原到 Check 之前的原始版本
export async function handleCheckRevertRequest(req, res) {
  if (isOptions(req, res)) return true
  if (req.method !== 'POST') return false

  try {
    const current = readCurrentResult()
    if (!current) {
      return sendJson(req, res, 400, { ok: false, error: '没有找到当前 B 生成结果' })
    }
    if (!hasOriginalBackup(current.filename)) {
      return sendJson(req, res, 400, { ok: false, error: '没有找到原始备份，无法还原' })
    }
    const original = loadOriginalBackup(current.filename)
    if (!original) {
      return sendJson(req, res, 500, { ok: false, error: '原始备份读取失败' })
    }
    const { filename } = overwriteCurrentResult(original)
    return sendJson(req, res, 200, {
      ok: true,
      filename,
      rows: original.rows || [],
      reverted: true,
    })
  } catch (error) {
    return sendJson(req, res, 500, {
      ok: false,
      error: error?.message || String(error),
    })
  }
}

// 应用 Check 结果：覆写当前 board-result 文件
export async function handleCheckApplyRequest(req, res) {
  if (isOptions(req, res)) return true
  if (req.method !== 'POST') return false

  try {
    const body = await readJsonBody(req)
    const rows = body.rows
    if (!Array.isArray(rows) || !rows.length) {
      return sendJson(req, res, 400, { ok: false, error: '缺少 rows 参数' })
    }

    const current = readCurrentResult()
    if (!current) {
      return sendJson(req, res, 400, { ok: false, error: '没有找到当前 B 生成结果' })
    }

    // 第一次 apply 前保存原始备份（只存一次，不覆盖）
    saveOriginalBackup(current.filename, current.result)

    // 覆写当前文件（保留原文件其他字段，只更新 rows 和 checkedAt）
    const updated = {
      ...current.result,
      rows,
      checkedAt: new Date().toISOString(),
    }
    const { filename } = overwriteCurrentResult(updated)

    return sendJson(req, res, 200, {
      ok: true,
      filename,
      rows,
    })
  } catch (error) {
    return sendJson(req, res, 500, {
      ok: false,
      error: error?.message || String(error),
    })
  }
}

// ---------- Vite 插件 ----------
export function checkAgentProxyPlugin() {
  return {
    name: 'check-agent-proxy',
    configureServer(server) {
      server.middlewares.use('/api/check-agent/check', (req, res, next) => {
        Promise.resolve(handleCheckAgentRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
      server.middlewares.use('/api/check-agent/apply', (req, res, next) => {
        Promise.resolve(handleCheckApplyRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
      server.middlewares.use('/api/check-agent/revert', (req, res, next) => {
        Promise.resolve(handleCheckRevertRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
