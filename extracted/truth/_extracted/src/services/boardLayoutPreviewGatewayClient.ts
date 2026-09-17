import type { AppConfig } from '../config/defaultConfig';
import type { CLayoutPreviewDraft, ScriptAgentDraftRow, StageCanvasConfig } from '../domain/teachingProject';

type BoardLayoutPreviewGatewayResponse = {
  preview?: CLayoutPreviewDraft;
  error?: {
    code: string;
    message: string;
  };
  status: 'ok' | 'failed';
};

export async function requestBoardLayoutPreview({
  config,
  problemText,
  rows,
  stageCanvas,
}: {
  config: AppConfig['scriptAgent'];
  problemText: string;
  rows: ScriptAgentDraftRow[];
  stageCanvas: StageCanvasConfig;
}): Promise<CLayoutPreviewDraft> {
  if (!rows.length) {
    throw new Error('rows 为空，无法生成排版预览。');
  }

  const response = await fetch('/api/agent/board-layout-preview', {
    body: JSON.stringify({
      config,
      problemText: problemText.trim(),
      rows,
      stageCanvas,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const payload = await readGatewayJson<BoardLayoutPreviewGatewayResponse>(response, '板书排版预览');
  if (!response.ok || payload.status !== 'ok' || !payload.preview) {
    throw new Error(payload.error?.message || `板书排版预览失败：HTTP ${response.status}`);
  }

  return normalizePreviewDraft(payload.preview);
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

function normalizePreviewDraft(preview: CLayoutPreviewDraft): CLayoutPreviewDraft {
  return {
    version: 'c-layout-preview-v1',
    generatedAt: typeof preview.generatedAt === 'string' && preview.generatedAt.trim() ? preview.generatedAt : new Date().toISOString(),
    items: Array.isArray(preview.items)
      ? preview.items.map((item, index) => ({
          id: String(item.id || `preview-item-${index + 1}`),
          rowId: String(item.rowId || ''),
          chainKey: typeof item.chainKey === 'string' ? item.chainKey : undefined,
          text: String(item.text || ''),
          xPercent: clampPercent(item.xPercent),
          yPercent: clampPercent(item.yPercent),
          widthPercent: clampPercent(item.widthPercent),
          fontSize: clampNumber(item.fontSize, 16, 120),
          groupKey: String(item.groupKey || 'ungrouped'),
          stackIndex: Number.isFinite(Number(item.stackIndex)) ? Number(item.stackIndex) : index,
        }))
      : [],
  };
}

function clampPercent(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(100, Math.max(0, n));
}

function clampNumber(value: unknown, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return min;
  }
  return Math.min(max, Math.max(min, n));
}
