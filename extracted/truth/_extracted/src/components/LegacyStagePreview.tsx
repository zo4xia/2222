// @cleanroom-component: StagePreview
// @domain: stage-preview
// @slot: center-stage
// @depends: TeachingProject.stage.canvas, TeachingProject.assets(problemText), TeachingProject.timeline.clips(kind=board)
// @io-input: canvas, problemText, boardClips, playheadMs, selectedBoardClipId
// @io-output: onSelectBoardClip(clipId), onUpdateBoardClip(C visual x/y/width/fontSize)
// @route: App shell / center stage
// @fields: StageCanvasConfig, TeachingProject.assets(kind=problemText).summary, TimelineClip(kind=board).xPercent/yPercent/widthPercent/fontSize
// @boundary: C canvas position editing only; B timing stays in TeachingTimeline, A audio stays immutable
// @c-stage-copy: 整张画布都是 C 素材演绎区
// @route-impact: App shell only

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from 'antd';
import type { StageCanvasConfig, TeachingAsset, TimelineClip } from '../domain/teachingProject';
import { DEFAULT_BOARD_FONT_SIZE } from '../modules/boardFont/boardFontConfig';
import { AutoHandwritingLayer } from './AutoHandwritingLayer';
import { DrawboardStage } from './DrawboardStage';
import type { BoardStageToolMode, StageRecordingCanvases } from './drawboardStageTypes';
import type { GoldenFingerCanvasLayerHandle } from './GoldenFingerCanvasLayer';
import type { BoardClipPatch } from './drawboardStageTypes';
import { StagePreviewToolbar } from './StagePreviewToolbar';

export function StagePreview({
  boardClips,
  canvas,
  playheadMs,
  problemText,
  selectedBoardClipId,
  onRecordingActiveChange,
  onSelectBoardClip,
  onUpdateBoardClip,
}: {
  boardClips: TimelineClip[];
  canvas: StageCanvasConfig;
  playheadMs: number;
  problemText: TeachingAsset | undefined;
  selectedBoardClipId: string | null;
  onRecordingActiveChange?: (isRecording: boolean) => void;
  onSelectBoardClip: (clipId: string) => void;
  onUpdateBoardClip: (clipId: string, patch: BoardClipPatch) => void;
}) {
  const stageCanvasRef = useRef<HTMLDivElement | null>(null);
  const [boardFontLoadCount, setBoardFontLoadCount] = useState(0);
  const [activeToolMode, setActiveToolMode] = useState<BoardStageToolMode>('off');
  const [strokeColor, setStrokeColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const goldenFingerLayerRef = useRef<GoldenFingerCanvasLayerHandle | null>(null);
  const [stageRecordingCanvases, setStageRecordingCanvases] = useState<Omit<StageRecordingCanvases, 'content'> | null>(null);
  const [contentRecordingCanvas, setContentRecordingCanvas] = useState<HTMLCanvasElement | null>(null);
  const boardFontSize = canvas.boardFontSize || DEFAULT_BOARD_FONT_SIZE;
  const boardFontLoadKey = `${canvas.boardFontUrl || 'local'}:${boardFontLoadCount}`;
  const recordingCanvases = stageRecordingCanvases
    ? {
        ...stageRecordingCanvases,
        content: contentRecordingCanvas,
      }
    : null;

  // 稳定化回调引用，避免每次父渲染触发 DrawboardStage useEffect 空转
  const handleGoldenFingerReady = useCallback((handle: GoldenFingerCanvasLayerHandle | null) => {
    goldenFingerLayerRef.current = handle;
  }, []);

  useEffect(() => {
    const boardFontUrl = canvas.boardFontUrl?.trim();
    if (!boardFontUrl) {
      setBoardFontLoadCount((count) => count + 1);
      return;
    }

    let isCancelled = false;
    const stylesheetLink = document.createElement('link');
    stylesheetLink.dataset.cleanroomBoardFont = 'true';
    stylesheetLink.href = boardFontUrl;
    stylesheetLink.rel = 'stylesheet';

    const markFontStylesheetSettled = () => {
      if (!isCancelled) {
        setBoardFontLoadCount((count) => count + 1);
      }
    };

    stylesheetLink.addEventListener('load', markFontStylesheetSettled);
    stylesheetLink.addEventListener('error', markFontStylesheetSettled);
    document.head.appendChild(stylesheetLink);
    setBoardFontLoadCount((count) => count + 1);

    return () => {
      isCancelled = true;
      stylesheetLink.removeEventListener('load', markFontStylesheetSettled);
      stylesheetLink.removeEventListener('error', markFontStylesheetSettled);
      stylesheetLink.remove();
    };
  }, [canvas.boardFontUrl]);

  return (
    <Card
      className="zone-card zone-stage"
      title="预览舞台"
      extra={
        <StagePreviewToolbar
          onRecordingActiveChange={onRecordingActiveChange}
          recordingCanvases={recordingCanvases}
        />
      }
    >
      <DrawboardStage
        activeToolMode={activeToolMode}
        boardFontSize={boardFontSize}
        canvas={canvas}
        onClearGoldenFinger={() => goldenFingerLayerRef.current?.clear()}
        onChangeStrokeColor={setStrokeColor}
        onChangeStrokeWidth={setStrokeWidth}
        onChangeToolMode={setActiveToolMode}
        onGoldenFingerLayerReady={handleGoldenFingerReady}
        onRecordingCanvasesReady={setStageRecordingCanvases}
        onUndoGoldenFinger={() => goldenFingerLayerRef.current?.undo()}
        problemText={problemText}
        stageRef={stageCanvasRef}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
      >
        <AutoHandwritingLayer
          boardClips={boardClips}
          boardFontLoadKey={boardFontLoadKey}
          boardFontSize={boardFontSize}
          canvas={canvas}
          playheadMs={playheadMs}
          selectedBoardClipId={selectedBoardClipId}
          onRecordingCanvasReady={setContentRecordingCanvas}
          onSelectBoardClip={onSelectBoardClip}
          onUpdateBoardClip={onUpdateBoardClip}
        />
      </DrawboardStage>
    </Card>
  );
}
