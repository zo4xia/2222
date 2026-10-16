/* Check Agent — 独立模块，做 8 项把关（与 src/check-agent/prompt.js 顶部清单同源；★ Task 43 三职能归拢）：
   1. 口播优化——字符转义 & ASR 发音校正
   2. 答案数学正确性校验（只报告，不自己改答案）
   3. 易错点（commonMistakes）防坑核验与把关
   4. 冗余建议（只报告不执行：行数守恒硬约束，结构性冗余只进 changes 报告，绝不直接删/并行）
   5. 语气衔接去课后答案腔
   6. 板书优化——时机校准（startDelay 校准）
   7. 板书优化——内容对错与特殊字符（非题目区零 LaTeX，superFilter 凑法全局归一）
   8. 动作与时序——triggerKeyword 逐字校验 + 三动作白名单 + row 内互斥（action_timing）

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
} from './boardResultStore.js'
// ★ Task 13：Check 读活档——校准层 overwriteCurrentHandoff 只改 public/handoff/，
// 旧实现读 board-result 内嵌快照，生成后再点优化校准时 Check 仍拿旧 commonMistakes/teachingFocus
import { readCurrentHandoff } from './handoffStoreHandler.js'
import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
  getChatMessageText,
} from './http.js'

// ---------- JSON 解析 ----------
// ponytail: 唯一真源已抽到 src/lib/parseLLMJson.js
import { parseLLMJson } from '../src/lib/parseLLMJson.js'

// ---------- board / actionSpec 规范化（借用 B 的合同） ----------
import { normalizeBoard, normalizeAgentBV2ActionSpec } from '../src/agent-b-v2/contract.js'

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function formatChangeValue(value) {
  if (value && typeof value === 'object' && ('startDelay' in value || 'content' in value)) {
    const delayStr = Number.isFinite(Number(value.startDelay)) ? `+${Number(value.startDelay).toFixed(1)}s` : '+0.0s'
    return `落笔起手 ${delayStr} · 内容: ${value.content || '（无）'}`
  }
  return typeof value === 'string' ? value : JSON.stringify(value ?? '')
}

// ★ R8-③：Check 配比盲视修复——环节配比占比（B 生成时的唯一配比政策源）
// 此前 handoff 对象在 handler 里已读到（problemText/commonMistakes 等都拼进了 userContent），
// 唯独 stageRatioSuggestion 没拼 → Check 只能拿系统提示词里的静态死规则（撑死 3 行）
// 去砍 B 按 c 类题型配比（分析 25-35%）合规生成的分析行。
// 双键名兼容与 AgentBDirect 一致（stageRatioSuggestion / 环节配比占比）。
// ★ R8-③（夏夏终裁后二改）：配比仅作背景理解参考——行数与配比完全由 Agent B
// 自主决定，Check 不做任何行数/占比核对。双键名兼容与 AgentBDirect 一致。
export function buildStageRatioGuidance(ratioData) {
  const sr = ratioData && typeof ratioData === 'object' && !Array.isArray(ratioData)
    ? ratioData.suggestedRatio
    : null
  // 无区间数据（null/空对象/数组脏数据/缺 suggestedRatio）不注入，避免噪音
  if (!sr || typeof sr !== 'object' || Array.isArray(sr)) {
    return '【本题环节配比占比 (stageRatioSuggestion)】\n未提供（不影响任何检查——行数与配比由 Agent B 自主决定，Check 不做行数核对）。'
  }
  const line = (label, v) => `- ${label}：${String(v ?? '') || '未提供'}`
  const typeLine = [ratioData.cuCode, ratioData.type].filter(Boolean).join(' · ') || '未提供'
  return '【本题环节配比占比 (stageRatioSuggestion)】（仅作理解本题结构的背景参考）\n' +
    `- 题型：${typeLine}（置信度：${ratioData.confidence || '未提供'}）\n` +
    line('分析 (analysis)', sr.analysis) + '\n' +
    line('解答 (solution)', sr.solution) + '\n' +
    line('总结 (summary)', sr.summary) + '\n' +
    line('开收场 (introAndClosing)', sr.introAndClosing) + '\n' +
    '注意：行数与各 stage 行数配比由 Agent B 自主决定，你不得以此数据为依据核对、合并或删除任何行（含收尾金句行）。'
}

// ---------- 解析 Check Agent 返回 ----------
// ★ 行数守恒：structure 类是"只报告不动手"的冗余建议通道（夏夏终裁：
// 行数/配比 Agent B 自己决定，收尾金句绝不可删）
const ALLOWED_FIELDS = new Set(['speech', 'board', 'board_timing', 'actionSpec', 'action_timing', 'answer_error', 'common_mistake', 'structure'])

// export 供测试直测（test-check-ratio.mjs / 行数守恒用例）
export function parseCheckResponse(text, originalRows) {
  const parsed = parseLLMJson(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '返回内容不是 JSON 对象' }
  }
  if (!Array.isArray(parsed.rows) || !parsed.rows.length) {
    return { ok: false, error: '返回的 rows 为空' }
  }

  // ★ 代码级硬防线（金句保护兜底）：行数必须守恒——模型无论何理由
  // （含"废话合并"、"分析过长"等已被撤销的口径）删/并行，直接判格式
  // 违约回退原表，收尾金句永远删不掉。prompt 是软约束，这里是钢门。
  if (parsed.rows.length !== originalRows.length) {
    return {
      ok: false,
      error: `Check 无删行权限：输入 ${originalRows.length} 行，返回 ${parsed.rows.length} 行（行数守恒硬约束——行数与配比由 Agent B 自主决定，收尾金句不可删；如确需合并请由用户在 changes 报告建议下手动操作）`,
    }
  }

  // 校验 stage 顺序不变（行数守恒后同长度，防 stage 交换/篡改）
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

  // ★ 哑巴根修复（P1，2026-10-15）：Check 只拥有内容四字段的重写权；
  // 音频三字段（audioUrl/audioDurationMs/duration）按索引从原表一一对齐回填。
  // 旧版 4 字段白名单重建 rows，把试听回填的音频剥得干干净净——用户跑一次
  // Check 并应用，导出/播放立即全哑（row-player 拿占位串静音降级）。
  const rows = parsed.rows.map((row, i) => {
    const orig = originalRows[i] || {}
    const hasAudio = typeof orig.audioUrl === 'string' && orig.audioUrl !== ''
    return {
      stage: row?.stage || '',
      speech: typeof row?.speech === 'string' ? row.speech : '',
      board: row?.board !== undefined && row?.board !== null
        ? normalizeBoard(row.board)
        : '',
      actionSpec: Array.isArray(row?.actionSpec)
        ? normalizeAgentBV2ActionSpec(row.actionSpec)
        : [],
      // 音频字段随原行保留（Check 不碰音频）
      ...(hasAudio ? { audioUrl: orig.audioUrl } : {}),
      ...(Number(orig.audioDurationMs) > 0
        ? { audioDurationMs: Math.round(Number(orig.audioDurationMs)), duration: orig.duration }
        : {}),
    }
  })

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
      .map(c => `${c.row}:${c.field === 'board_timing' ? 'board' : c.field}`)
  )
  const minLen = Math.min(originalRows.length, rows.length)
  for (let i = 0; i < minLen; i++) {
    const orig = originalRows[i]
    const chk = rows[i]
    for (const field of ['speech', 'board', 'actionSpec']) {
      const key = `${i + 1}:${field}`
      if (reportedKeys.has(key)) continue // 模型已经报告过了，跳过
      const origVal = orig?.[field]
      const chkVal = chk?.[field]
      if (!valuesMatch(origVal, chkVal)) {
        const isOnlyTiming = field === 'board' &&
          origVal?.content === chkVal?.content &&
          origVal?.startDelay !== chkVal?.startDelay


        changes.push({
          row: i + 1,
          field: isOnlyTiming ? 'board_timing' : field,
          before: isOnlyTiming ? `+${Number(origVal?.startDelay || 0).toFixed(1)}s` : formatChangeValue(origVal),
          after: isOnlyTiming ? `+${Number(chkVal?.startDelay || 0).toFixed(1)}s` : formatChangeValue(chkVal),
          reason: isOnlyTiming
            ? `校准板书时机：落笔起手延迟调整为 +${Number(chkVal?.startDelay || 0).toFixed(1)}s`
            : '内容优化（模型未标注原因）',
        })
      }
    }
  }

  // 3. 行数变化段已删（行数守恒硬防线在前——行数不等直接 ok:false 回退原表，
  // 此分支永远不可达，删掉防"删行合法"语义残留复活）

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

    // ★ Task 13：handoff 参照改读活档（public/handoff/ 真相源，含校准层最新修缮），
    // 快照仅作活档缺失时的兑底；coordinateMode 幽灵子键砍除（canvasParams 从无此键，
    // 恒走 'percentage' fallback，真身在前端 UI ref，Check 请求体不携带）
    const liveHandoff = readCurrentHandoff()?.handoff || null
    const handoff = liveHandoff || readCurrentResult()?.result?.handoff
    const boardPlan = handoff?.boardPlan || null
    const coordinateMode = 'percentage'
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
        // ★ R8-③：配比政策源随题注入——有配比按配比核对，无配比退保守兜底（文本由纯函数构造，可测）
        type: 'text',
        text: buildStageRatioGuidance(handoff?.stageRatioSuggestion || handoff?.['环节配比占比'] || null),
      },
      {
        type: 'text',
        text: `【本题题干与易错点清单 (commonMistakes) 把关指南】\n` +
          `- 题目原文：${problemText || '（以原步骤第一行题目为准）'}\n` +
          `- 教学重点(teachingFocus)：${teachingFocus || '未提供'}\n` +
          `- 关键公式(keyFormulaList)：${JSON.stringify(keyFormulaList)}\n` +
          `- 易错点清单(commonMistakes)：${commonMistakes.length > 0 ? JSON.stringify(commonMistakes) : '未提供（知识库亦无匹配，跳过针对性防坑核验，仅做通用数学正确性与口播质量检查）'}\n\n` +
          `【修缮把关硬性要求】：\n` +
          `1. 检查口播中是否在易错步骤顺嘴做出了启发式防坑提醒（例如“这里行不行呀？”、“注意单位统一了没有”）。\n` +
          `2. 严密排查老师自身的推导与算式是否踩了上述易错坑！若老师自己算错，在 changes 数组中作为 answer_error 报警并详细说明原因！`,
      },
      {
        type: 'text',
        text: `【当前 B 生成结果四字段】\n${JSON.stringify(originalRows, null, 2)}`,
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

    // 大模型成功返回后，再经由本地 ASR 规则引擎进行二次保障与兜底清洗
    const finalDoubleCheck = polishRowsASR(parsed.value.rows)
    // 合并 changes
    const combinedChanges = [...parsed.value.changes]
    finalDoubleCheck.changes.forEach((extra) => {
      const exists = combinedChanges.some((c) => c.row === extra.row && c.field === extra.field)
      if (!exists) {
        combinedChanges.push(extra)
      }
    })

    return sendJson(req, res, 200, {
      ok: true,
      model: credentials.model,
      rows: finalDoubleCheck.rows,
      changes: combinedChanges,
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

// ★ Task 13：handleCheckRevertRequest + /api/check-agent/revert 端点整链砍除——
// 前端零 UI 入口（service.revertCheckResult 无消费者），配套原始备份机制
// （saveOriginalBackup/loadOriginalBackup/hasOriginalBackup）随之失读方，一并移除

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
    },
  }
}
