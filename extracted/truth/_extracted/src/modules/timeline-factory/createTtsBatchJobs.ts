// @cleanroom-module: timeline-factory
// @domain: tts-audio-pipeline
// @slot: timeline-factory/tts-batch-planner
// @depends: TtsSentenceUnit, TtsBatchJob
// @feature-branch: tts-audio-pipeline
// @feature-branch: voice-timing-json
// @feature-branch: board-audio-alignment
// @route-impact: none

import type { TtsBatchJob, TtsSentenceUnit } from '../../domain/teachingProject';
import type { CreateTtsBatchJobsOptions } from './types';

const defaultMaxBatchDurationMs = 60000;
const defaultMaxSentencesPerBatch = 5;
const defaultMinSentencesPerBatch = 3;
const defaultConcurrencyLimit = 5;

export function createTtsBatchJobs(
  units: TtsSentenceUnit[],
  options: CreateTtsBatchJobsOptions = {},
): TtsBatchJob[] {
  const maxBatchDurationMs = options.maxBatchDurationMs ?? defaultMaxBatchDurationMs;
  const maxSentencesPerBatch = options.maxSentencesPerBatch ?? defaultMaxSentencesPerBatch;
  const minSentencesPerBatch = options.minSentencesPerBatch ?? defaultMinSentencesPerBatch;
  const concurrencyLimit = options.concurrencyLimit ?? defaultConcurrencyLimit;
  return splitBalancedByCount(units, minSentencesPerBatch, maxSentencesPerBatch, maxBatchDurationMs).map((batch, index) =>
    toBatchJob(batch, index + 1, maxBatchDurationMs, concurrencyLimit),
  );
}

function splitBalancedByCount(
  units: TtsSentenceUnit[],
  minSentencesPerBatch: number,
  maxSentencesPerBatch: number,
  maxBatchDurationMs: number,
): TtsSentenceUnit[][] {
  if (units.length === 0) return [];

  const batchCount = Math.max(1, Math.ceil(units.length / maxSentencesPerBatch));
  const balancedBatches: TtsSentenceUnit[][] = [];
  let cursor = 0;

  for (let batchIndex = 0; batchIndex < batchCount; batchIndex += 1) {
    const remainingUnits = units.length - cursor;
    const remainingBatches = batchCount - batchIndex;
    const targetSize = Math.ceil(remainingUnits / remainingBatches);
    const batch = units.slice(cursor, cursor + targetSize);
    balancedBatches.push(batch);
    cursor += targetSize;
  }

  if (balancedBatches.every((batch) => batch.length >= minSentencesPerBatch && sumEstimatedDurationMs(batch) <= maxBatchDurationMs)) {
    return balancedBatches;
  }

  return splitByDurationFallback(units, maxSentencesPerBatch, maxBatchDurationMs);
}

function splitByDurationFallback(
  units: TtsSentenceUnit[],
  maxSentencesPerBatch: number,
  maxBatchDurationMs: number,
): TtsSentenceUnit[][] {
  const batches: TtsSentenceUnit[][] = [];
  let currentBatch: TtsSentenceUnit[] = [];
  let currentDurationMs = 0;

  for (const unit of units) {
    const unitDurationMs = unit.estimatedDurationMs ?? 0;
    const wouldExceedDuration = currentBatch.length > 0 && currentDurationMs + unitDurationMs > maxBatchDurationMs;
    const wouldExceedCount = currentBatch.length >= maxSentencesPerBatch;

    if (wouldExceedDuration || wouldExceedCount) {
      batches.push(currentBatch);
      currentBatch = [];
      currentDurationMs = 0;
    }

    currentBatch.push(unit);
    currentDurationMs += unitDurationMs;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function toBatchJob(
  units: TtsSentenceUnit[],
  batchIndex: number,
  maxDurationMs: number,
  concurrencyLimit: number,
): TtsBatchJob {
  return {
    concurrencyLimit: concurrencyLimit as 5,
    id: `tts-batch-${String(batchIndex).padStart(3, '0')}`,
    maxDurationMs: maxDurationMs as 60000,
    sentenceIds: units.map((unit) => unit.id),
  };
}

function sumEstimatedDurationMs(units: TtsSentenceUnit[]): number {
  return units.reduce((total, unit) => total + (unit.estimatedDurationMs ?? 0), 0);
}
