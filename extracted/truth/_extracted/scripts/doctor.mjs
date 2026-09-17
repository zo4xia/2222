import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { cwd, env, exit, versions } from 'node:process';

const root = cwd();
const failures = [];
const warnings = [];

const rel = (path) => relative(root, path) || '.';
const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);

function mustExist(path, label) {
  if (!existsSync(path)) {
    fail(`${label} missing: ${rel(path)}`);
  }
}

function walkFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
      walkFiles(full, files);
      continue;
    }
    files.push(full);
  }
  return files;
}

function checkRequiredFiles() {
  mustExist(join(root, '.npmrc'), 'local npm config');
  mustExist(join(root, 'package.json'), 'project manifest');
  mustExist(join(root, 'package-lock.json'), 'dependency lockfile');
  mustExist(join(root, 'src', 'domain', 'teachingProject.ts'), 'project truth model');
  mustExist(join(root, 'src', 'config', 'defaultConfig.ts'), 'config truth');
  mustExist(join(root, 'src', 'store', 'useTeachingEditorStore.ts'), 'store truth');
  mustExist(join(root, 'SURVIVAL_BASE.md'), 'survival base document');
  mustExist(join(root, 'PROJECT_POSITIONING.md'), 'project positioning document');
  mustExist(join(root, 'PROJECT_REUSE_EVALUATION.md'), 'project reuse evaluation document');
  mustExist(join(root, 'UI_FRAMEWORK_DECISION.md'), 'UI framework decision document');
  mustExist(join(root, 'QUALITY_BASE.md'), 'quality base document');
  mustExist(join(root, 'HUMAN_CONTEXT.md'), 'human context document');
  mustExist(join(root, 'TECH_DEBT_LOG.md'), 'technical debt log');
  mustExist(join(root, 'install.bat'), 'portable install launcher');
  mustExist(join(root, 'start.bat'), 'portable start launcher');
  mustExist(join(root, 'start-dev.bat'), 'detached dev server launcher');
  mustExist(join(root, 'start-window.bat'), 'visible dev server launcher');
  mustExist(join(root, 'status-dev.bat'), 'dev server status launcher');
  mustExist(join(root, 'stop-dev.bat'), 'dev server stop launcher');
  mustExist(join(root, 'build.bat'), 'portable build launcher');
  mustExist(join(root, 'doctor.bat'), 'survival doctor launcher');
  mustExist(join(root, 'bootstrap.bat'), 'survival bootstrap launcher');
  mustExist(join(root, 'prepare-runtime.bat'), 'runtime prepare launcher');
}

function checkNodeRuntime() {
  const major = Number.parseInt(versions.node.split('.')[0], 10);
  if (Number.isNaN(major) || major < 20) {
    fail(`current node must be >=20, got ${versions.node}`);
  }

  const localNode = join(root, 'runtime', 'node', 'node.exe');
  const localNpm = join(root, 'runtime', 'node', 'npm.cmd');
  if (!existsSync(localNode) || !existsSync(localNpm)) {
    warn('portable runtime missing: runtime/node/node.exe and runtime/node/npm.cmd');
  }

  const pathParts = (env.Path || env.PATH || '').split(';').filter(Boolean);
  const roamingNpm = pathParts.filter((part) => /AppData\\Roaming\\npm/i.test(part));
  if (roamingNpm.length > 0) {
    warn(`system PATH still contains old npm global path, but cleanroom launchers prepend runtime/node and .npmrc keeps npm cache local: ${roamingNpm.join(', ')}`);
  }

  const npmrc = join(root, '.npmrc');
  if (existsSync(npmrc)) {
    const npmrcText = readFileSync(npmrc, 'utf8');
    if (!/^cache=\.npm-cache$/m.test(npmrcText)) {
      fail('local .npmrc must keep npm cache inside project: cache=.npm-cache');
    }
  }
}

function checkNoParentDependency() {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const scripts = packageJson.scripts || {};
  for (const [name, command] of Object.entries(scripts)) {
    if (command.includes('..')) {
      fail(`script ${name} references parent directory: ${command}`);
    }
  }
}

function checkHardcodedMachinePaths() {
  const scannedRoots = [join(root, 'src'), join(root, 'scripts'), join(root, 'tool')];
  const extraFiles = [
    'package.json',
    '.npmrc',
    '.gitignore',
    'README.md',
    'PORTABLE_CONTRACT.md',
    'SURVIVAL_BASE.md',
    'PROJECT_POSITIONING.md',
    'PROJECT_REUSE_EVALUATION.md',
    'UI_FRAMEWORK_DECISION.md',
    'QUALITY_BASE.md',
    'HUMAN_CONTEXT.md',
    'TECH_DEBT_LOG.md',
    'install.bat',
    'start.bat',
    'start-dev.bat',
    'start-window.bat',
    'status-dev.bat',
    'stop-dev.bat',
    'build.bat',
    'doctor.bat',
    'bootstrap.bat',
    'prepare-runtime.bat',
  ];
  const files = [
    ...scannedRoots.flatMap((dir) => walkFiles(dir)),
    ...extraFiles.map((file) => join(root, file)).filter((file) => existsSync(file)),
  ];

  const forbidden = [
    /[A-Z]:\\Users\\Administrator/i,
    /[A-Z]:\\nvm/i,
    /[A-Z]:\\code\\room/i,
    /[A-Z]:\\Users\\Admin/i,
    /\.\.\\node_modules/i,
    /\.\.\/node_modules/i,
  ];

  for (const file of files) {
    let text = '';
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        fail(`hardcoded path pattern ${pattern} found in ${rel(file)}`);
      }
    }
  }
}

function checkNodeModulesLocal() {
  const nodeModules = join(root, 'node_modules');
  if (!existsSync(nodeModules)) {
    warn('node_modules missing: run install.bat or npm install');
    return;
  }
  const real = resolve(nodeModules);
  if (!real.startsWith(resolve(root) + sep)) {
    fail(`node_modules is not inside project root: ${real}`);
  }
  try {
    const packageCount = readdirSync(nodeModules).length;
    if (packageCount === 0 || statSync(nodeModules).size < 0) {
      warn('node_modules exists but looks empty');
    }
  } catch {
    warn('node_modules exists but cannot be read');
  }
}

checkRequiredFiles();
checkNodeRuntime();
checkNoParentDependency();
checkHardcodedMachinePaths();
checkNodeModulesLocal();

console.log('[cleanroom doctor] root:', root);
console.log('[cleanroom doctor] node:', versions.node);

if (warnings.length > 0) {
  console.log('\nWarnings:');
  for (const message of warnings) console.log(`- ${message}`);
}

if (failures.length > 0) {
  console.error('\nFailures:');
  for (const message of failures) console.error(`- ${message}`);
  exit(1);
}

console.log('\n[cleanroom doctor] survival base passed');
