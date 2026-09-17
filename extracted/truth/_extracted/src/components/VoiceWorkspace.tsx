// @@COMP_VOICE_WS ⚠️ BREAKPOINT: TTS ready → boardEvents → cAssetPrewarmQueue 触发点
// @cleanroom-component: VoiceWorkspace
// @domain: tts-audio-pipeline
// @slot: left-sider/voice-workspace
// @depends: TeachingProject.assets(scriptText/voiceAudio/voiceTiming), VoiceBatchStatusPanel
// ID: cleanroom-assets-voice-status-001
// 🔄 状态: TTS 批任务状态灯
// 💾 数据: voiceAudio / voiceTiming assets
// 🧩 复用: VoiceBatchStatusPanel + AssetList
// @feature-branch: board-events
// @io-input: assets, onApplyBoardEventsToTimeline, onSyncCAssetPrewarmQueue, onApplyTtsSentenceResults
// @io-output: TtsSentenceResult[] and BoardEvent[] through callbacks
// @route: App shell / left sider / assets voice tab
// @fields: TeachingProject.assets(kind=voiceAudio), TeachingProject.assets(kind=voiceTiming), TeachingProject.timeline.clips(kind=board)
// @adapter: local cosyvoice-gateway
// @event-map: scriptText -> local gateway -> voice assets + board events -> timeline clips
// @boundary: browser calls local Node gateway only; DASHSCOPE_API_KEY stays in Node/.env.local

import { AudioOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Collapse, Flex, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import type { AppConfig } from '../config/defaultConfig';
import type { BoardEvent, CLayoutPreviewDraft, ScriptAgentDraft, StageCanvasConfig, TeachingAsset, TeachingCAsset, TtsBatchUiItem, TtsSentenceResult } from '../domain/teachingProject';
import { readScriptChainKeysSourceRef } from '../modules/abcChain/abcChainKey';
import { createCAssetPrewarmQueue } from '../modules/cAssetPrewarm';
import { createBoardEventsFromTtsUnits, splitScriptIntoTtsSentenceUnits } from '../modules/timeline-factory';
import { filterTtsUnitsBySentenceResults, isReadyTtsSentenceResult, sortTtsSentenceResultsBySentenceOrder } from '../modules/timeline-factory/orderTtsSentenceResults';
import { ScriptSegmentWorkbench } from '../modules/scriptSegments';
import { requestBoardLayoutPreview } from '../services/boardLayoutPreviewGatewayClient';
import { requestCosyVoiceSentences } from '../services/cosyvoiceGatewayClient';
import { AssetList } from './AssetList';
import { VoiceBatchStatusPanel } from './VoiceBatchStatusPanel';

const { Text } = Typography;

export function VoiceWorkspace({
  assets,
  ttsConfig,
  scriptAgentConfig,
  scriptAgentCandidateDraft,
  onApplyBoardEventsToTimeline,
  onSyncCAssetPrewarmQueue,
  onApplyTtsSentenceResults,
  onSyncLayoutPreviewDraft,
  stageCanvas,
}: {
  assets: TeachingAsset[];
  ttsConfig: AppConfig['tts'];
  scriptAgentConfig: AppConfig['scriptAgent'];
  scriptAgentCandidateDraft: ScriptAgentDraft;
  onApplyBoardEventsToTimeline: (boardEvents: BoardEvent[]) => void;
  onSyncCAssetPrewarmQueue: (cAssets: TeachingCAsset[]) => void;
  onApplyTtsSentenceResults: (results: TtsSentenceResult[]) => void;
  onSyncLayoutPreviewDraft: (draft: CLayoutPreviewDraft | null) => void;
  stageCanvas: StageCanvasConfig;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingLayoutPreview, setIsGeneratingLayoutPreview] = useState(false);
  const [error, setError] = useState('');
  const [layoutPreviewError, setLayoutPreviewError] = useState('');
  const [lastResult, setLastResult] = useState<{ failedCount: number; readyCount: number; requestIds: string[] } | null>(null);
  const scriptTextAsset = assets.find((asset) => asset.kind === 'scriptText');
  const problemTextAsset = assets.find((asset) => asset.kind === 'problemText');
  const scriptText = scriptTextAsset?.summary ?? '';
  const scriptChainKeys = useMemo(() => readScriptChainKeysSourceRef(scriptTextAsset?.sourceRef), [scriptTextAsset?.sourceRef]);
  const voiceAssets = assets.filter((asset) => asset.kind === 'voiceAudio' || asset.kind === 'voiceTiming');
  const storedVoiceAudioUrls = readStoredAssetLines(assets.find((asset) => asset.kind === 'voiceAudio')?.sourceRef);
  const storedVoiceTimingEntries = readStoredAssetLines(assets.find((asset) => asset.kind === 'voiceTiming')?.sourceRef);
  const storedResult = storedVoiceAudioUrls.length
    ? {
        failedCount: 0,
        readyCount: storedVoiceAudioUrls.length,
        requestIds: [] as string[],
      }
    : null;
  const visibleResult = lastResult ?? storedResult;
  const splitResult = useMemo(() => splitScriptIntoTtsSentenceUnits(scriptText, { chainKeys: scriptChainKeys }), [scriptChainKeys, scriptText]);
  const batches = useMemo<TtsBatchUiItem[]>(
    () =>
      splitResult.units.map((unit) => ({
        audioTrackLabel: visibleResult ? '已入A轨' : undefined,
        id: `voice-batch-${unit.id}`,
        label: `第 ${unit.order} 段`,
        sentenceIds: [unit.id],
        status: isGenerating ? 'requesting' : visibleResult ? 'onTrack' : 'pending',
      })),
    [isGenerating, splitResult.units, visibleResult],
  );

  const handleGenerateRealTts = async () => {
    setError('');
    setLastResult(null);

    if (splitResult.units.length === 0) {
      setError('请先确认文稿，再生成 A 轨语音。');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await requestCosyVoiceSentences(
        splitResult.units.map((unit) => ({
          estimatedDurationMs: unit.estimatedDurationMs,
          id: unit.id,
          order: unit.order,
          text: unit.speechText,
        })),
        ttsConfig,
      );
      const resultsWithChainKeys = response.results.map((result) => ({
        ...result,
        chainKey: splitResult.units.find((unit) => unit.id === result.sentenceId)?.chainKey,
      }));
      const readyResults = sortTtsSentenceResultsBySentenceOrder(
        resultsWithChainKeys.filter((result) => result.status === 'ready' && isReadyTtsSentenceResult(result)),
      );
      const failedResults = resultsWithChainKeys.filter((result) => result.status === 'failed' || result.error);
      onApplyTtsSentenceResults(resultsWithChainKeys);

      const boardEventUnits = filterTtsUnitsBySentenceResults(splitResult.units, readyResults);
      const boardEvents = createBoardEventsFromTtsUnits(boardEventUnits, readyResults);
      if (boardEvents.length) {
        onApplyBoardEventsToTimeline(boardEvents);
        onSyncCAssetPrewarmQueue(
          createCAssetPrewarmQueue({
            boardEvents,
            canvas: stageCanvas,
            readyResults,
            units: boardEventUnits,
          }),
        );
      }

      setLastResult({
        failedCount: failedResults.length,
        readyCount: readyResults.length,
        requestIds: readyResults.map((result) => result.requestId).filter((requestId): requestId is string => Boolean(requestId)),
      });

      if (failedResults.length) {
        setError(failedResults.map((result) => result.error).filter(Boolean).join('\n') || '部分分段生成失败。');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateLayoutPreview = async () => {
    setLayoutPreviewError('');
    const rows = scriptAgentCandidateDraft.rows ?? [];
    const rowsWithBoardSlice = rows.filter((row) => row.boardSlice?.trim());
    if (!rowsWithBoardSlice.length) {
      setLayoutPreviewError('请先在第二步生成并确认包含板书候选的 rows。');
      return;
    }

    setIsGeneratingLayoutPreview(true);
    try {
      const preview = await requestBoardLayoutPreview({
        config: scriptAgentConfig,
        problemText: problemTextAsset?.summary ?? '',
        rows,
        stageCanvas,
      });
      onSyncLayoutPreviewDraft(preview);
    } catch (caughtError) {
      setLayoutPreviewError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setIsGeneratingLayoutPreview(false);
    }
  };

  return (
    <div className="voice-workspace">
      <Card className="voice-action-card" size="small">
        <Flex gap={10} vertical>
          <Space wrap>
            <Tag color="blue">讲解音频</Tag>
            <Tag color="cyan">{ttsConfig.voiceName}</Tag>
          </Space>
          <Text type="secondary">第三步先看整版排版预览，再决定是否生成讲解音频。</Text>
          <Space.Compact block>
            <Button
              block
              disabled={!scriptAgentCandidateDraft.rows?.length}
              loading={isGeneratingLayoutPreview}
              onClick={handleGenerateLayoutPreview}
            >
              生成板书排版预览
            </Button>
            <Button
              block
              disabled={splitResult.units.length === 0}
              icon={<AudioOutlined />}
              loading={isGenerating}
              onClick={handleGenerateRealTts}
              type="primary"
            >
              生成讲解音频
            </Button>
          </Space.Compact>
          {visibleResult ? (
            <Alert
              showIcon
               title={`${lastResult ? '生成完成' : '缓存已恢复'}：${visibleResult.readyCount} 段成功${visibleResult.failedCount ? `，${visibleResult.failedCount} 段失败` : ''}`}
               type={visibleResult.failedCount ? 'warning' : 'success'}
             />
           ) : null}
          {error ? <Alert description={error} showIcon title="真实 TTS 返回错误" type="error" /> : null}
          {layoutPreviewError ? <Alert description={layoutPreviewError} showIcon title="排版预览生成失败" type="error" /> : null}
        </Flex>
      </Card>
      <ScriptSegmentWorkbench
        emptyText="暂无可生成音频的换行分段。"
        maxVisibleSegments={24}
        scriptChainKeys={scriptChainKeys}
        scriptText={scriptText}
        title="音频生成确认"
      />
      <Collapse
        className="voice-advanced-collapse"
        items={[
          {
            children: <VoiceBatchStatusPanel batches={batches} isRealGatewayReady />,
            key: 'batches',
            label: (
              <Space size={6} wrap>
                <Text strong>处理明细</Text>
                <Text type="secondary">每段生成进度</Text>
                <Tag>{batches.length} 段</Tag>
              </Space>
            ),
          },
          {
            children: <AssetList assets={voiceAssets} />,
            key: 'assets',
            label: (
              <Space size={6} wrap>
                <Text strong>文件</Text>
                <Text type="secondary">音频与对齐数据</Text>
                <Tag color={storedVoiceAudioUrls.length ? 'green' : 'default'}>{storedVoiceAudioUrls.length} 音频</Tag>
                <Tag color={storedVoiceTimingEntries.length ? 'blue' : 'default'}>{storedVoiceTimingEntries.length} 对齐</Tag>
              </Space>
            ),
          },
        ]}
        size="small"
      />
    </div>
  );
}

function readStoredAssetLines(sourceRef: string | undefined) {
  return (sourceRef ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
