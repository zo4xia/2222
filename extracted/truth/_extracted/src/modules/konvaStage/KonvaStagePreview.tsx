// @cleanroom-component: KonvaStagePreview
// @domain: stage-preview/konva-canvas
// @boundary: Konva 框架舞台；读取现有 ABC 数据，不拥有 A/B/C 真相源。
//   Agent-first design: all board content rendered programmatically via Konva nodes.
//   No editor UI overhead — pure canvas control for Agent-driven workflows.
//   Recording: stage.toDataURL() feeds directly into useCanvasRecorder (no async Editor API).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Modal, Space } from 'antd';
import { Stage, Layer, Rect, Text, Transformer, Group } from 'react-konva';
import type Konva from 'konva';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import type { StageCanvasConfig, TeachingAsset, TimelineClip } from '../../domain/teachingProject';
import { createBoardFontFamily } from '../boardFont/boardFontConfig';
import {
  buildKonvaBoardClipNodes,
  buildKonvaBoardShapeMeta,
  buildKonvaStageChromeNodes,
  resolveKonvaStageSize,
  type KonvaBoardTextNodeConfig,
  type KonvaRectNodeConfig,
  type KonvaTextNodeConfig,
} from './abcToKonvaNodes';
import { StagePreviewToolbar } from '../../components/StagePreviewToolbar';
import type { BoardClipPatch, StageRecordingCanvases } from '../../components/drawboardStageTypes';

export function KonvaStagePreview({
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
  const stageRef = useRef<KonvaStage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [recordingCanvas, setRecordingCanvas] = useState<HTMLCanvasElement | null>(null);
  const [emptyOverlayCanvas, setEmptyOverlayCanvas] = useState<HTMLCanvasElement | null>(null);

  const fontFamily = useMemo(() => createBoardFontFamily(canvas.boardFontName), [canvas.boardFontName]);
  const stageSize = useMemo(() => resolveKonvaStageSize(canvas), [canvas]);

  // ── Compute all node descriptors (pure, no side-effects) ───────────
  const chromeNodes = useMemo(
    () => buildKonvaStageChromeNodes(canvas, problemText, fontFamily),
    [canvas, problemText, fontFamily],
  );
  const boardClipNodes = useMemo(
    () => buildKonvaBoardClipNodes({ boardClips, canvas, fontFamily, playheadMs }),
    [boardClips, canvas, fontFamily, playheadMs],
  );
  const boardMeta = useMemo(
    () => buildKonvaBoardShapeMeta(boardClipNodes),
    [boardClipNodes],
  );

  // ── Sync selectedNodeId when selectedBoardClipId changes externally ─
  useEffect(() => {
    if (!selectedBoardClipId) {
      setSelectedNodeId(null);
      return;
    }
    const hit = boardMeta.find((m: { clipId: string; nodeId: string }) => m.clipId === selectedBoardClipId);
    setSelectedNodeId(hit?.nodeId ?? null);
  }, [selectedBoardClipId, boardMeta]);

  // ── Attach Transformer to selected node ─────────────────────────────
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    const node = selectedNodeId ? stage.findOne(`#${selectedNodeId}`) : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedNodeId]);

  // ── Recording canvas setup (matches tldraw approach) ───────────────
  useEffect(() => {
    const base = document.createElement('canvas');
    const overlay = document.createElement('canvas');
    base.width = stageSize.width;
    base.height = stageSize.height;
    overlay.width = stageSize.width;
    overlay.height = stageSize.height;
    setRecordingCanvas(base);
    setEmptyOverlayCanvas(overlay);
    return () => {
      setRecordingCanvas(null);
      setEmptyOverlayCanvas(null);
    };
  }, [stageSize]);

  // ── Recording: periodically snapshot Konva stage → recording canvas ─
  useEffect(() => {
    if (!stageRef.current || !recordingCanvas) return;
    let isCancelled = false;
    let timerId = 0;
    const ctx = recordingCanvas.getContext('2d');
    if (!ctx) return;

    const paintFrame = () => {
      if (isCancelled) return;
      try {
        const ratio = recordingCanvas.width / stageSize.width;
        ctx.clearRect(0, 0, recordingCanvas.width, recordingCanvas.height);
        const dataUrl = stageRef.current!.toDataURL({ pixelRatio: ratio });
        const img = new window.Image();
        img.onload = () => {
          if (isCancelled) return;
          ctx.drawImage(img, 0, 0, recordingCanvas.width, recordingCanvas.height);
        };
        img.src = dataUrl;
      } catch {
        // skip frame
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
  }, [recordingCanvas, stageSize]);

  const recordingCanvases = useMemo<StageRecordingCanvases | null>(
    () => (recordingCanvas && emptyOverlayCanvas ? { base: recordingCanvas, content: null, overlay: emptyOverlayCanvas } : null),
    [emptyOverlayCanvas, recordingCanvas],
  );

  // ── Handlers ────────────────────────────────────────────────────────

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const clickedNode = e.target;
      const nodeId = clickedNode.id();
      const hit = boardMeta.find((m: { clipId: string; nodeId: string }) => m.nodeId === nodeId);
      if (hit) {
        setSelectedNodeId(nodeId);
        onSelectBoardClip(hit.clipId);
      } else {
        setSelectedNodeId(null);
        onSelectBoardClip('');
      }
    },
    [boardMeta, onSelectBoardClip],
  );

  const handleBoardDragEnd = useCallback(
    (nodeId: string) => {
      const hit = boardMeta.find((m: { clipId: string; nodeId: string }) => m.nodeId === nodeId);
      if (!hit || !stageRef.current) return;
      const node = stageRef.current.findOne(`#${nodeId}`);
      if (!node) return;
      const patch: BoardClipPatch = {
        xPercent: (node.x() / stageSize.width) * 100,
        yPercent: (node.y() / stageSize.height) * 100,
      };
      onUpdateBoardClip(hit.clipId, patch);
    },
    [boardMeta, onUpdateBoardClip, stageSize],
  );

  const handleTransformEnd = useCallback(
    (nodeId: string) => {
      const hit = boardMeta.find((m: { clipId: string; nodeId: string }) => m.nodeId === nodeId);
      if (!hit || !stageRef.current) return;
      const node = stageRef.current.findOne(`#${nodeId}`);
      if (!node) return;
      node.rotation(0);
      const patch: BoardClipPatch = {
        xPercent: (node.x() / stageSize.width) * 100,
        yPercent: (node.y() / stageSize.height) * 100,
        widthPercent: (node.width() / stageSize.width) * 100,
      };
      onUpdateBoardClip(hit.clipId, patch);
    },
    [boardMeta, onUpdateBoardClip, stageSize],
  );

  const handleExportPng = useCallback(() => {
    if (!stageRef.current) return;
    const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'teaching-stage.png';
    link.click();
  }, []);

  return (
    <Card
      className="zone-card zone-stage zone-stage--konva"
      title="预览舞台"
      extra={(
        <div className="konva-stage-card-actions">
          <Button onClick={() => setIsExpanded(true)} size="small" type="primary">展开舞台</Button>
          <StagePreviewToolbar onRecordingActiveChange={onRecordingActiveChange} recordingCanvases={recordingCanvases} />
        </div>
      )}
    >
      <KonvaStageBody
        boardClipNodes={boardClipNodes}
        chromeNodes={chromeNodes}
        handleExportPng={handleExportPng}
        handleStageClick={handleStageClick}
        handleTransformEnd={handleTransformEnd}
        onBoardDragEnd={handleBoardDragEnd}
        selectedNodeId={selectedNodeId}
        stageRef={stageRef}
        stageSize={stageSize}
        transformerRef={transformerRef}
      />
      <Modal
        className="konva-stage-modal"
        footer={null}
        onCancel={() => setIsExpanded(false)}
        open={isExpanded}
        title={`录屏舞台 ${canvas.width}×${canvas.height}`}
        width="92vw"
      >
        <KonvaStageBody
          boardClipNodes={boardClipNodes}
          chromeNodes={chromeNodes}
          expanded
          handleExportPng={handleExportPng}
          handleStageClick={handleStageClick}
          handleTransformEnd={handleTransformEnd}
          onBoardDragEnd={handleBoardDragEnd}
          selectedNodeId={selectedNodeId}
          stageRef={stageRef}
          stageSize={stageSize}
          transformerRef={transformerRef}
        />
      </Modal>
    </Card>
  );
}

// ── Internal: Stage body ────────────────────────────────────────────────

function KonvaStageBody({
  boardClipNodes,
  chromeNodes,
  expanded = false,
  handleExportPng,
  handleStageClick,
  handleTransformEnd,
  onBoardDragEnd,
  selectedNodeId,
  stageRef,
  stageSize,
  transformerRef,
}: {
  boardClipNodes: KonvaBoardTextNodeConfig[];
  chromeNodes: (KonvaRectNodeConfig | KonvaTextNodeConfig)[];
  expanded?: boolean;
  handleExportPng: () => void;
  handleStageClick: (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => void;
  handleTransformEnd: (nodeId: string) => void;
  onBoardDragEnd: (nodeId: string) => void;
  selectedNodeId: string | null;
  stageRef: React.RefObject<KonvaStage | null>;
  stageSize: { width: number; height: number };
  transformerRef: React.RefObject<Konva.Transformer | null>;
}) {
  return (
    <div className={expanded ? 'konva-stage-shell konva-stage-shell--expanded' : 'konva-stage-shell'}>
      <aside className="konva-stage-toolbar" aria-label="舞台工具栏">
        <Space direction="vertical" size="small">
          <Button block onClick={handleExportPng}>
            导出 PNG
          </Button>
        </Space>
      </aside>
      <section
        className="konva-stage-canvas"
        style={{
          aspectRatio: `${stageSize.width} / ${stageSize.height}`,
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <Stage
          ref={stageRef}
          width={expanded ? stageSize.width * 1.6 : stageSize.width}
          height={expanded ? stageSize.height * 1.6 : stageSize.height}
          scaleX={expanded ? 1.6 : 1}
          scaleY={expanded ? 1.6 : 1}
          onClick={handleStageClick}
          onTap={handleStageClick as unknown as (evt: Konva.KonvaEventObject<TouchEvent>) => void}
        >
          <Layer>
            {/* Chrome: frame border, labels, problem title */}
            {chromeNodes.map((node) =>
              node.type === 'rect' ? (
                <Rect
                  key={node.id}
                  id={node.id}
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  stroke={node.stroke}
                  strokeWidth={node.strokeWidth}
                  dash={node.dash}
                  cornerRadius={node.cornerRadius}
                  listening={false}
                />
              ) : (
                <Text
                  key={node.id}
                  id={node.id}
                  x={node.x}
                  y={node.y}
                  text={node.text}
                  fontSize={node.fontSize}
                  fontFamily={node.fontFamily}
                  fill={node.fill}
                  fontStyle={node.fontStyle}
                  width={node.width}
                  padding={node.padding}
                  lineHeight={node.lineHeight}
                  listening={false}
                />
              ),
            )}

            {/* Board clip text nodes (draggable, selectable) */}
            {boardClipNodes.map((node) => (
              <Group
                key={node.id}
                id={node.id}
                draggable
                onDragEnd={() => onBoardDragEnd(node.id)}
              >
                <Text
                  id={`${node.id}-text`}
                  x={0}
                  y={0}
                  text={node.text}
                  fontSize={node.fontSize}
                  fontFamily={node.fontFamily}
                  fill={node.fill}
                  width={node.width}
                  lineHeight={node.lineHeight}
                  padding={node.padding}
                  wrap="word"
                />
              </Group>
            ))}

            {/* Transformer for selected board clip */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(_oldBox, newBox) => {
                if (newBox.width < 20 || newBox.height < 20) return _oldBox;
                return newBox;
              }}
              onTransformEnd={() => {
                const nodes = transformerRef.current?.nodes();
                if (nodes && nodes.length === 1) {
                  handleTransformEnd(nodes[0].id());
                }
              }}
            />
          </Layer>
        </Stage>
      </section>
    </div>
  );
}
