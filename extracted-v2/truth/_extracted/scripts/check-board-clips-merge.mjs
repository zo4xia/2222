import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-clips-merge-check');
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
  `import { applyBoardEventsToTeachingTimeline } from './modules/timeline-factory/applyBoardEventsToTeachingTimeline.js';\n` +
    `import { mapBoardEventsToTimelineClips } from './modules/timeline-factory/mapBoardEventsToTimelineClips.js';\n` +
    `import { mergeBoardClipsIntoTimelineClips } from './modules/timeline-factory/mergeBoardClipsIntoTimelineClips.js';\n\n` +
    `const existingClips = [\n` +
    `  { id: 'clip-voice-1', trackId: 'track-voice', kind: 'audio', label: '音频 1', startMs: 0, endMs: 1200 },\n` +
    `  { id: 'clip-board-001', trackId: 'track-board', kind: 'board', label: '旧生成板书', startMs: 100, endMs: 600 },\n` +
    `  { id: 'clip-board-manual-note', trackId: 'track-board', kind: 'board', label: '手工补充板书', startMs: 700, endMs: 900 },\n` +
    `  { id: 'clip-marker-1', trackId: 'track-marker', kind: 'marker', label: '<b>同步点</b>', startMs: 100, endMs: 200 },\n` +
    `];\n` +
    `const events = [\n` +
    `  { id: 'board-event-001', sentenceId: 'tts-sentence-001', text: '新板书 1', startMs: 1200, endMs: 2400, source: 'sync-marker' },\n` +
    `  { id: 'board-event-002', sentenceId: 'tts-sentence-002', text: '新板书 2', startMs: 2400, endMs: 3600, source: 'sync-marker' },\n` +
    `];\n` +
    `const generated = mapBoardEventsToTimelineClips(events);\n` +
    `const merged = mergeBoardClipsIntoTimelineClips(existingClips, generated);\n` +
    `if (!merged.some((clip) => clip.id === 'clip-voice-1' && clip.kind === 'audio')) throw new Error('audio clip must be kept');\n` +
    `if (merged.some((clip) => clip.label === '旧生成板书')) throw new Error('old generated board clip must be replaced');\n` +
    `if (!merged.some((clip) => clip.id === 'clip-board-manual-note')) throw new Error('manual board clip must be kept');\n` +
    `if (!merged.some((clip) => clip.id === 'clip-board-001' && clip.label === '新板书 1')) throw new Error('new generated board clip missing');\n` +
    `if (!merged.some((clip) => clip.sourceRef === 'tts-sentence-002')) throw new Error('sentence sourceRef must be kept');\n` +
    `const boardClipLabels = merged.filter((clip) => clip.kind === 'board').map((clip) => clip.label);\n` +
    `if (boardClipLabels.join('|') !== '手工补充板书|新板书 1|新板书 2') throw new Error('unexpected board labels: ' + boardClipLabels.join('|'));\n` +
    `const timeline = applyBoardEventsToTeachingTimeline({ tracks: [], clips: existingClips, playheadMs: 0, durationMs: 1000 }, events);\n` +
    `if (timeline.durationMs !== 3600) throw new Error('timeline duration must extend to last board clip');\n` +
    `if (!timeline.clips.some((clip) => clip.id === 'clip-voice-1')) throw new Error('timeline writeback must keep audio clip');\n` +
    `console.log('[board-clips-merge] passed', JSON.stringify(merged, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
