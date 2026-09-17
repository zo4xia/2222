// @cleanroom-module: useBoardStickerDragController
// @domain: board-sticker/portable-drag-controller
// @io-input: clip visual fields, stage rect, pointer coordinates, fallback font size
// @io-output: local preview patch during drag; final visual patch on pointerup
// @boundary: C1/C visual placement controller only; does not read store, write timeline, own A/B timing, or know page shell

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createBoardStickerMovePatch,
  createBoardStickerUniformResizePatch,
  type BoardStickerVisualPatch,
} from './boardStickerGeometry';

type BoardStickerDragMode = 'move' | 'resize';

type BoardStickerStageRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type BoardStickerDragStartInput = {
  areaRect: BoardStickerStageRect;
  clipId: string;
  mode: BoardStickerDragMode;
  originClientX: number;
  originClientY: number;
  originFontSize: number;
  originXPercent: number;
  originYPercent: number;
  originWidthPercent: number;
};

type BoardStickerDragState = BoardStickerDragStartInput;

type BoardStickerPreviewState = {
  clipId: string;
  patch: BoardStickerVisualPatch;
};

export function useBoardStickerDragController({
  fallbackFontSize,
  onCommitPatch,
}: {
  fallbackFontSize: number;
  onCommitPatch: (clipId: string, patch: BoardStickerVisualPatch) => void;
}) {
  const activeDragRef = useRef<BoardStickerDragState | null>(null);
  const commitPatchRef = useRef(onCommitPatch);
  const frameRef = useRef<number | null>(null);
  const pendingPreviewRef = useRef<BoardStickerPreviewState | null>(null);
  const latestPreviewRef = useRef<BoardStickerPreviewState | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const [preview, setPreview] = useState<BoardStickerPreviewState | null>(null);

  useEffect(() => {
    commitPatchRef.current = onCommitPatch;
  }, [onCommitPatch]);

  const flushPreview = useCallback((nextPreview: BoardStickerPreviewState) => {
    pendingPreviewRef.current = nextPreview;
    latestPreviewRef.current = nextPreview;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setPreview(pendingPreviewRef.current);
    });
  }, []);

  useEffect(() => {
    if (!draggingClipId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = activeDragRef.current;
      if (!dragState) {
        return;
      }

      const patch =
        dragState.mode === 'resize'
          ? createBoardStickerUniformResizePatch({
              areaWidth: dragState.areaRect.width,
              currentClientX: event.clientX,
              fallbackFontSize,
              originClientX: dragState.originClientX,
              originFontSize: dragState.originFontSize,
              originWidthPercent: dragState.originWidthPercent,
            })
          : createBoardStickerMovePatch({
              areaHeight: dragState.areaRect.height,
              areaWidth: dragState.areaRect.width,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
              originClientX: dragState.originClientX,
              originClientY: dragState.originClientY,
              originXPercent: dragState.originXPercent,
              originYPercent: dragState.originYPercent,
            });

      flushPreview({
        clipId: dragState.clipId,
        patch,
      });
    };

    const handlePointerUp = () => {
      const dragState = activeDragRef.current;
      const finalPreview = latestPreviewRef.current;
      if (dragState && finalPreview?.clipId === dragState.clipId) {
        commitPatchRef.current(dragState.clipId, finalPreview.patch);
      }

      activeDragRef.current = null;
      latestPreviewRef.current = null;
      pendingPreviewRef.current = null;
      setPreview(null);
      setDraggingClipId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingClipId, fallbackFontSize, flushPreview]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const startDrag = useCallback((input: BoardStickerDragStartInput) => {
    activeDragRef.current = input;
    latestPreviewRef.current = null;
    pendingPreviewRef.current = null;
    setPreview(null);
    setDraggingClipId(input.clipId);
  }, []);

  const getPreviewPatch = useCallback(
    (clipId: string): BoardStickerVisualPatch | null => (preview?.clipId === clipId ? preview.patch : null),
    [preview],
  );

  return {
    draggingClipId,
    getPreviewPatch,
    startDrag,
  };
}
