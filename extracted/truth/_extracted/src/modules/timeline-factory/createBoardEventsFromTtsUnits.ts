// @cleanroom-module: timeline-factory
// @domain: board-audio-alignment
// @slot: timeline-factory/board-event-generator
// @depends: TtsSentenceUnit, TtsSentenceResult, BoardEvent
// @feature-branch: board-events
// @feature-branch: tts-audio-pipeline
// @data-map: TtsSentenceUnit.boardMarkerTexts -> BoardEvent.text
// @data-map: TtsSentenceResult.durationMs -> BoardEvent.startMs/endMs
// @route-impact: none

import type { BoardEvent, TtsSentenceResult, TtsSentenceUnit } from '../../domain/teachingProject';
import { isBoardMaterialChainKey } from '../abcChain/abcChainKey';
import type { CreateBoardEventsOptions } from './types';

const defaultFallbackDurationMs = 1200;
const defaultMinDurationMs = 300;

export function createBoardEventsFromTtsUnits(
  units: TtsSentenceUnit[],
  sentenceResults: TtsSentenceResult[],
  options: CreateBoardEventsOptions = {},
): BoardEvent[] {
  const fallbackDurationMs = options.fallbackDurationMs ?? defaultFallbackDurationMs;
  const minDurationMs = options.minDurationMs ?? defaultMinDurationMs;
  const sentenceTimingById = createSentenceTimingMap(units, sentenceResults, fallbackDurationMs, minDurationMs);

  return units.flatMap((unit) => {
    const markerTexts = (unit.boardMarkerTexts?.length ? unit.boardMarkerTexts : unit.boardMarkerText ? [unit.boardMarkerText] : [])
      .map((markerText) => markerText.trim())
      .filter(Boolean);
    if (!unit.hasBoardMarker || markerTexts.length === 0) {
      return [];
    }

      const timing = sentenceTimingById.get(unit.id) ?? createFallbackTiming(unit, fallbackDurationMs, minDurationMs);
      return markerTexts.flatMap((markerText, markerIndex) => {
        const chainKey = unit.boardMarkerChainKeys?.[markerIndex] ?? unit.chainKey;
        if (!isBoardMaterialChainKey(chainKey)) {
          return [];
        }
        return [{
          chainKey,
          endMs: timing.endMs,
          id: `board-event-${String(unit.order).padStart(3, '0')}-${String(markerIndex + 1).padStart(2, '0')}`,
          sentenceId: unit.id,
          source: 'sync-marker',
          startMs: timing.startMs,
          text: markerText,
        } satisfies BoardEvent];
      });
    });
}

function createSentenceTimingMap(
  units: TtsSentenceUnit[],
  sentenceResults: TtsSentenceResult[],
  fallbackDurationMs: number,
  minDurationMs: number,
): Map<string, { startMs: number; endMs: number }> {
  const timingById = new Map<string, { startMs: number; endMs: number }>();
  const resultBySentenceId = new Map(sentenceResults.map((result) => [result.sentenceId, result]));
  let cursorMs = 0;

  for (const unit of [...units].sort((left, right) => left.order - right.order)) {
    const result = resultBySentenceId.get(unit.id);
    const durationMs = normalizeDurationMs(result?.durationMs ?? unit.estimatedDurationMs, fallbackDurationMs, minDurationMs);
    timingById.set(unit.id, {
      endMs: cursorMs + durationMs,
      startMs: cursorMs,
    });
    cursorMs += durationMs;
  }

  return timingById;
}

function createFallbackTiming(
  unit: TtsSentenceUnit,
  fallbackDurationMs: number,
  minDurationMs: number,
): { startMs: number; endMs: number } {
  const durationMs = normalizeDurationMs(unit.estimatedDurationMs, fallbackDurationMs, minDurationMs);
  const startMs = Math.max(0, (unit.order - 1) * fallbackDurationMs);
  return {
    endMs: startMs + durationMs,
    startMs,
  };
}

function normalizeDurationMs(durationMs: number | undefined, fallbackDurationMs: number, minDurationMs: number): number {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return fallbackDurationMs;
  }

  return Math.max(Math.round(durationMs), minDurationMs);
}
