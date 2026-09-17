import { DEFAULT_BOARD_DRAW_SPEED } from './boardRevealConfig';

export function getBoardRevealProgress({
  drawSpeed,
  playheadMs,
  revealEndMs,
  revealStartMs,
}: {
  drawSpeed?: number;
  playheadMs: number;
  revealEndMs: number | undefined;
  revealStartMs: number | undefined;
}): number {
  if (!Number.isFinite(playheadMs)) {
    return 0;
  }

  if (
    typeof revealStartMs !== 'number' ||
    !Number.isFinite(revealStartMs) ||
    typeof revealEndMs !== 'number' ||
    !Number.isFinite(revealEndMs)
  ) {
    return 1;
  }

  const startMs = Math.max(0, revealStartMs);
  const rawEndMs = Math.max(0, revealEndMs);

  if (rawEndMs <= startMs) {
    return playheadMs >= startMs ? 1 : 0;
  }

  const endMs = Math.max(startMs + 1, rawEndMs);

  if (playheadMs <= startMs) {
    return 0;
  }

  if (playheadMs >= endMs) {
    return 1;
  }

  const linearProgress = (playheadMs - startMs) / (endMs - startMs);
  const safeDrawSpeed = clampNumber(drawSpeed ?? DEFAULT_BOARD_DRAW_SPEED, 0.1, 4);
  // drawSpeed 作为线性倍率：1.0=均匀写完，2.0=快一倍，0.5=慢一半
  const effectiveProgress = clampNumber(linearProgress * safeDrawSpeed, 0, 1);
  return shapeBoardRevealProgress(effectiveProgress);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function shapeBoardRevealProgress(progress: number) {
  return progress * progress * (3 - 2 * progress);
}
