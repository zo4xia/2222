import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-handwriting-support-check');
const checkFile = join(outDir, 'check.mjs');

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

const emittedBoardTextDisplayRoutePath = join(outDir, 'modules', 'boardSticker', 'boardTextDisplayRoute.js');
writeFileSync(
  emittedBoardTextDisplayRoutePath,
  readFileSync(emittedBoardTextDisplayRoutePath, 'utf8').replace('./mathBoardText', './mathBoardText.js'),
);

writeFileSync(
  checkFile,
  `import { resolveBoardTextDisplayRoute } from './modules/boardSticker/boardTextDisplayRoute.js';\n` +
    `import { hasBoardMath, isBoardTextSupportedByHandwritingFont } from './modules/boardSticker/mathBoardText.js';\n` +
    `const handwritingSupportedCases = [\n` +
    `  '0',\n` +
    `  '42',\n` +
    `  'Hello',\n` +
    `  'a+b=5',\n` +
    `  'y=2x+1',\n` +
    `  '函数',\n` +
    `  '函数 y=2x+1',\n` +
    `  '! " # $ % & \\' ( ) * + , - . / : ; < = > ? @ [ \\\\ ] ^ _ { | } ~',\n` +
    `  '[]{}|',\n` +
    `  'A[1]|B{2}',\n` +
    `  '25×4=100',\n` +
    `  '1200÷100=12',\n` +
    `  'f(x)=x^2+1',\n` +
    `  '函数 f(x)=x^2+1',\n` +
    `  '简单中文',\n` +
    `];\n` +
    `for (const text of handwritingSupportedCases) {\n` +
    `  if (!isBoardTextSupportedByHandwritingFont(text)) throw new Error('expected handwriting support for: ' + text);\n` +
    `}\n` +
    `const handwritingRoutes = [\n` +
    `  '42',\n` +
    `  'Hello',\n` +
    `  '函数 y=2x+1',\n` +
    `  'a+b=5',\n` +
    `  '[]{}|',\n` +
    `  'A[1]|B{2}',\n` +
    `  '25×4=100',\n` +
    `  '1200÷100=12',\n` +
    `  'f(x)=x^2+1',\n` +
    `  '函数 f(x)=x^2+1',\n` +
    `  '\\\\(f(x)=x^2+1\\\\)',\n` +
    `];\n` +
    `for (const text of handwritingRoutes) {\n` +
    `  const route = resolveBoardTextDisplayRoute(text);\n` +
    `  if (route.kind !== 'handwriting') throw new Error('expected handwriting route for: ' + text + ', got ' + route.kind);\n` +
    `}\n` +
    `const formulaRoutes = [\n` +
    `  '\\\\frac{1}{2}+\\\\frac{1}{3}',\n` +
    `  '$\\\\frac{1}{2}+\\\\frac{1}{3}$',\n` +
    `  'x_{1}=2',\n` +
    `];\n` +
    `for (const text of formulaRoutes) {\n` +
    `  const route = resolveBoardTextDisplayRoute(text);\n` +
    `  if (route.kind !== 'formula') throw new Error('expected formula route for: ' + text + ', got ' + route.kind);\n` +
    `}\n` +
    `if (!hasBoardMath('f(x)=x^2+1')) throw new Error('linear exponent text can be math-detected while still taking the C handwriting route');\n` +
    `if (!hasBoardMath('\\\\frac{1}{2}+\\\\frac{1}{3}')) throw new Error('latex fraction must still be detected as math');\n` +
    `console.log('[board-handwriting-support] passed');\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
