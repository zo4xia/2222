import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-end-pin-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(
  join(root, 'runtime', 'node', 'node.exe'),
  [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir],
  {
    cwd: root,
    stdio: 'inherit',
  },
);

const emittedTimelineWindowPath = join(outDir, 'modules', 'timeline', 'timelineWindow.js');
writeFileSync(
  emittedTimelineWindowPath,
  readFileSync(emittedTimelineWindowPath, 'utf8'),
);

writeFileSync(
  checkFile,
  `import { isPlayheadInsideTimelineWindow, isPlayheadInsideTimelineWindowWithPinnedEnd } from './modules/timeline/timelineWindow.js';\n` +
    `if (isPlayheadInsideTimelineWindow(1000, 0, 1000) !== false) {\n` +
    `  throw new Error('base window should keep end exclusive for generic timeline checks');\n` +
    `}\n` +
    `if (isPlayheadInsideTimelineWindowWithPinnedEnd(1000, 0, 1000) !== true) {\n` +
    `  throw new Error('pinned-end window must include end frame for board visibility');\n` +
    `}\n` +
    `if (isPlayheadInsideTimelineWindowWithPinnedEnd(1001, 0, 1000) !== false) {\n` +
    `  throw new Error('pinned-end window must still reject values past end');\n` +
    `}\n` +
    `console.log('[smoke-board-end-pin-visible] passed');\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
