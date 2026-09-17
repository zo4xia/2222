// @cleanroom-component: DrawboardStage
// @domain: drawboard-stage
// @slot: center-stage/drawboard-home
// @depends: StageCanvasConfig, TeachingAsset(problemText)
// @io-input: canvas, problemText, boardFontSize, children layers
// @io-output: rendered stage container for recording
// @boundary: layout/recording house only; does not own A audio, B timing, or C1/C2 internals

import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StageCanvasConfig, TeachingAsset } from '../domain/teachingProject';
import type { BoardStageToolMode, StageRecordingCanvases } from './drawboardStageTypes';
import { BoardStageToolOverlay } from './BoardStageToolOverlay';
import { CanvasRecordingSurface } from './CanvasRecordingSurface';
import { GoldenFingerCanvasLayer, type GoldenFingerCanvasLayerHandle } from './GoldenFingerCanvasLayer';
import { MathText } from './MathText';

export function DrawboardStage({
  activeToolMode,
  boardFontSize,
  canvas,
  children,
  onClearGoldenFinger,
  onChangeStrokeColor,
  onChangeStrokeWidth,
  onChangeToolMode,
  onGoldenFingerLayerReady,
  onRecordingCanvasesReady,
  onUndoGoldenFinger,
  problemText,
  stageRef,
  strokeColor,
  strokeWidth,
}: {
  activeToolMode: BoardStageToolMode;
  boardFontSize: number;
  canvas: StageCanvasConfig;
  children: ReactNode;
  onClearGoldenFinger?: () => void;
  onChangeStrokeColor?: (color: string) => void;
  onChangeStrokeWidth?: (width: number) => void;
  onChangeToolMode?: (mode: BoardStageToolMode) => void;
  onGoldenFingerLayerReady?: (handle: GoldenFingerCanvasLayerHandle | null) => void;
  /** 暴露底图 canvas + 金手指 canvas 给录制模块做合成录制 */
  onRecordingCanvasesReady?: (canvases: Omit<StageRecordingCanvases, 'content'> | null) => void;
  onUndoGoldenFinger?: () => void;
  problemText: TeachingAsset | undefined;
  stageRef: RefObject<HTMLDivElement | null>;
  strokeColor: string;
  strokeWidth: number;
}) {
  const problemSummary = problemText?.summary.trim();
  const [baseCanvasEl, setBaseCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const overlayContainerRef = useRef<HTMLDivElement | null>(null);
  /** 画笔层是否需要拦截事件：pen/eraser/highlight/circle/cross 时拦截，off 时穿透给 C 层 */
  const canDrawOverlay = activeToolMode !== 'off';

  /** callback ref 替代 useRef + useEffect 中间层，直接通知父组件 GoldenFinger handle 就绪 */
  const goldenFingerCallbackRef = useCallback(
    (handle: GoldenFingerCanvasLayerHandle | null) => {
      onGoldenFingerLayerReady?.(handle);
    },
    [onGoldenFingerLayerReady],
  );

  // 收集底图 canvas 和金手指 canvas，向上通知录制模块
  const syncRecordingCanvases = useCallback(() => {
    const overlayCanvas = overlayContainerRef.current?.querySelector('.golden-finger-canvas-layer') as HTMLCanvasElement | null;
    if (baseCanvasEl && overlayCanvas) {
      onRecordingCanvasesReady?.({ base: baseCanvasEl, overlay: overlayCanvas });
    }
  }, [baseCanvasEl, onRecordingCanvasesReady]);

  useEffect(() => {
    syncRecordingCanvases();
  }, [syncRecordingCanvases]);

  return (
    <div className="drawboard-stage-shell">
      <BoardStageToolOverlay
        activeColor={strokeColor}
        activeStrokeWidth={strokeWidth}
        activeToolMode={activeToolMode}
        onChangeColor={(color) => onChangeStrokeColor?.(color)}
        onChangeStrokeWidth={(width) => onChangeStrokeWidth?.(width)}
        onChangeToolMode={(mode) => onChangeToolMode?.(mode)}
        onClear={() => onClearGoldenFinger?.()}
        onUndo={() => onUndoGoldenFinger?.()}
      />
      <div
        ref={stageRef}
        className="stage-canvas stage-canvas--courseware"
        style={{
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          background: canvas.background,
          '--board-font-size': `${boardFontSize}px`,
          '--board-handwriting-font': canvas.boardFontFamily,
        } as CSSProperties}
      >
        <CanvasRecordingSurface canvas={canvas} onCanvasReady={setBaseCanvasEl} problemSummary={problemSummary} />
        <div className="courseware-label courseware-label--problem">题目</div>
        <div className="courseware-label courseware-label--answer">解答</div>
        <div className="courseware-problem-area">
          {problemSummary ? (
            <MathText as="p" className="stage-problem-text">
              {problemSummary}
            </MathText>
          ) : null}
        </div>
        {children}
        <div ref={overlayContainerRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: canDrawOverlay ? 'auto' : 'none' }}>
          <GoldenFingerCanvasLayer
            ref={goldenFingerCallbackRef}
            activeToolMode={activeToolMode}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
          />
        </div>
      </div>
    </div>
  );
}
