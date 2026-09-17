// @cleanroom-component: BoardClipInspector
// @domain: inspector/board-clip
// @slot: right-inspector/board-clip-card
// @depends: TimelineClip(kind=board)
// @io-input: selectedClip
// @io-output: onUpdateBoardClip
// @fields: BoardClipInspectorPatch from boardClipInspectorContract; read timing fields for mapping only
// @boundary: selected C material controls only; B timing lives in TeachingTimeline, no canvas size or A audio edits
// @c-drawspeed-boundary: C 书写速度由 C 书写速度控制，不由 B 寿命隐式改写
import { useEffect, useMemo, useState } from 'react';
import { Card, Empty, Tag, Typography } from 'antd';
import type { TimelineClip } from '../domain/teachingProject';
import { normalizeBoardRevealWindow } from '../modules/boardReveal';
import {
  createBoardClipInspectorDraft,
  createBoardClipInspectorPatch,
  createBoardClipInspectorScalePatch,
  getBoardClipInspectorScalePercent,
  hasBoardClipInspectorDraftChanges,
  normalizeBoardClipInspectorDraft,
  type BoardClipInspectorDraft,
  type BoardClipInspectorPatch,
} from './boardClipInspector/boardClipInspectorContract';
import {
  BoardClipBindingHintSection,
  BoardClipCanvasPositionSection,
  BoardClipContentSection,
  BoardClipDrawFeelSection,
  BoardClipFontGapSection,
  BoardClipInspectorActions,
  BoardClipLightGroup,
  BoardClipSkinSection,
} from './boardClipInspector/BoardClipInspectorSections';

const { Text } = Typography;

export function BoardClipInspector({
  defaultFontSize,
  selectedClip,
  onUpdateBoardClip,
}: {
  defaultFontSize: number;
  selectedClip: TimelineClip | undefined;
  onUpdateBoardClip: (patch: BoardClipInspectorPatch) => void;
}) {
  // 当前数据模型里 B 寿命和 C 角色还同住 TimelineClip(kind='board')。
  // 右侧面板只把 board clip 当 C 角色编辑；B 寿命唯一入口留在时间轴。
  const selectedBoardClip = selectedClip?.kind === 'board' ? selectedClip : undefined;
  const selectedCClip = selectedBoardClip;
  const initialDraft = useMemo(() => createBoardClipInspectorDraft(selectedCClip, defaultFontSize), [defaultFontSize, selectedCClip]);
  const [draft, setDraft] = useState<BoardClipInspectorDraft | null>(initialDraft);
  const activeDraft = selectedBoardClip && draft?.clipId === selectedBoardClip.id ? draft : initialDraft;

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  const hasDraftChanges = hasBoardClipInspectorDraftChanges(activeDraft, selectedCClip, defaultFontSize);
  const scalePercent = getBoardClipInspectorScalePercent(activeDraft);
  const sourceStartMs = selectedCClip?.sourceStartMs ?? selectedCClip?.startMs ?? 0;
  const sourceEndMs = selectedCClip?.sourceEndMs ?? selectedCClip?.endMs ?? 0;
  const savedRevealStartMs = selectedCClip?.revealStartMs ?? sourceStartMs;
  const savedRevealEndMs = selectedCClip?.revealEndMs ?? sourceEndMs;
  // @xiaxia-inspector-preview: local timing patch only previews mapping; confirmDraft never sends it to store.
  const previewRevealWindow =
    selectedCClip && activeDraft
      ? normalizeBoardRevealWindow({
        displayEndMs: activeDraft.endMs,
        displayStartMs: activeDraft.startMs,
        patch: {
          endMs: activeDraft.endMs,
          startMs: activeDraft.startMs,
        },
        previousDisplayEndMs: selectedCClip.endMs,
        previousDisplayStartMs: selectedCClip.startMs,
        previousRevealEndMs: savedRevealEndMs,
        previousRevealStartMs: savedRevealStartMs,
        sourceEndMs,
        sourceStartMs,
      })
      : {
        revealEndMs: savedRevealEndMs,
        revealStartMs: savedRevealStartMs,
      };

  const updateDraft = (patch: Partial<BoardClipInspectorDraft>) => {
    setDraft((currentDraft) => {
      const baseDraft = selectedCClip && currentDraft?.clipId === selectedCClip.id ? currentDraft : initialDraft;
      return baseDraft ? normalizeBoardClipInspectorDraft({ ...baseDraft, ...patch }) : baseDraft;
    });
  };

  const updateScaleDraft = (value: number | string | null) => {
    const nextScalePercent = normalizeNumber(value, scalePercent);
    updateDraft(createBoardClipInspectorScalePatch(defaultFontSize, nextScalePercent));
  };

  const confirmDraft = () => {
    if (!activeDraft || !hasDraftChanges) {
      return;
    }

    const { clipId } = activeDraft;
    if (clipId !== selectedBoardClip?.id) {
      return;
    }

    // @xiaxia-inspector-boundary: C material panel reads B timing for mapping, but only writes C material fields.
    onUpdateBoardClip(createBoardClipInspectorPatch(activeDraft));
  };

  return (
    <Card
      className="zone-card zone-inspector"
      extra={<Tag color={hasDraftChanges ? 'orange' : 'blue'}>{hasDraftChanges ? '未确认' : selectedCClip ? '当前素材' : '素材面板'}</Tag>}
      title={selectedCClip ? '选中 C 角色内容（当前素材内容）' : '素材内容'}
    >
      {selectedCClip && activeDraft ? (
        <div className="board-clip-inspector">
          <BoardClipLightGroup dataAnchor="bc-light-group-content-001" title="显示内容">
            <BoardClipContentSection clipId={selectedBoardClip.id} label={activeDraft.label} onChange={(label) => updateDraft({ label })} />
            <BoardClipBindingHintSection
              displayEndMs={activeDraft.endMs}
              displayStartMs={activeDraft.startMs}
              revealEndMs={previewRevealWindow.revealEndMs}
              revealStartMs={previewRevealWindow.revealStartMs}
              sourceEndMs={sourceEndMs}
              sourceStartMs={sourceStartMs}
            />
          </BoardClipLightGroup>
          <BoardClipLightGroup dataAnchor="bc-light-group-skin-001" title="C 外观">
            <BoardClipSkinSection
              draft={activeDraft}
              onChange={updateDraft}
              onScaleChange={updateScaleDraft}
              scalePercent={scalePercent}
            />
            <BoardClipFontGapSection />
          </BoardClipLightGroup>
          <BoardClipLightGroup dataAnchor="bc-light-group-position-001" title="C 站位">
            <BoardClipCanvasPositionSection draft={activeDraft} onChange={updateDraft} />
          </BoardClipLightGroup>
          <BoardClipLightGroup dataAnchor="bc-light-group-performance-001" title="C 演绎">
            <BoardClipDrawFeelSection drawSpeed={activeDraft.drawSpeed} onChange={(drawSpeed) => updateDraft({ drawSpeed })} />
          </BoardClipLightGroup>
          <BoardClipInspectorActions
            hasDraftChanges={hasDraftChanges}
            onConfirm={confirmDraft}
            onReset={() => setDraft(initialDraft)}
          />
          <Text type="secondary">
            真正书写时段会跟着讲解音频和素材时长一起变化；超出音频尾部的部分只会静态停留。
          </Text>
        </div>
      ) : selectedClip ? (
        <Empty description="选择 C 角色后，这里只编辑 C 素材内容和样式；B 寿命请在时间轴调整。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Empty description="选择 C 角色后，可调整内容、位置、大小和书写速度；B 寿命请在时间轴调整。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Card>
  );
}

function normalizeNumber(value: number | string | null, fallback: number) {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value);
    return Number.isNaN(parsedValue) ? fallback : parsedValue;
  }
  return fallback;
}
