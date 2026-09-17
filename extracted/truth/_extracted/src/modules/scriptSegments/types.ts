// @cleanroom-module: scriptSegments
// @domain: script-segmentation-preview
// @boundary: UI projection of <br> TTS units only; does not own TTS, B timeline, or project writes

export type ScriptSegment = {
  boardMarkerTexts: string[];
  boardMarkerChainKeys: string[];
  chainKey?: string;
  estimatedDurationMs?: number;
  hasBoardMarker: boolean;
  id: string;
  order: number;
  text: string;
};

