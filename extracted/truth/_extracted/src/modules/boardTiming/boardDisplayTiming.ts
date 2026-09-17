export type BoardDisplayWindowPatch = {
  endMs?: number;
  startMs?: number;
};

export type BoardDisplayTimingDragMode = 'end' | 'range' | 'start';

export function normalizeBoardDisplayWindow({
  endMs,
  minDurationMs = 100,
  startMs,
}: {
  endMs: number;
  minDurationMs?: number;
  startMs: number;
}): Required<BoardDisplayWindowPatch> {
  const safeStartMs = Math.max(0, startMs);

  return {
    endMs: Math.max(safeStartMs + minDurationMs, endMs),
    startMs: safeStartMs,
  };
}

export function createBoardDisplayTimingDragPatch({
  currentClientX,
  durationMs,
  laneWidth,
  minDurationMs = 100,
  mode,
  originEndMs,
  originStartMs,
  pointerX,
}: {
  currentClientX: number;
  durationMs: number;
  laneWidth: number;
  minDurationMs?: number;
  mode: BoardDisplayTimingDragMode;
  originEndMs: number;
  originStartMs: number;
  pointerX: number;
}): BoardDisplayWindowPatch {
  const safeDurationMs = Math.max(minDurationMs, durationMs);
  const safeLaneWidth = Math.max(1, laneWidth);
  const deltaMs = Math.round(((currentClientX - pointerX) / safeLaneWidth) * safeDurationMs);
  const clipWidthMs = Math.max(minDurationMs, originEndMs - originStartMs);

  if (mode === 'start') {
    return {
      startMs: clampNumber(originStartMs + deltaMs, 0, originEndMs - minDurationMs),
    };
  }

  if (mode === 'end') {
    return {
      endMs: clampNumber(originEndMs + deltaMs, originStartMs + minDurationMs, safeDurationMs),
    };
  }

  const startMs = clampNumber(originStartMs + deltaMs, 0, safeDurationMs - clipWidthMs);

  return {
    endMs: startMs + clipWidthMs,
    startMs,
  };
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
