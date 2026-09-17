// @cleanroom-component: GoldenFingerCanvasLayer
// @domain: drawboard-stage/golden-finger-overlay
// @slot: drawboard-stage/top-user-draw-layer
// @depends: native HTMLCanvasElement, BoardStageToolMode
// @io-input: activeToolMode, strokeColor
// @io-output: visible overlay strokes
// @boundary: visual overlay only; no A/B/C mutation, no timeline writes, no C asset writes, no whiteboard/base-worldline data mixing
// @mode-contract:
//   off     = golden-finger overlay stops owning pointer input
//   pen     = continuous freehand drawing
//   eraser  = erase strokes
//   highlight = semi-transparent wide marker (荧光笔/划重点)
//   circle  = two-point ellipse (圈圈标注)
//   cross   = two-point X mark (叉叉标注)

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { BoardStageToolMode } from './drawboardStageTypes';

type OverlayPoint = {
  x: number;
  y: number;
};

/** 每一笔记录的模式类型 */
type StrokeMode = 'pen' | 'eraser' | 'highlight' | 'circle' | 'cross';

type OverlayStroke = {
  color: string;
  mode: StrokeMode;
  points: OverlayPoint[];
  width: number;
};

const DEFAULT_PEN_WIDTH = 4;
const ERASER_WIDTH_MULTIPLIER = 4;
/** 高亮笔宽度倍率：基础宽度的 3 倍 */
const HIGHLIGHT_WIDTH_MULTIPLIER = 3;
/** 高亮笔透明度 */
const HIGHLIGHT_ALPHA = 0.35;
const MIN_POINT_DISTANCE_RATIO = 0.0012;

export type GoldenFingerCanvasLayerHandle = {
  clear: () => void;
  undo: () => void;
};

export const GoldenFingerCanvasLayer = forwardRef<GoldenFingerCanvasLayerHandle, {
  activeToolMode: BoardStageToolMode;
  strokeWidth: number;
  strokeColor: string;
}>(function GoldenFingerCanvasLayer({
  activeToolMode,
  strokeWidth,
  strokeColor,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<OverlayStroke[]>([]);
  const currentStrokeRef = useRef<OverlayStroke | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const redrawFrameRef = useRef<number | null>(null);

  /** 是否需要拦截事件并绘制：pen / eraser / highlight 连续绘制，circle / cross 单次放置 */
  const canDraw = activeToolMode === 'pen' || activeToolMode === 'eraser' || activeToolMode === 'highlight' || activeToolMode === 'circle' || activeToolMode === 'cross';

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    canvas.dataset.strokeCount = String(strokesRef.current.length + (currentStrokeRef.current ? 1 : 0));

    for (const stroke of [...strokesRef.current, ...(currentStrokeRef.current ? [currentStrokeRef.current] : [])]) {
      drawStroke(context, stroke, rect.width, rect.height);
    }
  }, []);

  const cancelScheduledRedraw = useCallback(() => {
    if (redrawFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(redrawFrameRef.current);
    redrawFrameRef.current = null;
  }, []);

  const scheduleRedraw = useCallback(() => {
    if (redrawFrameRef.current !== null) {
      return;
    }

    redrawFrameRef.current = window.requestAnimationFrame(() => {
      redrawFrameRef.current = null;
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    redraw();
    return () => cancelScheduledRedraw();
  }, [cancelScheduledRedraw, redraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(() => {
    if (canDraw) {
      return;
    }

    const canvas = canvasRef.current;
    if (canvas && pointerIdRef.current !== null) {
      releasePointer(canvas, pointerIdRef.current);
    }
    cancelScheduledRedraw();
    currentStrokeRef.current = null;
    pointerIdRef.current = null;
    redraw();
  }, [canDraw, cancelScheduledRedraw, redraw]);

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        cancelScheduledRedraw();
        strokesRef.current = [];
        currentStrokeRef.current = null;
        pointerIdRef.current = null;
        redraw();
      },
      undo: () => {
        cancelScheduledRedraw();
        strokesRef.current = strokesRef.current.slice(0, -1);
        currentStrokeRef.current = null;
        pointerIdRef.current = null;
        redraw();
      },
    }),
    [cancelScheduledRedraw, redraw],
  );

  /** 将 toolMode 映射到 StrokeMode */
  const modeForTool = useCallback((tool: BoardStageToolMode): StrokeMode => {
    if (tool === 'eraser') return 'eraser';
    if (tool === 'highlight') return 'highlight';
    if (tool === 'circle') return 'circle';
    if (tool === 'cross') return 'cross';
    return 'pen';
  }, []);

  /** 根据工具模式计算笔宽 */
  const widthForTool = useCallback((tool: BoardStageToolMode): number => {
    if (tool === 'eraser') return strokeWidth * ERASER_WIDTH_MULTIPLIER;
    if (tool === 'highlight') return (strokeWidth || DEFAULT_PEN_WIDTH) * HIGHLIGHT_WIDTH_MULTIPLIER;
    return strokeWidth || DEFAULT_PEN_WIDTH;
  }, [strokeWidth]);

  const commitCurrentStroke = useCallback(
    (canvas: HTMLCanvasElement, pointerId: number) => {
      if (pointerIdRef.current !== pointerId || !currentStrokeRef.current) {
        return;
      }

      const completedStroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      pointerIdRef.current = null;
      strokesRef.current = [...strokesRef.current, completedStroke];
      releasePointer(canvas, pointerId);
      scheduleRedraw();
    },
    [scheduleRedraw],
  );

  /** pen/eraser/highlight：持续绘制；circle/cross：只记录起点，移动时预览 */
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();

    const points = readPointerSamples(event.currentTarget, event.nativeEvent);
    pointerIdRef.current = event.pointerId;
    currentStrokeRef.current = {
      color: strokeColor,
      mode: modeForTool(activeToolMode),
      points,
      width: widthForTool(activeToolMode),
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // iPadOS / Safari 可能拒绝 pointer capture，绘制可继续
    }
    scheduleRedraw();
  }, [canDraw, strokeColor, activeToolMode, modeForTool, widthForTool, scheduleRedraw]);

  /** pen/eraser/highlight：追加采样点；circle/cross：更新终点预览 */
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId || !currentStrokeRef.current) {
      return;
    }
    event.preventDefault();

    const points = readPointerSamples(event.currentTarget, event.nativeEvent);
    const mode = currentStrokeRef.current.mode;

    if (mode === 'circle' || mode === 'cross') {
      // 单次放置工具：只保留起点 + 最新位置作为终点预览
      currentStrokeRef.current.points = [currentStrokeRef.current.points[0], points[points.length - 1]];
      scheduleRedraw();
      return;
    }

    // 连续绘制工具：追加采样点
    let changed = false;
    for (const point of points) {
      changed = appendPoint(currentStrokeRef.current, point) || changed;
    }
    if (!changed) {
      return;
    }
    scheduleRedraw();
  }, [scheduleRedraw]);

  return (
    <canvas
      aria-hidden="true"
      className="golden-finger-canvas-layer"
      data-golden-finger-mode={activeToolMode}
      onPointerCancel={(event) => {
        if (pointerIdRef.current !== event.pointerId) {
          return;
        }
        event.preventDefault();
        releasePointer(event.currentTarget, event.pointerId);
        currentStrokeRef.current = null;
        pointerIdRef.current = null;
        scheduleRedraw();
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        commitCurrentStroke(event.currentTarget, event.pointerId);
      }}
      onLostPointerCapture={(event) => {
        commitCurrentStroke(event.currentTarget, event.pointerId);
      }}
      ref={canvasRef}
      style={{ pointerEvents: canDraw ? 'auto' : 'none' }}
    />
  );
});

function releasePointer(canvas: HTMLCanvasElement, pointerId: number) {
  if (canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
}

function readPoint(bounds: CanvasBounds, clientX: number, clientY: number): OverlayPoint {
  return {
    x: clampRatio((clientX - bounds.left) / bounds.width),
    y: clampRatio((clientY - bounds.top) / bounds.height),
  };
}

function readPointerSamples(canvas: HTMLCanvasElement, pointerEvent: PointerEvent): OverlayPoint[] {
  const bounds = readCanvasBounds(canvas);
  const coalescedEvents =
    typeof pointerEvent.getCoalescedEvents === 'function' ? pointerEvent.getCoalescedEvents() : [];
  const samples = coalescedEvents.length ? coalescedEvents : [pointerEvent];
  return samples.map((sample) => readPoint(bounds, sample.clientX, sample.clientY));
}

function appendPoint(stroke: OverlayStroke, nextPoint: OverlayPoint) {
  const previousPoint = stroke.points[stroke.points.length - 1];
  if (!previousPoint) {
    stroke.points.push(nextPoint);
    return true;
  }

  const dx = nextPoint.x - previousPoint.x;
  const dy = nextPoint.y - previousPoint.y;
  const distance = Math.hypot(dx, dy);
  if (distance < MIN_POINT_DISTANCE_RATIO) {
    return false;
  }

  stroke.points.push(nextPoint);
  return true;
}

type CanvasBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

function readCanvasBounds(canvas: HTMLCanvasElement): CanvasBounds {
  const rect = canvas.getBoundingClientRect();
  return {
    height: rect.height || 1,
    left: rect.left,
    top: rect.top,
    width: rect.width || 1,
  };
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

// ─── 核心绘制函数 ────────────────────────────────────────────────

function drawStroke(context: CanvasRenderingContext2D, stroke: OverlayStroke, width: number, height: number) {
  if (!stroke.points.length) {
    return;
  }

  switch (stroke.mode) {
    case 'circle':
      drawCircleShape(context, stroke, width, height);
      return;
    case 'cross':
      drawCrossShape(context, stroke, width, height);
      return;
    case 'highlight':
      drawFreehand(context, stroke, width, height, HIGHLIGHT_ALPHA);
      return;
    default:
      drawFreehand(context, stroke, width, height, 1);
  }
}

/** 自由绘制（画笔/橡皮擦/高亮笔） */
function drawFreehand(
  context: CanvasRenderingContext2D,
  stroke: OverlayStroke,
  cw: number,
  ch: number,
  alpha: number,
) {
  context.save();
  context.globalAlpha = alpha;
  context.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.lineWidth = stroke.width;
  context.strokeStyle = stroke.color;
  context.fillStyle = stroke.color;

  const [firstPoint] = stroke.points;
  const firstX = firstPoint.x * cw;
  const firstY = firstPoint.y * ch;

  if (stroke.points.length === 1) {
    // 单点画圆
    context.beginPath();
    context.arc(firstX, firstY, stroke.width / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(firstX, firstY);

  if (stroke.points.length === 2) {
    const secondPoint = stroke.points[1];
    context.lineTo(secondPoint.x * cw, secondPoint.y * ch);
    context.stroke();
    context.restore();
    return;
  }

  // 三次及以上：quadraticCurveTo 平滑曲线
  for (let index = 1; index < stroke.points.length - 1; index += 1) {
    const point = stroke.points[index];
    const nextPoint = stroke.points[index + 1];
    const controlX = point.x * cw;
    const controlY = point.y * ch;
    const endX = ((point.x + nextPoint.x) * cw) / 2;
    const endY = ((point.y + nextPoint.y) * ch) / 2;
    context.quadraticCurveTo(controlX, controlY, endX, endY);
  }
  const lastPoint = stroke.points[stroke.points.length - 1];
  context.lineTo(lastPoint.x * cw, lastPoint.y * ch);
  context.stroke();
  context.restore();
}

/** 绘制圈圈：两点确定的椭圆 */
function drawCircleShape(context: CanvasRenderingContext2D, stroke: OverlayStroke, cw: number, ch: number) {
  if (stroke.points.length < 2) {
    // 只有一个点时画预览小圆
    const [pt] = stroke.points;
    context.save();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.beginPath();
    context.ellipse(pt.x * cw, pt.y * ch, stroke.width * 2, stroke.width * 2, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return;
  }

  const [start, end] = stroke.points;
  const cx = ((start.x + end.x) / 2) * cw;
  const cy = ((start.y + end.y) / 2) * ch;
  const rx = (Math.abs(end.x - start.x) * cw) / 2;
  const ry = (Math.abs(end.y - start.y) * ch) / 2;

  context.save();
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.beginPath();
  context.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

/** 绘制叉叉：两点之间的 X 标记 */
function drawCrossShape(context: CanvasRenderingContext2D, stroke: OverlayStroke, cw: number, ch: number) {
  if (stroke.points.length < 2) {
    // 只有一个点时画预览小叉
    const [pt] = stroke.points;
    const cx = pt.x * cw;
    const cy = pt.y * ch;
    const halfSize = stroke.width * 3;
    context.save();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(cx - halfSize, cy - halfSize);
    context.lineTo(cx + halfSize, cy + halfSize);
    context.moveTo(cx + halfSize, cy - halfSize);
    context.lineTo(cx - halfSize, cy + halfSize);
    context.stroke();
    context.restore();
    return;
  }

  const [start, end] = stroke.points;
  const x1 = start.x * cw;
  const y1 = start.y * ch;
  const x2 = end.x * cw;
  const y2 = end.y * ch;

  context.save();
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.moveTo(x2, y1);
  context.lineTo(x1, y2);
  context.stroke();
  context.restore();
}
