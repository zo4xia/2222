import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const protocolDir = join(root, 'src', 'protocols');

const protocolFiles = listTypeScriptFiles(protocolDir);

const requiredFiles = [
  'exportPackage.ts',
  'index.ts',
  'materialInput.ts',
  'performancePlan.ts',
  'scriptRow.ts',
  'stageConfig.ts',
  'voiceTiming.ts',
];

const existingRelativeFiles = new Set(protocolFiles.map((filePath) => relative(protocolDir, filePath).replaceAll('\\', '/')));
for (const requiredFile of requiredFiles) {
  if (!existingRelativeFiles.has(requiredFile)) {
    throw new Error(`Protocol Kit missing required file: ${requiredFile}`);
  }
}

const forbiddenFragments = [
  "from 'react'",
  'from "react"',
  "from 'antd'",
  'from "antd"',
  "from '../components",
  'from "../components',
  "from '../modules",
  'from "../modules',
  "from '../services",
  'from "../services',
  "from '../store",
  'from "../store',
  "from '../domain",
  'from "../domain',
  "from '../config",
  'from "../config',
  "from '../agent",
  'from "../agent',
  'Aliyun',
  'aliyun',
  'CanvasRenderingContext2D',
  'HTMLCanvasElement',
  'localStorage',
  'fetch(',
  'axios',
];

for (const filePath of protocolFiles) {
  const text = readFileSync(filePath, 'utf8');
  const relativePath = relative(root, filePath);

  if (!text.includes('@boundary: Protocol Kit')) {
    throw new Error(`Protocol file missing boundary marker: ${relativePath}`);
  }

  for (const forbiddenFragment of forbiddenFragments) {
    if (text.includes(forbiddenFragment)) {
      throw new Error(`Protocol file must stay pure and provider/UI/runtime-free: ${relativePath} contains ${forbiddenFragment}`);
    }
  }
}

const indexText = readFileSync(join(protocolDir, 'index.ts'), 'utf8');
for (const exportedType of [
  'MaterialInput',
  'ScriptRow',
  'VoiceTimingSlice',
  'DirectorCue',
  'ActorAsset',
  'PerformanceStageConfig',
  'PerformanceExportPackage',
]) {
  if (!indexText.includes(exportedType)) {
    throw new Error(`Protocol Kit public export missing ${exportedType}`);
  }
}

const performancePlanText = readFileSync(join(protocolDir, 'performancePlan.ts'), 'utf8');
if (
  !performancePlanText.includes('widthPercent?: number') ||
  !performancePlanText.includes('scale?: number') ||
  performancePlanText.indexOf('widthPercent?: number') > performancePlanText.indexOf('scale?: number')
) {
  throw new Error('ActorAsset must expose widthPercent and scale as separate contracts, with widthPercent listed before scale.');
}

const stageConfigText = readFileSync(join(protocolDir, 'stageConfig.ts'), 'utf8');
for (const slotField of ['xPercent', 'yPercent', 'widthPercent', 'heightPercent']) {
  if (!stageConfigText.includes(`${slotField}: number`)) {
    throw new Error(`StageLayoutSlot missing percent field: ${slotField}`);
  }
}

console.log('[protocol-kit-boundaries] passed');

function listTypeScriptFiles(dir) {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        return listTypeScriptFiles(fullPath);
      }
      return fullPath.endsWith('.ts') ? [fullPath] : [];
    })
    .sort();
}

