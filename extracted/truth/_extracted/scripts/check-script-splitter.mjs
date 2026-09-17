import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-script-splitter-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

const compiledSplitterFile = join(outDir, 'modules', 'timeline-factory', 'splitScriptIntoTtsSentenceUnits.js');
const compiledSplitterText = readFileSync(compiledSplitterFile, 'utf8');
writeFileSync(
  compiledSplitterFile,
  compiledSplitterText.replace(
    "from '../speechText/aliyunMathSpeechText'",
    "from '../speechText/aliyunMathSpeechText.js'",
  ),
);

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
  `import { splitScriptIntoTtsSentenceUnits, stripBoardMarkersForTts } from './modules/timeline-factory/splitScriptIntoTtsSentenceUnits.js';\n` +
    `import { normalizeScriptAgentDraft } from './modules/scriptAgentDraft/normalizeScriptAgentDraft.js';\n\n` +
    `const sample = '同学你好，很高兴为你讲解这道题目，让我们来看看这道题目内容：<br>我们先算括号里面的乘法，<b>25×4＝100</b>。<br>然后计算 1200÷100=12。分数可以写成 \\\\frac{1}{2}，括号也要保留。';\n` +
    `const result = splitScriptIntoTtsSentenceUnits(sample);\n` +
    `const chainResult = splitScriptIntoTtsSentenceUnits(sample, { chainKeys: ['template-open', 'step-1', 'template-end'] });\n` +
    `if (result.plainTtsText.includes('<b>') || result.plainTtsText.includes('</b>') || result.plainTtsText.includes('.......') || result.plainTtsText.includes('►') || result.plainTtsText.includes('◄')) throw new Error('TTS text still contains board markers');\n` +
    `if (stripBoardMarkersForTts(sample).includes('<b>') || stripBoardMarkersForTts(sample).includes('</b>') || stripBoardMarkersForTts(sample).includes('.......') || stripBoardMarkersForTts(sample).includes('►') || stripBoardMarkersForTts(sample).includes('◄')) throw new Error('strip failed');\n` +
    `if (result.markerCount !== 1) throw new Error('marker count mismatch');\n` +
    `if (!result.units.some((unit) => unit.hasBoardMarker && unit.boardMarkerText === '25×4＝100')) throw new Error('paired board marker was not preserved for alignment');\n` +
    `if (result.units.length !== 3) throw new Error(\`<br> sentence truth mismatch: \${result.units.length}\`);\n` +
    `if (result.units.some((unit) => unit.chainKey || unit.boardMarkerChainKeys?.length)) throw new Error('splitter must not invent chainKey labels when upstream rows did not provide them');\n` +
    `if (chainResult.units[0].chainKey !== 'template-open' || chainResult.units[1].chainKey !== 'step-1' || chainResult.units[1].boardMarkerChainKeys?.[0] !== 'step-1') throw new Error('chainKey must flow into TTS units and board markers');\n` +
    `for (const expectedText of ['25×4＝100', '1200÷100=12', '\\\\frac{1}{2}', '括号']) {\n` +
    `  if (!result.units.map((unit) => unit.text).join('\\n').includes(expectedText)) throw new Error(\`display text lost: \${expectedText}\`);\n` +
    `}\n` +
    `for (const forbiddenSpeechText of ['\\\\frac', '\\\\div', '$', '\\\\left', '\\\\right']) {\n` +
    `  if (result.plainTtsText.includes(forbiddenSpeechText)) throw new Error(\`speech text must not send display math syntax to Aliyun: \${forbiddenSpeechText}\`);\n` +
    `}\n` +
    `for (const expectedSpeechText of ['25乘以4等于100', '1200除以100等于12', '2分之1']) {\n` +
    `  if (!result.plainTtsText.includes(expectedSpeechText)) throw new Error(\`speech text lost natural math reading: \${expectedSpeechText}\`);\n` +
    `}\n` +
    `const delimitedResult = splitScriptIntoTtsSentenceUnits('已经包好的公式 $x+1=2$ 不要重复包裹。');\n` +
    `if (delimitedResult.units.length !== 1) throw new Error('without <br>, punctuation must not split TTS units');\n` +
    `if (!delimitedResult.plainTtsText.includes('x加1等于2') || delimitedResult.plainTtsText.includes('$x+1=2$')) throw new Error('existing math delimiter must be converted to natural speech text');\n` +
    `const latexSpeechResult = splitScriptIntoTtsSentenceUnits('我们先算 $\\\\left( \\\\frac{1}{4}+\\\\frac{3}{8} \\\\right) \\\\div \\\\frac{1}{4}$。');\n` +
    `if (latexSpeechResult.plainTtsText.includes('\\\\left') || latexSpeechResult.plainTtsText.includes('\\\\right')) throw new Error('Aliyun TTS math text should remove left/right wrappers');\n` +
    `if (latexSpeechResult.plainTtsText.includes('\\\\div')) throw new Error('Aliyun TTS math text should normalize \\\\div');\n` +
    `if (latexSpeechResult.plainTtsText.includes('\\\\frac') || latexSpeechResult.plainTtsText.includes('$')) throw new Error('Aliyun TTS math text must not keep LaTeX or formula delimiters in speechText');\n` +
    `if (!latexSpeechResult.plainTtsText.includes('括号4分之1加8分之3括号除以4分之1')) throw new Error('Aliyun TTS math text should convert LaTeX fractions/operators to natural Chinese speech');\n` +
    `const multiBoardResult = splitScriptIntoTtsSentenceUnits('这一段不换气，<b>第一条板书</b>，继续讲生活例子，<b>第二条板书</b>。');\n` +
    `if (multiBoardResult.units.length !== 1) throw new Error('<b> must not split Aliyun TTS units');\n` +
    `if ((multiBoardResult.units[0].boardMarkerTexts || []).length !== 2) throw new Error('multiple board markers in one <br> segment should be preserved for B track');\n` +
    `const legacySample = '旧标记也兼容。\\n►先算括号：25×4=100。◄';\n` +
    `const legacyResult = splitScriptIntoTtsSentenceUnits(legacySample);\n` +
    `if (!legacyResult.units.some((unit) => unit.hasBoardMarker && unit.boardMarkerText === '先算括号：25×4=100。')) throw new Error('legacy board marker compatibility failed');\n` +
    `const normalizedDraft = normalizeScriptAgentDraft({ spokenScript: '讲解 <BR/> 这里写 <strong>rac{1}{2}</strong>', boardPlan: 'frac{3}{8}' });\n` +
    `if (!normalizedDraft.spokenScript.includes('<br>') || !normalizedDraft.spokenScript.includes('<b>\\\\frac{1}{2}</b>')) throw new Error('draft spokenScript normalization failed');\n` +
    `if (!normalizedDraft.boardPlan.includes('\\\\frac{3}{8}')) throw new Error('draft boardPlan normalization failed');\n` +
    `console.log('[script-splitter] passed', JSON.stringify(result.units, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
