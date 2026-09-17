import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cwd, exit } from 'node:process';

const root = cwd();
const required = [
  join(root, 'runtime', 'node', 'node.exe'),
  join(root, 'runtime', 'node', 'npm.cmd'),
  join(root, 'package.json'),
  join(root, 'package-lock.json'),
  join(root, 'doctor.bat'),
  join(root, 'bootstrap.bat'),
  join(root, 'prepare-runtime.bat'),
  join(root, 'install.bat'),
  join(root, 'start.bat'),
  join(root, 'build.bat'),
  join(root, 'src', 'App.tsx'),
  join(root, 'src', 'domain', 'teachingProject.ts'),
  join(root, 'src', 'config', 'defaultConfig.ts'),
  join(root, 'src', 'store', 'useTeachingEditorStore.ts'),
];

const missing = required.filter((path) => !existsSync(path));

if (missing.length > 0) {
  console.error('[cleanroom] portable check failed');
  for (const path of missing) {
    console.error(`missing: ${relative(root, path)}`);
  }
  exit(1);
}

console.log('[cleanroom] portable check passed');
