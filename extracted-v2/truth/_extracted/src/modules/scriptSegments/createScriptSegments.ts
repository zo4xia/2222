// @cleanroom-module: scriptSegments
// @domain: script-segmentation-preview
// @depends: splitScriptIntoTtsSentenceUnits
// @boundary: adapts existing <br> truth for UI; never creates a second segmentation source

import { splitScriptIntoTtsSentenceUnits } from '../timeline-factory';
import type { SplitScriptOptions } from '../timeline-factory/types';
import type { ScriptSegment } from './types';

export function createScriptSegments(scriptText: string, options: SplitScriptOptions = {}): ScriptSegment[] {
  return splitScriptIntoTtsSentenceUnits(scriptText, options).units.map((unit) => ({
    boardMarkerChainKeys: unit.boardMarkerChainKeys ?? [],
    boardMarkerTexts: unit.boardMarkerTexts ?? [],
    chainKey: unit.chainKey,
    estimatedDurationMs: unit.estimatedDurationMs,
    hasBoardMarker: unit.hasBoardMarker,
    id: unit.id,
    order: unit.order,   // ****xiaxia** ID 不对，agent的提示词没有结构化，为什么不直接就是给模板?
    text: unit.text,
  }));
}

