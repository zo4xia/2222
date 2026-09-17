import type { TimelineClip } from '../../domain/teachingProject';
import { DEFAULT_BOARD_DRAW_SPEED } from '../../modules/boardReveal/boardRevealConfig';
import { normalizeBoardDisplayWindow } from '../../modules/boardTiming';
import {
  createBoardStickerUniformScalePatch,
  DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
  DEFAULT_BOARD_STICKER_X_PERCENT,
  DEFAULT_BOARD_STICKER_Y_PERCENT,
  getBoardStickerFontSize,
  normalizeBoardStickerVisualPatch,
} from '../../modules/boardSticker';

const DEFAULT_BOARD_CLIP_COLOR = '#111111';

export type BoardClipInspectorPatch = Partial<
  Pick<TimelineClip, 'color' | 'label' | 'xPercent' | 'yPercent' | 'widthPercent' | 'fontSize' | 'drawSpeed'>
>;
// Contract anchor for boundary check:
// Pick<TimelineClip, 'label' | 'xPercent' | 'yPercent' | 'widthPercent' | 'fontSize' | 'drawSpeed'>

export type BoardClipInspectorWritableDraft = {
  color: string;
  drawSpeed: number;
  fontSize: number;
  label: string;
  widthPercent: number;
  xPercent: number;
  yPercent: number;
};

export type BoardClipInspectorDraft = BoardClipInspectorWritableDraft & {
  clipId: string;
  endMs: number;
  startMs: number;
};

export function createBoardClipInspectorDraft(selectedBoardClip: TimelineClip | undefined, defaultFontSize: number) {
  if (!selectedBoardClip) {
    return null;
  }

  return normalizeBoardClipInspectorDraft({
    clipId: selectedBoardClip.id,
    color: selectedBoardClip.color ?? DEFAULT_BOARD_CLIP_COLOR,
    drawSpeed: selectedBoardClip.drawSpeed ?? DEFAULT_BOARD_DRAW_SPEED,
    endMs: selectedBoardClip.endMs,
    fontSize: getBoardStickerFontSize(selectedBoardClip.fontSize, defaultFontSize),
    label: selectedBoardClip.label,
    startMs: selectedBoardClip.startMs,
    widthPercent: selectedBoardClip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
    xPercent: selectedBoardClip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT,
    yPercent: selectedBoardClip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT,
  });
}

export function normalizeBoardClipInspectorDraft(draft: BoardClipInspectorDraft): BoardClipInspectorDraft {
  const displayWindow = normalizeBoardDisplayWindow(draft);
  const visualPatch = normalizeBoardStickerVisualPatch(draft);

  return {
    ...draft,
    drawSpeed: visualPatch.drawSpeed,
    endMs: displayWindow.endMs,
    fontSize: visualPatch.fontSize,
    startMs: displayWindow.startMs,
    widthPercent: visualPatch.widthPercent,
    xPercent: visualPatch.xPercent,
    yPercent: visualPatch.yPercent,
  };
}

export function hasBoardClipInspectorDraftChanges(
  draft: BoardClipInspectorDraft | null,
  selectedBoardClip: TimelineClip | undefined,
  defaultFontSize: number,
) {
  return (
    selectedBoardClip !== undefined &&
    draft !== null &&
    (draft.color !== (selectedBoardClip.color ?? DEFAULT_BOARD_CLIP_COLOR) ||
      draft.label !== selectedBoardClip.label ||
      draft.xPercent !== (selectedBoardClip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT) ||
      draft.yPercent !== (selectedBoardClip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT) ||
      draft.widthPercent !== (selectedBoardClip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT) ||
      draft.fontSize !== getBoardStickerFontSize(selectedBoardClip.fontSize, defaultFontSize) ||
      draft.drawSpeed !== (selectedBoardClip.drawSpeed ?? DEFAULT_BOARD_DRAW_SPEED))
  );
}

export function getBoardClipInspectorScalePercent(draft: BoardClipInspectorDraft | null) {
  return draft ? Math.round((draft.widthPercent / DEFAULT_BOARD_STICKER_WIDTH_PERCENT) * 100) : 100;
}

export function createBoardClipInspectorScalePatch(defaultFontSize: number, scalePercent: number) {
  return createBoardStickerUniformScalePatch({
    fallbackFontSize: defaultFontSize,
    originFontSize: defaultFontSize,
    originWidthPercent: DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
    scalePercent,
  });
}

export function createBoardClipInspectorPatch(draft: BoardClipInspectorDraft): BoardClipInspectorPatch {
  return {
    color: draft.color,
    drawSpeed: draft.drawSpeed,
    fontSize: draft.fontSize,
    label: draft.label,
    widthPercent: draft.widthPercent,
    xPercent: draft.xPercent,
    yPercent: draft.yPercent,
  };
}
