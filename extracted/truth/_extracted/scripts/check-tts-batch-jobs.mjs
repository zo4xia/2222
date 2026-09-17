import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-tts-batch-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

writeFileSync(
  checkFile,
  `import { createTtsBatchJobs } from './modules/timeline-factory/createTtsBatchJobs.js';\n\n` +
    `const units = Array.from({ length: 11 }, (_, index) => ({\n` +
    `  id: 'tts-sentence-' + String(index + 1).padStart(3, '0'),\n` +
    `  text: '第' + (index + 1) + '句。',\n` +
    `  order: index + 1,\n` +
    `  hasBoardMarker: index % 2 === 0,\n` +
    `  estimatedDurationMs: 6000,\n` +
    `}));\n` +
    `const jobs = createTtsBatchJobs(units);\n` +
    `if (jobs.length !== 3) throw new Error('expected 3 jobs, got ' + jobs.length);\n` +
    `for (const job of jobs) {\n` +
    `  if (job.sentenceIds.length < 3 || job.sentenceIds.length > 5) throw new Error('batch size out of 3-5 range: ' + job.sentenceIds.length);\n` +
    `  if (job.maxDurationMs !== 60000) throw new Error('maxDurationMs must be 60000');\n` +
    `  if (job.concurrencyLimit !== 5) throw new Error('concurrencyLimit must be 5');\n` +
    `}\n` +
    `const longUnits = units.map((unit) => ({ ...unit, estimatedDurationMs: 31000 }));\n` +
    `const longJobs = createTtsBatchJobs(longUnits);\n` +
    `for (const job of longJobs) {\n` +
    `  const total = job.sentenceIds.length * 31000;\n` +
    `  if (total > 60000) throw new Error('batch duration exceeded 60s: ' + total);\n` +
    `}\n` +
    `console.log('[tts-batch-jobs] passed', JSON.stringify(jobs, null, 2));\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
