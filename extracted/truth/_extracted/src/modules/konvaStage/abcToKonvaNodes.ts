// @cleanroom-module: konvaStage/abcToKonvaNodes
// @domain: stage-preview/konva-rendering
// @boundary: maps ABC data (boardClips, problemText, canvas config, playheadMs) to Konva node descriptors.
//   Pure data transformation, no React side-effects, no DOM access.
// @rationale: replaces tldraw shapes with Konva-friendly descriptors for Agent-first programmatic control.
//   Agent can call these functions directly to generate node configs, then feed into Konva Stage/Layer.

import type { StageCanvasConfig, TeachingAsset, TimelineClip } from '../../domain/teachingProject';
import { getBoardRevealProgress } from '../boardReveal';
import {
  DEFAULT_BOARD_STICKER_WIDTH_PERCENT,
  DEFAULT_BOARD_STICKER_X_PERCENT,
  DEFAULT_BOARD_STICKER_Y_PERCENT,
  getBoardStickerFontSize,
} from '../boardSticker';
import { compareBoardClipLayerOrder } from '../boardOrdering';
import { isPlayheadInsideTimelineWindowWithPinnedEnd } from '../timeline/timelineWindow';

// ── Stage size resolution ──────────────────────────────────────────────

/** Resolve Konva stage pixel dimensions from canvas config (same logic as tldraw version). */
export function resolveKonvaStageSize(canvas: StageCanvasConfig) {
  const width = canvas.width > canvas.height ? 960 : canvas.width === canvas.height ? 720 : 540;
  return {
    height: Math.round(width * (canvas.height / canvas.width)),
    width,
  };
}

// ── Board shape meta (clipId ↔ Konva node id mapping) ──────────────────

export type KonvaStageBoardShapeMeta = {
  clipId: string;
  nodeId: string; // unique id string for Konva node
};

// ── Static chrome nodes (frame border, labels, problem title) ──────────

export type KonvaTextNodeConfig = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  fontStyle?: string;
  width?: number;   // wrapping width (0 = auto)
  padding?: number;
  lineHeight?: number;
};

export type KonvaRectNodeConfig = {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  cornerRadius?: number;
};

export type KonvaBoardTextNodeConfig = KonvaTextNodeConfig & {
  clipId: string;
  revealProgress: number; // 0..1
  fullText: string;
};

/** Build the static chrome nodes: frame border, "题目"/"板书" labels, problem title text. */
export function buildKonvaStageChromeNodes(canvas: StageCanvasConfig, problemText: TeachingAsset | undefined, fontFamily: string): (KonvaRectNodeConfig | KonvaTextNodeConfig)[] {
  const size = resolveKonvaStageSize(canvas);
  const nodes: (KonvaRectNodeConfig | KonvaTextNodeConfig)[] = [];

  // Frame border
  nodes.push({
    id: 'konva-stage-frame',
    type: 'rect',
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
    stroke: '#29d4ff',
    strokeWidth: 2,
    dash: [8, 4],
    cornerRadius: 12,
  });

  // "题目" label
  nodes.push({
    id: 'konva-stage-problem-label',
    type: 'text',
    x: size.width * 0.035,
    y: size.height * 0.055,
    text: '题目',
    fontSize: 16,
    fontFamily,
    fill: '#29d4ff',
    fontStyle: 'bold',
  });

  // "板书" label
  nodes.push({
    id: 'konva-stage-board-label',
    type: 'text',
    x: size.width * 0.035,
    y: size.height * 0.24,
    text: '板书',
    fontSize: 16,
    fontFamily,
    fill: '#29d4ff',
    fontStyle: 'bold',
  });

  // Problem title
  if (problemText?.summary.trim()) {
    nodes.push({
      id: 'konva-stage-problem-text',
      type: 'text',
      x: size.width * 0.15,
      y: size.height * 0.04,
      text: problemText.summary.trim(),
      fontSize: 22,
      fontFamily,
      fill: '#111111',
      width: size.width * 0.76,
      lineHeight: 1.5,
      padding: 4,
    });
  }

  return nodes;
}

/** Build board clip text nodes with reveal progress. Agent calls this to get node configs. */
export function buildKonvaBoardClipNodes({
  boardClips,
  canvas,
  fontFamily,
  playheadMs,
}: {
  boardClips: TimelineClip[];
  canvas: StageCanvasConfig;
  fontFamily: string;
  playheadMs: number;
}): KonvaBoardTextNodeConfig[] {
  const size = resolveKonvaStageSize(canvas);
  const visibleBoardClips = boardClips
    .filter((clip) => isPlayheadInsideTimelineWindowWithPinnedEnd(playheadMs, clip.startMs, clip.endMs))
    .sort(compareBoardClipLayerOrder);

  return visibleBoardClips.map((clip) => {
    const revealProgress = getBoardRevealProgress({
      drawSpeed: clip.drawSpeed,
      playheadMs,
      revealEndMs: clip.revealEndMs ?? clip.sourceEndMs ?? clip.endMs,
      revealStartMs: clip.revealStartMs ?? clip.sourceStartMs ?? clip.startMs,
    });
    const fullText = clip.label.trim();
    const visibleLength = Math.max(1, Math.ceil(fullText.length * revealProgress));
    const visibleText = fullText.slice(0, visibleLength);

    const widthPercent = clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT;
    const xPercent = clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT;
    const yPercent = clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT;
    const fontSize = getBoardStickerFontSize(clip.fontSize, canvas.boardFontSize);

    return {
      id: `konva-board-${clip.id}`,
      type: 'text' as const,
      clipId: clip.id,
      x: size.width * (xPercent / 100),
      y: size.height * (yPercent / 100),
      text: visibleText,
      fullText,
      fontSize,
      fontFamily,
      fill: clip.color ?? '#111111',
      width: size.width * (widthPercent / 100),
      lineHeight: 1.6,
      padding: 4,
      revealProgress,
    };
  });
}

/** Build board shape meta list (clipId ↔ nodeId mapping) for selection tracking. */
export function buildKonvaBoardShapeMeta(boardClipNodes: KonvaBoardTextNodeConfig[]): KonvaStageBoardShapeMeta[] {
  return boardClipNodes.map((node) => ({
    clipId: node.clipId,
    nodeId: node.id,
  }));
}
