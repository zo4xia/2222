import assert from 'node:assert/strict'
import { handleAgentBV2Request } from './agentBV2Handler.js'
import { handleCheckAgentRequest } from './checkAgentHandler.js'
import { handleRecognitionRequest } from './recognitionHandler.js'
import { buildSpeechMarkdown } from '../src/lib/speechMarkdown.js'
import { validateAgentBV2Rows } from '../src/agent-b-v2/contract.js'
import { getAgentBDirectorView, getAgentBoardToolCatalog } from '../src/board-tools/boardToolCatalog.js'
import { validateRoughNotationAction } from '../src/board-tools/roughNotationTool.js'
import { buildStep1Handoff } from '../src/services/stepHandoff.js'

function mockResponse() {
  const headers = new Map()
  return {
    headers,
    statusCode: 0,
    body: '',
    setHeader(key, value) { headers.set(key, value) },
    end(value = '') { this.body = value },
  }
}

process.env.CORS_ORIGINS = 'https://frontend.example'
let response = mockResponse()
await handleAgentBV2Request({ method: 'POST', headers: { origin: 'https://frontend.example' }, body: {} }, response)
assert.equal(response.statusCode, 400)
assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://frontend.example')

response = mockResponse()
await handleRecognitionRequest({ method: 'POST', headers: { origin: 'https://other.example' }, body: {} }, response)
assert.equal(response.statusCode, 400)
assert.equal(response.headers.has('Access-Control-Allow-Origin'), false)

process.env.UPSTREAM_HOSTS = 'api.allowed.example'
response = mockResponse()
await handleAgentBV2Request({
  method: 'POST',
  headers: {},
  body: { apiKey: 'test', endpoint: 'https://api.blocked.example/v1', model: 'test' },
}, response)
assert.equal(response.statusCode, 400)
assert.match(response.body, /UPSTREAM_HOSTS/)

const originalFetch = globalThis.fetch
let upstreamRequest
let upstreamUrl
let upstreamCallCount = 0
let failFirstRequest = true
const upstreamRows = [
  { duration: '待程序预估', stage: '题目', speech: '我们先读题。', board: { content: '', startDelay: 0 }, actionSpec: [] },
  { duration: '待程序预估', stage: '分析', speech: '我们开始分析。', board: { content: '分析内容', startDelay: 1 }, actionSpec: [] },
  { duration: '待程序预估', stage: '分析', speech: '我们继续分析。', board: { content: '继续分析', startDelay: 1 }, actionSpec: [] },
]
globalThis.fetch = async (url, options) => {
  upstreamCallCount += 1
  upstreamUrl = String(url)
  upstreamRequest = JSON.parse(options.body)
  if (failFirstRequest) {
    failFirstRequest = false
    return new Response(JSON.stringify({ error: { message: 'temporary upstream failure' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (options.headers['x-api-key']) {
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify({ rows: upstreamRows }) }],
      stop_reason: 'end_turn',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const isCheck = upstreamRequest.messages?.[0]?.content?.includes('Check Agent')
  const isRecognition = upstreamRequest.messages?.[0]?.content?.[0]?.text?.includes('Agent A 题目识别与知识点检索助手')
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify(isRecognition
          ? {
              problemText: '计算8+5，用凑十法讲解',
              problemType: 'calculation',
              boardFocus: 'calculation_process',
              imageKind: 'text_only',
              keepOriginal: false,
              uncertainItems: [],
              suggestedLayout: { layout: 'left_right' },
              knowledgeAnalysis: {
                suggestedGrade: '一年级',
                coreKnowledge: [{ knowledgeId: 'kp_1' }],
                teachingFocus: '理解凑十',
                keyFormulaList: ['8+2+3=13'],
              },
            }
          : isCheck
          ? {
              rows: upstreamRows.map((row, index) => ({
                ...row,
                duration: '预计 0:00—0:05',
                ...(index === 1
                  ? { speech: '我们开始分析并回顾公式。' }
                  : {}),
              })),
              changes: [{ row: 2, field: 'speech', before: '开始分析。', after: '我们开始分析。', reason: '补足自然口播' }],
            }
          : { rows: upstreamRows }),
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
try {
  response = mockResponse()
  await handleAgentBV2Request({
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/chat/completions',
      model: 'test',
      handoff: {
        problemText: '1加1等于多少？',
        problemImage: 'data:image/png;base64,PROBLEM',
        sourceImageDataUrl: 'data:image/png;base64,SOURCE',
        previewDataUrl: 'data:image/png;base64,PREVIEW',
        imageDataUrl: 'data:image/png;base64,IMAGE',
        ignoredField: '不得进入模型文本 handoff',
      },
    },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(upstreamCallCount, 2)
  assert.equal(upstreamUrl, 'https://api.allowed.example/v1/chat/completions')
  const firstAgentBContent = upstreamRequest.messages[1].content
  assert.equal(firstAgentBContent.filter((item) => item.type === 'image_url').length, 0)
  assert.doesNotMatch(firstAgentBContent[0].text, /problemImage|sourceImageDataUrl|previewDataUrl|imageDataUrl|ignoredField/)

  response = mockResponse()
  await handleAgentBV2Request({
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/messages',
      model: 'claude-sonnet-4-6',
      apiType: 'anthropic-messages',
      handoff: {
        problemImage: 'data:image/png;base64,PROBLEM',
        previewDataUrl: 'data:image/png;base64,PREVIEW',
      },
    },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(upstreamUrl, 'https://api.allowed.example/v1/messages')
  assert.match(upstreamRequest.system, /小学数学讲题 Agent B/)
  assert.equal(upstreamRequest.messages[0].content.filter((item) => item.type === 'image').length, 0)

  const recognitionRequest = {
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/chat/completions',
      model: 'test',
      problemText: '计算8+5，用凑十法讲解',
    },
  }
  const knowledgeBase = (await import('./docReferences.js')).AGENT_A_KNOWLEDGE_BASE
  response = mockResponse()
  await handleRecognitionRequest(recognitionRequest, response, { knowledgeBase })
  assert.equal(response.statusCode, 200)
  assert.match(upstreamRequest.messages[0].content[0].text, /Top-K 精确检索/)
  assert.match(upstreamRequest.messages[0].content[0].text, /rawKnowledgeRecord 由服务端按有效 knowledgeId 完整回填/)
  const recognitionBody = JSON.parse(response.body)
  assert.equal(recognitionBody.knowledgeRetrieval.mode, 'top-k')
  assert.equal(recognitionBody.result.knowledgeAnalysis.coreKnowledge[0].knowledgeId, 'kp_1')
  assert.equal(recognitionBody.result.knowledgeAnalysis.coreKnowledge[0].rawKnowledgeRecord.编号, 'kp_1')
  assert.equal(recognitionBody.cached, false)
  const callsAfterRecognition = upstreamCallCount

  response = mockResponse()
  await handleRecognitionRequest(recognitionRequest, response, { knowledgeBase })
  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).cached, true)
  assert.equal(upstreamCallCount, callsAfterRecognition, '相同 Agent A 请求不应重复调用付费上游')

  response = mockResponse()
  await handleAgentBV2Request({
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/chat/completions',
      model: 'test',
      handoff: { sourceImageDataUrl: 'data:image/png;base64,AA==' },
    },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(upstreamRequest.messages[1].content.some((item) => item.type === 'image_url'), false)

  response = mockResponse()
  const timedRows = upstreamRows.map((row) => ({
    ...row,
    duration: '预计 0:00—0:05',
    timingStatus: 'estimated',
    estimatedDurationMs: 5000,
  }))
  await handleCheckAgentRequest({
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/chat/completions',
      model: 'test',
      currentRows: timedRows,
      handoff: {
        problemText: '1加1等于多少？',
        previewDataUrl: 'data:image/png;base64,PREVIEW',
      },
    },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.match(upstreamRequest.messages[0].content, /Check Agent/)
  assert.match(upstreamRequest.messages[0].content, /口播稿（speech）统一规范/)
  assert.match(upstreamRequest.messages[0].content, /只保留实际要朗读的内容/)
  assert.doesNotMatch(upstreamRequest.messages[0].content, /doc\/key\.md/)
  assert.match(upstreamRequest.messages[1].content.map(c => c.text).join('\n'), /当前 B 生成结果四字段/)
  assert.equal(upstreamRequest.messages[1].content.some((item) => item.type === 'image_url'), false)
  const checkBody = JSON.parse(response.body)
  assert.equal(checkBody.changes.length, 1)
  assert.equal(checkBody.changes[0].field, 'speech')
  assert.equal(Object.hasOwn(checkBody.rows[0], 'duration'), false)
  assert.equal(Object.hasOwn(checkBody.rows[0], 'timingStatus'), false)
  assert.equal(checkBody.rows[0].stage, upstreamRows[0].stage)
  assert.equal(checkBody.rows[1].speech, '我们开始分析并回顾公式。')
  assert.equal(Object.hasOwn(checkBody.rows[0], 'notes'), false)

  response = mockResponse()
  await handleAgentBV2Request({
    method: 'POST',
    headers: {},
    body: {
      apiKey: 'test',
      endpoint: 'https://api.allowed.example/v1/chat/completions',
      model: 'test',
      handoff: { problemText: '1加1等于多少？' },
    },
  }, response)
  assert.equal(response.statusCode, 200)
  assert.equal(upstreamRequest.messages[0].content.includes('【doc/'), false)
  assert.equal(upstreamRequest.messages[0].content.includes('.md】'), false)
  assert.equal(upstreamRequest.messages[0].content.includes('.csv】'), false)
  assert.match(upstreamRequest.messages[1].content[0].text, /^【Agent A handoff】/)
  assert.ok(upstreamRequest.messages[1].content.length >= 1)
  assert.ok(upstreamRequest.messages[1].content.every((item) => item.type === 'text'))
  assert.doesNotMatch(upstreamRequest.messages[1].content[0].text, /data:image\/png;base64/)
  assert.doesNotMatch(upstreamRequest.messages[1].content[0].text, /sourceImageDataUrl|previewDataUrl|imageDataUrl|problemImage/)
} finally {
  globalThis.fetch = originalFetch
}

const markdown = buildSpeechMarkdown(upstreamRows, { problemText: '1加1等于多少？', model: 'test' })
assert.equal(markdown, '我们先读题。\n\n我们开始分析。\n\n我们继续分析。\n')

const normalizedHandoff = buildStep1Handoff({
  boardPlan: { analysis: { x: 6, y: 41, w: 40, h: 30 } },
})
assert.equal(Object.hasOwn(normalizedHandoff, 'canvas'), false)
assert.equal(Object.hasOwn(normalizedHandoff, 'sourceImageDataUrl'), false)
assert.equal(Object.hasOwn(normalizedHandoff, 'previewDataUrl'), false)
assert.equal(normalizedHandoff.coordinateSpec.coordinateSystem, '百分比坐标（0—100），原点左上')

const directorCatalog = getAgentBDirectorView()
const boardToolCatalog = getAgentBoardToolCatalog()
assert.deepEqual(
  directorCatalog.tools.map((tool) => tool.id),
  ['rough-notation', 'rough-line', 'rough-arrow', 'draw'],
)
assert.deepEqual(
  directorCatalog.tools[0].actions.map((item) => item.action),
  ['underline', 'highlight', 'box', 'circle', 'bracket', 'strike-through', 'crossed-off'],
)
assert.equal(directorCatalog.tools[0].actionSchema.options.colorId, undefined)
assert.equal(directorCatalog.tools[1].actionSchema.style.colorId, 'ink|red')
assert.equal(boardToolCatalog.tools[1].coordinateSystem.unit, 'percent')
assert.equal(boardToolCatalog.tools[1].coordinateSystem.range, '0-100')
assert.equal(validateRoughNotationAction({
  tool: 'rough-notation',
  action: 'invalid-action',
  target: { region: 'question', exactText: '题干' },
}).ok, false)

const actionRows = [
  { duration: '待程序预估', stage: '题目', speech: '我们先读题。', board: '', actionSpec: [] },
  {
    duration: '待程序预估',
    stage: '分析',

    speech: '我们画一条辅助线。',
    board: '辅助线',
    actionSpec: [{
      action: {
        tool: 'rough-line',
        region: 'analysis',
        start: [20, 52],
        end: [50, 52],
        order: 1,
        style: { colorId: 'red', strokeWidthId: 'normal' },
      },
    }],
  },
]
const normalizedActionRows = validateAgentBV2Rows(actionRows, { problemType: 'geometry' })
assert.equal(normalizedActionRows.ok, true)
assert.deepEqual(normalizedActionRows.value[1].actionSpec[0].action.start, [20, 52])
assert.deepEqual(normalizedActionRows.value[1].actionSpec[0].action.end, [50, 52])
const pixelActionRows = actionRows.map((row, index) => index === 1
  ? { ...row, actionSpec: [{ ...row.actionSpec[0], action: { ...row.actionSpec[0].action, start: [220, 520], end: [520, 520] } }] }
  : row)
assert.deepEqual(validateAgentBV2Rows(pixelActionRows, { problemType: 'geometry' }).value[1].actionSpec, [])
assert.equal(validateAgentBV2Rows(actionRows.map((row, index) => index === 1
  ? { ...row, actionSpec: [{ action: row.actionSpec[0].action }] }
  : row), { problemType: 'geometry' }).ok, true)
assert.equal(Object.hasOwn(normalizedActionRows.value[1].actionSpec[0], 'cueText'), false)
const invalidActionRows = validateAgentBV2Rows(actionRows.map((row, index) => index === 1
  ? { ...row, actionSpec: [{ action: { tool: 'draw', region: 'analysis', order: 1 } }] }
  : row), { problemType: 'geometry' })
assert.equal(invalidActionRows.ok, true)
assert.deepEqual(invalidActionRows.value[1].actionSpec, [])
const removedToolRows = validateAgentBV2Rows(actionRows.map((row, index) => index === 1
  ? { ...row, actionSpec: [{ action: { tool: 'rough-rect', region: 'analysis', order: 1 } }] }
  : row), { problemType: 'geometry' })
assert.deepEqual(removedToolRows.value[1].actionSpec, [])

console.log('proxy self-check ok')
