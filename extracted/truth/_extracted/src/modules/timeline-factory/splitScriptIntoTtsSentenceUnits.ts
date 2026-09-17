// @cleanroom-module: timeline-factory
// @domain: tts-audio-pipeline
// @slot: timeline-factory/script-splitter
// @depends: TtsSentenceUnit
// @feature-branch: tts-audio-pipeline
// @feature-branch: script-sync-marker
// @feature-branch: board-audio-alignment
// @route-impact: none

import type { TtsSentenceUnit } from '../../domain/teachingProject';
import { prepareAliyunMathSpeechText } from '../speechText/aliyunMathSpeechText';
import type { SplitScriptOptions, SplitScriptResult } from './types';

const boldBoardMarkerPattern = /<b>([\s\S]*?)<\/b>/gi;
const pairedBoardMarkerPattern = /\.{7}([\s\S]*?)\.{7}/g;
const legacyBoardMarkerPattern = /►([\s\S]*?)◄/g;
const brBoundaryPattern = /<br\s*\/?>/i;
const defaultCharsPerSecond = 4.2;

export function stripBoardMarkersForTts(text: string): string {
  return text
    .replace(boldBoardMarkerPattern, (_, markerText: string) => markerText)
    .replace(pairedBoardMarkerPattern, (_, markerText: string) => markerText)
    .replace(legacyBoardMarkerPattern, (_, markerText: string) => markerText)
    .replace(/[►◄]/g, '')
    .replace(/\.{7}/g, '');
}

export function splitScriptIntoTtsSentenceUnits(scriptText: string, options: SplitScriptOptions = {}): SplitScriptResult {
  const normalizedText = scriptText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalizedText) {
    return {
      markerCount: 0,
      plainTtsText: '',
      units: [],
    };
  }

  const markerTexts = collectBoardMarkerTexts(normalizedText);
  const plainText = stripBoardMarkersForTts(normalizedText);
  const rawSentences = splitIntoSentences(plainText);

  const units: TtsSentenceUnit[] = rawSentences.map((sentence, index) => {
    const boardMarkerTexts = markerTexts.filter((marker) => sentence.includes(marker));
    const boardMarkerText = boardMarkerTexts[0];
    const chainKey = options.chainKeys?.[index];
    const speechText = prepareAliyunMathSpeechText(sentence);

    return {
      boardMarkerText,
      boardMarkerChainKeys: chainKey ? boardMarkerTexts.map(() => chainKey) : undefined,
      boardMarkerTexts,
      chainKey,
      estimatedDurationMs: estimateDurationMs(speechText, options.maxEstimatedDurationMs),
      hasBoardMarker: Boolean(boardMarkerText),
      id: `tts-sentence-${String(index + 1).padStart(3, '0')}`,
      order: index + 1,
      speechText,
      text: sentence,
    };
  });

  return {
    markerCount: markerTexts.length,
    plainTtsText: units.map((unit) => unit.speechText).join('\n'),
    units,
  };
}

function collectBoardMarkerTexts(text: string): string[] {
  return [
    ...[...text.matchAll(boldBoardMarkerPattern)].map((match) => ({
      index: match.index ?? 0,
      text: normalizeWhitespace(match[1]),
    })),
    ...[...text.matchAll(pairedBoardMarkerPattern)].map((match) => ({
      index: match.index ?? 0,
      text: normalizeWhitespace(match[1]),
    })),
    ...[...text.matchAll(legacyBoardMarkerPattern)].map((match) => ({
      index: match.index ?? 0,
      text: normalizeWhitespace(match[1]),
    })),
  ]
    .sort((firstMarker, secondMarker) => firstMarker.index - secondMarker.index)
    .map((marker) => marker.text)
    .filter(Boolean);
}

function splitIntoSentences(text: string): string[] {
  if (brBoundaryPattern.test(text)) {
    return text
      .split(/<br\s*\/?>/i)
      .map((segment) => normalizeWhitespace(segment))
      .filter(Boolean);
  }

  const singleSegment = normalizeWhitespace(text);
  return singleSegment ? [singleSegment] : [];
}

function normalizeWhitespace(text: string): string {
  return text.replace(/[\t ]+/g, ' ').trim();
}

function estimateDurationMs(sentence: string, maxEstimatedDurationMs = 60000): number {
  const estimatedMs = Math.ceil((sentence.length / defaultCharsPerSecond) * 1000);
  return Math.min(Math.max(estimatedMs, 800), maxEstimatedDurationMs);
}
