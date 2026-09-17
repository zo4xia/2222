// @cleanroom-module: createAssetWorkflowSteps
// @domain: workflow-orchestration
// ID: cleanroom-assets-step-sdk-factory-001
// @io-input: TeachingAsset[], asset room callbacks, onApplyBoardEventsToTimeline, onSyncCAssetPrewarmQueue
// @io-output: WorkflowStepSdk[]
// @route: App shell / left sider / asset room
// @fields: problemImage, problemText, scriptText, boardLayout, voiceAudio, voiceTiming, exportResult, timeline.clips(kind=board)
// @boundary: step SDK declaration only; does not own AntD Tabs or mutate project directly

import type { AssetTabKey } from '../config/assetTabs';
import type { AppConfig } from '../config/defaultConfig';
import type { BoardEvent, CLayoutPreviewDraft, ScriptAgentDraft, StageCanvasConfig, TeachingAsset, TeachingCAsset, TtsSentenceResult } from '../domain/teachingProject';
import { AssetList } from '../components/AssetList';
import { ProblemWorkspace } from '../components/ProblemWorkspace';
import { ScriptBoardSummaryStep } from '../components/ScriptBoardSummaryStep';
import { VoiceWorkspace } from '../components/VoiceWorkspace';
import type { WorkflowStepSdk } from './workflowStepSdk';

type CreateAssetWorkflowStepsInput = {
  assets: TeachingAsset[];
  ttsConfig: AppConfig['tts'];
  scriptAgentConfig: AppConfig['scriptAgent'];
  scriptAgentCandidateDraft: ScriptAgentDraft;
  layoutPreviewDraft: CLayoutPreviewDraft | null;
  stageCanvas: StageCanvasConfig;
  currentImage: TeachingAsset | undefined;
  recognitionConfig: AppConfig['recognition'];
  recognitionError: string;
  isRecognizingProblem: boolean;
  onImportProblemImage: (file: File) => void;
  onApplyBoardEventsToTimeline: (boardEvents: BoardEvent[]) => void;
  onSyncCAssetPrewarmQueue: (cAssets: TeachingCAsset[]) => void;
  onApplyTtsSentenceResults: (results: TtsSentenceResult[]) => void;
  onSyncLayoutPreviewDraft: (draft: CLayoutPreviewDraft | null) => void;
  onConfirmProblemText: () => void;
  onGenerateScriptAgent: () => void;
  onOpenScriptAgent: () => void;
  onUpdateProblemText: (text: string) => void;
  problemText: TeachingAsset | undefined;
  boardLayout: TeachingAsset | undefined;
  scriptText: TeachingAsset | undefined;
};

export function createAssetWorkflowSteps({
  assets,
  ttsConfig,
  scriptAgentConfig,
  scriptAgentCandidateDraft,
  layoutPreviewDraft,
  stageCanvas,
  currentImage,
  recognitionConfig,
  recognitionError,
  isRecognizingProblem,
  onImportProblemImage,
  onApplyBoardEventsToTimeline,
  onSyncCAssetPrewarmQueue,
  onApplyTtsSentenceResults,
  onSyncLayoutPreviewDraft,
  onConfirmProblemText,
  onGenerateScriptAgent,
  onOpenScriptAgent,
  onUpdateProblemText,
  problemText,
  boardLayout,
  scriptText,
}: CreateAssetWorkflowStepsInput): WorkflowStepSdk[] {
  const isProblemConfirmed = problemText?.status === 'ready' && Boolean(problemText.summary.trim());

  return [
    {
      boundary: 'Edits and confirms problemText before opening chat or explicitly requesting script-board generation; no TTS or timeline writes.',
      events: ['onUpdateProblemText(text)', 'onConfirmProblemText()', 'onOpenScriptAgent()', 'onGenerateScriptAgent()'],
      id: 'problem',
      inputFields: ['TeachingProject.assets(kind=problemImage)', 'TeachingProject.assets(kind=problemText)'],
      outputFields: ['TeachingProject.assets(kind=problemText)'],
      render: () => (
        <ProblemWorkspace
          imageAsset={currentImage}
          isRecognizingProblem={isRecognizingProblem}
          boardSummary={boardLayout?.summary}
          hasConfirmedBoard={Boolean(boardLayout?.summary?.trim()) && boardLayout?.status === 'ready'}
          recognitionError={recognitionError}
          recognitionConfig={recognitionConfig}
          onConfirmProblemText={onConfirmProblemText}
          onGenerateScriptAgent={onGenerateScriptAgent}
          onImportProblemImage={onImportProblemImage}
          onOpenScriptAgent={onOpenScriptAgent}
          onUpdateProblemText={onUpdateProblemText}
          scriptTextAsset={scriptText}
          textAsset={problemText}
        />
      ),
      routeSlot: 'left-sider/assets/problem',
      status: problemText?.status === 'ready' ? 'ready' : 'needsInput',
      title: '题目',
    },
    {
      boundary: 'Summarizes scriptText and boardLayout; opens Agent Drawer for real generation/editing.',
      events: ['onOpenScriptAgent()'],
      id: 'scriptBoard',
      inputFields: ['TeachingProject.assets(kind=problemText)', 'TeachingProject.assets(kind=scriptText)', 'TeachingProject.assets(kind=boardLayout)'],
      outputFields: ['TeachingProject.assets(kind=scriptText)', 'TeachingProject.assets(kind=boardLayout)'],
      render: () => (
        <ScriptBoardSummaryStep
          boardLayoutAsset={boardLayout}
          canOpenAgent={isProblemConfirmed}
          onOpenScriptAgent={onOpenScriptAgent}
          scriptTextAsset={scriptText}
          layoutPreviewDraft={layoutPreviewDraft}
          stageCanvas={stageCanvas}
        />
      ),
      routeSlot: 'left-sider/assets/script-board',
      status: scriptText?.status === 'ready' && boardLayout?.status === 'ready' ? 'ready' : 'needsInput',
      title: '文稿/C素材候选',
    },
    {
      boundary: 'Requests local CosyVoice gateway only; the browser never receives or stores DASHSCOPE_API_KEY.',
      events: ['requestCosyVoiceSentences(sentences)', 'onApplyTtsSentenceResults(results)', 'onApplyBoardEventsToTimeline(BoardEvent[])'],
      id: 'voiceAudio',
      inputFields: ['TeachingProject.assets(kind=voiceAudio)', 'TeachingProject.assets(kind=voiceTiming)'],
      outputFields: ['TeachingProject.timeline.clips(kind=board)', 'TeachingProject.timeline.durationMs'],
      render: () => (
        <VoiceWorkspace
          assets={assets}
          ttsConfig={ttsConfig}
          scriptAgentConfig={scriptAgentConfig}
          scriptAgentCandidateDraft={scriptAgentCandidateDraft}
          stageCanvas={stageCanvas}
          onApplyBoardEventsToTimeline={onApplyBoardEventsToTimeline}
          onSyncCAssetPrewarmQueue={onSyncCAssetPrewarmQueue}
          onApplyTtsSentenceResults={onApplyTtsSentenceResults}
          onSyncLayoutPreviewDraft={onSyncLayoutPreviewDraft}
        />
      ),
      routeSlot: 'left-sider/assets/voice',
      status: 'available',
      title: '音频A轨',
    },
    createAssetListStep('voiceTiming', '语音时序', assets, ['TeachingProject.assets(kind=voiceTiming)']),
    createAssetListStep('exportResult', '交付', assets, ['TeachingProject.assets(kind=exportResult)']),
    {
      boundary: 'Only displays every asset; does not mutate assets.',
      events: [],
      id: 'all',
      inputFields: ['TeachingProject.assets(*)'],
      outputFields: [],
      render: () => <AssetList assets={filterAssets(assets, 'all')} />,
      routeSlot: 'left-sider/assets/all',
      status: 'available',
      title: '总览',
    },
  ];
}

function createAssetListStep(
  id: AssetTabKey,
  title: string,
  assets: TeachingAsset[],
  inputFields: string[],
): WorkflowStepSdk {
  return {
    boundary: 'Asset list display only; does not mutate assets.',
    events: [],
    id,
    inputFields,
    outputFields: [],
    render: () => <AssetList assets={filterAssets(assets, id)} />,
    routeSlot: `left-sider/assets/${id}`,
    status: 'available',
    title,
  };
}

function filterAssets(assets: TeachingAsset[], key: AssetTabKey) {
  if (key === 'all') return assets;
  if (key === 'problem') return assets.filter((asset) => asset.kind === 'problemImage' || asset.kind === 'problemText');
  if (key === 'scriptBoard') return assets.filter((asset) => asset.kind === 'scriptText' || asset.kind === 'boardLayout');
  return assets.filter((asset) => asset.kind === key);
}
