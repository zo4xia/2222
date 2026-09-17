// @cleanroom-component: InspectorPanel
// @domain: inspector
// @slot: right-inspector
// @depends: CanvasInspector, BoardClipInspector, BoardControlResponsibilitiesPanel
// @io-input: canvas, selectedClip
// @io-output: onUpdateCanvas, onUpdateBoardClip
// @route: App shell / right inspector
// @boundary: layout composition only; no field-level editing logic here

import type { StageCanvasConfig, TimelineClip } from '../domain/teachingProject';
import { BoardClipInspector } from './BoardClipInspector';
import { BoardControlResponsibilitiesPanel } from './BoardControlResponsibilitiesPanel';
import { CanvasInspector } from './CanvasInspector';
import { CurrentProjectBoardFontInspector } from './CurrentProjectBoardFontInspector';
import type { BoardClipInspectorPatch } from './boardClipInspector/boardClipInspectorContract';

export function InspectorPanel({
  canvas,
  selectedClip,
  onUpdateBoardClip,
  onUpdateCanvas,
}: {
  canvas: StageCanvasConfig;
  selectedClip: TimelineClip | undefined;
  onUpdateBoardClip: (patch: BoardClipInspectorPatch) => void;
  onUpdateCanvas: (canvas: StageCanvasConfig) => void;
}) {
  return (
    <section className="inspector-stack">
      <BoardControlResponsibilitiesPanel />
      <CanvasInspector canvas={canvas} onUpdateCanvas={onUpdateCanvas} />
      <CurrentProjectBoardFontInspector canvas={canvas} onUpdateCanvas={onUpdateCanvas} />
      <BoardClipInspector defaultFontSize={canvas.boardFontSize} onUpdateBoardClip={onUpdateBoardClip} selectedClip={selectedClip} />
    </section>
  );
}
