/* 知识点修缮 API — 独立模块，不动 Agent A 和 Agent B 的核心逻辑
   直接读写 public/handoff.json，通过文件解耦 */

import { KNOWLEDGE_REFINE_SYSTEM_PROMPT } from '../src/agent-b-v2/knowledgeRefinePrompt.js'
import { readCurrentHandoff, overwriteCurrentHandoff, fullPath as getHandoffFullPath } from './handoffStoreHandler.js'
import {
  isOptions,
  readJsonBody,
  requestChatCompletion,
  resolveUserCredentials,
  sendJson,
  getChatMessageText,
} from './http.js'
import { existsSync, readFileSync, copyFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// 从文本中提取 JSON（支持纯 JSON、```json ... ```、嵌套对象）
function extractJsonFromText(text) {
  if (!text) return null
  try { return JSON.parse(text) } catch { /* continue */ }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch { /* continue */ }
  }
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(text.slice(firstBrace, lastBrace + 1)) } catch { /* fail */ }
  }
  return null
}

// 字段级 merge：只覆盖知识点相关字段，其他字段保持原样（防上游乱改）
const REFINE_TOP_FIELDS = ['relatedKnowledge', 'commonMistakes']
const REFINE_NESTED_FIELDS = ['teachingFocus', 'keyFormulaList', 'formulaHints']

function mergeKnowledgeFields(original, refined) {
  if (!refined || typeof refined !== 'object') return original
  const merged = { ...original }
  for (const field of REFINE_TOP_FIELDS) {
    if (refined[field] !== undefined) merged[field] = refined[field]
  }
  if (refined.knowledgeAnalysis && typeof refined.knowledgeAnalysis === 'object') {
    merged.knowledgeAnalysis = { ...(original.knowledgeAnalysis || {}) }
    for (const field of REFINE_NESTED_FIELDS) {
      if (refined.knowledgeAnalysis[field] !== undefined) {
        merged.knowledgeAnalysis[field] = refined.knowledgeAnalysis[field]
      }
    }
  }
  return merged
}

// 原始快照文件名：在当前 handoff 文件名后加 .original.json
function originalBackupPath(filename) {
  return getHandoffFullPath(filename.replace(/\.json$/, '.original.json'))
}

function saveOriginalBackup(filename, handoff) {
  const backupPath = originalBackupPath(filename)
  if (existsSync(backupPath)) return // 已有备份就不覆盖
  writeFileSync(backupPath, JSON.stringify(handoff, null, 2), 'utf-8')
}

function hasOriginalBackup(filename) {
  return existsSync(originalBackupPath(filename))
}

function loadOriginalBackup(filename) {
  const backupPath = originalBackupPath(filename)
  if (!existsSync(backupPath)) return null
  try {
    return JSON.parse(readFileSync(backupPath, 'utf-8'))
  } catch {
    return null
  }
}

export async function handleKnowledgeRefineRequest(req, res) {
  if (isOptions(req, res)) return true
  const url = new URL(req.url, 'http://localhost')
  const path = url.pathname
  // 中间件注册在 /api/knowledge/，req.url 前缀已去掉
  if (path !== '/refine' && path !== '/revert') return false
  if (req.method !== 'POST') return false

  // POST /api/knowledge/revert — 还原到修缮前的原始版本
  if (path === '/api/knowledge/revert') {
    try {
      const current = readCurrentHandoff()
      if (!current) {
        return sendJson(req, res, 400, { ok: false, error: '没有找到 handoff 存档' })
      }
      const original = loadOriginalBackup(current.filename)
      if (!original) {
        return sendJson(req, res, 400, { ok: false, error: '没有找到原始备份，无法还原' })
      }
      const filename = overwriteCurrentHandoff(original)
      return sendJson(req, res, 200, {
        ok: true,
        filename,
        handoff: original,
        reverted: true,
      })
    } catch (error) {
      return sendJson(req, res, 500, {
        ok: false,
        error: error?.message || String(error),
      })
    }
  }

  // POST /api/knowledge/refine — 修缮知识点
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

    // 从当前活跃的实体文件读 handoff，不依赖前端传
    const current = readCurrentHandoff()
    const handoff = current?.handoff
    if (!handoff || typeof handoff !== 'object') {
      return sendJson(req, res, 400, {
        ok: false,
        error: '没有找到 handoff 存档，请先生成',
      })
    }

    // 第一次修缮前保存原始备份（只存一次，不覆盖）
    saveOriginalBackup(current.filename, handoff)

    const userContent = [
      {
        type: 'text',
        text: `【输入 handoff】\n${JSON.stringify(handoff, null, 2)}\n\n请修缮其中的知识点相关字段，其他字段原样保留。输出完整的 JSON。`,
      },
    ]

    const { response, data } = await requestChatCompletion({
      ...credentials,
      timeoutMs: 60000,
      body: {
        temperature: Number(body.temperature ?? 0.3),
        stream: false,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: KNOWLEDGE_REFINE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      },
    })

    if (!response.ok) {
      return sendJson(req, res, response.status, {
        ok: false,
        error: data?.error?.message || data?.message || `上游失败 ${response.status}`,
      })
    }

    const text = getChatMessageText(data?.choices?.[0]?.message)
    // 容错：从文本中提取 JSON（支持纯 JSON、```json ... ```、嵌套 handoff 字段）
    let refinedHandoff = extractJsonFromText(text)
    if (refinedHandoff?.handoff && typeof refinedHandoff.handoff === 'object') {
      refinedHandoff = refinedHandoff.handoff
    }
    // 字段级 merge：只覆盖知识点相关字段，其他字段保持原样（防上游乱改）
    // 提取失败则降级：返回原 handoff + 友好提示，不返回 502
    const mergedHandoff = mergeKnowledgeFields(handoff, refinedHandoff)
    const refineOk = Boolean(refinedHandoff)

    // 原地覆写当前文件（不生成新文件，保持文件名不变）
    const filename = overwriteCurrentHandoff(mergedHandoff)

    return sendJson(req, res, 200, {
      ok: true,
      model: credentials.model,
      filename,
      handoff: mergedHandoff,
      usage: data?.usage || null,
      refineOk,
      ...(refineOk ? {} : { warning: 'AI 这次没返回标准格式，已保留原内容，可重试' }),
    })
  } catch (error) {
    const status = error?.name === 'AbortError' ? 504 : 500
    return sendJson(req, res, status, {
      ok: false,
      error: error?.name === 'AbortError' ? '上游超时（60 秒）' : error?.message || String(error),
    })
  }
}

export function knowledgeRefinePlugin() {
  return {
    name: 'knowledge-refine-proxy',
    configureServer(server) {
      server.middlewares.use('/api/knowledge/', (req, res, next) => {
        Promise.resolve(handleKnowledgeRefineRequest(req, res)).then((handled) => {
          if (!handled) next()
        }).catch(next)
      })
    },
  }
}
