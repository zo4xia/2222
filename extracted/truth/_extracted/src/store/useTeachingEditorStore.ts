// @@STORE_ROOT
// 唯一状态管理入口：TeachingProject + AppConfig + ScriptAgentDraft + 播放状态
// 关键 action：applyScriptAgentDraft / applyTtsSentenceResults / applyBoardEventsToTimeline / syncCAssetPrewarmQueue
import { create } from 'zustand';
import { defaultConfig, type AppConfig } from '../config/defaultConfig';
import {
  type BoardEvent,
  createSeedProject,
  type ScriptAgentDraft,
  type StageCanvasConfig,
  type TeachingAsset,
  type TeachingProject,
  type CLayoutPreviewDraft,
  type TeachingCAsset,
  type TeachingAssetKind,
  type TimelineClip,
  type TtsSentenceResult,
  type VoiceAudioPayload,
  type VoiceTimingPayload,
} from '../domain/teachingProject';
import {
  createBoardTypographyConfig,
} from '../modules/boardFont/boardFontConfig';
import { createAbcChainLabel, createScriptChainKeysSourceRef } from '../modules/abcChain/abcChainKey';
import { normalizeBoardStickerVisualPatch } from '../modules/boardSticker';
import { normalizeBoardDisplayWindow } from '../modules/boardTiming';
import { normalizeBoardRevealWindow } from '../modules/boardReveal';
import { hasScriptAgentDraftContent, normalizeScriptAgentDraft } from '../modules/scriptAgentDraft';
import { applyBoardEventsToTeachingTimeline } from '../modules/timeline-factory';
import { isReadyTtsSentenceResult, sortTtsSentenceResultsBySentenceOrder } from '../modules/timeline-factory/orderTtsSentenceResults';

type TeachingEditorState = {
  config: AppConfig;
  scriptAgentCandidateDraft: ScriptAgentDraft;
  project: TeachingProject;
  pendingProject: TeachingProject | null;
  layoutPreviewDraft: CLayoutPreviewDraft | null;
  selectedClipId: string | null;
  isPlaying: boolean;
  livePlayheadMs: number | null;
  updateConfig: (config: AppConfig) => void;
  selectClip: (clipId: string | null) => void;
  setLiveTimelinePlayhead: (playheadMs: number | null) => void;
  setTimelinePlayhead: (playheadMs: number) => void;
  setPlayingState: (playing: boolean) => void;
  importProblemImage: (file: File) => void;
  updateProblemText: (text: string) => void;
  applyRecognizedProblemText: (text: string, confirm?: boolean) => void;
  confirmProblemText: () => void;
  updateScriptText: (text: string) => void;
  updateBoardLayout: (text: string) => void;
  updateScriptAgentCandidateDraft: (draft: ScriptAgentDraft) => void;
  patchScriptAgentCandidateDraft: (patch: Partial<ScriptAgentDraft>) => void;
  resetScriptAgentCandidateDraft: () => void;
  syncLayoutPreviewDraft: (draft: CLayoutPreviewDraft | null) => void;
  clearLayoutPreviewDraft: () => void;
  restoreProjectSnapshot: (
    project: TeachingProject,
    options?: { preservePendingProject?: boolean; preserveScriptAgentCandidateDraft?: boolean },
  ) => void;
  applyScriptAgentDraft: (draft: ScriptAgentDraft) => void;
  updateVoiceAudio: (payload: VoiceAudioPayload) => void;
  updateVoiceTiming: (payload: VoiceTimingPayload) => void;
  updateStageCanvas: (canvas: StageCanvasConfig) => void;
  applyTtsSentenceResults: (results: TtsSentenceResult[]) => void;
  applyBoardEventsToTimeline: (boardEvents: BoardEvent[]) => void;
  syncCAssetPrewarmQueue: (cAssets: TeachingCAsset[]) => void;
  updateBoardClip: (clipId: string, patch: BoardClipPatch) => void;
  updateBoardTiming: (clipId: string, patch: Partial<Pick<TimelineClip, 'startMs' | 'endMs'>>) => void;
  updateSelectedBoardClip: (patch: BoardClipPatch) => void;
};

type BoardClipPatch = Partial<
  Pick<
    TimelineClip,
    | 'label'
    | 'startMs'
    | 'endMs'
    | 'color'
    | 'xPercent'
    | 'yPercent'
    | 'widthPercent'
    | 'fontSize'
    | 'drawSpeed'
    | 'revealStartMs'
    | 'revealEndMs'
  >
>;

const problemImageAssetId = 'asset-problem-image-current';
const configStorageKey = 'cleanroom-app-config-v1';
const projectStorageKey = 'cleanroom-teaching-project-v1';
const pendingProjectStorageKey = 'cleanroom-pending-teaching-project-v1';
const scriptAgentCandidateDraftStorageKey = 'cleanroom-script-agent-candidate-draft-v1';

const assetIdsByKind: Partial<Record<TeachingAssetKind, string>> = {
  problemText: 'asset-problem-text',
  scriptText: 'asset-script',
  boardLayout: 'asset-board-layout',
  voiceAudio: 'asset-voice-audio',
  voiceTiming: 'asset-voice-timing',
};

function updateAsset(
  assets: TeachingAsset[],
  kind: TeachingAssetKind,
  patch: Partial<TeachingAsset>,
): TeachingAsset[] {
  const assetId = assetIdsByKind[kind];
  return assets.map((asset) =>
    asset.id === assetId || asset.kind === kind
      ? {
        ...asset,
        ...patch,
      }
      : asset,
  );
}

function updateAssetSummary(assets: TeachingAsset[], kind: TeachingAssetKind, summary: string, source: TeachingAsset['source']) {
  const patch: Partial<TeachingAsset> = {
    summary,
    source,
  };
  if (summary.trim()) {
    patch.status = 'ready';
  }
  return updateAsset(assets, kind, {
    ...patch,
  });
}

function createEmptyScriptAgentDraft(): ScriptAgentDraft {
  return {
    boardPlan: '',
    spokenScript: '',
  };
}

export const useTeachingEditorStore = create<TeachingEditorState>((set) => {
  const initialConfig = loadPersistedConfig();

  return {
    config: initialConfig,
    scriptAgentCandidateDraft: loadPersistedScriptAgentCandidateDraft(),
    project: loadPersistedProject(initialConfig),
    pendingProject: loadPersistedPendingProject(initialConfig),
    layoutPreviewDraft: null,
    selectedClipId: null,
    isPlaying: false,
    livePlayheadMs: null,
    updateConfig: (config) =>
      set(() => {
        const normalizedConfig = mergeConfig(config);
        persistConfig(normalizedConfig);
        return {
          config: normalizedConfig,
        };
      }),
    selectClip: (clipId) => set({ selectedClipId: clipId }),
    setPlayingState: (playing) => {
      setProjectPersistencePlayingState(playing);
      set((state) => {
        if (playing) {
          return { isPlaying: true };
        }

        if (state.livePlayheadMs === null) {
          return { isPlaying: false };
        }

        const project: TeachingProject = {
          ...state.project,
          timeline: {
            ...state.project.timeline,
            playheadMs: clampNumber(state.livePlayheadMs, 0, state.project.timeline.durationMs),
          },
        };
        return {
          isPlaying: false,
          livePlayheadMs: null,
          project: persistProject(project),
        };
      });
    },
    setLiveTimelinePlayhead: (playheadMs) =>
      set((state) => ({
        livePlayheadMs:
          playheadMs === null ? null : clampNumber(playheadMs, 0, state.project.timeline.durationMs),
      })),
    setTimelinePlayhead: (playheadMs) =>
      set((state) => {
        const project: TeachingProject = {
          ...state.project,
          timeline: {
            ...state.project.timeline,
            playheadMs: clampNumber(playheadMs, 0, state.project.timeline.durationMs),
          },
        };
        return {
          livePlayheadMs: null,
          project: persistProject(project),
        };
      }),
    importProblemImage: (file) =>
      set((state) => {
        const importedAt = new Date().toISOString();
        const taskId = createTaskId(importedAt);
        const seedProject = createSeedProjectFromConfig(state.config);
        const imageUrl = URL.createObjectURL(file);
        const imageTitle = file.name || '本地题目图片';
        const imageAsset: TeachingAsset = {
          id: `${problemImageAssetId}-${taskId}`,
          kind: 'problemImage',
          title: imageTitle,
          status: 'ready',
          summary: '本地导入的当前题图，未接 API 时作为画布预览和识别输入。',
          source: 'manual',
          sourceRef: imageUrl,
        };
        const assets = [imageAsset, ...seedProject.assets];

        const project: TeachingProject = {
          ...seedProject,
          assets,
          createdAt: importedAt,
          id: taskId,
          task: {
            source: 'manual',
            taskId,
          },
          title: createProjectTitleFromFileName(imageTitle, taskId),
        };

        return {
          pendingProject: persistPendingProject(project),
          scriptAgentCandidateDraft: clearPersistedScriptAgentCandidateDraft(),
          layoutPreviewDraft: null,
        };
      }),
    updateProblemText: (text) =>
      set((state) => {
        const targetProject = state.pendingProject ?? state.project;
        const project = {
          ...targetProject,
          assets: updateAsset(targetProject.assets, 'problemText', {
            summary: text,
            source: 'manual',
            status: text.trim() ? 'needsReview' : 'missing',
          }),
        };
        return {
          ...(state.pendingProject ? { pendingProject: persistPendingProject(project) } : { project: persistProject(project) }),
        };
      }),
    applyRecognizedProblemText: (text, confirm = false) =>
      set((state) => {
        const targetProject = state.pendingProject ?? state.project;
        const project = {
          ...targetProject,
          assets: updateAsset(targetProject.assets, 'problemText', {
            summary: text,
            source: 'agent',
            status: text.trim() ? (confirm ? 'ready' : 'needsReview') : 'missing',
          }),
        };
        return {
          ...(state.pendingProject ? { pendingProject: persistPendingProject(project) } : { project: persistProject(project) }),
        };
      }),
    confirmProblemText: () =>
      set((state) => {
        const targetProject = state.pendingProject ?? state.project;
        const problemText = targetProject.assets.find((asset) => asset.kind === 'problemText')?.summary.trim();
        if (!problemText) {
          return state;
        }

        const project = {
          ...targetProject,
          assets: updateAsset(targetProject.assets, 'problemText', {
            status: 'ready',
            source: 'manual',
          }),
        };
        return {
          ...(state.pendingProject ? { pendingProject: persistPendingProject(project) } : { project: persistProject(project) }),
        };
      }),
    updateScriptText: (text) =>
      set((state) => {
        const targetProject = state.pendingProject ?? state.project;
        const project = {
          ...targetProject,
          assets: updateAsset(updateAssetSummary(targetProject.assets, 'scriptText', text, 'manual'), 'scriptText', {
            sourceRef: '',
          }),
        };
        return {
          ...(state.pendingProject ? { pendingProject: persistPendingProject(project) } : { project: persistProject(project) }),
        };
      }),
    updateBoardLayout: (text) =>
      set((state) => {
        const targetProject = state.pendingProject ?? state.project;
        const project = {
          ...targetProject,
          assets: updateAssetSummary(targetProject.assets, 'boardLayout', text, 'manual'),
        };
        return {
          ...(state.pendingProject ? { pendingProject: persistPendingProject(project) } : { project: persistProject(project) }),
        };
      }),
    updateScriptAgentCandidateDraft: (draft) =>
      set((state) => {
        const normalizedDraft = normalizeScriptAgentDraft(draft);
        if (shouldKeepExistingScriptAgentDraft(state.scriptAgentCandidateDraft, normalizedDraft)) {
          return state;
        }
        persistScriptAgentCandidateDraft(normalizedDraft);
        return { scriptAgentCandidateDraft: normalizedDraft };
      }),
    patchScriptAgentCandidateDraft: (patch) =>
      set((state) => {
        const normalizedDraft = normalizeScriptAgentDraft({
          ...state.scriptAgentCandidateDraft,
          ...patch,
        });
        if (shouldKeepExistingScriptAgentDraft(state.scriptAgentCandidateDraft, normalizedDraft)) {
          return state;
        }
        persistScriptAgentCandidateDraft(normalizedDraft);
        return {
          scriptAgentCandidateDraft: normalizedDraft,
        };
      }),
    resetScriptAgentCandidateDraft: () => set({ scriptAgentCandidateDraft: clearPersistedScriptAgentCandidateDraft() }),
    syncLayoutPreviewDraft: (draft) => set({ layoutPreviewDraft: draft }),
    clearLayoutPreviewDraft: () => set({ layoutPreviewDraft: null }),
    restoreProjectSnapshot: (project, options) => {
      const normalizedProject = {
        ...project,
        stage: {
          ...project.stage,
          canvas: normalizeStageCanvas(project.stage.canvas),
        },
      };
      set({
        project: persistProject(normalizedProject),
        ...(options?.preservePendingProject ? {} : { pendingProject: clearPersistedPendingProject() }),
        layoutPreviewDraft: null,
        livePlayheadMs: null,
        scriptAgentCandidateDraft: options?.preserveScriptAgentCandidateDraft
          ? loadPersistedScriptAgentCandidateDraft()
          : clearPersistedScriptAgentCandidateDraft(),
        selectedClipId: null,
      });
    },
    applyScriptAgentDraft: (draft) =>
      set((state) => {
        const normalizedDraft = normalizeScriptAgentDraft(draft);
        const scriptRowsSourceRef = createScriptChainKeysSourceRef(normalizedDraft.rows);
        const targetProject = state.pendingProject ?? state.project;
        const project = {
          ...targetProject,
          assets: updateAssetSummary(
            updateAsset(updateAssetSummary(targetProject.assets, 'scriptText', normalizedDraft.spokenScript, 'agent'), 'scriptText', {
              sourceRef: scriptRowsSourceRef,
            }),
            'boardLayout',
            normalizedDraft.boardPlan,
            'agent',
          ),
        };
        return {
          project: persistProject(project),
          pendingProject: clearPersistedPendingProject(),
          selectedClipId: state.pendingProject ? null : state.selectedClipId,
          scriptAgentCandidateDraft: persistScriptAgentCandidateDraft(normalizedDraft),
        };
      }),
    updateVoiceAudio: (payload) =>
      set((state) => {
        const durationText = payload.durationMs ? `，时长 ${Math.round(payload.durationMs / 1000)} 秒` : '';
        const project = {
          ...state.project,
          assets: updateAsset(state.project.assets, 'voiceAudio', {
            status: payload.audioUrl ? 'ready' : 'missing',
            summary: payload.summary || `TTS 音频已写入${durationText}。`,
            source: 'tts',
            sourceRef: payload.audioUrl,
          }),
        };
        return {
          project: persistProject(project),
        };
      }),
    updateVoiceTiming: (payload) =>
      set((state) => {
        const project = {
          ...state.project,
          assets: updateAsset(state.project.assets, 'voiceTiming', {
            status: payload.timingJson.trim() ? 'ready' : 'missing',
            summary: payload.summary || 'TTS 时序 JSON 已写入，等待解析同步标记。',
            source: 'tts',
            sourceRef: payload.timingJson,
          }),
        };
        return {
          project: persistProject(project),
        };
      }),
    updateStageCanvas: (canvas) =>
      set((state) => {
        const project = {
          ...state.project,
          stage: {
            ...state.project.stage,
            canvas: normalizeStageCanvas(canvas),
          },
        };
        return {
          project: persistProject(project),
        };
      }),
    applyTtsSentenceResults: (results) =>
      set((state) => {
        const readyResults = sortTtsSentenceResultsBySentenceOrder(results.filter(isReadyTtsSentenceResult));
        const audioClips = createVoiceTimelineClips(readyResults);
        const totalDurationMs = audioClips.reduce((maxEndMs, clip) => Math.max(maxEndMs, clip.endMs), 0);
        const clips = [
          ...state.project.timeline.clips.filter((clip) => !(clip.trackId === 'track-voice' && clip.kind === 'audio')),
          ...audioClips,
        ].sort((left, right) => {
          if (left.startMs !== right.startMs) {
            return left.startMs - right.startMs;
          }
          return left.trackId.localeCompare(right.trackId);
        });

        const project = {
          ...state.project,
          assets: updateAsset(
            updateAsset(state.project.assets, 'voiceAudio', {
              source: 'tts',
              sourceRef: readyResults.map((result) => result.audioUrl).join('\n'),
              status: readyResults.length ? 'ready' : 'missing',
              summary: readyResults.length
                ? `真实 CosyVoice 已生成 ${readyResults.length} 句 A 轨音频，总时长约 ${Math.round(totalDurationMs / 1000)} 秒。`
                : '真实 CosyVoice 未返回可用音频。',
            }),
            'voiceTiming',
            {
              source: 'tts',
              sourceRef: readyResults.map((result) => result.timingJson).filter(Boolean).join('\n'),
              status: readyResults.some((result) => result.timingJson.trim()) ? 'ready' : 'missing',
              summary: readyResults.length ? `真实 CosyVoice 时序 JSON 已写入 ${readyResults.length} 句。` : '真实 CosyVoice 未返回时序 JSON。',
            },
          ),
          timeline: {
            ...state.project.timeline,
            clips,
            durationMs: Math.max(state.project.timeline.durationMs, totalDurationMs, ...clips.map((clip) => clip.endMs)),
          },
        };
        return {
          project: persistProject(project),
        };
      }),
    applyBoardEventsToTimeline: (boardEvents) =>
      set((state) => {
        const project = {
          ...state.project,
          timeline: applyBoardEventsToTeachingTimeline(state.project.timeline, boardEvents),
        };
        return {
          project: persistProject(project),
        };
      }),
    syncCAssetPrewarmQueue: (cAssets) =>
      set((state) => {
        const project = {
          ...state.project,
          cAssets,
        };
        return {
          project: persistProject(project),
        };
      }),
    updateBoardClip: (clipId, patch) =>
      set((state) => updateBoardClipState(state, clipId, patch)),
    updateBoardTiming: (clipId: string, patch: Partial<Pick<TimelineClip, 'startMs' | 'endMs'>>) =>
      set((state) => updateBoardClipState(state, clipId, patch)),
    updateSelectedBoardClip: (patch) =>
      set((state) => {
        const selectedClipId = state.selectedClipId;
        if (!selectedClipId) {
          return state;
        }

        return updateBoardClipState(state, selectedClipId, patch);
      }),
  };
});

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Window & { __TEACHING_EDITOR_STORE__?: typeof useTeachingEditorStore }).__TEACHING_EDITOR_STORE__ = useTeachingEditorStore;
}

function loadPersistedConfig(): AppConfig {
  if (typeof window === 'undefined') {
    return defaultConfig;
  }

  try {
    const rawConfig = window.localStorage.getItem(configStorageKey);
    if (!rawConfig) {
      return defaultConfig;
    }
    return mergeConfig(JSON.parse(rawConfig));
  } catch {
    return defaultConfig;
  }
}

function loadPersistedProject(config: AppConfig): TeachingProject {
  const seedProject = createSeedProjectFromConfig(config);
  if (typeof window === 'undefined') {
    return seedProject;
  }

  try {
    const rawProject = window.localStorage.getItem(projectStorageKey);
    if (!rawProject) {
      return seedProject;
    }

    const parsedProject = JSON.parse(rawProject) as Partial<TeachingProject>;
    const parsedTimeline = parsedProject.timeline ?? seedProject.timeline;
    const clips = Array.isArray(parsedTimeline.clips) ? parsedTimeline.clips : seedProject.timeline.clips;
    const durationMs = Math.max(seedProject.timeline.durationMs, ...clips.map((clip) => Number(clip.endMs) || 0));

    return {
      ...seedProject,
      ...parsedProject,
      assets: Array.isArray(parsedProject.assets) ? parsedProject.assets : seedProject.assets,
      cAssets: Array.isArray(parsedProject.cAssets) ? parsedProject.cAssets : seedProject.cAssets,
      stage: {
        ...seedProject.stage,
        ...parsedProject.stage,
        canvas: normalizeStageCanvas({
          ...seedProject.stage.canvas,
          ...parsedProject.stage?.canvas,
        }),
      },
      timeline: {
        ...seedProject.timeline,
        ...parsedTimeline,
        clips,
        durationMs,
        playheadMs: clampNumber(Number(parsedTimeline.playheadMs) || 0, 0, durationMs),
        tracks: Array.isArray(parsedTimeline.tracks) ? parsedTimeline.tracks : seedProject.timeline.tracks,
      },
    };
  } catch {
    return seedProject;
  }
}

function loadPersistedPendingProject(config: AppConfig): TeachingProject | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawProject = window.localStorage.getItem(pendingProjectStorageKey);
    if (!rawProject) {
      return null;
    }

    return normalizePersistedProject(JSON.parse(rawProject) as Partial<TeachingProject>, createSeedProjectFromConfig(config));
  } catch {
    return null;
  }
}

function normalizePersistedProject(parsedProject: Partial<TeachingProject>, seedProject: TeachingProject): TeachingProject {
  const parsedTimeline = parsedProject.timeline ?? seedProject.timeline;
  const clips = Array.isArray(parsedTimeline.clips) ? parsedTimeline.clips : seedProject.timeline.clips;
  const durationMs = Math.max(seedProject.timeline.durationMs, ...clips.map((clip) => Number(clip.endMs) || 0));

  return {
    ...seedProject,
    ...parsedProject,
    assets: Array.isArray(parsedProject.assets) ? parsedProject.assets : seedProject.assets,
    cAssets: Array.isArray(parsedProject.cAssets) ? parsedProject.cAssets : seedProject.cAssets,
    stage: {
      ...seedProject.stage,
      ...parsedProject.stage,
      canvas: normalizeStageCanvas({
        ...seedProject.stage.canvas,
        ...parsedProject.stage?.canvas,
      }),
    },
    timeline: {
      ...seedProject.timeline,
      ...parsedTimeline,
      clips,
      durationMs,
      playheadMs: clampNumber(Number(parsedTimeline.playheadMs) || 0, 0, durationMs),
      tracks: Array.isArray(parsedTimeline.tracks) ? parsedTimeline.tracks : seedProject.timeline.tracks,
    },
  };
}

// 添加播放状态检查，避免播放时的localStorage持久化
let isProjectPersistencePlaying = false;

function setProjectPersistencePlayingState(playing: boolean) {
  isProjectPersistencePlaying = playing;
}

function persistProject(project: TeachingProject): TeachingProject {
  // 播放时不持久化playheadMs变化，避免同步IO阻塞
  if (typeof window !== 'undefined' && !isProjectPersistencePlaying) {
    window.localStorage.setItem(projectStorageKey, JSON.stringify(project));
  }
  return project;
}

function persistPendingProject(project: TeachingProject): TeachingProject {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(pendingProjectStorageKey, JSON.stringify(project));
  }
  return project;
}

function clearPersistedPendingProject(): null {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(pendingProjectStorageKey);
  }
  return null;
}

function mergeConfig(config: unknown): AppConfig {
  const savedConfig = config && typeof config === 'object' ? (config as Partial<AppConfig>) : {};
  const savedStageDefaults: Partial<AppConfig['stageDefaults']> = savedConfig.stageDefaults ?? {};
  const savedStageCanvas: Partial<AppConfig['stageDefaults']['canvas']> = savedStageDefaults.canvas ?? {};
  const savedScriptAgent: Partial<AppConfig['scriptAgent']> = savedConfig.scriptAgent ?? {};
  const scriptAgent = {
    ...defaultConfig.scriptAgent,
    ...savedScriptAgent,
  };
  const boardTypography = createBoardTypographyConfig({
    boardFontName: savedStageCanvas.boardFontName,
    boardFontSize: savedStageCanvas.boardFontSize ?? savedConfig.typography?.boardFontSize,
    boardFontUrl: savedStageCanvas.boardFontUrl,
  });

  if (shouldUpgradeScriptAgentPrompt(savedScriptAgent.promptSystem)) {
    scriptAgent.promptSystem = defaultConfig.scriptAgent.promptSystem;
  }

  if (shouldUpgradeScriptAgentUserTemplate(savedScriptAgent.promptUserTemplate)) {
    scriptAgent.promptUserTemplate = defaultConfig.scriptAgent.promptUserTemplate;
  }

  if (shouldUpgradeScriptAgentOutputContract(savedScriptAgent.outputContract)) {
    scriptAgent.outputContract = defaultConfig.scriptAgent.outputContract;
  }

  return {
    ...defaultConfig,
    ...savedConfig,
    automation: {
      ...defaultConfig.automation,
      ...savedConfig.automation,
    },
    feishu: {
      ...defaultConfig.feishu,
      ...savedConfig.feishu,
    },
    recognition: {
      ...defaultConfig.recognition,
      ...savedConfig.recognition,
    },
    scriptAgent,
    service: {
      ...defaultConfig.service,
      ...savedConfig.service,
    },
    tts: {
      ...defaultConfig.tts,
      ...savedConfig.tts,
    },
    vectorKb: {
      ...defaultConfig.vectorKb,
      ...savedConfig.vectorKb,
    },
    stageDefaults: {
      ...defaultConfig.stageDefaults,
      ...savedStageDefaults,
      canvas: {
        ...defaultConfig.stageDefaults.canvas,
        ...savedStageCanvas,
        boardFontName: boardTypography.boardFontName,
        boardFontSize: boardTypography.boardFontSize,
        boardFontUrl: boardTypography.boardFontUrl,
      },
    },
    typography: {
      ...defaultConfig.typography,
      ...savedConfig.typography,
    },
    effects: {
      ...defaultConfig.effects,
      ...savedConfig.effects,
    },
    output: {
      ...defaultConfig.output,
      ...savedConfig.output,
    },
  };
}

function shouldUpgradeScriptAgentPrompt(promptSystem: unknown) {
  if (typeof promptSystem !== 'string' || !promptSystem.trim()) {
    return false;
  }

  if (!promptSystem.includes('rows') && (promptSystem.includes('spokenScript') || promptSystem.includes('boardPlan'))) {
    return true;
  }

  if (promptSystem.includes('优先输出 rows') || promptSystem.includes('旧格式仅兼容') || promptSystem.includes('JSON 格式：{"spokenScript"')) {
    return true;
  }

  if (hasPollutedTemplateOpenBcPrompt(promptSystem)) {
    return true;
  }

  const looksLikeOldDefaultScriptAgentPrompt =
    promptSystem.includes('## 断句真相') &&
    promptSystem.includes('禁止输出 Tactus') &&
    !promptSystem.includes('## A/B 分片输出示例');

  if (looksLikeOldDefaultScriptAgentPrompt) {
    return true;
  }

  return [
    '单句不要超过 100 字',
    '需要断成下一段语音时才写 <br>',
    '需要下一段语音时写 <br>',
    '每个 <b> 都加 <br>',
  ].some((legacyText) => promptSystem.includes(legacyText));
}

function shouldUpgradeScriptAgentUserTemplate(promptUserTemplate: unknown) {
  return (
    typeof promptUserTemplate === 'string' &&
    ((!promptUserTemplate.includes('rows') &&
      (promptUserTemplate.includes('逐句讲解稿') ||
        promptUserTemplate.includes('逐句口播稿') ||
        promptUserTemplate.includes('<br>') ||
        promptUserTemplate.includes('板书计划'))) ||
      promptUserTemplate.includes('优先输出 rows') ||
      hasPollutedTemplateOpenBcPrompt(promptUserTemplate) ||
      (promptUserTemplate.includes('Agent 和用户不要手写 <br> / <b> / ##') && !promptUserTemplate.includes('必须返回 rows')))
  );
}

function hasPollutedTemplateOpenBcPrompt(text: string) {
  const bTemplateOpen = ['B', 'template', 'open'].join('-');
  const cTemplateOpen = ['C', 'template', 'open'].join('-');
  const bTemplateOpenFamily = ['B', 'template', 'open/pre/end'].join('-');
  const cTemplateOpenFamily = ['C', 'template', 'open/pre/end'].join('-');
  const legacySlotClaim = ['保留', 'A/B/C', '标签位'].join(' ');

  return (
    text.includes(legacySlotClaim) ||
    text.includes(bTemplateOpen) ||
    text.includes(cTemplateOpen) ||
    text.includes(bTemplateOpenFamily) ||
    text.includes(cTemplateOpenFamily)
  );
}

function shouldUpgradeScriptAgentOutputContract(outputContract: unknown) {
  return !Array.isArray(outputContract) || outputContract.length !== 1 || outputContract[0] !== 'rows';
}

function persistConfig(config: AppConfig) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(configStorageKey, JSON.stringify(config));
}

function loadPersistedScriptAgentCandidateDraft(): ScriptAgentDraft {
  if (typeof window === 'undefined') {
    return createEmptyScriptAgentDraft();
  }

  try {
    const rawDraft = window.localStorage.getItem(scriptAgentCandidateDraftStorageKey);
    if (!rawDraft) {
      return createEmptyScriptAgentDraft();
    }
    return normalizeScriptAgentDraft(JSON.parse(rawDraft));
  } catch {
    return createEmptyScriptAgentDraft();
  }
}

function persistScriptAgentCandidateDraft(draft: ScriptAgentDraft): ScriptAgentDraft {
  const normalizedDraft = normalizeScriptAgentDraft(draft);
  if (typeof window === 'undefined') {
    return normalizedDraft;
  }

  if (!hasScriptAgentDraftContent(normalizedDraft)) {
    window.localStorage.removeItem(scriptAgentCandidateDraftStorageKey);
    return createEmptyScriptAgentDraft();
  }

  window.localStorage.setItem(scriptAgentCandidateDraftStorageKey, JSON.stringify(normalizedDraft));
  return normalizedDraft;
}

function clearPersistedScriptAgentCandidateDraft(): ScriptAgentDraft {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(scriptAgentCandidateDraftStorageKey);
  }
  return createEmptyScriptAgentDraft();
}

function shouldKeepExistingScriptAgentDraft(currentDraft: ScriptAgentDraft, nextDraft: ScriptAgentDraft) {
  return hasScriptAgentDraftContent(currentDraft) && !hasScriptAgentDraftContent(nextDraft);
}

function createSeedProjectFromConfig(config: AppConfig): TeachingProject {
  const seedProject = createSeedProject();

  return {
    ...seedProject,
    stage: {
      ...seedProject.stage,
      canvas: createStageCanvasFromConfig(config),
    },
  };
}

function createStageCanvasFromConfig(config: AppConfig): StageCanvasConfig {
  const canvas = config.stageDefaults.canvas;
  const boardTypography = createBoardTypographyConfig(canvas);

  return normalizeStageCanvas({
    background: canvas.background,
    ...boardTypography,
    height: canvas.height,
    preset: canvas.preset,
    width: canvas.width,
  });
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeStageCanvas(canvas: StageCanvasConfig): StageCanvasConfig {
  const boardTypography = createBoardTypographyConfig(canvas);

  return {
    ...canvas,
    background: canvas.background.trim() || '#ffffff',
    ...boardTypography,
    height: Math.round(clampNumber(canvas.height, 360, 3840)),
    width: Math.round(clampNumber(canvas.width, 360, 3840)),
  };
}

function createTaskId(value: string) {
  const date = new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (input: number) => String(input).padStart(2, '0');
  return [
    'task',
    safeDate.getFullYear(),
    pad(safeDate.getMonth() + 1),
    pad(safeDate.getDate()),
    '-',
    pad(safeDate.getHours()),
    pad(safeDate.getMinutes()),
    pad(safeDate.getSeconds()),
  ].join('');
}

function createProjectTitleFromFileName(fileName: string, fallback: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim();
  return baseName || fallback;
}

function updateBoardClipState(
  state: TeachingEditorState,
  clipId: string,
  patch: BoardClipPatch,
): Partial<TeachingEditorState> {
  const clips = state.project.timeline.clips.map((clip) => {
    if (clip.id !== clipId || clip.kind !== 'board') {
      return clip;
    }

    const previousRevealStartMs = clip.revealStartMs ?? clip.startMs;
    const previousRevealEndMs = clip.revealEndMs ?? clip.endMs;
    const sourceStartMs = clip.sourceStartMs ?? previousRevealStartMs;
    const sourceEndMs = clip.sourceEndMs ?? previousRevealEndMs;
    const nextClip = {
      ...clip,
      ...patch,
    };
    const displayWindow = normalizeBoardDisplayWindow({
      endMs: nextClip.endMs,
      startMs: nextClip.startMs,
    });
    const { endMs, startMs } = displayWindow;
    const visualPatch = normalizeBoardStickerVisualPatch(nextClip);
    const revealWindow = normalizeBoardRevealWindow({
      displayEndMs: endMs,
      displayStartMs: startMs,
      patch,
      previousDisplayEndMs: clip.endMs,
      previousDisplayStartMs: clip.startMs,
      previousRevealEndMs,
      previousRevealStartMs,
      sourceEndMs,
      sourceStartMs,
    });

    return {
      ...nextClip,
      startMs,
      endMs,
      xPercent: visualPatch.xPercent,
      yPercent: visualPatch.yPercent,
      widthPercent: visualPatch.widthPercent,
      fontSize: nextClip.fontSize === undefined ? undefined : visualPatch.fontSize,
      drawSpeed: visualPatch.drawSpeed,
      revealEndMs: revealWindow.revealEndMs,
      revealStartMs: revealWindow.revealStartMs,
      sourceEndMs,
      sourceStartMs,
    };
  });

  const project = {
    ...state.project,
    timeline: {
      ...state.project.timeline,
      clips,
      durationMs: Math.max(state.project.timeline.durationMs, ...clips.map((clip) => clip.endMs)),
    },
  };

  return {
    project: persistProject(project),
  };
}

function createVoiceTimelineClips(results: TtsSentenceResult[]): TimelineClip[] {
  let cursorMs = 0;

  return results.map((result, index) => {
    const durationMs = Math.max(300, Math.round(result.durationMs || 1200));
    const clip: TimelineClip = {
      chainKey: result.chainKey,
      endMs: cursorMs + durationMs,
      id: `clip-voice-tts-${String(index + 1).padStart(3, '0')}`,
      kind: 'audio',
      label: createAbcChainLabel(result.chainKey, 'a'),
      sourceRef: result.audioUrl,
      startMs: cursorMs,
      trackId: 'track-voice',
    };
    cursorMs += durationMs;
    return clip;
  });
}
