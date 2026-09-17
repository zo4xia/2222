// @cleanroom-component: BoardPreviewCard
// @domain: teaching-assets
// @slot: left-sider/board-preview
// @depends: CLayoutPreviewDraft, StageCanvasConfig, tldraw
// @route-impact: App shell only

import { useEffect, useMemo, useState } from 'react';
import { Tag, Typography } from 'antd';
import { createShapeId, Editor, Tldraw, toRichText } from 'tldraw';
import 'tldraw/tldraw.css';
import type { CLayoutPreviewDraft, StageCanvasConfig } from '../domain/teachingProject';
import { resolveTldrawStageSize } from '../modules/tldrawStage/abcToTldrawShapes';

const { Text } = Typography;

const PREVIEW_SHAPE_IDS = {
  frame: createShapeId('layout-preview-frame'),
  title: createShapeId('layout-preview-title'),
};

export function BoardPreviewCard({
  draft,
  stageCanvas,
}: {
  draft: CLayoutPreviewDraft | null;
  stageCanvas: StageCanvasConfig;
}) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const stageSize = useMemo(() => resolveTldrawStageSize(stageCanvas), [stageCanvas]);
  const draftKey = useMemo(
    () =>
      draft?.items
        .map((item) => `${item.id}:${item.xPercent}:${item.yPercent}:${item.widthPercent}:${item.fontSize}:${item.stackIndex}`)
        .join('|') ?? '',
    [draft],
  );

  useEffect(() => {
    if (!editor) return;

    const stalePreviewShapeIds = editor
      .getCurrentPageShapes()
      .map((shape) => shape.id)
      .filter((shapeId) => String(shapeId).startsWith('shape:layout-preview-item-'));

    editor.run(() => {
      editor.deleteShapes([
        PREVIEW_SHAPE_IDS.frame,
        PREVIEW_SHAPE_IDS.title,
        ...stalePreviewShapeIds,
      ].filter((id) => editor.getShape(id)));

      if (!draft?.items.length) {
        return;
      }

      const sortedItems = [...draft.items].sort((a, b) => a.stackIndex - b.stackIndex || a.id.localeCompare(b.id));

      editor.createShapes([
        {
          id: PREVIEW_SHAPE_IDS.frame,
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
          id: PREVIEW_SHAPE_IDS.title,
          type: 'text',
          x: stageSize.width * 0.04,
          y: stageSize.height * 0.04,
          props: {
            richText: toRichText('板书排版预览（临时）'),
            size: 'm',
            font: 'draw',
            color: 'light-blue',
            autoSize: true,
          },
        },
        ...sortedItems.map((item) => ({
          id: createShapeId(`layout-preview-item-${item.id}`),
          type: 'text' as const,
          x: stageSize.width * (item.xPercent / 100),
          y: stageSize.height * (item.yPercent / 100),
          props: {
            richText: toRichText(item.text),
            size: resolvePreviewTextSize(item.fontSize),
            font: 'draw' as const,
            color: 'black' as const,
            w: stageSize.width * (item.widthPercent / 100),
            autoSize: false,
          },
        })),
      ]);

      editor.zoomToBounds({ x: 0, y: 0, w: stageSize.width, h: stageSize.height }, { animation: { duration: 0 }, inset: 20 });
    }, { history: 'ignore' });
  }, [draft?.items.length, draftKey, editor, draft, stageSize.height, stageSize.width]);

  return (
    <section className="board-preview-card" aria-label="板书预览">
      <Text strong>板书排版预览</Text>
      <Tag color={draft?.items.length ? 'green' : 'default'}>
        {draft?.items.length ? `临时预览 ${draft.items.length} 项` : '暂无预览'}
      </Tag>
      {draft?.items.length ? (
        <div className="board-preview-canvas-wrap" aria-label="板书排版预览画布">
          <Tldraw
            hideUi
            onMount={setEditor}
            persistenceKey="board-layout-preview-sidecard"
          />
        </div>
      ) : (
        <div className="board-preview-placeholder">暂无板书预览</div>
      )}
      <Text type="secondary">用于视觉评审（临时态），不写正式 C 真相。</Text>
    </section>
  );
}

function resolvePreviewTextSize(fontSize: number): 's' | 'm' | 'l' | 'xl' {
  if (fontSize >= 46) return 'xl';
  if (fontSize >= 34) return 'l';
  if (fontSize >= 24) return 'm';
  return 's';
}
