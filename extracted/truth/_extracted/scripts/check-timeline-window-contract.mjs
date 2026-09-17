import { readFileSync } from 'node:fs';

const helperText = readFileSync('src/modules/timeline/timelineWindow.ts', 'utf8');
const autoHandwritingText = readFileSync('src/components/AutoHandwritingLayer.tsx', 'utf8');
const timelineTrackRowText = readFileSync('src/components/TimelineTrackRow.tsx', 'utf8');
const voicePlaybackStartText = readFileSync('src/modules/audioPlayback/voicePlaybackStart.ts', 'utf8');

if (!helperText.includes('playheadMs >= startMs && playheadMs < endMs')) {
  throw new Error('Timeline window contract must be [startMs, endMs).');
}

for (const [name, text] of [
  ['AutoHandwritingLayer', autoHandwritingText],
  ['TimelineTrackRow', timelineTrackRowText],
  ['voicePlaybackStart', voicePlaybackStartText],
]) {
  if (!text.includes('isPlayheadInsideTimelineWindow')) {
    throw new Error(`${name} must use isPlayheadInsideTimelineWindow for A/B/C active window checks.`);
  }
}

for (const [name, text] of [
  ['AutoHandwritingLayer', autoHandwritingText],
  ['TimelineTrackRow', timelineTrackRowText],
  ['voicePlaybackStart', voicePlaybackStartText],
]) {
  if (text.includes('playheadMs >= clip.startMs && playheadMs <= clip.endMs') || text.includes('playheadMs >= laneClip.startMs && playheadMs <= laneClip.endMs')) {
    throw new Error(`${name} still uses inclusive end boundary.`);
  }
}

console.log('timeline window contract ok: [startMs, endMs)');
