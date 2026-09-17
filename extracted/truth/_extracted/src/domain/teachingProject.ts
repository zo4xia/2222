import {
  createBoardTypographyConfig,
  DEFAULT_BOARD_FONT_NAME,
  DEFAULT_BOARD_FONT_SIZE,
  DEFAULT_BOARD_FONT_URL,
} from '../modules/boardFont/boardFontConfig';
import type { ScriptRow } from '../protocols';

export type TrackKind = 'voice' | 'speech' | 'board' | 'marker';

export type TimelineTrack = {
  id: string;
  kind: TrackKind;
  name: string;
};

export type TimelineClipKind = 'audio' | 'speech' | 'board' | 'marker';

export type TimelineClip = {
  id: string;
  trackId: string;
  kind: TimelineClipKind;
  chainKey?: string;
  label: string;
  startMs: number;
  endMs: number;
  color?: string;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  fontSize?: number;
  drawSpeed?: number;
  revealStartMs?: number;
  revealEndMs?: number;
  sourceStartMs?: number;
  sourceEndMs?: number;
  sourceRef?: string;
};

export type TeachingTimeline = {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  playheadMs: number;
  durationMs: number;
};

export type StageCanvasPreset = 'landscape-1080p' | 'landscape-720p' | 'classic-4-3' | 'portrait-1080p' | 'square-1080' | 'custom';

export type StageCanvasConfig = {
  preset: StageCanvasPreset;
  width: number;
  height: number;
  background: string;
  boardFontFamily: string;
  boardFontName: string;
  boardFontSize: number;
  boardFontUrl: string;
};

export type TeachingAssetKind =
  | 'problemImage'
  | 'problemText'
  | 'scriptText'
  | 'boardLayout'
  | 'voiceAudio'
  | 'voiceTiming'
  | 'exportResult';

export type TeachingAssetStatus = 'missing' | 'ready' | 'needsReview' | 'done';

export type TeachingAsset = {
  id: string;
  kind: TeachingAssetKind;
  title: string;
  status: TeachingAssetStatus;
  summary: string;
  source: 'manual' | 'feishu' | 'agent' | 'tts' | 'export';
  sourceRef?: string;
};

export type TeachingCAssetStatus = 'queued';

export type TeachingCAsset = {
  id: string;
  boardEventId: string;
  sentenceId: string;
  chainKey?: string;
  markerText: string;
  rawSentenceText: string;
  estimatedDurationMs: number;
  revealBudgetMs: number;
  fontFamily: string;
  fontName: string;
  fontUrl: string;
  fingerprint: string;
  status: TeachingCAssetStatus;
};

export type CLayoutPreviewItem = {
  id: string;
  rowId: string;
  chainKey?: string;
  text: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  fontSize: number;
  groupKey: string;
  stackIndex: number;
};

export type CLayoutPreviewDraft = {
  version: 'c-layout-preview-v1';
  generatedAt: string;
  items: CLayoutPreviewItem[];
};

export type GoldenFingerPoint = {
  x: number;
  y: number;
};

export type GoldenFingerStroke = {
  color: string;
  mode: 'pen' | 'eraser';
  points: GoldenFingerPoint[];
  width: number;
};

export type TeachingProject = {
  id: string;
  title: string;
  createdAt: string;
  stage: {
    canvas: StageCanvasConfig;
  };
  task: {
    source: 'manual' | 'feishu';
    taskId?: string;
  };
  assets: TeachingAsset[];
  cAssets: TeachingCAsset[];
  goldenFingerOverlays: GoldenFingerStroke[];
  timeline: TeachingTimeline;
};

export type ScriptAgentDraftRow = {
  id: ScriptRow['id'];
  chainKey?: string;
  section: string;
  stepLabel: string;
  voiceText: ScriptRow['voiceText'];
  boardSlice: string;
};

export type ScriptAgentDraft = {
  spokenScript: string;
  boardPlan: string;
  rows?: ScriptAgentDraftRow[];
};

export type VoiceAudioPayload = {
  audioUrl: string;
  durationMs?: number;
  summary?: string;
};

export type VoiceTimingPayload = {
  timingJson: string;
  summary?: string;
};

export type TtsSentenceUnit = {
  id: string;
  chainKey?: string;
  text: string;
  speechText: string;
  order: number;
  hasBoardMarker: boolean;
  boardMarkerText?: string;
  boardMarkerTexts?: string[];
  boardMarkerChainKeys?: string[];
  estimatedDurationMs?: number;
};

export type TtsBatchJob = {
  id: string;
  sentenceIds: string[];
  maxDurationMs: 60000;
  concurrencyLimit: 5;
};

export type TtsSentenceResult = {
  sentenceId: string;
  chainKey?: string;
  audioUrl: string;
  timingJson: string;
  durationMs: number;
  error?: string;
  requestId?: string;
  status?: 'ready' | 'failed';
};

export type TtsBatchResult = {
  jobId: string;
  results: TtsSentenceResult[];
  rawProvider: 'aliyun' | 'manual' | 'future-provider';
};

export type BoardEventSource = 'sync-marker';

export type BoardEvent = {
  id: string;
  chainKey?: string;
  sentenceId: string;
  text: string;
  startMs: number;
  endMs: number;
  source: BoardEventSource;
};

export type TtsBatchUiStatus = 'pending' | 'requesting' | 'jsonReady' | 'audioReady' | 'onTrack' | 'failed';

export type TtsBatchUiItem = {
  id: string;
  label: string;
  sentenceIds: string[];
  status: TtsBatchUiStatus;
  audioTrackLabel?: string;
  error?: string;
};

export const createSeedProject = (): TeachingProject => {
  const boardTypography = createBoardTypographyConfig({
    boardFontName: DEFAULT_BOARD_FONT_NAME,
    boardFontSize: DEFAULT_BOARD_FONT_SIZE,
    boardFontUrl: DEFAULT_BOARD_FONT_URL,
  });

  return {
    id: 'seed-project',
    title: '新的教学剪辑工程',
    createdAt: new Date().toISOString(),
    stage: {
      canvas: {
        background: '#ffffff',
        ...boardTypography,
        height: 1080,
        preset: 'landscape-1080p',
        width: 1920,
      },
    },
    task: {
      source: 'manual',
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        title: '图片题目文本',
        status: 'missing',
        summary: '',
        source: 'manual',
      },
      {
        id: 'asset-script',
        kind: 'scriptText',
        title: '解题讲解文稿',
        status: 'missing',
        summary: '',
        source: 'manual',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        title: 'C素材候选',
        status: 'missing',
        summary: '',
        source: 'manual',
      },
      {
        id: 'asset-voice-audio',
        kind: 'voiceAudio',
        title: 'A 语音音频',
        status: 'missing',
        summary: '阿里云 TTS 返回的音频地址或本地缓存。',
        source: 'tts',
      },
      {
        id: 'asset-voice-timing',
        kind: 'voiceTiming',
        title: '语音时序 JSON',
        status: 'missing',
        summary: '用于把板书事件自动排到时间轴。',
        source: 'tts',
      },
    ],
    cAssets: [],
    goldenFingerOverlays: [],
    timeline: {
      playheadMs: 0,
      durationMs: 9000,
      tracks: [
        { id: 'track-voice', kind: 'voice', name: 'A 语音轨' },
        { id: 'track-board', kind: 'board', name: 'B 寿命轨' },
      ],
      clips: [
        {
          id: 'clip-voice-1',
          trackId: 'track-voice',
          kind: 'audio',
          label: '音频 1｜同学你好',
          startMs: 0,
          endMs: 1800,
        },
        {
          id: 'clip-voice-2',
          trackId: 'track-voice',
          kind: 'audio',
          label: '音频 2｜先算括号',
          startMs: 1800,
          endMs: 4200,
        },
        {
          id: 'clip-voice-3',
          trackId: 'track-voice',
          kind: 'audio',
          label: '音频 3｜再算除法',
          startMs: 4200,
          endMs: 6800,
        },
      ],
    },
  };
};
