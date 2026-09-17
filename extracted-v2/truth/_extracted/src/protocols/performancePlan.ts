// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

import type { VoiceTimingSlice } from './voiceTiming';

export type DirectorCue = {
  id: string;
  sliceId: string;
  actorId: string;
  startMs: number;
  endMs: number;
  revealStartMs?: number;
  revealEndMs?: number;
  holdAfterEnd?: boolean;
  metadata?: Record<string, unknown>;
};

export type ActorAssetKind = 'handwriting' | 'formula' | 'image' | 'shape' | 'annotation';

export type ActorAsset = {
  id: string;
  kind: ActorAssetKind;
  content: string;
  xPercent: number;
  yPercent: number;
  widthPercent?: number;
  fontSize?: number;
  scale?: number;
  color?: string;
  stylePreset?: string;
  metadata?: Record<string, unknown>;
};

export type PerformancePlan = {
  id: string;
  timing: VoiceTimingSlice[];
  cues: DirectorCue[];
  actors: ActorAsset[];
  metadata?: Record<string, unknown>;
};

