// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

export type VoiceTimingSlice = {
  id: string;
  rowId?: string;
  text: string;
  audioUrl?: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  sourceRef?: string;
  metadata?: Record<string, unknown>;
};

export type VoiceTimingPackage = {
  id: string;
  audioUrl?: string;
  durationMs?: number;
  slices: VoiceTimingSlice[];
  metadata?: Record<string, unknown>;
};

