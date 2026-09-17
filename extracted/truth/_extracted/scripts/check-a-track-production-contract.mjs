import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const scriptRowsOutputText = readFileSync(join(root, 'src', 'modules', 'aTrackProduction', 'scriptRowsOutput.ts'), 'utf8');
const aTrackIndexText = readFileSync(join(root, 'src', 'modules', 'aTrackProduction', 'index.ts'), 'utf8');
const domainText = readFileSync(join(root, 'src', 'domain', 'teachingProject.ts'), 'utf8');
const protocolIndexText = readFileSync(join(root, 'src', 'protocols', 'index.ts'), 'utf8');

if (!scriptRowsOutputText.includes('@boundary: A Track Production Kit script rows output only')) {
  throw new Error('A Track script rows output must keep its boundary marker.');
}

for (const requiredText of [
  "import type { ScriptRow, ScriptRowDraft } from '../../protocols'",
  'normalizeScriptAgentTableRows',
  'createATrackScriptRowsOutput',
  'createATrackScriptRowsOutputFromDraft',
  'toProtocolScriptRow',
]) {
  if (!scriptRowsOutputText.includes(requiredText)) {
    throw new Error(`A Track script rows output missing required bridge text: ${requiredText}`);
  }
}

for (const forbiddenText of [
  'splitScriptIntoTtsSentenceUnits',
  'createBoardEventsFromTtsUnits',
  'applyBoardEventsToTeachingTimeline',
  'renderBoardTextStickerImage',
  'Canvas',
  'Aliyun',
  'aliyun',
  '<br>',
  '<b>',
  'voiceAudio',
  'voiceTiming',
]) {
  if (scriptRowsOutputText.includes(forbiddenText)) {
    throw new Error(`A Track script rows output must not cross into TTS, B/C, Canvas, or legacy compiler concerns: ${forbiddenText}`);
  }
}

if (!aTrackIndexText.includes('createATrackScriptRowsOutput') || !aTrackIndexText.includes('ATrackScriptRowsOutput')) {
  throw new Error('A Track Production public index must expose the script rows control output.');
}

if (!domainText.includes("import type { ScriptRow } from '../protocols'")) {
  throw new Error('ScriptAgentDraftRow must be type-anchored to Protocol ScriptRow.');
}

for (const requiredDomainAnchor of ["id: ScriptRow['id']", "voiceText: ScriptRow['voiceText']"]) {
  if (!domainText.includes(requiredDomainAnchor)) {
    throw new Error(`ScriptAgentDraftRow missing Protocol ScriptRow anchor: ${requiredDomainAnchor}`);
  }
}

for (const exportedProtocolType of ['ScriptRow', 'ScriptRowDraft']) {
  if (!protocolIndexText.includes(exportedProtocolType)) {
    throw new Error(`Protocol Kit public index must export ${exportedProtocolType}`);
  }
}

console.log('[a-track-production-contract] passed');

