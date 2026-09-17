// @cleanroom-module: timeline-factory
// @domain: board-audio-alignment
// @slot: timeline-factory/board-clip-writeback-merge
// @depends: TimelineClip
// @feature-branch: board-events
// @feature-branch: timeline-review-workflow
// @data-map: generated TimelineClip(kind=board) -> TeachingProject.timeline.clips
// ID: cleanroom-timeline-board-merge-001
// @io-input: existing TimelineClip[], generated board TimelineClip[], MergeBoardClipsIntoTimelineClipsOptions
// @io-output: TimelineClip[] with generated board clips replaced
// @route: store applyBoardEventsToTimeline / timeline-review-workflow
// @fields: TeachingProject.timeline.clips(kind=board)
// @boundary: pure merge only; keeps non-board clips and manual/custom board clips untouched

import type { TimelineClip } from '../../domain/teachingProject';
import type { MergeBoardClipsIntoTimelineClipsOptions } from './types';

const defaultBoardTrackId = 'track-board';
const defaultGeneratedClipIdPrefix = 'clip-board';

function isGeneratedBoardClip(
  clip: TimelineClip,
  trackId: string,
  generatedClipIdPrefix: string,
): boolean {
  const generatedClipIdPattern = new RegExp(`^${generatedClipIdPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`);
  const generatedSourceRefPattern = /^tts-sentence-\d+$/;
  return (
    clip.kind === 'board' &&
    clip.trackId === trackId &&
    (generatedClipIdPattern.test(clip.id) || generatedSourceRefPattern.test(clip.sourceRef ?? ''))
  );
}

export function mergeBoardClipsIntoTimelineClips(
  existingClips: TimelineClip[],
  generatedBoardClips: TimelineClip[],
  options: MergeBoardClipsIntoTimelineClipsOptions = {},
): TimelineClip[] {
  const trackId = options.trackId ?? defaultBoardTrackId;
  const generatedClipIdPrefix = options.generatedClipIdPrefix ?? defaultGeneratedClipIdPrefix;
  const keptClips = existingClips.filter((clip) => !isGeneratedBoardClip(clip, trackId, generatedClipIdPrefix));

  return [...keptClips, ...generatedBoardClips].sort((left, right) => {
    if (left.startMs !== right.startMs) {
      return left.startMs - right.startMs;
    }
    return left.trackId.localeCompare(right.trackId);
  });
}
