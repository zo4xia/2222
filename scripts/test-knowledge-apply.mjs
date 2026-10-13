/**
 * test-knowledge-apply.mjs — R8-① A 方案「先对比确认再落盘」apply 端点冒烟验证
 *
 * 断言：
 *  1. POST /apply 白名单落盘：提案的知识字段（relatedKnowledge/teachingFocus/keyFormulaList）进档，
 *     别环字段（stageRatioSuggestion/boardPlan/canvasParams）原样保留不被提案卷回
 *  2. 落盘前后 current.json 指针文件名不变（原地覆写，不建新档）
 *  3. POST /revert 不再被处理（旧死分支已移除，返回 false 交回中间件 404）
 *  4. 缺提案时 400 拒绝
 *
 * 环境安全：指针与同名档先备份、测后恢复；测试档用专属文件名 20261013-777777-777
 * 注：sendJson 无 return 值是全仓既定约定（中间件按"响应已发出"处理），mock 按同契约构造
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const handoffDir = resolve(root, 'public/handoff')
const pointer = resolve(handoffDir, 'current.json')
const testFilename = 'handoff-20261013-777777-777.json'
const testFile = resolve(handoffDir, testFilename)

const { handleKnowledgeRefineRequest } = await import(resolve(root, 'server/knowledgeRefineHandler.js'))

// ---------- 环境备份 ----------
const pointerBackup = existsSync(pointer) ? readFileSync(pointer) : null
const testFileBackup = existsSync(testFile) ? readFileSync(testFile) : null

let passed = 0
let failed = 0
function check(name, cond) {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failed++; console.log(`  ✗ ${name}`) }
}

// ---------- mock res（statusCode 直设于 res 对象，与 sendJson 真实行为一致） ----------
function mockRes() {
  const state = { body: null }
  const res = {
    statusCode: 0,
    end(chunk) { state.body = JSON.parse(String(chunk)) },
    setHeader() {},
    on() {},
  }
  return { res, state }
}

// ---------- 测试档 ----------
const baseHandoff = {
  handoffVersion: 1,
  problemText: '一块长方形菜地长 8 米、宽 5 米，求面积。',
  problemType: 'geometry',
  relatedKnowledge: [{ 编号: 'K-001', 知识点: '长方形面积' }],
  knowledgeAnalysis: { teachingFocus: '面积公式推导', keyFormulaList: ['S=ab'] },
  stageRatioSuggestion: { type: 'b', cuCode: 'CU-03', confidence: 'high', suggestedRatio: { analysis: 0.1, solution: 0.6 } },
  boardPlan: { question: { x: 6, y: 13 } },
  canvasParams: { fontSize: 38 },
}

mkdirSync(handoffDir, { recursive: true })
writeFileSync(testFile, JSON.stringify(baseHandoff, null, 2), 'utf-8')
writeFileSync(pointer, JSON.stringify({ projectCode: '20261013-777777-777', filename: testFilename, createdAt: new Date().toISOString() }), 'utf-8')

try {
  // 用例 1：apply 白名单落盘
  {
    const { res, state } = mockRes()
    const req = { method: 'POST', url: '/apply', body: { handoff: {
      relatedKnowledge: [{ 编号: 'K-002', 知识点: '长方形与正方形面积对比' }],
      knowledgeAnalysis: { teachingFocus: '先辨图形再选公式', keyFormulaList: ['S=ab', 'S=a²'] },
      // 提案里带上了"过期"的别环字段，白名单必须拒绝它们卷回
      stageRatioSuggestion: { type: 'c', cuCode: 'CU-01' },
      boardPlan: { question: { x: 99, y: 99 } },
    } } }
    await handleKnowledgeRefineRequest(req, res)
    check('HTTP 200 + ok（响应已发出）', res.statusCode === 200 && state.body?.ok === true)
    check('响应携带落盘后 handoff', state.body?.handoff?.relatedKnowledge?.[0]?.编号 === 'K-002')
    const onDisk = JSON.parse(readFileSync(testFile, 'utf-8'))
    check('知识字段落盘：relatedKnowledge 更新', onDisk.relatedKnowledge?.[0]?.编号 === 'K-002')
    check('知识字段落盘：teachingFocus 更新', onDisk.knowledgeAnalysis?.teachingFocus === '先辨图形再选公式')
    check('知识字段落盘：keyFormulaList 更新', onDisk.knowledgeAnalysis?.keyFormulaList?.length === 2)
    check('别环字段保留：stageRatioSuggestion 不被提案卷回', onDisk.stageRatioSuggestion?.type === 'b')
    check('别环字段保留：boardPlan 不被提案卷回', onDisk.boardPlan?.question?.x === 6)
    check('别环字段保留：canvasParams 原样', onDisk.canvasParams?.fontSize === 38)
    const ptr = JSON.parse(readFileSync(pointer, 'utf-8'))
    check('指针不变：原地覆写不建新档', ptr.filename === testFilename)
  }

  // 用例 2：缺提案 → 400
  {
    const { res, state } = mockRes()
    await handleKnowledgeRefineRequest({ method: 'POST', url: '/apply', body: {} }, res)
    check('缺提案 400 拒绝', res.statusCode === 400 && state.body?.ok === false)
  }

  // 用例 3：/revert 不再处理（旧死分支已移除）
  {
    const { res, state } = mockRes()
    const handled = await handleKnowledgeRefineRequest({ method: 'POST', url: '/revert', body: {} }, res)
    check('revert 已移除：返回 false 交回中间件（404）', handled === false && state.body === null)
  }

  // 用例 4：GET 拒绝
  {
    const { res } = mockRes()
    const handled = await handleKnowledgeRefineRequest({ method: 'GET', url: '/apply', body: {} }, res)
    check('GET /apply 不处理', handled === false)
  }
} finally {
  // ---------- 环境恢复 ----------
  if (pointerBackup != null) writeFileSync(pointer, pointerBackup)
  else rmSync(pointer, { force: true })
  if (testFileBackup != null) writeFileSync(testFile, testFileBackup)
  else rmSync(testFile, { force: true })
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed ? 1 : 0)
