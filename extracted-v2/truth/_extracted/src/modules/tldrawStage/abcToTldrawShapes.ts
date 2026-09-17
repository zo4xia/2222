import { createShapeId, type Editor, type TLShapeId, toRichText } from 'tldraw';
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

export const TL_STAGE_SHAPE_IDS = {
  frame: createShapeId('abc-stage-frame'),
  problemLabel: createShapeId('abc-stage-problem-label'),
  boardLabel: createShapeId('abc-stage-board-label'),
  problemText: createShapeId('abc-stage-problem-text'),
};

export type TldrawStageBoardShapeMeta = {
  clipId: string;
  shapeId: TLShapeId;
};

export function syncAbcStageToTldraw({
  canvas,
  editor,
  playheadMs,
  problemText,
  boardClips,
}: {
  canvas: StageCanvasConfig;
  editor: Editor;
  playheadMs: number;
  problemText: TeachingAsset | undefined;
  boardClips: TimelineClip[];
}): TldrawStageBoardShapeMeta[] {
  const stageSize = resolveTldrawStageSize(canvas);
  const visibleBoardClips = boardClips
    .filter((clip) => isPlayheadInsideTimelineWindowWithPinnedEnd(playheadMs, clip.startMs, clip.endMs))
    .sort(compareBoardClipLayerOrder);
  const boardShapeIds = visibleBoardClips.map((clip) => createShapeId(`abc-board-${clip.id}`));
  const managedIds = [
    TL_STAGE_SHAPE_IDS.frame,
    TL_STAGE_SHAPE_IDS.problemLabel,
    TL_STAGE_SHAPE_IDS.boardLabel,
    TL_STAGE_SHAPE_IDS.problemText,
    ...boardClips.map((clip) => createShapeId(`abc-board-${clip.id}`)),
  ];

  editor.run(() => {
    editor.deleteShapes(managedIds.filter((id) => editor.getShape(id)));
    editor.createShapes(
      [
        {
          id: TL_STAGE_SHAPE_IDS.frame,
          type: 'geo',
          x: 0,
          y: 0,
          props: {
            geo: 'rectangle',
            w: stageSize.width,
            h: stageSize.height,
            color: 'light-blue',
            fill: 'none',
            dash: 'draw',
            size: 'xl',
          },
        },
        {
          id: TL_STAGE_SHAPE_IDS.problemLabel,
          type: 'text',
          x: stageSize.width * 0.035,
          y: stageSize.height * 0.055,
          props: {
            richText: toRichText('题目'),
            size: 'm',
            font: 'draw',
            color: 'light-blue',
            autoSize: true,
          },
        },
        {
          id: TL_STAGE_SHAPE_IDS.boardLabel,
          type: 'text',
          x: stageSize.width * 0.035,
          y: stageSize.height * 0.24,
          props: {
            richText: toRichText('板书'),
            size: 'm',
            font: 'draw',
            color: 'light-blue',
            autoSize: true,
          },
        },
        ...(problemText?.summary.trim()
          ? [
              {
                id: TL_STAGE_SHAPE_IDS.problemText,
                type: 'text' as const,
                x: stageSize.width * 0.15,
                y: stageSize.height * 0.04,
                props: {
                  richText: toRichText(problemText.summary.trim()),
                  size: 'l' as const,
                  font: 'draw' as const,
                  color: 'black' as const,
                  w: stageSize.width * 0.76,
                  autoSize: false,
                },
              },
            ]
          : []),
        ...visibleBoardClips.map((clip, index) => {
          const revealProgress = getBoardRevealProgress({
            drawSpeed: clip.drawSpeed,
            playheadMs,
            revealEndMs: clip.revealEndMs ?? clip.sourceEndMs ?? clip.endMs,
            revealStartMs: clip.revealStartMs ?? clip.sourceStartMs ?? clip.startMs,
          });
          const sourceText = clip.label.trim();
          const visibleLength = Math.max(1, Math.ceil(sourceText.length * revealProgress));
          const visibleText = sourceText.slice(0, visibleLength);
          const widthPercent = clip.widthPercent ?? DEFAULT_BOARD_STICKER_WIDTH_PERCENT;
          const xPercent = clip.xPercent ?? DEFAULT_BOARD_STICKER_X_PERCENT;
          const yPercent = clip.yPercent ?? DEFAULT_BOARD_STICKER_Y_PERCENT;
          const fontSize = getBoardStickerFontSize(clip.fontSize, canvas.boardFontSize);

          return {
            id: boardShapeIds[index],
            type: 'text' as const,
            x: stageSize.width * (xPercent / 100),
            y: stageSize.height * (yPercent / 100),
            props: {
              richText: toRichText(visibleText),
              size: resolveTldrawTextSize(fontSize),
              font: 'draw' as const,
              color: 'black' as const,
              w: stageSize.width * (widthPercent / 100),
              autoSize: false,
            },
          };
        }),
      ],
    );
  }, { history: 'ignore' });

  return visibleBoardClips.map((clip, index) => ({
    clipId: clip.id,
    shapeId: boardShapeIds[index],
  }));
}

export function resolveTldrawStageSize(canvas: StageCanvasConfig) {
  const width = canvas.width > canvas.height ? 960 : canvas.width === canvas.height ? 720 : 540;
  return {
    height: Math.round(width * (canvas.height / canvas.width)),
    width,
  };
}

function resolveTldrawTextSize(fontSize: number): 's' | 'm' | 'l' | 'xl' {
  if (fontSize >= 46) return 'xl';
  if (fontSize >= 34) return 'l';
  if (fontSize >= 24) return 'm';
  return 's';
}
