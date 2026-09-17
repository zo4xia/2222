import type { TtsSentenceResult, TtsSentenceUnit } from '../domain/teachingProject';
import type { AppConfig } from '../config/defaultConfig';

export type CosyVoiceGatewaySentenceInput = Pick<TtsSentenceUnit, 'estimatedDurationMs' | 'id' | 'order'> & {
  text: TtsSentenceUnit['speechText'];
};
export type CosyVoiceGatewayConfig = AppConfig['tts'];

export type CosyVoiceGatewayResult = TtsSentenceResult & {
  audioBytes?: number;
  requestId?: string;
  status: 'ready' | 'failed';
  text?: string;
};

export type CosyVoiceGatewayResponse = {
  model: string;
  results: CosyVoiceGatewayResult[];
  status: 'ok' | 'partial';
  voice: string;
};

const defaultGatewayUrl = '';

export async function requestCosyVoiceSentences(
  sentences: CosyVoiceGatewaySentenceInput[],
  config: CosyVoiceGatewayConfig,
): Promise<CosyVoiceGatewayResponse> {
  if (sentences.length === 0) {
    throw new Error('需要先确认口播文稿。');
  }

  const response = await fetch(resolveEndpoint(config.endpoint), {
    // @xiaxia-settings-hint: Keep this body aligned with AppSettingsDrawer tts.* and gateway normalizers.
    body: JSON.stringify({
      format: config.format,
      model: config.modelName,
      sampleRate: config.sampleRate,
      sentences,
      voice: config.voiceName,
      wordTimestampEnabled: config.wordTimestampEnabled,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload?.error?.message || `CosyVoice gateway failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return validateGatewayResponse(payload);
}

function getGatewayUrl() {
  return (import.meta.env.VITE_COSYVOICE_GATEWAY_URL || defaultGatewayUrl).replace(/\/$/, '');
}

function resolveEndpoint(endpoint: string) {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${getGatewayUrl()}${normalizedEndpoint}`;
}

function validateGatewayResponse(payload: unknown): CosyVoiceGatewayResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('CosyVoice gateway returned an invalid response.');
  }

  const response = payload as Partial<CosyVoiceGatewayResponse>;
  if (!Array.isArray(response.results)) {
    throw new Error('CosyVoice gateway response is missing results.');
  }

  return {
    model: typeof response.model === 'string' ? response.model : '',
    results: response.results.map(validateResult),
    status: response.status === 'partial' ? 'partial' : 'ok',
    voice: typeof response.voice === 'string' ? response.voice : '',
  };
}

function validateResult(result: unknown): CosyVoiceGatewayResult {
  if (!result || typeof result !== 'object') {
    throw new Error('CosyVoice gateway returned an invalid sentence result.');
  }

  const item = result as Partial<CosyVoiceGatewayResult>;
  if (typeof item.sentenceId !== 'string' || !item.sentenceId) {
    throw new Error('CosyVoice sentence result is missing sentenceId.');
  }

  return {
    audioBytes: typeof item.audioBytes === 'number' ? item.audioBytes : undefined,
    audioUrl: typeof item.audioUrl === 'string' ? item.audioUrl : '',
    durationMs: typeof item.durationMs === 'number' ? item.durationMs : 0,
    error: typeof item.error === 'string' ? item.error : undefined,
    requestId: typeof item.requestId === 'string' ? item.requestId : undefined,
    sentenceId: item.sentenceId,
    status: item.status === 'failed' ? 'failed' : 'ready',
    text: typeof item.text === 'string' ? item.text : undefined,
    timingJson: typeof item.timingJson === 'string' ? item.timingJson : '',
  };
}
