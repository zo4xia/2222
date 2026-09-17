// @cleanroom-module: voicePlaybackStart
// @domain: voice-audio-playback
// @boundary: A playback start resolution only; never loops A audio from B/C tail state

import type { TimelineClip } from '../../domain/teachingProject';
import { isPlayheadInsideTimelineWindow } from '../timeline/timelineWindow';

export type VoicePlaybackStart = {
  clip: TimelineClip;
  offsetMs: number;
  playheadMs: number;
};

export function resolveVoicePlaybackStart(playheadMs: number, playableClips: TimelineClip[]): VoicePlaybackStart | null {
  const currentClip = playableClips.find((clip) => isPlayheadInsideTimelineWindow(playheadMs, clip.startMs, clip.endMs));
  if (currentClip) {
    return {
      clip: currentClip,
      offsetMs: Math.max(0, playheadMs - currentClip.startMs),
      playheadMs,
    };
  }

  const nextClip = playableClips.find((clip) => clip.endMs > playheadMs);
  if (nextClip) {
    return {
      clip: nextClip,
      offsetMs: 0,
      playheadMs: nextClip.startMs,
    };
  }

  return null;
}
