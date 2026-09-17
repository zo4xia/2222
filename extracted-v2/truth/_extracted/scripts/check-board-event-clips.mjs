import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-event-clips-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

const emittedMapBoardEventsPath = join(outDir, 'modules', 'timeline-factory', 'mapBoardEventsToTimelineClips.js');
writeFileSync(
  emittedMapBoardEventsPath,
  readFileSync(emittedMapBoardEventsPath, 'utf8').replace("../boardReveal/boardRevealConfig", "../boardReveal/boardRevealConfig.js"),
);

writeFileSync(
  checkFile,
  `import { mapBoardEventsToTimelineClips } from './modules/timeline-factory/mapBoardEventsToTimelineClips.js';\n\n` +
    `const events = [\n` +
    `  { chainKey: 'step-1', id: 'board-event-002', sentenceId: 'tts-sentence-002', text: '先算括号：25×4=100。', startMs: 1200, endMs: 3600, source: 'sync-marker' },\n` +
    `  { chainKey: 'step-2', id: 'board-event-003', sentenceId: 'tts-sentence-003', text: '再算除法：1200÷100=12。', startMs: 3600, endMs: 6400, source: 'sync-marker' },\n` +
    `];\n` +
    `const clips = mapBoardEventsToTimelineClips(events);\n` +
    `if (clips.length !== 2) throw new Error('expected 2 clips, got ' + clips.length);\n` +
    `if (clips.some((clip) => clip.kind !== 'board')) throw new Error('all clips must be board kind');\n` +
    `if (clips.some((clip) => clip.trackId !== 'track-board')) throw new Error('all clips must target track-board');\n` +
    `if (clips[0].label !== events[0].text) throw new Error('label must come from board event text');\n` +
    `if (clips[0].sourceRef !== 'tts-sentence-002') throw new Error('sourceRef must keep sentence id');\n` +
    `if (clips[0].chainKey !== 'step-1' || clips[1].chainKey !== 'step-2') throw new Error('chainKey must flow from board event to timeline clip');\n` +
    `if (clips[1].startMs !== 3600 || clips[1].endMs !== 6400) throw new Error('timing mismatch');\n` +
    `if (clips[0].sourceStartMs !== events[0].startMs || clips[0].sourceEndMs !== events[0].endMs) throw new Error('A source fields must come from board event timing');\n` +
    `if (clips[0].revealStartMs !== events[0].startMs || clips[0].revealEndMs !== events[0].endMs) throw new Error('initial C reveal window must match A source timing');\n` +
    `const custom = mapBoardEventsToTimelineClips(events, { trackId: 'custom-board', clipIdPrefix: 'board-candidate' });\n` +
    `if (custom[0].trackId !== 'custom-board') throw new Error('custom track id not applied');\n` +
    `if (!custom[0].id.startsWith('board-candidate-')) throw new Error('custom clip prefix not applied');\n` +
    `console.log('[board-event-clips] passed', JSON.stringify(clips, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
