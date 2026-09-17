// @cleanroom-component: BoardClipInspectorSections
// @domain: inspector
// @slot: right-inspector
// @depends: TeachingProject.timeline.clips
// @route-impact: App shell only

import { EditOutlined } from '@ant-design/icons';
import { Button, Input, InputNumber, Slider, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { MathText } from '../MathText';
import type { BoardClipInspectorWritableDraft } from './boardClipInspectorContract';

const { Text } = Typography;
const BOARD_CLIP_COLOR_SWATCHES = ['#111111', '#1d4ed8', '#dc2626', '#16a34a', '#7c3aed'];

export function BoardClipLightGroup({
  children,
  dataAnchor,
  title,
}: {
  children: ReactNode;
  dataAnchor: string;
  title: string;
}) {
  return (
    <section className="inspector-light-group" data-anchor={dataAnchor}>
      <Text className="inspector-light-group-title" strong>
        {title}
      </Text>
      <div className="inspector-light-group-body">{children}</div>
    </section>
  );
}

export function BoardClipContentSection({
  clipId,
  label,
  onChange,
}: {
  clipId: string;
  label: string;
  onChange: (label: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setIsEditing(false);
  }, [clipId]);

  return (
    <section className="inspector-section" data-anchor="bc-c-content-panel-001">
      <div className="inspector-section-header">
        <Text className="inspector-section-title" strong>
          当前素材内容
        </Text>
        <Button icon={<EditOutlined />} onClick={() => setIsEditing((current) => !current)} size="small" type="text">
          修改
        </Button>
      </div>
      {isEditing ? (
        <label className="inspector-field">
          <Text type="secondary">这段素材写什么</Text>
          <Input.TextArea
            autoFocus
            autoSize={{ minRows: 3, maxRows: 6 }}
            className="math-editor-input"
            onBlur={() => setIsEditing(false)}
            onChange={(event) => onChange(event.target.value)}
            value={label}
          />
        </label>
      ) : (
        <button className="inspector-content-preview" onClick={() => setIsEditing(true)} type="button">
          <MathText as="span">{label || '当前素材还没有内容。'}</MathText>
        </button>
      )}
    </section>
  );
}

export function BoardClipBindingHintSection({
  displayEndMs,
  displayStartMs,
  revealEndMs,
  revealStartMs,
  sourceEndMs,
  sourceStartMs,
}: {
  displayEndMs: number;
  displayStartMs: number;
  revealEndMs: number;
  revealStartMs: number;
  sourceEndMs: number;
  sourceStartMs: number;
}) {
  return (
    <section className="inspector-section" data-anchor="bc-c-binding-hint-panel-001">
      <Text className="inspector-section-title" strong>
        当前素材映射关联
      </Text>
      <div className="inspector-readonly-list">
        <div>
          <Text strong>讲解音频</Text>
          <Text type="secondary">{formatMsRange(sourceStartMs, sourceEndMs)}</Text>
        </div>
        <div>
          <Text strong>素材时长</Text>
          <Text type="secondary">{formatMsRange(displayStartMs, displayEndMs)}</Text>
        </div>
        <div>
          <Text strong>书写时段</Text>
          <Text type="secondary">{formatMsRange(revealStartMs, revealEndMs)}</Text>
        </div>
      </div>
      <Text type="secondary">这里会一起显示讲解、素材时长和实际书写时段，方便你对齐。</Text>
    </section>
  );
}

export function BoardClipSkinSection({
  draft,
  onChange,
  onScaleChange,
  scalePercent,
}: {
  draft: Pick<BoardClipInspectorWritableDraft, 'color' | 'fontSize' | 'widthPercent'>;
  onChange: (patch: Partial<Pick<BoardClipInspectorWritableDraft, 'color' | 'fontSize' | 'widthPercent'>>) => void;
  onScaleChange: (value: number | string | null) => void;
  scalePercent: number;
}) {
  return (
    <section className="inspector-section" data-anchor="bc-c-skin-panel-001" data-legacy-anchor="bc-c-position-size-panel-001">
      <Text className="inspector-section-title" strong>
        C 外观
      </Text>
      <label className="inspector-field">
        <Text strong>字号 / 宽度联动</Text>
        <InputNumber max={220} min={20} onChange={onScaleChange} step={5} suffix="%" value={scalePercent} />
        <Text type="secondary">联动缩放：字号和换行宽度同时变化，不拉伸手写图像。</Text>
      </label>
      <label className="inspector-field">
        <Text strong>C 字号</Text>
        <InputNumber
          max={96}
          min={12}
          onChange={(value) => onChange({ fontSize: normalizeNumber(value, draft.fontSize) })}
          step={1}
          suffix="px"
          value={draft.fontSize}
        />
      </label>
      <label className="inspector-field">
        <Text strong>字体颜色</Text>
        <div className="inspector-color-swatch-row">
          {BOARD_CLIP_COLOR_SWATCHES.map((color) => (
            <button
              aria-label={`C color ${color}`}
              className="inspector-color-swatch"
              data-selected={draft.color === color ? 'true' : 'false'}
              key={color}
              onClick={() => onChange({ color })}
              style={{ backgroundColor: color }}
              type="button"
            />
          ))}
        </div>
        <Text type="secondary">沿用画布墨色</Text>
      </label>
    </section>
  );
}

export function BoardClipCanvasPositionSection({
  draft,
  onChange,
}: {
  draft: Pick<BoardClipInspectorWritableDraft, 'widthPercent' | 'xPercent' | 'yPercent'>;
  onChange: (patch: Partial<Pick<BoardClipInspectorWritableDraft, 'widthPercent' | 'xPercent' | 'yPercent'>>) => void;
}) {
  return (
    <section className="inspector-section" data-anchor="bc-c-canvas-position-panel-001">
      <Text className="inspector-section-title" strong>
        C 站位
      </Text>
      <div className="inspector-field-grid">
        <label className="inspector-field">
          <Text strong>横向位置</Text>
          <InputNumber
            max={100}
            min={0}
            onChange={(value) => onChange({ xPercent: normalizeNumber(value, draft.xPercent) })}
            step={1}
            suffix="%"
            value={draft.xPercent}
          />
        </label>
        <label className="inspector-field">
          <Text strong>纵向位置</Text>
          <InputNumber
            max={100}
            min={0}
            onChange={(value) => onChange({ yPercent: normalizeNumber(value, draft.yPercent) })}
            step={1}
            suffix="%"
            value={draft.yPercent}
          />
        </label>
      </div>
      <label className="inspector-field">
        <Text strong>换行宽度</Text>
        <InputNumber
          max={90}
          min={8}
          onChange={(value) => onChange({ widthPercent: normalizeNumber(value, draft.widthPercent) })}
          step={1}
          suffix="%"
          value={draft.widthPercent}
        />
        <Text type="secondary">仅改换行盒，字号不变；文字可能重新排版。配合“字号 / 宽度联动”调整整体占位。</Text>
      </label>
    </section>
  );
}

export function BoardClipDrawFeelSection({
  drawSpeed,
  onChange,
}: {
  drawSpeed: number;
  onChange: (drawSpeed: number) => void;
}) {
  return (
    <section className="inspector-section" data-anchor="bc-c-draw-feel-panel-001">
      <label className="inspector-field">
        <Text strong>C 书写速度</Text>
        <Space align="center" size={10}>
          <Slider
            marks={{
              0.5: '慢',
              1: '正常',
              2: '快',
              3: '很快',
            }}
            max={4}
            min={0.1}
            onChange={(value) => onChange(value)}
            step={0.1}
            style={{ width: 180 }}
            value={drawSpeed}
          />
          <InputNumber max={4} min={0.1} onChange={(value) => onChange(normalizeNumber(value, drawSpeed))} step={0.1} value={drawSpeed} />
        </Space>
      </label>
      <Text type="secondary">只影响 C 在 A source ∩ B display 内的 reveal 快慢；不改 A 语音，不改 B 寿命。</Text>
      <Text type="secondary">B 只管上台、下台和静态留场；C 书写快慢在“C 演绎”里单独调整，不反写 A/B。</Text>
      <Text type="secondary">C 书写速度由 C 书写速度控制，不由 B 寿命隐式改写</Text>
    </section>
  );
}

export function BoardClipFontGapSection() {
  return (
    <section className="inspector-section" data-anchor="bc-c-font-gap-panel-001">
      <Text className="inspector-section-title" strong>
        字体 URL
      </Text>
      <div className="inspector-readonly-list">
        <div>
          <Text strong>引用其他字体</Text>
          <Tag color="blue">走画布变量</Tag>
        </div>
        <Text type="secondary">当前 per-clip color 已入正式状态链，但 per-clip fontUrl 还没有独立字段。</Text>
      </div>
    </section>
  );
}

export function BoardClipInspectorActions({
  hasDraftChanges,
  onConfirm,
  onReset,
}: {
  hasDraftChanges: boolean;
  onConfirm: () => void;
  onReset: () => void;
}) {
  return (
    <Space className="inspector-actions">
      <Button disabled={!hasDraftChanges} onClick={onReset}>
        撤销
      </Button>
      <Button disabled={!hasDraftChanges} onClick={onConfirm} type="primary">
        确认应用
      </Button>
    </Space>
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

function formatMsRange(startMs: number, endMs: number) {
  return `${Math.round(startMs)} ms - ${Math.round(endMs)} ms`;
}
