// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

import type { PerformancePlan } from './performancePlan';
import type { PerformanceStageConfig } from './stageConfig';
import type { VoiceTimingPackage } from './voiceTiming';

export type PerformanceExportPackage = {
  projectId: string;
  voice?: VoiceTimingPackage;
  performance?: PerformancePlan;
  stage?: PerformanceStageConfig;
  subtitleUrl?: string;
  videoUrl?: string;
  metadata?: Record<string, unknown>;
};

