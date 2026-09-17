// @cleanroom-component: TimelineTrackRow
// @domain: teaching-timeline
// @slot: center-timeline/track-row
// @depends: TeachingProject.timeline.tracks, TeachingProject.timeline.clips
// @feature-branch: timeline-selection
// @feature-branch: board-audio-alignment
// @io-input: track, clips, selectedClipId, onSelectClip
// @io-output: onSelectClip(clipId)
// @route: TeachingTimeline / track row
// @fields: TimelineTrack, TimelineClip[]
// @boundary: row layout only; does not sort globally, does not mutate clips, does not know external API
// @route-impact: App shell only, future route: task-review

import type { TimelineClip, TimelineTrack } from '../domain/teachingProject';
import { compareBoardClipLayerOrder } from '../modules/boardOrdering';
import { isPlayheadInsideTimelineWindow } from '../modules/timeline/timelineWindow';
import { TimelineClipBlock } from './TimelineClipBlock';

export function TimelineTrackRow({
  track,
  clips,
  durationMs,
  playheadMs,
  selectedClipId,
  onSelectClip,
  onUpdateBoardTiming,
}: {
  track: TimelineTrack;
  clips: TimelineClip[];
  durationMs: number;
  playheadMs: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onUpdateBoardTiming?: (clipId: string, patch: Partial<Pick<TimelineClip, 'startMs' | 'endMs'>>) => void;
}) {
  const safeDurationMs = Math.max(1000, durationMs);
  const sortedClips = [...clips].sort((left, right) => (
    track.kind === 'board'
      ? compareBoardClipLayerOrder(left, right)
      : left.startMs - right.startMs || left.id.localeCompare(right.id)
  ));

  if (track.kind === 'board') {
    const laneCount = sortedClips.length;

    return (
      <div className="track-row track-row--board">
        <div className="track-label">{readUserFacingTrackName(track)}</div>
        <div className="board-sticker-stack">
          {Array.from({ length: laneCount }, (_, laneIndex) => {
            const laneClip = sortedClips[laneIndex];
            return (
              <div className="board-sticker-lane-row" key={laneClip?.id ?? `empty-board-lane-${laneIndex}`}>
                <div className={['track-lane board-sticker-lane', laneClip ? '' : 'is-empty'].filter(Boolean).join(' ')}>
                  <span
                    aria-hidden="true"
                    className="track-playhead"
                    style={{
                      left: `${(Math.min(safeDurationMs, Math.max(0, playheadMs)) / safeDurationMs) * 100}%`,
                    }}
                  />
                  {laneClip ? (
                    <TimelineClipBlock
                      clip={laneClip}
                      durationMs={durationMs}
                      isActive={isPlayheadInsideTimelineWindow(playheadMs, laneClip.startMs, laneClip.endMs)}
                      isSelected={laneClip.id === selectedClipId}
                      layerIndex={laneIndex}
                      onSelectClip={onSelectClip}
                      onUpdateBoardTiming={onUpdateBoardTiming}
                    />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="track-row">
      <div className="track-label">{readUserFacingTrackName(track)}</div>
      <div className="track-lane">
        <span
          aria-hidden="true"
          className="track-playhead"
          style={{
            left: `${(Math.min(safeDurationMs, Math.max(0, playheadMs)) / safeDurationMs) * 100}%`,
          }}
        />
        {sortedClips.map((clip) => (
          <TimelineClipBlock
            clip={clip}
            durationMs={durationMs}
            isActive={isPlayheadInsideTimelineWindow(playheadMs, clip.startMs, clip.endMs)}
            isSelected={clip.id === selectedClipId}
            key={clip.id}
            onSelectClip={onSelectClip}
          />
        ))}
      </div>
    </div>
  );
}

function readUserFacingTrackName(track: TimelineTrack) {
  return track.kind === 'board' ? '素材时长' : '讲解音频';
}
