import type { AppConfig } from '../config/defaultConfig';
import type { ScriptAgentDraft } from '../domain/teachingProject';
import { normalizeScriptAgentDraft } from '../modules/scriptAgentDraft';

type ScriptAgentGatewayResponse = {
  draft?: ScriptAgentDraft;
  error?: {
    code: string;
    message: string;
  };
  model?: string;
  requestId?: string;
  status: 'ok' | 'failed';
};

export async function requestScriptAgentDraft({
  config,
  problemText,
  revisionPrompt,
}: {
  config: AppConfig['scriptAgent'];
  problemText: string;
  revisionPrompt: string;
}): Promise<ScriptAgentDraft> {
  const normalizedProblemText = problemText.trim();
  if (!normalizedProblemText) {
    throw new Error('需要先确认题文。');
  }

  const response = await fetch('/api/agent/script-board', {
    body: JSON.stringify({
      config,
      problemText: normalizedProblemText,
      revisionPrompt: revisionPrompt.trim(),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await readGatewayJson<ScriptAgentGatewayResponse>(response, 'Agent');
  if (!response.ok || payload.status !== 'ok' || !payload.draft) {
    throw new Error(payload.error?.message || `Agent 请求失败：HTTP ${response.status}`);
  }

  return normalizeScriptAgentDraft(payload.draft);
}

async function readGatewayJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`${label}接口返回空内容：HTTP ${response.status}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}接口返回非 JSON 内容：HTTP ${response.status}`);
  }
}
