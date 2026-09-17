export function isPlayheadInsideTimelineWindow(playheadMs: number, startMs: number, endMs: number) {
  return playheadMs >= startMs && playheadMs < endMs;
}

export function isPlayheadInsideTimelineWindowWithPinnedEnd(playheadMs: number, startMs: number, endMs: number) {
  return playheadMs >= startMs && playheadMs <= endMs;
}
