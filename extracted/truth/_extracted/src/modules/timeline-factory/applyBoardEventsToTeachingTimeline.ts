// @cleanroom-module: timeline-factory
// @domain: board-audio-alignment
// @slot: timeline-factory/board-events-to-timeline-writeback
// @depends: BoardEvent, TeachingTimeline
// @feature-branch: board-events
// @feature-branch: timeline-review-workflow
// @data-map: BoardEvent[] -> TeachingProject.timeline.clips(kind=board)
// ID: cleanroom-timeline-board-writeback-001
// @io-input: TeachingTimeline, BoardEvent[]
// @io-output: TeachingTimeline with generated board clips and updated durationMs
// @route: store applyBoardEventsToTimeline / timeline-review-workflow
// @fields: TeachingProject.timeline.clips, TeachingProject.timeline.durationMs
// @boundary: pure timeline writeback only; no asset mutation, no TTS request, no UI mutation

import type { BoardEvent, TeachingTimeline } from '../../domain/teachingProject';
import { mapBoardEventsToTimelineClips } from './mapBoardEventsToTimelineClips.js';
import { mergeBoardClipsIntoTimelineClips } from './mergeBoardClipsIntoTimelineClips.js';

export function applyBoardEventsToTeachingTimeline(
  timeline: TeachingTimeline,
  boardEvents: BoardEvent[],
): TeachingTimeline {
  const boardClips = mapBoardEventsToTimelineClips(boardEvents);
  const clips = mergeBoardClipsIntoTimelineClips(timeline.clips, boardClips);
  const maxClipEndMs = clips.reduce((maxEndMs, clip) => Math.max(maxEndMs, clip.endMs), 0);

  return {
    ...timeline,
    clips,
    durationMs: Math.max(timeline.durationMs, maxClipEndMs),
  };
}
