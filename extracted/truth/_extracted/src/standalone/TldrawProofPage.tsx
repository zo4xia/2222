// @domain: standalone-prototype
// @route: standalone=tldraw-proof
// @boundary: tldraw 框架验真页；只证明框架能力，不写入主线 ABC 状态。
import { useCallback, useMemo, useState } from 'react';
import {
  createShapeId,
  Editor,
  GeoShapeGeoStyle,
  Tldraw,
  TLShapeId,
  toRichText,
  useValue,
} from 'tldraw';
import 'tldraw/tldraw.css';

type ProofBoardRow = {
  section: string;
  stepLabel: string;
  voiceText: string;
  boardSlice: string;
  chainKey: string;
};

const PROOF_ROWS: ProofBoardRow[] = [
  {
    section: 'read-problem',
    stepLabel: '开始读题',
    voiceText: '题目要求计算二十五乘四，再用一千二百除以结果。',
    boardSlice: '25 x 4 = 100',
    chainKey: 'read-problem-001',
  },
  {
    section: 'analysis',
    stepLabel: '分析题目',
    voiceText: '先求一组的数量，再把总量平均分。',
    boardSlice: '1200 ÷ 100 = 12',
    chainKey: 'analysis-001',
  },
  {
    section: 'step-1',
    stepLabel: '步骤1',
    voiceText: '乘法先完成，得到一百。',
    boardSlice: '所以每份是 12',
    chainKey: 'step-1-001',
  },
  {
    section: 'summary',
    stepLabel: '总结',
    voiceText: '答案是十二。',
    boardSlice: '答：12',
    chainKey: 'summary-001',
  },
];

const PROOF_SHAPE_IDS: TLShapeId[] = [
  createShapeId('proof-frame'),
  createShapeId('proof-title'),
  createShapeId('proof-read-problem-label'),
  createShapeId('proof-read-problem-board'),
  createShapeId('proof-analysis-label'),
  createShapeId('proof-analysis-board'),
  createShapeId('proof-step-1-label'),
  createShapeId('proof-step-1-board'),
  createShapeId('proof-summary-label'),
  createShapeId('proof-summary-board'),
];

export function TldrawProofPage() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [exportStatus, setExportStatus] = useState('未导出');
  const currentToolId = useValue('tldraw proof current tool', () => editor?.getCurrentToolId() ?? 'none', [editor]);

  const toolbarItems = useMemo(
    () => [
      { key: 'select', label: '选择', action: () => editor?.setCurrentTool('select') },
      { key: 'draw', label: '画笔', action: () => editor?.setCurrentTool('draw') },
      { key: 'eraser', label: '橡皮', action: () => editor?.setCurrentTool('eraser') },
      { key: 'text', label: '文字', action: () => editor?.setCurrentTool('text') },
      {
        key: 'rectangle',
        label: '矩形',
        action: () => {
          if (!editor) return;
          editor.run(() => {
            editor.setStyleForNextShapes(GeoShapeGeoStyle, 'rectangle');
            editor.setCurrentTool('geo');
          });
        },
      },
      {
        key: 'oval',
        label: '圆形',
        action: () => {
          if (!editor) return;
          editor.run(() => {
            editor.setStyleForNextShapes(GeoShapeGeoStyle, 'oval');
            editor.setCurrentTool('geo');
          });
        },
      },
    ],
    [editor],
  );

  const seedProofBoard = useCallback((mountedEditor: Editor) => {
    mountedEditor.run(() => {
      mountedEditor.deleteShapes(PROOF_SHAPE_IDS.filter((id) => mountedEditor.getShape(id)));
      mountedEditor.createShapes([
        {
          id: PROOF_SHAPE_IDS[0],
          type: 'geo',
          x: 80,
          y: 60,
          props: {
            geo: 'rectangle',
            w: 1120,
            h: 630,
            color: 'light-blue',
            fill: 'none',
            dash: 'draw',
            size: 'xl',
          },
        },
        {
          id: PROOF_SHAPE_IDS[1],
          type: 'text',
          x: 118,
          y: 92,
          props: {
            richText: toRichText('ABC rows -> tldraw 画布 proof'),
            size: 'l',
            font: 'draw',
            color: 'light-blue',
            autoSize: true,
          },
        },
        ...PROOF_ROWS.flatMap((row, index) => {
          const y = 168 + index * 112;
          return [
            {
              id: PROOF_SHAPE_IDS[2 + index * 2],
              type: 'text' as const,
              x: 128,
              y,
              props: {
            richText: toRichText(row.stepLabel),
                size: 'm' as const,
                font: 'draw' as const,
                color: 'light-blue' as const,
                autoSize: true,
              },
            },
            {
              id: PROOF_SHAPE_IDS[3 + index * 2],
              type: 'text' as const,
              x: 520,
              y: y - 8,
              props: {
                richText: toRichText(row.boardSlice),
                size: 'xl' as const,
                font: 'draw' as const,
                color: 'black' as const,
                autoSize: true,
              },
            },
          ];
        }),
      ]);
      mountedEditor.zoomToBounds({ x: 60, y: 40, w: 1180, h: 690 }, { animation: { duration: 0 } });
      mountedEditor.setCurrentTool('draw');
    });
  }, []);

  const handleMount = useCallback(
    (mountedEditor: Editor) => {
      setEditor(mountedEditor);
      seedProofBoard(mountedEditor);
    },
    [seedProofBoard],
  );

  const handleReset = useCallback(() => {
    if (!editor) return;
    seedProofBoard(editor);
  }, [editor, seedProofBoard]);

  const handleExport = useCallback(async () => {
    if (!editor) return;
    const shapeIds = [...editor.getCurrentPageShapeIds()];
    if (shapeIds.length === 0) {
      setExportStatus('无形状可导出');
      return;
    }
    const { blob } = await editor.toImage(shapeIds, { format: 'png', background: true });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tldraw-proof-board.png';
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus(`已导出 ${shapeIds.length} 个形状`);
  }, [editor]);

  return (
    <main className="tldraw-proof-page">
      <aside className="tldraw-proof-sidebar" aria-label="tldraw 外置工具栏">
        <div className="tldraw-proof-sidebar__title">tldraw proof</div>
        <div className="tldraw-proof-sidebar__meta">当前工具：{currentToolId}</div>
        <div className="tldraw-proof-toolbar">
          {toolbarItems.map((item) => (
            <button
              className="tldraw-proof-button"
              data-active={currentToolId === item.key || (item.key === 'rectangle' && currentToolId === 'geo')}
              key={item.key}
              onClick={item.action}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <button className="tldraw-proof-button tldraw-proof-button--primary" onClick={handleReset} type="button">
          重置 ABC 样例
        </button>
        <button className="tldraw-proof-button tldraw-proof-button--primary" onClick={handleExport} type="button">
          导出 PNG
        </button>
        <div className="tldraw-proof-sidebar__meta">{exportStatus}</div>
        <div className="tldraw-proof-data">
          {PROOF_ROWS.map((row) => (
            <div className="tldraw-proof-data__row" key={row.chainKey}>
              <strong>{row.stepLabel}</strong>
              <span>{row.boardSlice}</span>
            </div>
          ))}
        </div>
      </aside>
      <section className="tldraw-proof-canvas" aria-label="tldraw 画布区域">
        <Tldraw hideUi onMount={handleMount} persistenceKey="tldraw-proof-page" />
      </section>
    </main>
  );
}
