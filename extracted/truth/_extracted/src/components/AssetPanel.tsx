// @cleanroom-component: AssetPanel
// @domain: teaching-assets
// @slot: left-sider
// @depends: TeachingProject.assets, importProblemImage action, future recognition-ai-config
// @feature-branch: recognition-ai-config
// @feature-branch: problem-text-edit
// @feature-branch: script-agent-interface
// @feature-branch: agent-draft-apply
// @data-map: problemText -> ProblemWorkspace.recognized-result-text -> updateProblemText -> ScriptAgentWorkspace.problem-context-box
// @data-map: boardLayout -> ProblemUploadPreview.board-confirm-overlay -> applyScriptAgentDraft/updateBoardLayout
// @event-map: ProblemWorkspace.next -> onOpenScriptAgent -> App.scriptAgentOpen Drawer
// @route-impact: App shell only

// ID: cleanroom-assets-panel-root-001
// 💾 数据: TeachingProject.assets
// 🔌 事件: importProblemImage / updateProblemText / openScriptAgent
// 🧩 后续拆分: ProblemUploadPreview, ProblemWorkspace, VoiceWorkspace, AssetList
// @io-input: assets, onImportProblemImage, onOpenScriptAgent, onGenerateScriptAgent, onUpdateProblemText, onApplyBoardEventsToTimeline, onSyncCAssetPrewarmQueue
// @io-output: none direct; delegates child events upward
// @route: App shell / left sider / asset room
// @fields: TeachingProject.assets(problemImage/problemText/scriptText/boardLayout/voiceAudio/voiceTiming/exportResult), TeachingProject.timeline.clips(kind=board)
// @boundary: assembly only; no OCR, no real TTS; timeline write is delegated via explicit callback

import { CheckCircleFilled, ClockCircleFilled } from '@ant-design/icons';
import { Button, Card, Flex, message, Progress, Space, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { AppConfig } from '../config/defaultConfig';
import type { BoardEvent, CLayoutPreviewDraft, ScriptAgentDraft, StageCanvasConfig, TeachingAsset, TeachingCAsset, TtsSentenceResult } from '../domain/teachingProject';
import { requestProblemTextRecognition } from '../services/recognitionGatewayClient';
import { getAssetWorkflowRailSteps, getAssetWorkflowStage, visibleWorkflowStepIds, type VisibleWorkflowStepKey } from '../workflow/assetWorkflowFlow';
import { createAssetWorkflowSteps } from '../workflow/createAssetWorkflowSteps';
import { AssetWorkflowTabs } from './AssetWorkflowTabs';

const { Text, Title } = Typography;

export function AssetPanel({
  assets,
  automationConfig,
  recognitionConfig,
  ttsConfig,
  scriptAgentConfig,
  scriptAgentCandidateDraft,
  layoutPreviewDraft,
  onImportProblemImage,
  onApplyBoardEventsToTimeline,
  onSyncCAssetPrewarmQueue,
  onApplyTtsSentenceResults,
  onSyncLayoutPreviewDraft,
  onApplyRecognizedProblemText,
  onConfirmProblemText,
  onGenerateScriptAgent,
  onOpenScriptAgent,
  onUpdateProblemText,
  stageCanvas,
  requestedWorkflowKey,
  requestedWorkflowRequestId,
}: {
  assets: TeachingAsset[];
  automationConfig: AppConfig['automation'];
  recognitionConfig: AppConfig['recognition'];
  ttsConfig: AppConfig['tts'];
  scriptAgentConfig: AppConfig['scriptAgent'];
  scriptAgentCandidateDraft: ScriptAgentDraft;
  layoutPreviewDraft: CLayoutPreviewDraft | null;
  onImportProblemImage: (file: File) => void;
  onApplyBoardEventsToTimeline: (boardEvents: BoardEvent[]) => void;
  onSyncCAssetPrewarmQueue: (cAssets: TeachingCAsset[]) => void;
  onApplyTtsSentenceResults: (results: TtsSentenceResult[]) => void;
  onSyncLayoutPreviewDraft: (draft: CLayoutPreviewDraft | null) => void;
  onApplyRecognizedProblemText: (text: string, confirm?: boolean) => void;
  onConfirmProblemText: () => void;
  onGenerateScriptAgent: () => void;
  onOpenScriptAgent: () => void;
  onUpdateProblemText: (text: string) => void;
  stageCanvas: StageCanvasConfig;
  requestedWorkflowKey: VisibleWorkflowStepKey | null;
  requestedWorkflowRequestId: number;
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [isRecognizingProblem, setIsRecognizingProblem] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [activeWorkflowKey, setActiveWorkflowKey] = useState<VisibleWorkflowStepKey>('problem');
  const readyAssets = assets.filter((asset) => asset.status === 'ready' || asset.status === 'done').length;
  const completionPercent = Math.round((readyAssets / Math.max(assets.length, 1)) * 100);
  const currentImage = assets.find((asset) => asset.kind === 'problemImage' && asset.sourceRef);
  const problemText = assets.find((asset) => asset.kind === 'problemText');
  const scriptText = assets.find((asset) => asset.kind === 'scriptText');
  const boardLayout = assets.find((asset) => asset.kind === 'boardLayout');
  const voiceAudio = assets.find((asset) => asset.kind === 'voiceAudio');
  const hasConfirmedBoard = Boolean(boardLayout?.summary?.trim()) && boardLayout?.status === 'ready';
  const isProblemConfirmed = problemText?.status === 'ready' && Boolean(problemText.summary.trim());
  const isScriptReady = scriptText?.status === 'ready' && Boolean(scriptText.summary.trim());
  const isBoardReady = boardLayout?.status === 'ready' && Boolean(boardLayout.summary.trim());
  const isVoiceReady = voiceAudio?.status === 'ready';
  const workflowReadiness = {
    hasConfirmedBoard,
    isBoardReady,
    isProblemConfirmed,
    isScriptReady,
    isVoiceReady,
  };
  const workflowStage = getAssetWorkflowStage(workflowReadiness);
  const railSteps = getAssetWorkflowRailSteps(workflowReadiness);
  useEffect(() => {
    if (requestedWorkflowKey) {
      setActiveWorkflowKey(requestedWorkflowKey);
    }
  }, [requestedWorkflowKey, requestedWorkflowRequestId]);

  const handleWorkflowPrimaryAction = () => {
    if (!isProblemConfirmed) {
      if (problemText?.summary.trim()) {
        onConfirmProblemText();
        setActiveWorkflowKey('scriptBoard');
        return;
      }

      setActiveWorkflowKey('problem');
      return;
    }

    setActiveWorkflowKey(workflowStage.targetKey);

    if (workflowStage.targetKey === 'scriptBoard' && (!isScriptReady || !isBoardReady)) {
      onOpenScriptAgent();
    }
  };
  const handleRecognizeProblemImage = async (file: File) => {
    if (recognitionConfig.provider === 'manual-first') {
      setRecognitionError('当前是手动优先模式，请直接编辑题文后确认。');
      return;
    }

    setIsRecognizingProblem(true);
    setRecognitionError('');
    try {
      const recognizedText = await requestProblemTextRecognition({
        config: recognitionConfig,
        imageFile: file,
      });
      if (automationConfig.mode === 'unattended') {
        onApplyRecognizedProblemText(recognizedText, true);
        onGenerateScriptAgent();
        messageApi.success('题图识别完成，已按自动免审模式进入文稿生成。');
      } else {
        onApplyRecognizedProblemText(recognizedText, false);
        messageApi.success('题图识别完成，请核对后确认题文。');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setRecognitionError(errorMessage);
      messageApi.error(errorMessage);
    } finally {
      setIsRecognizingProblem(false);
    }
  };

  const handleImportProblemImage = (file: File) => {
    onImportProblemImage(file);
    if (recognitionConfig.provider !== 'manual-first') {
      void handleRecognizeProblemImage(file);
    }
  };
  const steps = createAssetWorkflowSteps({
    assets,
    ttsConfig,
    scriptAgentConfig,
    scriptAgentCandidateDraft,
    layoutPreviewDraft,
    currentImage,
    recognitionConfig,
    recognitionError,
    isRecognizingProblem,
    boardLayout,
    onImportProblemImage: handleImportProblemImage,
    onApplyBoardEventsToTimeline,
    onSyncCAssetPrewarmQueue,
    onApplyTtsSentenceResults,
    onSyncLayoutPreviewDraft,
    stageCanvas,
    onConfirmProblemText,
    onGenerateScriptAgent,
    onOpenScriptAgent,
    onUpdateProblemText,
    problemText,
    scriptText,
  });
  const visibleSteps = steps.filter((step) => visibleWorkflowStepIds.has(step.id));

  return (
    <Card className="workflow-card" title="生成流程" extra={<Tag color="cyan">Workflow</Tag>}>
      {contextHolder}
      <div className="workflow-hero">
        <div>
          <Text className="workflow-eyebrow">下一步</Text>
          <Title level={4}>{workflowStage.title}</Title>
          <Text type="secondary">{workflowStage.description}</Text>
        </div>
        <Button
          icon={workflowStage.actionIcon}
          onClick={handleWorkflowPrimaryAction}
          type="primary"
        >
          {workflowStage.actionLabel}
        </Button>
      </div>

      <div className="workflow-rail">
        {railSteps.map((step, index) => (
          <button
            className={[
              'workflow-step',
              activeWorkflowKey === step.key ? 'is-active' : '',
              step.done ? 'is-done' : '',
            ].filter(Boolean).join(' ')}
            key={step.key}
            onClick={() => setActiveWorkflowKey(step.key)}
            type="button"
          >
            {step.done ? <CheckCircleFilled className="workflow-step-icon is-done" /> : <ClockCircleFilled className="workflow-step-icon" />}
            <span>
              <strong>{index + 1}. {step.label}</strong>
              <small>{step.note}</small>
            </span>
          </button>
        ))}
      </div>

      <Flex align="center" className="workflow-progress-row" gap={10}>
        <Progress percent={completionPercent} showInfo={false} size="small" status="active" />
        <Space size={4}>
          <Tag color={isProblemConfirmed ? 'green' : 'orange'}>{isProblemConfirmed ? '题文已确认' : '待确认题文'}</Tag>
          <Tag color={isVoiceReady ? 'green' : 'default'}>{isVoiceReady ? '可播放' : '待生成音频'}</Tag>
        </Space>
      </Flex>
      <AssetWorkflowTabs
        activeKey={activeWorkflowKey}
        onActiveKeyChange={(key) => {
          if (visibleWorkflowStepIds.has(key)) {
            setActiveWorkflowKey(key as VisibleWorkflowStepKey);
          }
        }}
        steps={visibleSteps}
      />
    </Card>
  );
}
