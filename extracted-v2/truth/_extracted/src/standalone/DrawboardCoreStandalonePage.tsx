// @cleanroom-component: DrawboardCoreStandalonePage
// @domain: standalone-prototype
// @slot: full-page
// @depends: AutoHandwritingLayer, DrawboardStage
// @route-impact: standalone=drawboard-core

import { Button, Card, Input, Slider, Space, Tag, Typography } from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AutoHandwritingLayer } from '../components/AutoHandwritingLayer';
import { DrawboardStage } from '../components/DrawboardStage';
import type { BoardClipPatch, BoardStageToolMode } from '../components/drawboardStageTypes';
import type { GoldenFingerCanvasLayerHandle } from '../components/GoldenFingerCanvasLayer';
import type { StageCanvasConfig, TeachingAsset, TimelineClip } from '../domain/teachingProject';
import {
  createBoardTypographyConfig,
  DEFAULT_BOARD_FONT_NAME,
  DEFAULT_BOARD_FONT_URL,
} from '../modules/boardFont/boardFontConfig';
import { DEFAULT_BOARD_DRAW_SPEED } from '../modules/boardReveal/boardRevealConfig';

const { Text, Title } = Typography;

const STANDALONE_CANVAS: StageCanvasConfig = {
  background: '#ffffff',
  ...createBoardTypographyConfig({
    boardFontName: DEFAULT_BOARD_FONT_NAME,
    boardFontSize: 42,
    boardFontUrl: DEFAULT_BOARD_FONT_URL,
  }),
  height: 720,
  preset: 'landscape-720p',
  width: 1280,
};

const STANDALONE_PROBLEM_TEXT: TeachingAsset = {
  id: 'standalone-problem',
  kind: 'problemText',
  source: 'manual',
  status: 'ready',
  summary: '例题：一辆车 2 小时行驶 120 公里，平均每小时行驶多少公里？',
  title: '单体预览题干',
};

const CREATE_DEMO_CLIP = (label: string): TimelineClip => ({
  color: '#171717',
  drawSpeed: DEFAULT_BOARD_DRAW_SPEED,
  endMs: 14000,
  fontSize: 42,
  id: 'standalone-clip-1',
  kind: 'board',
  label,
  revealEndMs: 9000,
  revealStartMs: 0,
  sourceEndMs: 9000,
  sourceStartMs: 0,
  startMs: 0,
  trackId: 'track-board',
  widthPercent: 48,
  xPercent: 58,
  yPercent: 56,
});

const SAMPLE_LABELS = [
  '120 ÷ 2 = 60',
  '25×4=100\n1200÷100=12',
  'A: 已知 y=2x+1\nB: 求 x=3 时 y 的值',
];

export function DrawboardCoreStandalonePage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const goldenFingerLayerRef = useRef<GoldenFingerCanvasLayerHandle | null>(null);
  const [activeToolMode, setActiveToolMode] = useState<BoardStageToolMode>('off');
  const [strokeColor, setStrokeColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [selectedBoardClipId, setSelectedBoardClipId] = useState<string | null>('standalone-clip-1');
  const [playheadMs, setPlayheadMs] = useState(3000);
  const [boardLabel, setBoardLabel] = useState(SAMPLE_LABELS[0]);
  const [boardClips, setBoardClips] = useState<TimelineClip[]>(() => [CREATE_DEMO_CLIP(SAMPLE_LABELS[0])]);
  const boardFontLoadKey = useMemo(
    () => `standalone-drawboard:${STANDALONE_CANVAS.boardFontUrl}:${STANDALONE_CANVAS.boardFontFamily}`,
    [],
  );

  // 稳定化回调引用，避免每次渲染触发 DrawboardStage useEffect 空转
  const handleGoldenFingerReady = useCallback((handle: GoldenFingerCanvasLayerHandle | null) => {
    goldenFingerLayerRef.current = handle;
  }, []);

  const patchBoardClip = (clipId: string, patch: BoardClipPatch) => {
    setBoardClips((previous) =>
      previous.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)),
    );
  };

  const updateLabel = (nextLabel: string) => {
    setBoardLabel(nextLabel);
    setBoardClips((previous) =>
      previous.map((clip) => (clip.id === 'standalone-clip-1' ? { ...clip, label: nextLabel } : clip)),
    );
  };

  const clip = boardClips[0];

  return (
    <div className="drawboard-standalone-page">
      <header className="drawboard-standalone-page__header">
        <Title level={4}>画布+画笔单体页</Title>
        <Text type="secondary">只验画布层和金手指层，不写入 A/B/C 主链。</Text>
      </header>

      <Card
        className="drawboard-standalone-page__controls"
        title="单体控制台"
      >
        <div className="drawboard-standalone-grid">
          <label>
            当前文本
            <Input.TextArea
              autoSize={{ minRows: 2, maxRows: 4 }}
              onChange={(event) => updateLabel(event.target.value)}
              value={boardLabel}
            />
          </label>
          <label>
            进度 {playheadMs}ms
            <Slider max={14000} min={0} onChange={(value) => setPlayheadMs(Array.isArray(value) ? value[0] : value)} value={playheadMs} />
          </label>
          <Space size={8} wrap>
            <Button onClick={() => updateLabel(SAMPLE_LABELS[0])}>示例 1</Button>
            <Button onClick={() => updateLabel(SAMPLE_LABELS[1])}>示例 2</Button>
            <Button onClick={() => updateLabel(SAMPLE_LABELS[2])}>示例 3</Button>
          </Space>
          <div className="drawboard-standalone-row">
            <Tag color={activeToolMode === 'off' ? 'blue' : 'default'}>模式: {activeToolMode}</Tag>
            <Tag color="default">颜色: {strokeColor}</Tag>
            <Tag color="default">粗细: {strokeWidth}</Tag>
            {clip ? <Tag color="default">C位置: ({Math.round(clip.xPercent ?? 0)}%, {Math.round(clip.yPercent ?? 0)}%)</Tag> : null}
          </div>
        </div>
      </Card>

      <DrawboardStage
        activeToolMode={activeToolMode}
        boardFontSize={STANDALONE_CANVAS.boardFontSize}
        canvas={STANDALONE_CANVAS}
        onClearGoldenFinger={() => goldenFingerLayerRef.current?.clear()}
        onChangeStrokeColor={setStrokeColor}
        onChangeStrokeWidth={setStrokeWidth}
        onChangeToolMode={setActiveToolMode}
        onGoldenFingerLayerReady={handleGoldenFingerReady}
        onUndoGoldenFinger={() => goldenFingerLayerRef.current?.undo()}
        problemText={STANDALONE_PROBLEM_TEXT}
        stageRef={stageRef}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
      >
        <AutoHandwritingLayer
          boardClips={boardClips}
          boardFontLoadKey={boardFontLoadKey}
          boardFontSize={STANDALONE_CANVAS.boardFontSize}
          canvas={STANDALONE_CANVAS}
          playheadMs={playheadMs}
          selectedBoardClipId={selectedBoardClipId}
          onSelectBoardClip={setSelectedBoardClipId}
          onUpdateBoardClip={patchBoardClip}
        />
      </DrawboardStage>
    </div>
  );
}
