// @cleanroom-module: scriptSegmentBoardMarkers
// @domain: script-segmentation-preview
// @boundary: UI projection helper only; B/C eligibility still comes from isBoardMaterialChainKey(chainKey)

import { isBoardMaterialChainKey } from '../abcChain/abcChainKey';
import type { ScriptSegment } from './types';

export type ScriptSegmentBoardMarker = {
  chainKey?: string;
  text: string;
};

export function readAllowedBoardMarkers(segment: ScriptSegment): ScriptSegmentBoardMarker[] {
  return segment.boardMarkerTexts
    .map((text, markerIndex) => ({
      chainKey: segment.boardMarkerChainKeys[markerIndex] ?? segment.chainKey,
      text,
    }))
    .filter((marker) => marker.text.trim() && isBoardMaterialChainKey(marker.chainKey));
}

export function countAllowedBoardMarkers(segments: ScriptSegment[]): number {
  return segments.reduce((total, segment) => total + readAllowedBoardMarkers(segment).length, 0);
}
