// @cleanroom-component: TldrawStagePreview
// @domain: stage-preview/framework-canvas
// @boundary: tldraw 框架舞台；读取现有 ABC 数据，不拥有 A/B/C 真相源。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, ColorPicker, Modal, Segmented, Slider, Space, Typography } from 'antd';
import {
  DefaultColorStyle,
  Editor,
  GeoShapeGeoStyle,
  Tldraw,
  useValue,
} from 'tldraw';
import 'tldraw/tldraw.css';
import type { StageCanvasConfig, TeachingAsset, TimelineClip } from '../domain/teachingProject';
import { resolveTldrawStageSize, syncAbcStageToTldraw, type TldrawStageBoardShapeMeta } from '../modules/tldrawStage/abcToTldrawShapes';
import { StagePreviewToolbar } from './StagePreviewToolbar';
import type { BoardStageToolMode, StageRecordingCanvases } from './drawboardStageTypes';
import type { BoardClipPatch } from './drawboardStageTypes';

const { Text } = Typography;

export function TldrawStagePreview({
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
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeToolMode, setActiveToolMode] = useState<BoardStageToolMode>('off');
  const [strokeColor, setStrokeColor] = useState('#111111');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const [boardShapeMeta, setBoardShapeMeta] = useState<TldrawStageBoardShapeMeta[]>([]);
  const [recordingCanvas, setRecordingCanvas] = useState<HTMLCanvasElement | null>(null);
  const [emptyOverlayCanvas, setEmptyOverlayCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const latestClipPatchRef = useRef('');
  const currentToolId = useValue('stage current tldraw tool', () => editor?.getCurrentToolId() ?? 'select', [editor]);
  const boardClipKey = useMemo(
    () => boardClips.map((clip) => [
      clip.id,
      clip.label,
      clip.startMs,
      clip.endMs,
      clip.xPercent,
      clip.yPercent,
      clip.widthPercent,
      clip.fontSize,
      clip.drawSpeed,
      clip.revealStartMs,
      clip.revealEndMs,
    ].join(':')).join('|'),
    [boardClips],
  );
  const stageSize = useMemo(() => resolveTldrawStageSize(canvas), [canvas]);
  const recordingCanvases = useMemo<StageRecordingCanvases | null>(
    () => (recordingCanvas && emptyOverlayCanvas ? { base: recordingCanvas, content: null, overlay: emptyOverlayCanvas } : null),
    [emptyOverlayCanvas, recordingCanvas],
  );

  useEffect(() => {
    if (!editor) return;
    const nextMeta = syncAbcStageToTldraw({
      boardClips,
      canvas,
      editor,
      playheadMs,
      problemText,
    });
    setBoardShapeMeta(nextMeta);
    window.requestAnimationFrame(() => {
      editor.zoomToBounds({ x: 0, y: 0, w: stageSize.width, h: stageSize.height }, { animation: { duration: 0 }, inset: 24 });
    });
  }, [boardClipKey, boardClips, canvas, editor, playheadMs, problemText, stageSize]);

  useEffect(() => {
    if (!editor) return;
    return editor.store.listen(
      () => {
        const selectedShape = editor.getOnlySelectedShape();
        const hit = boardShapeMeta.find((item) => item.shapeId === selectedShape?.id);
        if (hit && hit.clipId !== selectedBoardClipId) {
          onSelectBoardClip(hit.clipId);
        }
        if (hit && selectedShape && selectedShape.type === 'text') {
          const props = selectedShape.props as { w?: number };
          const patch = {
            widthPercent: props.w ? (props.w / stageSize.width) * 100 : undefined,
            xPercent: (selectedShape.x / stageSize.width) * 100,
            yPercent: (selectedShape.y / stageSize.height) * 100,
          };
          const patchKey = `${hit.clipId}:${Math.round(patch.xPercent * 100)}:${Math.round(patch.yPercent * 100)}:${Math.round((patch.widthPercent ?? 0) * 100)}`;
          if (patchKey !== latestClipPatchRef.current) {
            latestClipPatchRef.current = patchKey;
            onUpdateBoardClip(hit.clipId, patch);
          }
        }
      },
      { scope: 'all' },
    );
  }, [boardShapeMeta, editor, onSelectBoardClip, onUpdateBoardClip, selectedBoardClipId, stageSize]);

  useEffect(() => {
    if (!editor || !selectedBoardClipId) return;
    const meta = boardShapeMeta.find((item) => item.clipId === selectedBoardClipId);
    if (meta) {
      editor.setSelectedShapes([meta.shapeId]);
    }
  }, [boardShapeMeta, editor, selectedBoardClipId]);

  const handleMount = useCallback((mountedEditor: Editor) => {
    setEditor(mountedEditor);
    mountedEditor.setCurrentTool('select');
  }, []);

  useEffect(() => {
    const canvasElement = document.createElement('canvas');
    const overlayElement = document.createElement('canvas');
    canvasElement.width = stageSize.width;
    canvasElement.height = stageSize.height;
    overlayElement.width = stageSize.width;
    overlayElement.height = stageSize.height;
    setRecordingCanvas(canvasElement);
    setEmptyOverlayCanvas(overlayElement);
    return () => {
      setRecordingCanvas(null);
      setEmptyOverlayCanvas(null);
    };
  }, [stageSize]);

  useEffect(() => {
    if (!editor || !recordingCanvas) return;
    let isCancelled = false;
    let timerId = 0;
    const context = recordingCanvas.getContext('2d');
    if (!context) return;

    const paintFrame = async () => {
      if (isCancelled) return;
      try {
        const shapeIds = [...editor.getCurrentPageShapeIds()];
        context.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
        if (shapeIds.length) {
          const { blob } = await editor.toImage(shapeIds, { format: 'png', background: true });
          if (isCancelled) return;
          const image = await loadImageFromBlob(blob);
          if (isCancelled) return;
          context.drawImage(image, 0, 0, recordingCanvas.width, recordingCanvas.height);
        }
      } catch {
        // 录制帧失败时跳过当前帧，下一帧继续。
      } finally {
        if (!isCancelled) {
          timerId = window.setTimeout(paintFrame, 180);
        }
      }
    };

    void paintFrame();
    return () => {
      isCancelled = true;
      window.clearTimeout(timerId);
    };
  }, [editor, recordingCanvas]);

  const setTool = useCallback((mode: BoardStageToolMode) => {
    setActiveToolMode(mode);
    if (!editor) return;
    if (mode === 'pen' || mode === 'highlight' || mode === 'circle' || mode === 'cross') {
      editor.setStyleForNextShapes(DefaultColorStyle, resolveTldrawColor(strokeColor));
      editor.setCurrentTool('draw');
      return;
    }
    if (mode === 'eraser') {
      editor.setCurrentTool('eraser');
      return;
    }
    editor.setCurrentTool('select');
  }, [editor, strokeColor]);

  const setGeoTool = useCallback((geo: 'rectangle' | 'oval') => {
    if (!editor) return;
    editor.run(() => {
      editor.setStyleForNextShapes(GeoShapeGeoStyle, geo);
      editor.setStyleForNextShapes(DefaultColorStyle, resolveTldrawColor(strokeColor));
      editor.setCurrentTool('geo');
    });
  }, [editor, strokeColor]);

  const handleExportPng = useCallback(async () => {
    if (!editor) return;
    const ids = [...editor.getCurrentPageShapeIds()];
    if (!ids.length) return;
    const { blob } = await editor.toImage(ids, { format: 'png', background: true });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'teaching-stage.png';
    link.click();
    URL.revokeObjectURL(link.href);
  }, [editor]);

  return (
    <Card
      className="zone-card zone-stage zone-stage--tldraw"
      title="预览舞台"
      extra={(
        <div className="tldraw-stage-card-actions">
          <Button onClick={() => setIsExpanded(true)} size="small" type="primary">展开舞台</Button>
          <StagePreviewToolbar onRecordingActiveChange={onRecordingActiveChange} recordingCanvases={recordingCanvases} />
        </div>
      )}
    >
      <TldrawStageBody
        activeToolMode={activeToolMode}
        canvas={canvas}
        currentToolId={currentToolId}
        handleExportPng={handleExportPng}
        handleMount={handleMount}
        setGeoTool={setGeoTool}
        setStrokeColor={setStrokeColor}
        setStrokeWidth={setStrokeWidth}
        setTool={setTool}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
      />
      <Modal
        className="tldraw-stage-modal"
        footer={null}
        onCancel={() => setIsExpanded(false)}
        open={isExpanded}
        title={`录屏舞台 ${canvas.width}×${canvas.height}`}
        width="92vw"
      >
        <TldrawStageBody
          activeToolMode={activeToolMode}
          canvas={canvas}
          currentToolId={currentToolId}
          expanded
          handleExportPng={handleExportPng}
          handleMount={handleMount}
          setGeoTool={setGeoTool}
          setStrokeColor={setStrokeColor}
          setStrokeWidth={setStrokeWidth}
          setTool={setTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />
      </Modal>
    </Card>
  );
}

function TldrawStageBody({
  activeToolMode,
  canvas,
  currentToolId,
  expanded = false,
  handleExportPng,
  handleMount,
  setGeoTool,
  setStrokeColor,
  setStrokeWidth,
  setTool,
  strokeColor,
  strokeWidth,
}: {
  activeToolMode: BoardStageToolMode;
  canvas: StageCanvasConfig;
  currentToolId: string;
  expanded?: boolean;
  handleExportPng: () => void;
  handleMount: (editor: Editor) => void;
  setGeoTool: (geo: 'rectangle' | 'oval') => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setTool: (mode: BoardStageToolMode) => void;
  strokeColor: string;
  strokeWidth: number;
}) {
  return (
    <div className={expanded ? 'tldraw-stage-shell tldraw-stage-shell--expanded' : 'tldraw-stage-shell'}>
      <aside className="tldraw-stage-toolbar" aria-label="舞台工具栏">
        <Space orientation="vertical" size="small">
          <Segmented
            block
            onChange={(value) => setTool(value as BoardStageToolMode)}
            options={[
              { label: '选择', value: 'off' },
              { label: '画笔', value: 'pen' },
              { label: '橡皮', value: 'eraser' },
            ]}
            value={activeToolMode === 'eraser' || activeToolMode === 'pen' ? activeToolMode : 'off'}
          />
          <Space.Compact block>
            <Button onClick={() => setGeoTool('rectangle')}>矩形</Button>
            <Button onClick={() => setGeoTool('oval')}>圆形</Button>
          </Space.Compact>
          <Button block onClick={handleExportPng}>
            导出 PNG
          </Button>
          <Space orientation="vertical" size={4}>
            <Text type="secondary">颜色</Text>
            <ColorPicker
              onChange={(_, hex) => setStrokeColor(hex)}
              showText
              value={strokeColor}
            />
          </Space>
          <Space orientation="vertical" size={4}>
            <Text type="secondary">粗细</Text>
            <Slider max={20} min={1} onChange={setStrokeWidth} value={strokeWidth} />
          </Space>
          <Text type="secondary">当前：{currentToolId}</Text>
        </Space>
      </aside>
      <section
        className="tldraw-stage-canvas"
        style={{ aspectRatio: `${canvas.width} / ${canvas.height}`, background: canvas.background }}
      >
        <Tldraw hideUi onMount={handleMount} persistenceKey={expanded ? 'teaching-abc-stage-expanded' : 'teaching-abc-stage'} />
      </section>
    </div>
  );
}

function resolveTldrawColor(color: string) {
  if (color === '#29d4ff') return 'light-blue';
  if (color === '#d00000' || color === '#ff0000') return 'red';
  if (color === '#008000' || color === '#00aa55') return 'green';
  if (color === '#0066ff') return 'blue';
  return 'black';
}

function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('tldraw stage recording frame failed.'));
    };
    image.src = url;
  });
}
