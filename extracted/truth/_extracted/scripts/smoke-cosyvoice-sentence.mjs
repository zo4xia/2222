import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COSYVOICE_DEFAULT_VOICE,
  COSYVOICE_MODEL,
  COSYVOICE_REST_URL,
  createCosyVoiceRestRequestBody,
} from './cosyvoice-contract.mjs';
import { loadLocalEnv } from './load-local-env.mjs';

loadLocalEnv();
const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  throw new Error('DASHSCOPE_API_KEY is required in process.env or .env.local.');
}

const smokeModel = process.env.COSYVOICE_SMOKE_MODEL || COSYVOICE_MODEL;
const smokeVoice = process.env.COSYVOICE_SMOKE_VOICE || COSYVOICE_DEFAULT_VOICE;
const sentence = process.argv.slice(2).join(' ').trim() || '我们先算括号里面的乘法，25×4＝100。';
const outputDir = join(process.cwd(), '.tmp-cosyvoice-smoke');
const fileStamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = join(outputDir, `cosyvoice-${fileStamp}.mp3`);
const providerDebugFile = join(outputDir, `cosyvoice-${fileStamp}.provider-response.txt`);
const timingFile = join(outputDir, `cosyvoice-${fileStamp}.timing.json`);

mkdirSync(outputDir, { recursive: true });

const startedAt = Date.now();
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 90000);

const response = await fetch(COSYVOICE_REST_URL, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-DashScope-SSE': 'enable',
  },
  body: JSON.stringify(
    createCosyVoiceRestRequestBody({
      model: smokeModel,
      text: sentence,
      voice: smokeVoice,
    }),
  ),
  signal: controller.signal,
}).finally(() => clearTimeout(timeout));

const providerText = await response.text();
if (!response.ok) {
  throw new Error(`CosyVoice REST failed: HTTP ${response.status} ${sanitizeProviderText(providerText)}`.trim());
}

const parsed = parseProviderEvents(providerText);
if (!parsed.audioUrl) {
  writeFileSync(providerDebugFile, sanitizeProviderText(providerText));
  throw new Error(`CosyVoice REST returned no audio URL; requestId=${parsed.requestId || 'unknown'}`);
}

const audioResponse = await fetch(parsed.audioUrl);
if (!audioResponse.ok) {
  throw new Error(`CosyVoice audio download failed: HTTP ${audioResponse.status}`);
}

const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
if (audioBuffer.length === 0) {
  throw new Error('CosyVoice returned no audio bytes.');
}

writeFileSync(outputFile, audioBuffer);
writeFileSync(
  timingFile,
  JSON.stringify(
    {
      audio: {
        expiresAt: parsed.expiresAt,
        id: parsed.audioId,
        url: parsed.audioUrl,
      },
      model: smokeModel,
      requestId: parsed.requestId,
      sentence,
      sentences: parsed.sentences,
      usage: {
        characters: parsed.characters,
      },
      voice: smokeVoice,
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      audioBytes: audioBuffer.length,
      model: smokeModel,
      outputFile,
      requestId: parsed.requestId,
      sentenceCount: 1,
      sentenceTimingCount: parsed.sentences.length,
      status: 'ok',
      timingFile,
      tookMs: Date.now() - startedAt,
      voice: smokeVoice,
    },
    null,
    2,
  ),
);

function parseProviderEvents(rawText) {
  const result = {
    audioId: '',
    audioUrl: '',
    characters: undefined,
    expiresAt: undefined,
    requestId: '',
    sentences: [],
  };
  const sentenceMap = new Map();

  for (const payload of parseEventPayloads(rawText)) {
    result.requestId = payload.request_id || payload.requestId || result.requestId;
    result.characters = payload.usage?.characters ?? result.characters;

    const output = payload.output || {};
    const audio = output.audio || {};
    if (typeof audio.url === 'string' && audio.url) {
      result.audioUrl = audio.url;
    }
    if (typeof audio.id === 'string' && audio.id) {
      result.audioId = audio.id;
    }
    if (typeof audio.expires_at === 'number') {
      result.expiresAt = audio.expires_at;
    }

    const sentencePayload = output.sentence;
    if (sentencePayload && typeof sentencePayload.index === 'number') {
      const existing = sentenceMap.get(sentencePayload.index) || {
        index: sentencePayload.index,
        originalText: output.original_text || '',
        words: [],
      };

      if (output.original_text && !existing.originalText) {
        existing.originalText = output.original_text;
      }

      if (Array.isArray(sentencePayload.words)) {
        existing.words = sentencePayload.words.map((word) => ({
          beginIndex: Number(word.begin_index || 0),
          beginTime: Number(word.begin_time || 0),
          endIndex: Number(word.end_index || 0),
          endTime: Number(word.end_time || 0),
          text: String(word.text || ''),
        }));
      }

      sentenceMap.set(sentencePayload.index, existing);
    }
  }

  result.sentences = Array.from(sentenceMap.values()).sort((first, second) => first.index - second.index);
  return result;
}

function parseEventPayloads(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('{')) {
    return [JSON.parse(trimmed)];
  }

  const payloads = [];
  for (const line of rawText.split(/\r?\n/)) {
    if (!line.startsWith('data:')) {
      continue;
    }

    const data = line.slice('data:'.length).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    payloads.push(JSON.parse(data));
  }

  return payloads;
}

function sanitizeProviderText(text) {
  return text.replaceAll(apiKey, '[REDACTED]').slice(0, 600);
}
