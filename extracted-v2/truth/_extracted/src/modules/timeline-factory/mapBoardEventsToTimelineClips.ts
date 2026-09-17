// @cleanroom-module: timeline-factory
// @domain: board-audio-alignment
// @slot: timeline-factory/board-event-to-clip-mapper
// @depends: BoardEvent, TimelineClip
// @feature-branch: board-events
// @feature-branch: timeline-review-workflow
// @data-map: BoardEvent.text -> TimelineClip.label
// @data-map: BoardEvent.startMs/endMs -> TimelineClip.startMs/endMs
// @data-map: BoardEvent.startMs/endMs -> TimelineClip.sourceStartMs/sourceEndMs/revealStartMs/revealEndMs
// @data-map: BoardEvent.sentenceId -> TimelineClip.sourceRef
// ID: cleanroom-timeline-board-map-001
// @io-input: BoardEvent[], MapBoardEventsToTimelineClipsOptions
// @io-output: TimelineClip(kind=board)[]
// @route: timeline factory / timeline-review-workflow
// @fields: TeachingProject.timeline.clips(kind=board)
// @boundary: pure mapping only; no store writes, no UI mutation, no TTS request
// @b-c-separation: 当前过渡态：B轨时间属性和C轨视觉属性同住同一TimelineClip；目标态拆为BTimingClip+CVisualClip，但拆后仍必须ABC成组，不存在B-only

import type { BoardEvent, TimelineClip } from '../../domain/teachingProject';
import { DEFAULT_BOARD_DRAW_SPEED } from '../boardReveal/boardRevealConfig';
import type { MapBoardEventsToTimelineClipsOptions } from './types';

const defaultBoardTrackId = 'track-board';
const defaultClipIdPrefix = 'clip-board';
export function mapBoardEventsToTimelineClips(
  boardEvents: BoardEvent[],
  options: MapBoardEventsToTimelineClipsOptions = {},
): TimelineClip[] {
  const trackId = options.trackId ?? defaultBoardTrackId;
  const clipIdPrefix = options.clipIdPrefix ?? defaultClipIdPrefix;

  return boardEvents.map((event, index) => {
    // B轨时间控制属性（对应TTS句子）
    const bTimingProperties = {
      chainKey: event.chainKey,
      endMs: event.endMs,
      id: `${clipIdPrefix}-${String(index + 1).padStart(3, '0')}`,
      kind: 'board' as const,
      label: event.text,
      revealEndMs: event.endMs,
      revealStartMs: event.startMs,
      sourceEndMs: event.endMs,
      sourceRef: event.sentenceId,
      sourceStartMs: event.startMs,
      startMs: event.startMs,
      trackId,
    };

    // C轨视觉属性（对应板书内容）
    const cVisualProperties = {
      xPercent: 28 + (index % 3) * 18,
      yPercent: 48 + (index % 2) * 12,
      drawSpeed: readBoardDrawSpeed(),
    };

    // 合并B轨和C轨属性（暂时保持在一个TimelineClip中）
    return {
      ...bTimingProperties,
      ...cVisualProperties,
    };
  });
}

function readBoardDrawSpeed() {
  return DEFAULT_BOARD_DRAW_SPEED;
}
