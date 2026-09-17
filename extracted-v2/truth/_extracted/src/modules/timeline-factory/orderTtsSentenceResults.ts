// @cleanroom-module: timeline-factory
// @domain: tts-audio-board-alignment
// @boundary: keeps A audio clips and B/C board events on the same ready sentence stream

import type { TtsSentenceResult, TtsSentenceUnit } from '../../domain/teachingProject';

export function isReadyTtsSentenceResult(result: TtsSentenceResult): boolean {
  return Boolean(result.status !== 'failed' && result.audioUrl && !result.error);
}

export function sortTtsSentenceResultsBySentenceOrder(results: TtsSentenceResult[]): TtsSentenceResult[] {
  return [...results].sort((left, right) => compareTtsSentenceIds(left.sentenceId, right.sentenceId));
}

export function filterTtsUnitsBySentenceResults(units: TtsSentenceUnit[], results: TtsSentenceResult[]): TtsSentenceUnit[] {
  const sentenceIds = new Set(results.map((result) => result.sentenceId));
  return units.filter((unit) => sentenceIds.has(unit.id));
}

function compareTtsSentenceIds(left: string, right: string): number {
  const leftOrder = readTtsSentenceOrder(left);
  const rightOrder = readTtsSentenceOrder(right);

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.localeCompare(right);
}

function readTtsSentenceOrder(sentenceId: string): number {
  const match = sentenceId.match(/^tts-sentence-(\d+)$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number.parseInt(match[1], 10);
}
