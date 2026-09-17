import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-events-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

patchEmittedImport(join(outDir, 'modules', 'timeline-factory', 'createBoardEventsFromTtsUnits.js'), [
  ['../abcChain/abcChainKey', '../abcChain/abcChainKey.js'],
  ['./types', './types.js'],
]);
patchEmittedImport(join(outDir, 'modules', 'abcChain', 'abcChainKey.js'), [
  ['../../domain/globalRules', '../../domain/globalRules.js'],
]);
patchEmittedImport(join(outDir, 'modules', 'timeline-factory', 'orderTtsSentenceResults.js'), [
  ['./types', './types.js'],
]);

writeFileSync(
  checkFile,
  `import { createBoardEventsFromTtsUnits } from './modules/timeline-factory/createBoardEventsFromTtsUnits.js';\n` +
    `import { filterTtsUnitsBySentenceResults, sortTtsSentenceResultsBySentenceOrder } from './modules/timeline-factory/orderTtsSentenceResults.js';\n\n` +
    `const units = [\n` +
    `  { id: 'tts-sentence-001', text: '同学你好。', order: 1, hasBoardMarker: false, estimatedDurationMs: 1000 },\n` +
    `  { chainKey: 'step-1', id: 'tts-sentence-002', text: '先算括号：25×4=100。', order: 2, hasBoardMarker: true, boardMarkerText: '先算括号：25×4=100。', estimatedDurationMs: 2200 },\n` +
    `  { chainKey: 'step-2', id: 'tts-sentence-003', text: '再算除法：1200÷100=12。', order: 3, hasBoardMarker: true, boardMarkerText: '再算除法：1200÷100=12。', estimatedDurationMs: 2600 },\n` +
    `];\n` +
    `const results = [\n` +
    `  { sentenceId: 'tts-sentence-001', audioUrl: 'memory://audio-1.mp3', timingJson: '{}', durationMs: 1200 },\n` +
    `  { sentenceId: 'tts-sentence-002', audioUrl: 'memory://audio-2.mp3', timingJson: '{}', durationMs: 2400 },\n` +
    `  { sentenceId: 'tts-sentence-003', audioUrl: 'memory://audio-3.mp3', timingJson: '{}', durationMs: 2800 },\n` +
    `];\n` +
    `const events = createBoardEventsFromTtsUnits(units, results);\n` +
    `if (events.length !== 2) throw new Error('expected 2 board events, got ' + events.length);\n` +
    `if (events[0].sentenceId !== 'tts-sentence-002') throw new Error('first board event should follow sentence 2');\n` +
    `if (events[0].chainKey !== 'step-1' || events[1].chainKey !== 'step-2') throw new Error('board events must keep unit chainKey');\n` +
    `if (events[0].startMs !== 1200 || events[0].endMs !== 3600) throw new Error('sentence 2 timing mismatch');\n` +
    `if (events[1].startMs !== 3600 || events[1].endMs !== 6400) throw new Error('sentence 3 timing mismatch');\n` +
    `if (events.some((event) => /<\\/?b>/i.test(event.text) || event.text.includes('►') || event.text.includes('◄') || event.text.includes('.......'))) throw new Error('board event text must not include sync marker wrappers');\n` +
    `if (events.some((event) => event.source !== 'sync-marker')) throw new Error('board event source must be sync-marker');\n` +
    `const outOfOrderResults = [results[2], results[0], results[1]];\n` +
    `const outOfOrderEvents = createBoardEventsFromTtsUnits(units, outOfOrderResults);\n` +
    `if (outOfOrderEvents[0].startMs !== 1200 || outOfOrderEvents[0].endMs !== 3600) throw new Error('sentence 2 timing must follow unit order when TTS results are out of order');\n` +
    `if (outOfOrderEvents[1].startMs !== 3600 || outOfOrderEvents[1].endMs !== 6400) throw new Error('sentence 3 timing must follow unit order when TTS results are out of order');\n` +
    `const sortedResults = sortTtsSentenceResultsBySentenceOrder(outOfOrderResults);\n` +
    `if (sortedResults.map((result) => result.sentenceId).join(',') !== 'tts-sentence-001,tts-sentence-002,tts-sentence-003') throw new Error('A clips must consume ready TTS results in sentence order');\n` +
    `const partialReadyResults = sortTtsSentenceResultsBySentenceOrder([results[2], results[1]]);\n` +
    `const partialReadyUnits = filterTtsUnitsBySentenceResults(units, partialReadyResults);\n` +
    `const partialEvents = createBoardEventsFromTtsUnits(partialReadyUnits, partialReadyResults);\n` +
    `if (partialEvents[0].startMs !== 0 || partialEvents[0].endMs !== 2400) throw new Error('partial ready stream must not reserve failed sentence 1 before board event 2');\n` +
    `if (partialEvents[1].startMs !== 2400 || partialEvents[1].endMs !== 5200) throw new Error('partial ready stream must keep board event 3 aligned after ready sentence 2');\n` +
    `console.log('[board-events] passed', JSON.stringify(events, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });

function patchEmittedImport(filePath, replacements) {
  let text = readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    text = text.replaceAll(from, to);
  }
  writeFileSync(filePath, text);
}
