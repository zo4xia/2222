export interface TimelineFactoryPlaceholder {
  readonly kind: 'timeline-factory';
}

export type TimelineFactoryId = string;

export interface SplitScriptOptions {
  readonly chainKeys?: string[];
  readonly maxEstimatedDurationMs?: number;
}

export interface SplitScriptResult {
  readonly units: import('../../domain/teachingProject').TtsSentenceUnit[];
  readonly plainTtsText: string;
  readonly markerCount: number;
}

export interface CreateTtsBatchJobsOptions {
  readonly maxBatchDurationMs?: 60000;
  readonly maxSentencesPerBatch?: 3 | 4 | 5;
  readonly minSentencesPerBatch?: 1 | 2 | 3;
  readonly concurrencyLimit?: 5;
}

export interface CreateBoardEventsOptions {
  readonly minDurationMs?: number;
  readonly fallbackDurationMs?: number;
}

export interface MapBoardEventsToTimelineClipsOptions {
  readonly trackId?: string;
  readonly clipIdPrefix?: string;
}

export interface MergeBoardClipsIntoTimelineClipsOptions {
  readonly trackId?: string;
  readonly generatedClipIdPrefix?: string;
}
