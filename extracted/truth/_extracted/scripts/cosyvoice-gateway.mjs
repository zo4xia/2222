import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
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

const host = process.env.COSYVOICE_GATEWAY_HOST || '127.0.0.1';
const port = Number(process.env.COSYVOICE_GATEWAY_PORT || 8787);
const outputDir = join(process.cwd(), '.tmp-cosyvoice-smoke');
mkdirSync(outputDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    setCorsHeaders(response);

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url || '/', `http://${host}:${port}`);
    if (request.method === 'GET' && url.pathname.startsWith('/api/tts/cosyvoice/audio/')) {
      serveAudio(url.pathname, response);
      return;
    }

    if (request.method !== 'POST' || url.pathname !== '/api/tts/cosyvoice/sentences') {
      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } });
      return;
    }

    const body = await readJsonBody(request);
    const sentences = validateSentences(body.sentences);
    // @xiaxia-settings-hint: Aliyun A-track settings bridge; keep in sync with vite.config.mjs.
    const format = normalizeAudioFormat(body.format);
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : COSYVOICE_MODEL;
    const sampleRate = normalizeSampleRate(body.sampleRate);
    const voice = typeof body.voice === 'string' && body.voice.trim() ? body.voice.trim() : COSYVOICE_DEFAULT_VOICE;
    const wordTimestampEnabled = typeof body.wordTimestampEnabled === 'boolean' ? body.wordTimestampEnabled : true;
    const results = [];

    for (const sentence of sentences) {
      results.push(await synthesizeSentence({ format, model, sampleRate, sentence, voice, wordTimestampEnabled }));
    }

    sendJson(response, 200, {
      format,
      model,
      results,
      sampleRate,
      status: results.every((result) => result.status === 'ready') ? 'ok' : 'partial',
      voice,
      wordTimestampEnabled,
    });
  } catch (error) {
    sendJson(response, 500, {
      error: {
        code: 'COSYVOICE_GATEWAY_ERROR',
        message: sanitizeProviderText(error instanceof Error ? error.message : String(error)),
      },
    });
  }
});

server.listen(port, host, () => {
  console.log(`[cosyvoice-gateway] listening http://${host}:${port}`);
});

async function synthesizeSentence({ format, model, sampleRate, sentence, voice, wordTimestampEnabled }) {
  try {
    const providerResponse = await fetch(COSYVOICE_REST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable',
      },
      body: JSON.stringify(
        // @xiaxia-settings-hint: Last local hop before DashScope; do not drop format/sampleRate/wordTimestampEnabled.
        createCosyVoiceRestRequestBody({
          format,
          model,
          sampleRate,
          text: sentence.text,
          voice,
          wordTimestampEnabled,
        }),
      ),
    });

    const providerText = await providerResponse.text();
    if (!providerResponse.ok) {
      return {
        durationMs: sentence.estimatedDurationMs || 1200,
        error: `HTTP ${providerResponse.status} ${sanitizeProviderText(providerText)}`.trim(),
        sentenceId: sentence.id,
        status: 'failed',
        text: sentence.text,
        timingJson: '',
      };
    }

    const parsed = parseProviderEvents(providerText);
    if (!parsed.audioUrl) {
      return {
        durationMs: sentence.estimatedDurationMs || 1200,
        error: `No audio URL returned; requestId=${parsed.requestId || 'unknown'}`,
        requestId: parsed.requestId,
        sentenceId: sentence.id,
        status: 'failed',
        text: sentence.text,
        timingJson: JSON.stringify(parsed),
      };
    }

    const audioResponse = await fetch(parsed.audioUrl);
    if (!audioResponse.ok) {
      return {
        durationMs: sentence.estimatedDurationMs || parsed.durationMs || 1200,
        error: `Audio download failed: HTTP ${audioResponse.status}`,
        requestId: parsed.requestId,
        sentenceId: sentence.id,
        status: 'failed',
        text: sentence.text,
        timingJson: JSON.stringify(parsed),
      };
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
    const fileName = `${safeFilePart(sentence.id)}-${Date.now()}.${format}`;
    const outputFile = join(outputDir, fileName);
    writeFileSync(outputFile, audioBuffer);

    return {
      audioBytes: audioBuffer.length,
      audioUrl: `http://${host}:${port}/api/tts/cosyvoice/audio/${fileName}`,
      durationMs: parsed.durationMs || sentence.estimatedDurationMs || 1200,
      requestId: parsed.requestId,
      sentenceId: sentence.id,
      status: 'ready',
      text: sentence.text,
      timingJson: JSON.stringify(parsed),
    };
  } catch (error) {
    return {
      durationMs: sentence.estimatedDurationMs || 1200,
      error: sanitizeProviderText(error instanceof Error ? error.message : String(error)),
      sentenceId: sentence.id,
      status: 'failed',
      text: sentence.text,
      timingJson: '',
    };
  }
}

function validateSentences(sentences) {
  if (!Array.isArray(sentences) || sentences.length === 0) {
    throw new Error('sentences must be a non-empty array.');
  }

  return sentences.map((sentence, index) => {
    const id = typeof sentence.id === 'string' && sentence.id.trim() ? sentence.id.trim() : `tts-sentence-${String(index + 1).padStart(3, '0')}`;
    const text = typeof sentence.text === 'string' ? sentence.text.trim() : '';
    if (!text) {
      throw new Error(`sentence ${id} text is required.`);
    }

    return {
      estimatedDurationMs: Number(sentence.estimatedDurationMs) || undefined,
      id,
      order: Number(sentence.order) || index + 1,
      text,
    };
  });
}

function normalizeAudioFormat(format) {
  return format === 'wav' ? 'wav' : 'mp3';
}

function normalizeSampleRate(sampleRate) {
  const value = Number(sampleRate);
  if (!Number.isFinite(value)) {
    return 22050;
  }
  return Math.min(48000, Math.max(8000, Math.round(value)));
}

function parseProviderEvents(rawText) {
  const result = {
    audioId: '',
    audioUrl: '',
    characters: undefined,
    durationMs: 0,
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
  result.durationMs = result.sentences.reduce((max, sentence) => {
    const sentenceEnd = sentence.words.reduce((wordMax, word) => Math.max(wordMax, word.endTime), 0);
    return Math.max(max, sentenceEnd);
  }, 0);
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

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody.trim()) {
    return {};
  }
  return JSON.parse(rawBody);
}

function serveAudio(pathname, response) {
  const fileName = basename(decodeURIComponent(pathname.split('/').pop() || ''));
  if (!fileName.endsWith('.mp3') && !fileName.endsWith('.wav')) {
    sendJson(response, 400, { error: { code: 'INVALID_AUDIO_FILE', message: 'Only mp3/wav files are served.' } });
    return;
  }

  try {
    const audioBuffer = readFileSync(join(outputDir, fileName));
    response.writeHead(200, {
      'Content-Length': audioBuffer.length,
      'Content-Type': getAudioContentType(fileName),
    });
    response.end(audioBuffer);
  } catch {
    sendJson(response, 404, { error: { code: 'AUDIO_NOT_FOUND', message: 'Audio file not found.' } });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function getAudioContentType(fileName) {
  return fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
}

function safeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 48);
}

function sanitizeProviderText(text) {
  return String(text).replaceAll(apiKey, '[REDACTED]').slice(0, 800);
}
