// @cleanroom-module: useVoiceTrackAudio
// @domain: voice-audio-playback
// @depends: TimelineClip(kind=audio).sourceRef, browser HTMLAudioElement
// @io-input: playheadMs, isPlaying, audio clips
// @io-output: onSetPlayhead, onStop, playback status
// @boundary: A audio playback only; does not mutate B timing or C canvas state

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineClip } from '../../domain/teachingProject';
import { setActiveVoiceAudioElement } from './activeVoiceAudioElement';
import { prepareVoiceAudioSeek } from './voiceAudioSeek';
import { resolveVoicePlaybackStart } from './voicePlaybackStart';

export type VoiceTrackAudioStatus = {
  activeClipId: string | null;
  error: string;
  hasPlayableAudio: boolean;
};

type PlaybackClockAnchor = {
  clipEndMs: number;
  clipStartMs: number;
  offsetMs: number;
  startedAtMs: number;
};

export function useVoiceTrackAudio({
  clips,
  isPlaying,
  onSetPlayhead,
  onStop,
  playheadMs,
}: {
  clips: TimelineClip[];
  isPlaying: boolean;
  onSetPlayhead: (playheadMs: number) => void;
  onStop: () => void;
  playheadMs: number;
}): VoiceTrackAudioStatus {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeClipRef = useRef<TimelineClip | null>(null);
  const lastAudioDrivenPlayheadRef = useRef(playheadMs);
  const playheadRef = useRef(playheadMs);
  const playbackClockRef = useRef<PlaybackClockAnchor | null>(null);
  const playheadAnimationFrameIdRef = useRef<number | null>(null);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const playableClips = useMemo(
    () =>
      clips
        .filter((clip) => clip.kind === 'audio' && Boolean(clip.sourceRef))
        .sort((left, right) => left.startMs - right.startMs),
    [clips],
  );

  const stopPlayheadTimer = useCallback(() => {
    if (playheadAnimationFrameIdRef.current !== null) {
      window.cancelAnimationFrame(playheadAnimationFrameIdRef.current);
      playheadAnimationFrameIdRef.current = null;
    }
  }, []);

  const updatePlayheadFromClock = useCallback(() => {
    const clock = playbackClockRef.current;
    if (!clock) {
      return;
    }

    const elapsedMs = performance.now() - clock.startedAtMs;
    const nextPlayheadMs = Math.min(clock.clipEndMs, clock.clipStartMs + Math.round(clock.offsetMs + elapsedMs));
    if (nextPlayheadMs === lastAudioDrivenPlayheadRef.current) {
      return;
    }

    lastAudioDrivenPlayheadRef.current = nextPlayheadMs;
    playheadRef.current = nextPlayheadMs;
    onSetPlayhead(nextPlayheadMs);
  }, [onSetPlayhead]);

  const startPlayheadTimer = useCallback(
    (clip: TimelineClip, offsetMs: number) => {
      stopPlayheadTimer();
      playbackClockRef.current = {
        clipEndMs: clip.endMs,
        clipStartMs: clip.startMs,
        offsetMs,
        startedAtMs: performance.now(),
      };
      const tick = () => {
        updatePlayheadFromClock();
        const clock = playbackClockRef.current;
        if (!clock || playheadRef.current >= clock.clipEndMs) {
          playheadAnimationFrameIdRef.current = null;
          return;
        }
        playheadAnimationFrameIdRef.current = window.requestAnimationFrame(tick);
      };
      playheadAnimationFrameIdRef.current = window.requestAnimationFrame(tick);
    },
    [stopPlayheadTimer, updatePlayheadFromClock],
  );

  useEffect(() => {
    playheadRef.current = playheadMs;
  }, [playheadMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (!isPlaying) {
      audio.pause();
      setActiveVoiceAudioElement(null);
      stopPlayheadTimer();
      playbackClockRef.current = null;
      activeClipRef.current = null;
      setActiveClipId(null);
    }
  }, [isPlaying, stopPlayheadTimer]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    const audio = audioRef.current;
    setActiveVoiceAudioElement(audio);
    const abortController = new AbortController();
    let isCancelled = false;

    const playClip = async (clip: TimelineClip, offsetMs: number) => {
      setError('');
      activeClipRef.current = clip;
      setActiveClipId(clip.id);

      const source = resolveAudioSource(clip.sourceRef);
      try {
        await prepareVoiceAudioSeek({
          audio,
          offsetMs,
          signal: abortController.signal,
          source,
        });
        if (isCancelled) {
          return;
        }
        await audio.play();
        startPlayheadTimer(clip, offsetMs);
      } catch (caughtError) {
        if (!isCancelled) {
          setError(caughtError instanceof Error ? caughtError.message : '浏览器阻止了音频播放。');
          onStop();
        }
      }
    };

    const handleTimeUpdate = updatePlayheadFromClock;

    const handleEnded = () => {
      stopPlayheadTimer();
      playbackClockRef.current = null;
      const currentClip = activeClipRef.current;
      const currentIndex = currentClip ? playableClips.findIndex((clip) => clip.id === currentClip.id) : -1;
      const nextClip =
        currentIndex >= 0 ? playableClips[currentIndex + 1] : findNextPlayableClip(playheadRef.current + 1, playableClips);
      if (!nextClip) {
        const finalPlayheadMs =
          currentClip?.endMs ?? playableClips[playableClips.length - 1]?.endMs ?? playheadRef.current;
        lastAudioDrivenPlayheadRef.current = finalPlayheadMs;
        playheadRef.current = finalPlayheadMs;
        onSetPlayhead(finalPlayheadMs);
        activeClipRef.current = null;
        setActiveClipId(null);
        setActiveVoiceAudioElement(null);
        onStop();
        return;
      }
      lastAudioDrivenPlayheadRef.current = nextClip.startMs;
      playheadRef.current = nextClip.startMs;
      onSetPlayhead(nextClip.startMs);
      void playClip(nextClip, 0);
    };

    const handleError = () => {
      if (isCancelled) {
        return;
      }
      setError('A 轨音频文件无法读取，请重新生成或检查本地语音文件是否还在。');
      activeClipRef.current = null;
      setActiveClipId(null);
      setActiveVoiceAudioElement(null);
      onStop();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    const playbackStart = resolveVoicePlaybackStart(playheadRef.current, playableClips);
    if (!playbackStart) {
      setError(
        playableClips.length
          ? '播放头已在 A 轨语音结尾之后；请把 A 主时钟拖回语音范围再播放。'
          : '当前还没有可播放的 A 轨音频，请先生成真实语音。',
      );
      activeClipRef.current = null;
      setActiveClipId(null);
      onStop();
    } else {
      if (playbackStart.playheadMs !== playheadRef.current) {
        lastAudioDrivenPlayheadRef.current = playbackStart.playheadMs;
        playheadRef.current = playbackStart.playheadMs;
        onSetPlayhead(playbackStart.playheadMs);
      }
      void playClip(playbackStart.clip, playbackStart.offsetMs);
    }

    return () => {
      isCancelled = true;
      abortController.abort();
      stopPlayheadTimer();
      playbackClockRef.current = null;
      setActiveVoiceAudioElement(null);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [isPlaying, onSetPlayhead, onStop, playableClips, startPlayheadTimer, stopPlayheadTimer, updatePlayheadFromClock]);

  useEffect(() => {
    playheadRef.current = playheadMs;

    if (!isPlaying || Math.abs(playheadMs - lastAudioDrivenPlayheadRef.current) <= 75) {
      return;
    }

    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const playbackStart = resolveVoicePlaybackStart(playheadMs, playableClips);
    if (!playbackStart) {
      setError(
        playableClips.length
          ? '播放头已在 A 轨语音结尾之后；请把 A 主时钟拖回语音范围再播放。'
          : '当前还没有可播放的 A 轨音频，请先生成真实语音。',
      );
      audio.pause();
      activeClipRef.current = null;
      setActiveClipId(null);
      setActiveVoiceAudioElement(null);
      onStop();
      return;
    }

    const abortController = new AbortController();
    activeClipRef.current = playbackStart.clip;
    setActiveClipId(playbackStart.clip.id);
    setError('');
    lastAudioDrivenPlayheadRef.current = playbackStart.playheadMs;

    if (playbackStart.playheadMs !== playheadMs) {
      lastAudioDrivenPlayheadRef.current = playbackStart.playheadMs;
      playheadRef.current = playbackStart.playheadMs;
      onSetPlayhead(playbackStart.playheadMs);
    }

    const source = resolveAudioSource(playbackStart.clip.sourceRef);
    void prepareVoiceAudioSeek({
      audio,
      offsetMs: playbackStart.offsetMs,
      signal: abortController.signal,
      source,
    })
      .then(() => audio.play())
      .then(() => startPlayheadTimer(playbackStart.clip, playbackStart.offsetMs))
      .catch((caughtError) => {
        if (abortController.signal.aborted) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : '浏览器阻止了音频播放。');
        onStop();
      });

    return () => abortController.abort();
  }, [isPlaying, onSetPlayhead, onStop, playableClips, playheadMs, startPlayheadTimer]);

  return {
    activeClipId,
    error,
    hasPlayableAudio: playableClips.length > 0,
  };
}

function findNextPlayableClip(playheadMs: number, clips: TimelineClip[]) {
  return clips.find((clip) => clip.endMs > playheadMs);
}

function resolveAudioSource(sourceRef: string | undefined) {
  if (!sourceRef) {
    return '';
  }
  if (typeof window === 'undefined') {
    return sourceRef;
  }
  return new URL(sourceRef, window.location.href).href;
}
