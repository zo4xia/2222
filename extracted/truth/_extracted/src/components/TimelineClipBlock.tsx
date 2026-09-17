// @cleanroom-component: TimelineClipBlock
// @domain: teaching-timeline
// @slot: center-timeline/clip-block
// @depends: TeachingProject.timeline.clips
// @feature-branch: timeline-selection
// @feature-branch: board-audio-alignment
// @io-input: clip, isSelected, onSelectClip
// @io-output: onSelectClip(clip.id)
// @route: TeachingTimeline / track row / clip block
// @fields: TimelineClip.id, TimelineClip.kind, TimelineClip.label, TimelineClip.startMs, TimelineClip.endMs
// @boundary: clip display and B timing drag only; A voice clips remain read-only and C visual fields stay outside
// @route-impact: App shell only, future route: task-review

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineClip } from '../domain/teachingProject';
import {
  createBoardDisplayTimingDragPatch,
  type BoardDisplayTimingDragMode,
  type BoardDisplayWindowPatch,
} from '../modules/boardTiming';
import { readUserFacingSegmentLabelFromChainKey } from '../modules/scriptSegments/scriptSegmentDisplayLabels';
import { MathText } from './MathText';

export function TimelineClipBlock({
  clip,
  durationMs,
  isActive,
  isSelected,
  layerIndex,
  onSelectClip,
  onUpdateBoardTiming,
}: {
  clip: TimelineClip;
  durationMs: number;
  isActive: boolean;
  isSelected: boolean;
  layerIndex?: number;
  onSelectClip: (clipId: string) => void;
  onUpdateBoardTiming?: (clipId: string, patch: Partial<Pick<TimelineClip, 'startMs' | 'endMs'>>) => void;
}) {
  const dragStateRef = useRef<{
    clipId: string;
    durationMs: number;
    laneWidth: number;
    mode: BoardDisplayTimingDragMode;
    originEndMs: number;
    originStartMs: number;
    pointerX: number;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestPreviewRef = useRef<BoardDisplayWindowPatch | null>(null);
  const pendingPreviewRef = useRef<BoardDisplayWindowPatch | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPatch, setPreviewPatch] = useState<BoardDisplayWindowPatch | null>(null);
  const [rawClipTitle, rawClipSubtitle] = clip.label.split(/\r?\n/, 2);
  const clipTitle = clip.kind === 'audio' ? readUserFacingSegmentLabelFromChainKey(clip.chainKey) : rawClipTitle;
  const clipSubtitle = clip.kind === 'board' ? '' : rawClipSubtitle;
  const safeDurationMs = Math.max(1000, durationMs);
  const displayStartMs = previewPatch?.startMs ?? clip.startMs;
  const displayEndMs = previewPatch?.endMs ?? clip.endMs;
  const canDragTiming = clip.kind === 'board' && onUpdateBoardTiming;

  const flushPreviewPatch = (nextPatch: BoardDisplayWindowPatch) => {
    pendingPreviewRef.current = nextPatch;
    latestPreviewRef.current = nextPatch;

    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      setPreviewPatch(pendingPreviewRef.current);
    });
  };

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      flushPreviewPatch(
        createBoardDisplayTimingDragPatch({
          currentClientX: event.clientX,
          durationMs: dragState.durationMs,
          laneWidth: dragState.laneWidth,
          mode: dragState.mode,
          originEndMs: dragState.originEndMs,
          originStartMs: dragState.originStartMs,
          pointerX: dragState.pointerX,
        }),
      );
    };

    const handlePointerUp = () => {
      const dragState = dragStateRef.current;
      if (dragState && latestPreviewRef.current) {
        onUpdateBoardTiming?.(dragState.clipId, latestPreviewRef.current);
      }

      dragStateRef.current = null;
      latestPreviewRef.current = null;
      pendingPreviewRef.current = null;
      setPreviewPatch(null);
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onUpdateBoardTiming]);

  useEffect(
    () => () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    },
    [],
  );

  const startTimingDrag = (event: ReactPointerEvent<HTMLElement>, mode: BoardDisplayTimingDragMode) => {
    if (!canDragTiming) {
      return;
    }

    const laneWidth = event.currentTarget.closest('.track-lane')?.getBoundingClientRect().width;
    if (!laneWidth) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelectClip(clip.id);
    dragStateRef.current = {
      clipId: clip.id,
      durationMs,
      laneWidth,
      mode,
      originEndMs: clip.endMs,
      originStartMs: clip.startMs,
      pointerX: event.clientX,
    };
    latestPreviewRef.current = null;
    pendingPreviewRef.current = null;
    setPreviewPatch(null);
    setIsDragging(true);
  };

  return (
    <button
      className={[
        `clip clip--${clip.kind}`,
        isActive ? 'is-active' : '',
        isSelected ? 'selected' : '',
        canDragTiming ? 'clip--timing-draggable' : '',
        isDragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => {
        if (!isDragging) {
          onSelectClip(clip.id);
        }
      }}
      onPointerDown={canDragTiming ? (event) => startTimingDrag(event, 'range') : undefined}
      style={{
        left: `${(displayStartMs / safeDurationMs) * 100}%`,
        zIndex: layerIndex === undefined ? undefined : 10 + layerIndex,
        width: `${Math.max(10, ((displayEndMs - displayStartMs) / safeDurationMs) * 100)}%`,
      }}
      type="button"
    >
      {canDragTiming ? (
        <span
          aria-hidden="true"
          className="clip-resize-handle clip-resize-handle--start"
          onPointerDown={(event) => startTimingDrag(event, 'start')}
        />
      ) : null}
      <MathText className="clip-title">{clipTitle}</MathText>
      {clipSubtitle ? <MathText className="clip-subtitle">{clipSubtitle}</MathText> : null}
      {clip.kind === 'board' ? (
        <span aria-label="写完后保持可见" className="clip-end-pin" role="status" />
      ) : null}
      {canDragTiming ? (
        <span
          aria-hidden="true"
          className="clip-resize-handle clip-resize-handle--end"
          onPointerDown={(event) => startTimingDrag(event, 'end')}
        />
      ) : null}
    </button>
  );
}
