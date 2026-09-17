import { randomUUID } from 'node:crypto';

export const COSYVOICE_MODEL = 'cosyvoice-v3-flash';
export const COSYVOICE_CLONE_MODEL = 'cosyvoice-v3.5-flash';
export const COSYVOICE_DEFAULT_VOICE = 'longanyang';
export const COSYVOICE_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
export const COSYVOICE_REST_URL = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer';

export function createCosyVoiceRunTaskCommand({
  format = 'mp3',
  sampleRate = 22050,
  taskId = randomUUID(),
  model = COSYVOICE_MODEL,
  voice = COSYVOICE_DEFAULT_VOICE,
} = {}) {
  return {
    header: {
      action: 'run-task',
      task_id: taskId,
      streaming: 'duplex',
    },
    payload: {
      task_group: 'audio',
      task: 'tts',
      function: 'SpeechSynthesizer',
      model,
      parameters: {
        text_type: 'PlainText',
        voice,
        format,
        sample_rate: sampleRate,
        volume: 50,
        rate: 1,
        pitch: 1,
      },
      input: {},
    },
  };
}

export function createCosyVoiceContinueTaskCommand({ taskId, text }) {
  if (!taskId) {
    throw new Error('taskId is required');
  }
  if (!text?.trim()) {
    throw new Error('text is required');
  }

  return {
    header: {
      action: 'continue-task',
      task_id: taskId,
      streaming: 'duplex',
    },
    payload: {
      input: {
        text,
      },
    },
  };
}

export function createCosyVoiceFinishTaskCommand({ taskId }) {
  if (!taskId) {
    throw new Error('taskId is required');
  }

  return {
    header: {
      action: 'finish-task',
      task_id: taskId,
      streaming: 'duplex',
    },
    payload: {
      input: {},
    },
  };
}

export function createCosyVoiceSentenceRequest({
  sentences,
  model = COSYVOICE_MODEL,
  voice = COSYVOICE_DEFAULT_VOICE,
}) {
  const normalizedSentences = sentences.map((sentence, index) => {
    const id = sentence.id || `tts-sentence-${String(index + 1).padStart(3, '0')}`;
    const text = sentence.text?.trim();

    if (!text) {
      throw new Error(`sentence ${id} text is required`);
    }

    return {
      id,
      order: index + 1,
      text,
    };
  });

  return {
    model,
    voice,
    sentences: normalizedSentences,
  };
}

// @xiaxia-settings-hint: CosyVoice REST body contract for settings UI; protected by check-cosyvoice-gateway-contract and check-app-settings-fields.
export function createCosyVoiceRestRequestBody({
  text,
  model = COSYVOICE_MODEL,
  voice = COSYVOICE_DEFAULT_VOICE,
  format = 'mp3',
  sampleRate = 22050,
  rate = 1,
  wordTimestampEnabled = true,
}) {
  if (!text?.trim()) {
    throw new Error('text is required');
  }

  return {
    model,
    input: {
      format,
      rate,
      sample_rate: sampleRate,
      text: text.trim(),
      voice,
      word_timestamp_enabled: Boolean(wordTimestampEnabled),
    },
  };
}

export function createExpectedSentenceResultShape(sentence) {
  return {
    audioFile: undefined,
    durationMs: undefined,
    error: undefined,
    sentenceId: sentence.id,
    status: 'pending',
    timingJson: undefined,
  };
}
