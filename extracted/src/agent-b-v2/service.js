/* @qh-core LANE=B-V2 POINT=CLIENT_GENERATE buildPayload+fetch /api/agent-b-v2/generate
 * Agent B 使用独立配置，不与 Agent A / C 共用模型或 API。
 */
import { applyAgentBV2Timeline } from './timing.js'
import { getAgentBApiSnapshot } from '../lib/agentBApiConfig.js'

const GENERATION_TEMPERATURE = 0.8

export async function generateAgentBV2Rows({ handoff, systemPrompt, skillId, rowGapMs, canvasParams }) {
  const userSnap = getAgentBApiSnapshot()
  if (!userSnap.apiKey) {
    throw new Error('缺少 Agent B API Key：请先在前端「Agent 配置」里填写')
  }
  if (!userSnap.endpoint) {
    throw new Error('缺少 Agent B 接口地址：请填写完整 Chat Completions URL')
  }
  if (!/^https?:\/\/.+\/chat\/completions\/?$/i.test(userSnap.endpoint)) {
    throw new Error('Agent B 接口地址必须是完整 Chat Completions URL，例如 https://api.example.com/v1/chat/completions')
  }
  if (!userSnap.model) {
    throw new Error('缺少 Agent B model：请先在前端「Agent 配置」里填写模型名')
  }
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 650000)
  let response
  let data
  try {
    response = await fetch('/api/agent-b-v2/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        temperature: GENERATION_TEMPERATURE,
        endpoint: userSnap.endpoint,
        model: userSnap.model,
        apiKey: userSnap.apiKey,
        handoff,
        canvasParams: canvasParams || undefined,
        systemPrompt: systemPrompt || undefined,
        skillId: skillId || undefined,
      }),
    })
    data = await response.json().catch(() => ({}))
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Agent B 请求超时已取消，请检查上游网络与模型响应', { cause: error })
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok || !data.ok) {
    const detail = [data.error, data.code, data.diagnostic?.rawTextHead]
      .filter((item) => item != null && String(item).trim())
      .map((item) => String(item).trim())
      .join(' | ')
    throw new Error(detail || `Agent B 生成失败 ${response.status}`)
  }
  const rows = applyAgentBV2Timeline(data.rows, { rowGapMs })
  return {
    rows,
    model: data.model || userSnap.model,
    usage: data.usage || null,
  }
}
