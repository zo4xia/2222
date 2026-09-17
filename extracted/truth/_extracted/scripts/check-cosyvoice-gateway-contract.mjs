import {
  COSYVOICE_DEFAULT_VOICE,
  COSYVOICE_MODEL,
  COSYVOICE_REST_URL,
  createCosyVoiceContinueTaskCommand,
  createCosyVoiceFinishTaskCommand,
  createCosyVoiceRestRequestBody,
  createCosyVoiceRunTaskCommand,
  createCosyVoiceSentenceRequest,
  createExpectedSentenceResultShape,
} from './cosyvoice-contract.mjs';

const sampleSentences = [
  {
    id: 'tts-sentence-001',
    text: '我们先算括号里面的乘法，25×4＝100。',
  },
  {
    id: 'tts-sentence-002',
    text: '然后计算 1200÷100=12，分数可以写成 \\frac{1}{2}。',
  },
];

const request = createCosyVoiceSentenceRequest({
  sentences: sampleSentences,
});

assertEqual(request.model, COSYVOICE_MODEL, 'model mismatch');
assertEqual(request.voice, COSYVOICE_DEFAULT_VOICE, 'voice mismatch');
assertEqual(request.sentences.length, 2, 'sentence count mismatch');

for (const expectedText of ['25×4＝100', '1200÷100=12', '\\frac{1}{2}']) {
  if (!request.sentences.some((sentence) => sentence.text.includes(expectedText))) {
    throw new Error(`math text lost: ${expectedText}`);
  }
}

const taskId = 'contract-task-id';
const runTaskCommand = createCosyVoiceRunTaskCommand({ taskId });
const configuredRunTaskCommand = createCosyVoiceRunTaskCommand({
  format: 'wav',
  sampleRate: 24000,
  taskId: 'configured-task-id',
});
const continueTaskCommand = createCosyVoiceContinueTaskCommand({
  taskId,
  text: request.sentences[0].text,
});
const finishTaskCommand = createCosyVoiceFinishTaskCommand({ taskId });

assertEqual(runTaskCommand.header.action, 'run-task', 'run-task action mismatch');
assertEqual(runTaskCommand.header.streaming, 'duplex', 'run-task streaming mismatch');
assertEqual(runTaskCommand.payload.model, COSYVOICE_MODEL, 'run-task model mismatch');
assertEqual(runTaskCommand.payload.parameters.voice, COSYVOICE_DEFAULT_VOICE, 'run-task voice mismatch');
assertEqual(runTaskCommand.payload.parameters.format, 'mp3', 'run-task format mismatch');
assertEqual(configuredRunTaskCommand.payload.parameters.format, 'wav', 'configured run-task format mismatch');
assertEqual(configuredRunTaskCommand.payload.parameters.sample_rate, 24000, 'configured run-task sample rate mismatch');
assertEqual(continueTaskCommand.header.action, 'continue-task', 'continue-task action mismatch');
assertEqual(continueTaskCommand.payload.input.text, request.sentences[0].text, 'continue-task text mismatch');
assertEqual(finishTaskCommand.header.action, 'finish-task', 'finish-task action mismatch');

const restBody = createCosyVoiceRestRequestBody({ text: request.sentences[0].text });
assertEqual(COSYVOICE_REST_URL.includes('/SpeechSynthesizer'), true, 'REST endpoint mismatch');
assertEqual(restBody.model, COSYVOICE_MODEL, 'REST model mismatch');
assertEqual(restBody.input.voice, COSYVOICE_DEFAULT_VOICE, 'REST voice mismatch');
assertEqual(restBody.input.text, request.sentences[0].text, 'REST text mismatch');
assertEqual(restBody.input.format, 'mp3', 'REST format mismatch');
assertEqual(restBody.input.word_timestamp_enabled, true, 'REST word timestamp mismatch');

const configuredRestBody = createCosyVoiceRestRequestBody({
  format: 'wav',
  sampleRate: 24000,
  text: request.sentences[1].text,
  wordTimestampEnabled: false,
});
assertEqual(configuredRestBody.input.format, 'wav', 'configured REST format mismatch');
assertEqual(configuredRestBody.input.sample_rate, 24000, 'configured REST sample rate mismatch');
assertEqual(configuredRestBody.input.word_timestamp_enabled, false, 'configured REST word timestamp mismatch');

const resultShape = createExpectedSentenceResultShape(request.sentences[0]);
assertEqual(resultShape.sentenceId, 'tts-sentence-001', 'result sentence id mismatch');
assertEqual(resultShape.status, 'pending', 'result status mismatch');

console.log(
  JSON.stringify(
    {
      checked: 'cosyvoice-gateway-contract',
      model: request.model,
      sentenceCount: request.sentences.length,
      voice: request.voice,
    },
    null,
    2,
  ),
);

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}
