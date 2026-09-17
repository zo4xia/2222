// @cleanroom-component: VoiceTrack
// @domain: voice-audio-timeline
// @slot: center-timeline/voice-track
// @depends: TeachingProject.timeline.tracks(kind=voice), TeachingProject.timeline.clips(kind=audio), TeachingProject.assets(voiceAudio/voiceTiming)
// @route-impact: App shell only, future route: task-review
// @boundary: A track audio display + B timing adjustment strip

import { SoundOutlined } from '@ant-design/icons';
import { InputNumber, Space, Tag, Typography } from 'antd';
import type { TimelineClip, TimelineTrack } from '../domain/teachingProject';
import { TimelineTrackRow } from './TimelineTrackRow';

const { Text } = Typography;

export function VoiceTrack({
  track,
  clips,
  boardTimingClips,
  durationMs,
  playheadMs,
  selectedClipId,
  onSelectClip,
  onUpdateBoardTiming,
}: {
  track: TimelineTrack;
  clips: TimelineClip[];
  boardTimingClips: TimelineClip[];
  durationMs: number;
  playheadMs: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onUpdateBoardTiming: (clipId: string, patch: Partial<Pick<TimelineClip, 'startMs' | 'endMs'>>) => void;
}) {
  const selectedBoardTimingClip = boardTimingClips.find((clip) => clip.id === selectedClipId);

  return (
    <div className="voice-track">
      <div className="voice-track-meta">
        <Tag color="blue" icon={<SoundOutlined />}>
          讲解音频
        </Tag>
      </div>
      <TimelineTrackRow
        clips={clips}
        durationMs={durationMs}
        onSelectClip={onSelectClip}
        playheadMs={playheadMs}
        selectedClipId={selectedClipId}
        track={track}
      />
      {selectedBoardTimingClip ? (
        <div className="voice-track-b-timing">
          <Space align="center" className="voice-track-b-timing-controls" size={10} wrap>
            <Tag color="gold">素材时长</Tag>
            <Text strong>开始</Text>
            <InputNumber
              min={0}
              onChange={(value) =>
                onUpdateBoardTiming(selectedBoardTimingClip.id, {
                  startMs: normalizeTimelineNumber(value, selectedBoardTimingClip.startMs),
                })
              }
              step={100}
              value={selectedBoardTimingClip.startMs}
            />
            <Text strong>结束</Text>
            <InputNumber
              min={selectedBoardTimingClip.startMs + 100}
              onChange={(value) =>
                onUpdateBoardTiming(selectedBoardTimingClip.id, {
                  endMs: normalizeTimelineNumber(value, selectedBoardTimingClip.endMs),
                })
              }
              step={100}
              value={selectedBoardTimingClip.endMs}
            />
          </Space>
        </div>
      ) : null}
    </div>
  );
}

function normalizeTimelineNumber(value: number | string | null, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }
  return fallback;
}
