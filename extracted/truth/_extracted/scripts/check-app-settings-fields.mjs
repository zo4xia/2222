import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const settingsText = read('src/components/AppSettingsDrawer.tsx');
const cosyClientText = read('src/services/cosyvoiceGatewayClient.ts');
const viteConfigText = read('vite.config.mjs');
const gatewayText = read('scripts/cosyvoice-gateway.mjs');
const contractText = read('scripts/cosyvoice-contract.mjs');

// @xiaxia-settings-hint: Guard the quiet code stickers and the real field bridge together.
for (const [fileName, text] of [
  ['src/components/AppSettingsDrawer.tsx', settingsText],
  ['src/services/cosyvoiceGatewayClient.ts', cosyClientText],
  ['vite.config.mjs', viteConfigText],
  ['scripts/cosyvoice-gateway.mjs', gatewayText],
  ['scripts/cosyvoice-contract.mjs', contractText],
  ['scripts/check-app-settings-fields.mjs', read('scripts/check-app-settings-fields.mjs')],
]) {
  assertIncludes(text, '@xiaxia-settings-hint', `${fileName} missing Xiaxia settings hint sticker`);
}

const requiredSettingPaths = [
  "name={['tts', 'format']}",
  "name={['tts', 'sampleRate']}",
  "name={['tts', 'wordTimestampEnabled']}",
  "name={['vectorKb', 'enabled']}",
  "name={['vectorKb', 'provider']}",
  "name={['vectorKb', 'endpoint']}",
  "name={['vectorKb', 'apiKeyRef']}",
  "name={['vectorKb', 'collection']}",
  "name={['vectorKb', 'embeddingModel']}",
  "name={['vectorKb', 'topK']}",
];

for (const token of requiredSettingPaths) {
  assertIncludes(settingsText, token, `settings UI missing field ${token}`);
}

for (const token of [
  'A 轨音频格式',
  'A-template / A1/B1/C1 命名合同',
  '预留配置：保存但不参与当前 Agent 请求',
  'reserved-vector-kb-config',
  'Agent 对话参数必须跟随 A-template 命名合同',
  'promptSystem、promptUserTemplate、outputContract 都只服务 rows 候选稿',
  '开场读题主身份是 A-template-open',
  'prompt/template 层同时保留 B-template-open / C-template-open 占位',
  '分析题目和梳理总结可按需要填写 C 素材候选',
  '正式步骤才用 A1/B1/C1',
  'rows 表格候选（template 命名合同）',
  '当前只允许 rows；boardSlice 只是 C 素材候选',
]) {
  assertIncludes(settingsText, token, `settings UI missing boundary copy ${token}`);
}

if (settingsText.includes('A-template/A1-B1-C1')) {
  throw new Error('settings UI must use A-template / A1/B1/C1, not A-template/A1-B1-C1.');
}

for (const token of ['format: config.format', 'sampleRate: config.sampleRate', 'wordTimestampEnabled: config.wordTimestampEnabled']) {
  assertIncludes(cosyClientText, token, `CosyVoice client does not send ${token}`);
}

for (const [fileName, text] of [
  ['vite.config.mjs', viteConfigText],
  ['scripts/cosyvoice-gateway.mjs', gatewayText],
]) {
  for (const token of [
    'const format = normalizeAudioFormat(body.format)',
    'const sampleRate = normalizeSampleRate(body.sampleRate)',
    "typeof body.wordTimestampEnabled === 'boolean' ? body.wordTimestampEnabled : true",
    'createCosyVoiceRestRequestBody({',
    'wordTimestampEnabled',
    'Only mp3/wav files are served.',
    'getAudioContentType(fileName)',
  ]) {
    assertIncludes(text, token, `${fileName} missing TTS setting propagation token ${token}`);
  }
}

for (const token of [
  'format = \'mp3\'',
  'sampleRate = 22050',
  'wordTimestampEnabled = true',
  'word_timestamp_enabled: Boolean(wordTimestampEnabled)',
]) {
  assertIncludes(contractText, token, `CosyVoice contract missing configurable token ${token}`);
}

console.log(
  JSON.stringify(
    {
      checked: 'app-settings-fields',
      cosyVoice: ['format', 'sampleRate', 'wordTimestampEnabled'],
      vectorKb: 'ui-reserved-not-runtime',
    },
    null,
    2,
  ),
);

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function assertIncludes(text, token, message) {
  if (!text.includes(token)) {
    throw new Error(message);
  }
}
