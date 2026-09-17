// @@COMP_HANDWRITING ⚠️ BREAKPOINT: C 自动手写 reveal 核心层；拖拽冻结/曲线偏置/源时间 vs 显示时间判定
// @cleanroom-component: AutoHandwritingLayer
// @domain: drawboard-stage/c1-auto-handwriting
// @slot: drawboard-stage/c1-actor-layer
// @depends: TimelineClip(kind=board), StageCanvasConfig.boardFontFamily, BoardTextSticker
// @io-input: boardClips, playheadMs, selectedBoardClipId, boardFontLoadKey
// @io-output: onSelectBoardClip, onUpdateBoardClip(C visual x/y/width/fontSize)
// @boundary: C1 automatic board actor only; B timing and A audio stay outside this component
// @interaction-contract: C click/drag/resize remains here even when golden-finger mode is off; this layer receives input because top overlay is pointer-transparent in off mode
// @c-stage-copy: 整张画布都是 C 素材演绎区

import { useEffect, useMemo, useRef } from 'react';
import type { StageCanvasConfig, TimelineClip } from '../domain/teachingProject';
import { getBoardRevealProgress } from '../modules/boardReveal';
import { compareBoardClipLayerOrder } from '../modules/boardOrdering';
import {
  DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
  DEFAULT_BOARD_STICKER_X_PERCENT,
  DEFAULT_BOARD_STICKER_Y_PERCENT,
  getBoardStickerFontSize,
  renderBoardMathStickerImage,
  renderBoardTextStickerImage,
  resolveBoardTextDisplayRoute,
  useBoardStickerDragController,
} from '../modules/boardSticker';
import { isPlayheadInsideTimelineWindowWithPinnedEnd } from '../modules/timeline/timelineWindow';
import { BoardTextSticker } from './BoardTextSticker';
import type { BoardClipPatch } from './drawboardStageTypes';

export function AutoHandwritingLayer({
  boardClips,
  boardFontLoadKey,
  boardFontSize,
  canvas,
  playheadMs,
  selectedBoardClipId,
  onRecordingCanvasReady,
  onSelectBoardClip,
  onUpdateBoardClip,
}: {
  boardClips: TimelineClip[];
  boardFontLoadKey: string;
  boardFontSize: number;
  canvas: StageCanvasConfig;
  playheadMs: number;
  selectedBoardClipId: string | null;
  onRecordingCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onSelectBoardClip: (clipId: string) => void;
  onUpdateBoardClip: (clipId: string, patch: BoardClipPatch) => void;
}) {
  const boardAreaRef = useRef<HTMLDivElement | null>(null);
  const frozenRevealRef = useRef<{ clipId: string; progress: number } | null>(null);
  const recordingDrawVersionRef = useRef(0);
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { draggingClipId, getPreviewPatch, startDrag } = useBoardStickerDragController({
    fallbackFontSize: boardFontSize,
    onCommitPatch: onUpdateBoardClip,
  });
  // z-index follows the original A/C writing anchor, not the draggable B lifetime.
  const visibleBoardClips = useMemo(() => {
    return boardClips
      .filter((clip) => isPlayheadInsideTimelineWindowWithPinnedEnd(playheadMs, clip.startMs, clip.endMs))
      .sort(compareBoardClipLayerOrder);
  }, [boardClips, playheadMs]); // 使用useMemo缓存结果

  useEffect(() => {
    if (!draggingClipId) {
      frozenRevealRef.current = null;
    }
  }, [draggingClipId]);

  useEffect(() => {
    const recordingCanvas = document.createElement('canvas');
    recordingCanvas.width = canvas.width;
    recordingCanvas.height = canvas.height;
    recordingCanvasRef.current = recordingCanvas;
    onRecordingCanvasReady?.(recordingCanvas);

    return () => {
      recordingCanvasRef.current = null;
      onRecordingCanvasReady?.(null);
    };
  }, [canvas.height, canvas.width, onRecordingCanvasReady]);

  useEffect(() => {
    const drawVersion = recordingDrawVersionRef.current + 1;
    recordingDrawVersionRef.current = drawVersion;

    void drawRecordingBoardContent({
      boardArea: boardAreaRef.current,
      boardFontSize,
      canvas,
      clips: visibleBoardClips.map((clip) => {
        const previewPatch = getPreviewPatch(clip.id);
        const liveRevealProgress = readBoardClipRevealProgress(clip, playheadMs);
        const revealProgress =
          draggingClipId === clip.id && frozenRevealRef.current?.clipId === clip.id
            ? frozenRevealRef.current.progress
            : liveRevealProgress;

        return {
          color: clip.color ?? '#111111',
          fontSize: getBoardStickerFontSize(previewPatch?.fontSize ?? clip.fontSize, boardFontSize),
          label: clip.label.trim(),
          revealProgress,
          widthPercent: previewPatch?.widthPercent ?? clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
          xPercent: previewPatch?.xPercent ?? clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT,
          yPercent: previewPatch?.yPercent ?? clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT,
        };
      }),
      recordingCanvas: recordingCanvasRef.current,
      shouldContinue: () => recordingDrawVersionRef.current === drawVersion,
    }).catch(() => {
      const context = recordingCanvasRef.current?.getContext('2d');
      context?.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      recordingDrawVersionRef.current += 1;
    };
  }, [boardFontSize, canvas, draggingClipId, getPreviewPatch, playheadMs, visibleBoardClips]);

  return (
    <div className="courseware-board-area" ref={boardAreaRef}>
      {visibleBoardClips.length
        ? visibleBoardClips.map((clip, index) => {
          const previewPatch = getPreviewPatch(clip.id);
          const color = clip.color ?? '#111111';
          const fontSize = getBoardStickerFontSize(previewPatch?.fontSize ?? clip.fontSize, boardFontSize);
          const widthPercent = previewPatch?.widthPercent ?? clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT;
          const xPercent = previewPatch?.xPercent ?? clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT;
          const yPercent = previewPatch?.yPercent ?? clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT;
          const liveRevealProgress = readBoardClipRevealProgress(clip, playheadMs);
          const revealProgress =
            draggingClipId === clip.id && frozenRevealRef.current?.clipId === clip.id
              ? frozenRevealRef.current.progress
              : liveRevealProgress;

          return (
            <BoardTextSticker
              color={color}
              isDragging={draggingClipId === clip.id}
              isSelected={selectedBoardClipId === clip.id}
              key={clip.id}
              onPointerDown={(event) => {
                const areaRect = boardAreaRef.current?.getBoundingClientRect();
                if (!areaRect) {
                  return;
                }
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                frozenRevealRef.current = {
                  clipId: clip.id,
                  progress: liveRevealProgress,
                };
                onSelectBoardClip(clip.id);
                startDrag({
                  areaRect,
                  clipId: clip.id,
                  mode: 'move',
                  originClientX: event.clientX,
                  originClientY: event.clientY,
                  originFontSize: getBoardStickerFontSize(clip.fontSize, boardFontSize),
                  originXPercent: clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT,
                  originYPercent: clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT,
                  originWidthPercent: clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
                });
              }}
              onResizePointerDown={(event) => {
                const areaRect = boardAreaRef.current?.getBoundingClientRect();
                if (!areaRect) {
                  return;
                }
                event.preventDefault();
                event.stopPropagation();
                const resizeHandle = event.currentTarget;
                if (resizeHandle.parentElement instanceof HTMLButtonElement) {
                  resizeHandle.parentElement.setPointerCapture(event.pointerId);
                }
                frozenRevealRef.current = {
                  clipId: clip.id,
                  progress: liveRevealProgress,
                };
                onSelectBoardClip(clip.id);
                startDrag({
                  areaRect,
                  clipId: clip.id,
                  mode: 'resize',
                  originClientX: event.clientX,
                  originClientY: event.clientY,
                  originFontSize: getBoardStickerFontSize(clip.fontSize, boardFontSize),
                  originXPercent: clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT,
                  originYPercent: clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT,
                  originWidthPercent: clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
                });
              }}
              stackIndex={index}
              fontFamily={canvas.boardFontFamily}
              fontLoadKey={boardFontLoadKey}
              fontSize={fontSize}
              revealProgress={revealProgress}
              text={clip.label.trim()}
              widthPercent={widthPercent}
              xPercent={xPercent}
              yPercent={yPercent}
            />
          );
        })
        : null}
    </div>
  );
}

type RecordingBoardClip = {
  color: string;
  fontSize: number;
  label: string;
  revealProgress: number;
  widthPercent: number;
  xPercent: number;
  yPercent: number;
};

async function drawRecordingBoardContent({
  boardArea,
  boardFontSize,
  canvas,
  clips,
  recordingCanvas,
  shouldContinue,
}: {
  boardArea: HTMLDivElement | null;
  boardFontSize: number;
  canvas: StageCanvasConfig;
  clips: RecordingBoardClip[];
  recordingCanvas: HTMLCanvasElement | null;
  shouldContinue: () => boolean;
}) {
  if (!recordingCanvas) {
    return;
  }

  if (recordingCanvas.width !== canvas.width || recordingCanvas.height !== canvas.height) {
    recordingCanvas.width = canvas.width;
    recordingCanvas.height = canvas.height;
  }

  const context = recordingCanvas.getContext('2d');
  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!boardArea || !clips.length) {
    return;
  }

  const stageElement = boardArea.closest('.stage-canvas');
  const stageRect = stageElement?.getBoundingClientRect();
  const areaRect = boardArea.getBoundingClientRect();
  if (!stageRect || stageRect.width <= 0 || stageRect.height <= 0 || areaRect.width <= 0 || areaRect.height <= 0) {
    return;
  }

  const scaleX = canvas.width / stageRect.width;
  const scaleY = canvas.height / stageRect.height;
  const areaLeft = (areaRect.left - stageRect.left) * scaleX;
  const areaTop = (areaRect.top - stageRect.top) * scaleY;
  const areaWidth = areaRect.width * scaleX;
  const areaHeight = areaRect.height * scaleY;

  for (const clip of clips) {
    if (!shouldContinue()) {
      return;
    }

    const route = resolveBoardTextDisplayRoute(clip.label);
    const image = route.kind === 'formula'
      ? await renderBoardMathStickerImage(route.text, {
          color: clip.color,
          fontFamily: canvas.boardFontFamily,
          fontSize: clip.fontSize,
        })
      : await renderBoardTextStickerImage(route.text, {
          color: clip.color,
          fontFamily: canvas.boardFontFamily,
          fontSize: clip.fontSize,
        });
    const stickerImage = await loadRecordingImage(image.dataUrl);
    if (!shouldContinue()) {
      return;
    }

    const boxWidth = areaWidth * (clip.widthPercent / 100);
    const imageScale = Math.min(1, boxWidth / Math.max(1, image.width));
    const drawWidth = image.width * imageScale;
    const drawHeight = image.height * imageScale;
    const centerX = areaLeft + areaWidth * (clip.xPercent / 100);
    const centerY = areaTop + areaHeight * (clip.yPercent / 100);
    const drawX = centerX - boxWidth / 2 + 4 * scaleX;
    const drawY = centerY - drawHeight / 2;

    drawImageWithRevealClip(context, stickerImage, {
      height: drawHeight,
      progress: clip.revealProgress,
      width: drawWidth,
      x: drawX,
      y: drawY,
    });
  }
}

function drawImageWithRevealClip(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: { height: number; progress: number; width: number; x: number; y: number },
) {
  const progress = Math.min(1, Math.max(0, Number.isFinite(rect.progress) ? rect.progress : 1));
  const topEdge = Math.min(1, Math.max(0, progress + (progress > 0 && progress < 1 ? 0.018 : 0)));
  const bottomEdge = Math.min(1, Math.max(0, progress - (progress > 0 && progress < 1 ? 0.012 : 0)));

  context.save();
  context.beginPath();
  context.moveTo(rect.x, rect.y);
  context.lineTo(rect.x + rect.width * topEdge, rect.y);
  context.lineTo(rect.x + rect.width * bottomEdge, rect.y + rect.height);
  context.lineTo(rect.x, rect.y + rect.height);
  context.closePath();
  context.clip();
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  context.restore();
}

function loadRecordingImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('C recording image load failed.'));
    image.src = src;
  });
}

function readBoardClipRevealProgress(
  clip: TimelineClip,
  playheadMs: number,
) {
  return getBoardRevealProgress({
    drawSpeed: clip.drawSpeed,
    playheadMs,
    revealEndMs: clip.revealEndMs ?? clip.sourceEndMs ?? clip.endMs,
    revealStartMs: clip.revealStartMs ?? clip.sourceStartMs ?? clip.startMs,
  });
}
