import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  compileScriptAgentRowsToDraft,
  readScriptAgentRows,
} from './script-agent-rows-contract.mjs';

const root = process.cwd();
const outDir = join(root, '.tmp-script-agent-rows-check');
const checkFile = join(outDir, 'check.mjs');
const defaultConfigText = readFileSync(join(root, 'src', 'config', 'defaultConfig.ts'), 'utf8');
const domainText = readFileSync(join(root, 'src', 'domain', 'teachingProject.ts'), 'utf8');
const gatewayText = readFileSync(join(root, 'vite.config.mjs'), 'utf8');
const appText = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');
const agentReviewText = readFileSync(join(root, 'src', 'components', 'AgentReviewCard.tsx'), 'utf8');
const problemWorkspaceText = readFileSync(join(root, 'src', 'components', 'ProblemWorkspace.tsx'), 'utf8');
const scriptAgentWorkspaceText = readFileSync(join(root, 'src', 'components', 'ScriptAgentWorkspace.tsx'), 'utf8');
const scriptAgentDraftStateText = readFileSync(join(root, 'src', 'modules', 'scriptAgentDraft', 'scriptAgentDraftState.ts'), 'utf8');
const scriptAgentTableEditorText = readFileSync(join(root, 'src', 'modules', 'scriptAgentTable', 'ScriptAgentTableEditor.tsx'), 'utf8');
const teachingEditorStoreText = readFileSync(join(root, 'src', 'store', 'useTeachingEditorStore.ts'), 'utf8');
const localAgentPromptText = readFileSync(join(root, 'src', 'agent', 'scriptBoardAgentPrompt.ts'), 'utf8');
const stylesText = readFileSync(join(root, 'src', 'styles.css'), 'utf8');
const forbiddenTemplateOpenB = ['B', 'template', 'open', 'ayl'].join('-');
const forbiddenTemplateOpenC = ['C', 'template', 'open', 'ayl'].join('-');

if (!defaultConfigText.includes("export type ScriptAgentOutputContract = 'rows'")) {
  throw new Error('scriptAgent output contract must expose rows as the live Agent draft contract.');
}

if (!defaultConfigText.includes("outputContract: ['rows']")) {
  throw new Error('default scriptAgent.outputContract must be rows-only.');
}

if (!defaultConfigText.includes('必须输出 rows') || !defaultConfigText.includes('不要手写 <br> / <b>')) {
  throw new Error('default script Agent prompt must tell the model to output rows and not hand-write legacy tags.');
}

if (!gatewayText.includes('readScriptAgentRows') || !gatewayText.includes('compileScriptAgentRowsToDraft')) {
  throw new Error('script-board gateway must parse rows through the compiler.');
}

if (!domainText.includes('rows?: ScriptAgentDraftRow[]')) {
  throw new Error('ScriptAgentDraft must preserve candidate rows without writing them as formal assets.');
}

if (gatewayText.includes('JSON 格式：{"spokenScript"')) {
  throw new Error('script-board gateway fallback still advertises legacy spokenScript JSON.');
}

if (gatewayText.includes('spokenScript: normalized') || gatewayText.includes('function readFirstStringField') || gatewayText.includes('旧格式仅兼容')) {
  throw new Error('script-board gateway must fail closed instead of accepting legacy spokenScript/boardPlan or plain text.');
}

if (!gatewayText.includes('Agent 必须返回 rows 表格候选 JSON')) {
  throw new Error('script-board gateway must explain rows-only failure when Agent returns old/plain output.');
}

const rows = readScriptAgentRows({
  rows: [
    {
      boardSlice: '',
      section: '开场读题',
      stepLabel: '读题',
      voiceText: '同学你好，我们先来读题。',
    },
    {
      boardSlice: '观察条件',
      section: '分析题目',
      stepLabel: '观察',
      voiceText: '先观察题目条件。',
    },
    {
      boardSlice: '25×4=100',
      section: '解题环节',
      stepLabel: '第一步',
      voiceText: '我们先把 25 和 4 凑成一组，算出 25×4=100。',
    },
    {
      boardSlice: '1200÷100=12',
      section: '解题环节',
      stepLabel: '第二步',
      voiceText: '接着再用 1200÷100，得到 12。',
    },
    {
      boardSlice: '答案：12',
      section: '梳理总结',
      stepLabel: '总结',
      voiceText: '所以最后答案是 12。',
    },
  ],
});

const draft = compileScriptAgentRowsToDraft(rows);
const manualEmptyRows = readScriptAgentRows({
  rows: [
    {
      boardSlice: '',
      section: '解题环节',
      stepLabel: '第 1 步',
      voiceText: '',
    },
  ],
});
const manualEmptyDraft = compileScriptAgentRowsToDraft(manualEmptyRows);
const missingIdentityRows = readScriptAgentRows({
  rows: [
    {
      boardSlice: '缺分区板书',
      stepLabel: '缺分区',
      voiceText: '这行没有明确分区，不能被脑补成正式身份。',
    },
  ],
});
const missingIdentityDraft = compileScriptAgentRowsToDraft(missingIdentityRows);

if (!draft.spokenScript.includes('<br>')) {
  throw new Error('compiled rows must create <br> only inside the compiler output.');
}

if (draft.spokenScript.includes('<b>读题</b>') || !draft.spokenScript.includes('<b>观察条件</b>')) {
  throw new Error('template-open must keep A/B/C placeholders in prompt/template copy while compiler output keeps opening boardSlice out of formal B/C content.');
}

if (!draft.spokenScript.includes('<b>25×4=100</b>') || !draft.spokenScript.includes('<b>1200÷100=12</b>') || !draft.spokenScript.includes('<b>答案：12</b>')) {
  throw new Error('compiled rows must project boardSlice into <b> markers.');
}

if (
  draft.boardPlan.includes(forbiddenTemplateOpenB) ||
  draft.boardPlan.includes(forbiddenTemplateOpenC) ||
  !draft.boardPlan.includes('B-template-pre/C-template-pre：观察条件') ||
  !draft.boardPlan.includes('B1/C1：25×4=100') ||
  !draft.boardPlan.includes('B2/C2：1200÷100=12') ||
  !draft.boardPlan.includes('B-template-end/C-template-end：答案：12')
) {
  throw new Error('compiled rows must create boardPlan only for allowed B/C chainKey labels.');
}

if (draft.boardPlan.includes('B贴片')) {
  throw new Error('compiled rows boardPlan must not use old B sticker wording.');
}

if (!draft.rows || draft.rows.length !== 5 || draft.rows[0].stepLabel !== '读题') {
  throw new Error('compiled rows must preserve candidate rows for the table preview layer.');
}

if (!manualEmptyDraft.rows || manualEmptyDraft.rows.length !== 1 || manualEmptyDraft.spokenScript || manualEmptyDraft.boardPlan) {
  throw new Error('manual empty rows must stay editable in the candidate table without leaking into formal script or boardPlan.');
}

if (missingIdentityRows[0]?.chainKey !== 'unbound') {
  throw new Error('rows without explicit section must stay unbound instead of being inferred from row order.');
}

if (missingIdentityDraft.boardPlan) {
  throw new Error('compiled boardPlan must not create B/C material for missing row identity.');
}

if (
  missingIdentityDraft.boardPlan.includes(forbiddenTemplateOpenB) ||
  missingIdentityDraft.boardPlan.includes(forbiddenTemplateOpenC) ||
  missingIdentityDraft.boardPlan.includes('B1/') ||
  missingIdentityDraft.boardPlan.includes('C1')
) {
  throw new Error('missing row identity must not compile into template or numeric B/C labels.');
}

if (!agentReviewText.includes('formatDraftReceipt') || agentReviewText.includes('formatDraftAsMarkdown')) {
  throw new Error('Agent chat must use a receipt only; rows content belongs in the single table editing surface.');
}

if (!agentReviewText.includes('请基于已确认题文一步一步填写讲解切片表格候选')) {
  throw new Error('Agent default request must ask for the user-facing slice table instead of generic script and board text.');
}

if (agentReviewText.includes('输出合同：{scriptAgentConfig.outputContract.join') || agentReviewText.includes('行 rows 表格候选')) {
  throw new Error('Agent chat visible copy must not expose rows as the primary user-facing wording.');
}

if (!agentReviewText.includes("cleanroom-script-agent-chat-history-v2") || !agentReviewText.includes('isLegacyPreviewMessage')) {
  throw new Error('Agent chat must isolate/filter legacy preview messages from the old duplicated chat surface.');
}

if (appText.includes('destroyOnHidden') || appText.includes('destroyOnClose')) {
  throw new Error('Script Agent modal must preserve in-dialog cache when closed; do not destroy hidden content.');
}

const appAndAgentShellText = `${appText}\n${agentReviewText}\n${problemWorkspaceText}\n${scriptAgentWorkspaceText}`;
for (const forbiddenAppAgentCopy of [
  ['文稿', ' Agent'].join(''),
  ['对话', ' Agent'].join(''),
  ['正在打开文稿', ' Agent'].join(''),
  ['文稿与C素材', ' Agent'].join(''),
]) {
  if (appAndAgentShellText.includes(forbiddenAppAgentCopy)) {
    throw new Error(`App/Agent shell must not show old Script Agent label: ${forbiddenAppAgentCopy}`);
  }
}

for (const requiredAppAgentCopy of [
  '文稿与 C 素材 Agent',
  '打开文稿与 C 素材',
  '正在打开文稿与 C 素材 Agent...',
]) {
  if (!appAndAgentShellText.includes(requiredAppAgentCopy)) {
    throw new Error(`App/Agent shell missing Script/C material label: ${requiredAppAgentCopy}`);
  }
}

const receiptFunctionStart = agentReviewText.indexOf('function formatDraftReceipt');
const receiptFunctionEnd = agentReviewText.indexOf('function isLegacyPreviewMessage');
const receiptFunctionText = agentReviewText.slice(receiptFunctionStart, receiptFunctionEnd);
if (receiptFunctionText.includes('### rows 表格候选') || receiptFunctionText.includes('### compiler 文案预览')) {
  throw new Error('Agent chat must not duplicate candidate preview content already shown in the rows table.');
}

if (!domainText.includes("kind: 'scriptText'") || !domainText.includes("summary: ''") || domainText.includes('带 <br> 语音分段')) {
  throw new Error('seed project must not put instructional placeholder text into formal scriptText.');
}

const requiredTableWorkbenchCopy = [
  '讲解切片预览与编辑',
  '添加切片',
  '刷新候选稿',
  '行切片',
  '专业规则',
  '分区',
  '链路',
  '步骤',
  '板书素材（按分区）',
  'A轴讲解内容（语音切片）',
  'A 语音行和按分区允许的 C 素材候选',
  '个 C 素材候选',
  '操作',
  'A-template-open',
  'A-template-pre',
  'A-template-end',
  '四连环：对话生成候选 rows',
  'boardSlice 生成 C 素材候选',
  'A 返回真实时长后生成 B 寿命窗口',
  'C 再接排版和演绎资产',
  '唯一身份只看 chainKey',
  '开场读题主身份是 A-template-open',
  'prompt/template 层同时保留 B-template-open / C-template-open 占位',
  '分析题目 A-template-pre 和梳理总结 A-template-end 可按需要填写 C 素材候选',
  '正式解题步骤才允许 A1/B1/C1',
];
for (const copy of requiredTableWorkbenchCopy) {
  if (!scriptAgentTableEditorText.includes(copy)) {
    throw new Error(`rows table workbench is missing required UI copy: ${copy}`);
  }
}

const oldPinyinZoneCopy = [
  ['辅', '助区统一用', '拼音', '区名'].join(''),
  ['辅', '助区用', '拼音', '区名'].join(''),
  ['A', '-duti'].join(''),
  ['B', '-duti'].join(''),
  ['C', '-duti'].join(''),
  ['A', '-silu'].join(''),
  ['B', '-silu'].join(''),
  ['C', '-silu'].join(''),
  ['A', '-zongjie'].join(''),
  ['B', '-zongjie'].join(''),
  ['C', '-zongjie'].join(''),
];

if (!scriptAgentTableEditorText.includes('TableColumnsType<ScriptAgentTableRow>') || !scriptAgentTableEditorText.includes('className="script-agent-table"')) {
  throw new Error('rows table must use the AntD Table workbench as the single candidate editing surface.');
}

if (scriptAgentTableEditorText.includes('row.chainKey ?? createRowChainKey') || scriptAgentTableEditorText.includes('createRowChainKey(rows, row)')) {
  throw new Error('rows table UI must render A/B/C labels from row.chainKey only; missing identity shows unbound.');
}

if (!scriptAgentTableEditorText.includes('createAbcChainLabels(row.chainKey)') || !scriptAgentTableEditorText.includes('未绑定 chainKey')) {
  throw new Error('rows table UI must expose unbound chainKey instead of fabricating a visible mapping.');
}

for (const forbiddenRowsTableCopy of [
  '一行语音 + 一个可选板书贴片',
  'B/C板书素材（可空）',
  'A 语音行和可空 B/C 板书素材',
  '段板书',
  '没有 B 贴片',
  'B贴片',
  'C画布演员只从非空 B 板书贴片生成',
  'A 语音行和按分区允许的 B/C 素材',
  '个可生成 B/C 素材',
  'B1短于A1时，C1动作速度越快',
  ...oldPinyinZoneCopy,
]) {
  if (scriptAgentTableEditorText.includes(forbiddenRowsTableCopy)) {
    throw new Error(`rows table must not show old B-only copy: ${forbiddenRowsTableCopy}`);
  }
}

for (const forbiddenRowsPromptCopy of [
  '不生成 B 贴片',
  'B 贴片对齐',
  'B贴片',
  '不生成 B 指挥片段和 C 画布演员',
  '写入 B/C',
  '允许 B/C',
  '无 B/C',
  ...oldPinyinZoneCopy,
]) {
  if (`${defaultConfigText}\n${gatewayText}\n${localAgentPromptText}`.includes(forbiddenRowsPromptCopy)) {
    throw new Error(`script Agent prompts must not use old B-sticker copy: ${forbiddenRowsPromptCopy}`);
  }
}

if (
  !defaultConfigText.includes('开场读题主身份是 A-template-open') ||
  !defaultConfigText.includes('prompt/template 层同时保留 B-template-open / C-template-open 占位') ||
  !defaultConfigText.includes('对应 A-template-pre') ||
  !defaultConfigText.includes('正式解题步骤才允许 A1/B1/C1 递增') ||
  !defaultConfigText.includes('梳理总结对应 A-template-end') ||
  !gatewayText.includes('开场读题主身份是 A-template-open') ||
  !gatewayText.includes('prompt/template 层同时保留 B-template-open / C-template-open 占位') ||
  !localAgentPromptText.includes('开场读题主身份是 A-template-open')
) {
  throw new Error('script Agent prompts must keep template-open A/B/C placeholders aligned and reserve numeric A1/B1/C1 for formal solving steps only.');
}

if (scriptAgentWorkspaceText.includes('script-agent-table-boundary')) {
  throw new Error('ScriptAgentWorkspace must not put a large boundary alert before the rows table; table is the first candidate work surface.');
}

if (!scriptAgentWorkspaceText.includes('讲解切片候选') || !scriptAgentWorkspaceText.includes('<Tag color="geekblue">rows</Tag>')) {
  throw new Error('ScriptAgentWorkspace must show a user-facing candidate title and keep rows as a small technical tag.');
}

if (scriptAgentWorkspaceText.includes('<Text strong>rows 候选</Text>')) {
  throw new Error('ScriptAgentWorkspace toolbar must not expose rows as the primary candidate title.');
}

const firstRowsTableUse = scriptAgentTableEditorText.indexOf('<ScriptAgentRowsTable');
const firstRulesUse = scriptAgentTableEditorText.indexOf('<ScriptAgentTableRules />');
if (firstRowsTableUse === -1 || firstRulesUse === -1 || firstRowsTableUse > firstRulesUse) {
  throw new Error('rows table must render before collapsible rules so the table is the first visible work surface.');
}

if (scriptAgentTableEditorText.includes('<div className="script-agent-table-empty">') || !scriptAgentTableEditorText.includes('locale={{ emptyText:')) {
  throw new Error('rows table empty state must still render the AntD table scaffold with column headers.');
}

if (
  !scriptAgentTableEditorText.includes('等待 Agent 生成讲解切片') ||
  scriptAgentTableEditorText.includes('等待 rows 表格候选')
) {
  throw new Error('rows table empty copy must be user-facing and must not expose rows jargon as the first empty-state phrase.');
}

if (!scriptAgentTableEditorText.includes('onCompile: (rows: ScriptAgentTableRow[]) => void') || !scriptAgentWorkspaceText.includes('onCompile={(rows) =>')) {
  throw new Error('rows table compile button must call an explicit compile callback instead of floating as an unlabeled edit event.');
}

if (!stylesText.includes('.script-agent-table-workbench') || !stylesText.includes('.script-agent-table-toolbar') || !stylesText.includes('.script-agent-table-row-actions')) {
  throw new Error('rows table workbench must keep dedicated styles for the single candidate editing surface.');
}

mkdirSync(outDir, { recursive: true });
execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

const compiledDraftNormalizerFile = join(outDir, 'modules', 'scriptAgentDraft', 'normalizeScriptAgentDraft.js');
const compiledDraftNormalizerText = readFileSync(compiledDraftNormalizerFile, 'utf8');
writeFileSync(
  compiledDraftNormalizerFile,
  compiledDraftNormalizerText.replace(
    "from '../speechText/aliyunMathSpeechText'",
    "from '../speechText/aliyunMathSpeechText.js'",
  ).replace(
    "from '../scriptAgentTable/compileScriptAgentTableDraft'",
    "from '../scriptAgentTable/compileScriptAgentTableDraft.js'",
  ).replace(
    "from '../scriptAgentTable/normalizeScriptAgentTableDraft'",
    "from '../scriptAgentTable/normalizeScriptAgentTableDraft.js'",
  ),
);

const compiledTableCompilerFile = join(outDir, 'modules', 'scriptAgentTable', 'compileScriptAgentTableDraft.js');
const compiledTableCompilerText = readFileSync(compiledTableCompilerFile, 'utf8');
writeFileSync(
  compiledTableCompilerFile,
  compiledTableCompilerText.replace(
    "from '../abcChain/abcChainKey'",
    "from '../abcChain/abcChainKey.js'",
  ).replace(
    "from './normalizeScriptAgentTableDraft'",
    "from './normalizeScriptAgentTableDraft.js'",
  ),
);

const compiledTableNormalizerFile = join(outDir, 'modules', 'scriptAgentTable', 'normalizeScriptAgentTableDraft.js');
const compiledTableNormalizerText = readFileSync(compiledTableNormalizerFile, 'utf8');
writeFileSync(
  compiledTableNormalizerFile,
  compiledTableNormalizerText.replace(
    "from '../abcChain/abcChainKey'",
    "from '../abcChain/abcChainKey.js'",
  ),
);

const compiledAbcChainKeyFile = join(outDir, 'modules', 'abcChain', 'abcChainKey.js');
const compiledAbcChainKeyText = readFileSync(compiledAbcChainKeyFile, 'utf8');
writeFileSync(
  compiledAbcChainKeyFile,
  compiledAbcChainKeyText.replace(
    "from '../../domain/globalRules'",
    "from '../../domain/globalRules.js'",
  ),
);

writeFileSync(
  checkFile,
  `import { createAbcChainLabel, createTemplateChainKey } from './modules/abcChain/abcChainKey.js';\n` +
  `import { normalizeScriptAgentDraft } from './modules/scriptAgentDraft/normalizeScriptAgentDraft.js';\n\n` +
  `const manualEmptyDraft = normalizeScriptAgentDraft({ rows: [{ boardSlice: '', section: '解题环节', stepLabel: '第 1 步', voiceText: '' }] });\n` +
  `const missingIdentityDraft = normalizeScriptAgentDraft({ rows: [{ boardSlice: '缺分区板书', stepLabel: '缺分区', voiceText: '这行没有明确分区。' }] });\n` +
  `if (!manualEmptyDraft.rows || manualEmptyDraft.rows.length !== 1) throw new Error('production TS normalizer dropped a manual empty row');\n` +
  `if (manualEmptyDraft.spokenScript !== '' || manualEmptyDraft.boardPlan !== '') throw new Error('manual empty row leaked into formal script or boardPlan');\n` +
  `if (missingIdentityDraft.rows?.[0]?.chainKey !== 'unbound') throw new Error('production TS normalizer inferred identity for a row without section');\n` +
  `if (missingIdentityDraft.boardPlan !== '') throw new Error('production TS compiler must not emit B/C material for missing identity');\n` +
  `const forbiddenTemplateOpenB = ['B', 'template', 'open'].join('-');\n` +
  `if (missingIdentityDraft.boardPlan.includes('B1/') || missingIdentityDraft.boardPlan.includes(forbiddenTemplateOpenB)) throw new Error('production TS compiler fabricated a formal template-open or numeric B/C label for missing identity');\n` +
  `if (createAbcChainLabel(undefined, 'b') !== 'B-unbound') throw new Error('missing chainKey must not be disguised as B1');\n` +
  `if (createTemplateChainKey('读题分析') !== 'unbound') throw new Error('unknown legacy section must not be disguised as step-1');\n` +
  `console.log('[script-agent-rows:ts-normalizer] passed', JSON.stringify(manualEmptyDraft, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });

if (scriptAgentWorkspaceText.includes('<Text strong>文案预览</Text>') || scriptAgentWorkspaceText.includes('<Text strong>板书预览</Text>')) {
  throw new Error('ScriptAgentWorkspace must not show duplicated spokenScript/boardPlan preview cards beside the rows table.');
}

if (scriptAgentWorkspaceText.includes('Boolean(candidateDraft.spokenScript.trim() || candidateDraft.boardPlan.trim())')) {
  throw new Error('ScriptAgentWorkspace must not treat rows-only candidate drafts as empty.');
}

if (
  !scriptAgentWorkspaceText.includes('createScriptAgentDraftSignature(candidateDraft)') ||
  !scriptAgentWorkspaceText.includes('hasScriptAgentDraftContent(candidateDraft)')
) {
  throw new Error('ScriptAgentWorkspace must use shared rows-aware candidate draft helpers.');
}

if (
  !scriptAgentDraftStateText.includes('draft.rows?.length || draft.spokenScript.trim() || draft.boardPlan.trim()') ||
  !scriptAgentDraftStateText.includes('rows: draft.rows ?? []')
) {
  throw new Error('scriptAgentDraft state helpers must include rows in candidate content and signature checks.');
}

for (const forbiddenAgentReviewCopy of [
  '写入正式文稿和板书',
  '板书少一些',
  '板书候选',
]) {
  if (agentReviewText.includes(forbiddenAgentReviewCopy)) {
    throw new Error(`AgentReviewCard must use C material candidate wording, not old board copy: ${forbiddenAgentReviewCopy}`);
  }
}

for (const requiredAgentReviewCopy of [
  '文稿与 C 素材 Agent',
  '写入正式文稿和 C 素材候选',
  'C 素材少一些',
  'C 素材候选',
]) {
  if (!agentReviewText.includes(requiredAgentReviewCopy)) {
    throw new Error(`AgentReviewCard missing C material candidate wording: ${requiredAgentReviewCopy}`);
  }
}

if (agentReviewText.includes('candidateDraft.spokenScript || candidateDraft.boardPlan ? candidateDraft : draft')) {
  throw new Error('AgentReviewCard must use rows-aware draft content detection for the visible active draft.');
}

if (!agentReviewText.includes('hasScriptAgentDraftContent(candidateDraft) ? candidateDraft : draft')) {
  throw new Error('AgentReviewCard visible status must treat rows-only candidate drafts as active.');
}

if (
  scriptAgentWorkspaceText.includes('高级兜底') ||
  scriptAgentWorkspaceText.includes('直接文案') ||
  scriptAgentWorkspaceText.includes('直接板书') ||
  scriptAgentWorkspaceText.includes('onCandidateDraftPatch') ||
  scriptAgentWorkspaceText.includes('TextArea')
) {
  throw new Error('ScriptAgentWorkspace must keep rows table as the only candidate editing surface; no advanced legacy fallback in the Agent window.');
}

if (!teachingEditorStoreText.includes('cleanroom-script-agent-candidate-draft-v1') || !teachingEditorStoreText.includes('loadPersistedScriptAgentCandidateDraft')) {
  throw new Error('rows candidate draft must persist locally until a new generation task clears or replaces it.');
}

const localFallbackStart = localAgentPromptText.indexOf('export function createLocalScriptAgentDraft');
const localFallbackText = localAgentPromptText.slice(localFallbackStart);
if (!localFallbackText.includes('rows: [') || localFallbackText.includes("spokenScript: [")) {
  throw new Error('local script agent fallback must return rows instead of a hand-written legacy spokenScript demo.');
}

console.log('[script-agent-rows] passed', JSON.stringify(draft, null, 2));
