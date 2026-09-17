// @cleanroom-component: DrawboardHybridPrototypePage
// @domain: standalone-prototype
// @slot: full-page
// @depends: AutoHandwritingLayer, DrawboardStage, FloatingToolDock
// @route-impact: standalone=drawboard-hybrid

import { Button, Input, Slider, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AutoHandwritingLayer } from '../components/AutoHandwritingLayer';
import { DrawboardStage } from '../components/DrawboardStage';
import { FloatingToolDock } from '../components/FloatingToolDock';
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

type HybridShell = 'tiger' | 'dock' | 'focus';

const SHELL_OPTIONS: Array<{ description: string; label: string; value: HybridShell }> = [
  { description: '底部大面板 + 右侧 dock', label: '虎板', value: 'tiger' },
  { description: '右侧工具优先', label: 'Dock', value: 'dock' },
  { description: '尽量少打扰', label: '专注', value: 'focus' },
];

const PROTOTYPE_CANVAS: StageCanvasConfig = {
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

const PROTOTYPE_PROBLEM_TEXT: TeachingAsset = {
  id: 'prototype-problem',
  kind: 'problemText',
  source: 'manual',
  status: 'ready',
  summary: '例题：一辆车 2 小时行驶 120 公里，平均每小时行驶多少公里？',
  title: '混合原型题干',
};

function createDemoClip(label: string): TimelineClip {
  return {
    color: '#171717',
    drawSpeed: DEFAULT_BOARD_DRAW_SPEED,
    endMs: 14000,
    fontSize: 42,
    id: 'prototype-clip-1',
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
  };
}

const SAMPLE_LABELS = [
  '120 ÷ 2 = 60',
  '25×4=100\n1200÷100=12',
  'A: 已知 y=2x+1\nB: 求 x=3 时 y 的值',
];

export function DrawboardHybridPrototypePage() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const goldenFingerLayerRef = useRef<GoldenFingerCanvasLayerHandle | null>(null);
  const [shell, setShell] = useState<HybridShell>(() => readShellFromSearch(window.location.search));
  const [activeToolMode, setActiveToolMode] = useState<BoardStageToolMode>('off');
  const [strokeColor, setStrokeColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [selectedBoardClipId, setSelectedBoardClipId] = useState<string | null>('prototype-clip-1');
  const [playheadMs, setPlayheadMs] = useState(3000);
  const [boardLabel, setBoardLabel] = useState(SAMPLE_LABELS[0]);
  const [boardClips, setBoardClips] = useState<TimelineClip[]>(() => [createDemoClip(SAMPLE_LABELS[0])]);

  const boardFontLoadKey = useMemo(
    () => `prototype-drawboard:${PROTOTYPE_CANVAS.boardFontUrl}:${PROTOTYPE_CANVAS.boardFontFamily}`,
    [],
  );

  // 稳定化回调引用，避免每次渲染触发 DrawboardStage useEffect 空转
  const handleGoldenFingerReady = useCallback((handle: GoldenFingerCanvasLayerHandle | null) => {
    goldenFingerLayerRef.current = handle;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('standalone', 'drawboard-hybrid');
    params.set('shell', shell);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [shell]);

  const patchBoardClip = (clipId: string, patch: BoardClipPatch) => {
    setBoardClips((previous) => previous.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip)));
  };

  const updateLabel = (nextLabel: string) => {
    setBoardLabel(nextLabel);
    setBoardClips((previous) => previous.map((clip) => (clip.id === 'prototype-clip-1' ? { ...clip, label: nextLabel } : clip)));
  };

  const clip = boardClips[0];

  return (
    <div className={`drawboard-hybrid-prototype drawboard-hybrid-prototype--${shell}`}>
      <header className="drawboard-hybrid-prototype__header">
        <div className="drawboard-hybrid-prototype__header-copy">
          <Title level={4}>虎板混合原型</Title>
          <Text type="secondary">全屏画布 + 悬浮工具条 + 右侧快捷 dock，先看形态，不碰主轴。</Text>
        </div>
        <div className="drawboard-hybrid-prototype__header-tags">
          <Tag color="blue">shell: {shell}</Tag>
          <Tag>工具: {activeToolMode}</Tag>
          <Tag>播放: {Math.round(playheadMs / 100) / 10}s</Tag>
        </div>
      </header>

      <main className="drawboard-hybrid-prototype__stage-shell">
        <DrawboardStage
          activeToolMode={activeToolMode}
          boardFontSize={PROTOTYPE_CANVAS.boardFontSize}
          canvas={PROTOTYPE_CANVAS}
          onClearGoldenFinger={() => goldenFingerLayerRef.current?.clear()}
          onChangeStrokeColor={setStrokeColor}
          onChangeStrokeWidth={setStrokeWidth}
          onChangeToolMode={setActiveToolMode}
          onGoldenFingerLayerReady={handleGoldenFingerReady}
          onUndoGoldenFinger={() => goldenFingerLayerRef.current?.undo()}
          problemText={PROTOTYPE_PROBLEM_TEXT}
          stageRef={stageRef}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        >
          <AutoHandwritingLayer
            boardClips={boardClips}
            boardFontLoadKey={boardFontLoadKey}
            boardFontSize={PROTOTYPE_CANVAS.boardFontSize}
            canvas={PROTOTYPE_CANVAS}
            playheadMs={playheadMs}
            selectedBoardClipId={selectedBoardClipId}
            onSelectBoardClip={setSelectedBoardClipId}
            onUpdateBoardClip={patchBoardClip}
          />
        </DrawboardStage>

        <section className={`drawboard-hybrid-prototype__float-card drawboard-hybrid-prototype__float-card--${shell}`}>
          <div className="drawboard-hybrid-prototype__float-head">
            <div>
              <strong>悬浮控制台</strong>
              <small>{SHELL_OPTIONS.find((option) => option.value === shell)?.description}</small>
            </div>
            <Space size={6} wrap>
              {SHELL_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  onClick={() => setShell(option.value)}
                  type={shell === option.value ? 'primary' : 'default'}
                >
                  {option.label}
                </Button>
              ))}
            </Space>
          </div>

          <div className="drawboard-hybrid-prototype__float-toolbar">
            {null /* 画笔工具已移入 DrawboardStage 画布内部 */}
          </div>

          <div className="drawboard-hybrid-prototype__float-body">
            <label>
              C 文本
              <Input.TextArea
                autoSize={{ minRows: 2, maxRows: 4 }}
                onChange={(event) => updateLabel(event.target.value)}
                value={boardLabel}
              />
            </label>
            <label>
              播放位置 {playheadMs}ms
              <Slider
                max={14000}
                min={0}
                onChange={(value) => setPlayheadMs(Array.isArray(value) ? value[0] : value)}
                value={playheadMs}
              />
            </label>
            <Space size={8} wrap>
              <Button onClick={() => updateLabel(SAMPLE_LABELS[0])}>示例 1</Button>
              <Button onClick={() => updateLabel(SAMPLE_LABELS[1])}>示例 2</Button>
              <Button onClick={() => updateLabel(SAMPLE_LABELS[2])}>示例 3</Button>
            </Space>
            <div className="drawboard-hybrid-prototype__chips">
              <Tag color={shell === 'focus' ? 'gold' : 'blue'}>shell: {shell}</Tag>
              <Tag>模式: {activeToolMode}</Tag>
              <Tag>颜色: {strokeColor}</Tag>
              <Tag>粗细: {strokeWidth}</Tag>
              {clip ? <Tag>C位置: ({Math.round(clip.xPercent ?? 0)}%, {Math.round(clip.yPercent ?? 0)}%)</Tag> : null}
            </div>
          </div>
        </section>

        {shell !== 'focus' ? <FloatingToolDock /> : null}
      </main>
    </div>
  );
}

function readShellFromSearch(search: string): HybridShell {
  const value = new URLSearchParams(search).get('shell');
  if (value === 'dock' || value === 'focus' || value === 'tiger') {
    return value;
  }

  return 'tiger';
}
