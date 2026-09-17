// @cleanroom-component: CanvasInspector
// @domain: inspector/canvas
// @slot: right-inspector/canvas-card
// @depends: StageCanvasConfig
// @io-input: canvas
// @io-output: draft canvas -> explicit apply -> onUpdateCanvas(canvas)
// @fields: canvas.preset, canvas.width, canvas.height, canvas.background
// @boundary: Canvas stage/paper settings only; C actor typography lives in CurrentProjectBoardFontInspector

import { useEffect, useState } from 'react';
import { Button, Collapse, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import type { StageCanvasConfig, StageCanvasPreset } from '../domain/teachingProject';

const { Text } = Typography;

const canvasPresets: Array<{ label: string; value: StageCanvasPreset; width: number; height: number }> = [
  { height: 1080, label: '横屏 16:9｜1920×1080', value: 'landscape-1080p', width: 1920 },
  { height: 720, label: '横屏 16:9｜1280×720', value: 'landscape-720p', width: 1280 },
  { height: 768, label: '课堂 4:3｜1024×768', value: 'classic-4-3', width: 1024 },
  { height: 1920, label: '竖屏 9:16｜1080×1920', value: 'portrait-1080p', width: 1080 },
  { height: 1080, label: '方屏 1:1｜1080×1080', value: 'square-1080', width: 1080 },
  { height: 1080, label: '自定义', value: 'custom', width: 1920 },
];

export function CanvasInspector({
  canvas,
  onUpdateCanvas,
}: {
  canvas: StageCanvasConfig;
  onUpdateCanvas: (canvas: StageCanvasConfig) => void;
}) {
  const [draftCanvas, setDraftCanvas] = useState(canvas);

  useEffect(() => {
    setDraftCanvas(canvas);
  }, [canvas]);

  const selectedPreset = canvasPresets.find((preset) => preset.value === draftCanvas.preset) ?? canvasPresets[0];
  const ratioText = formatRatio(draftCanvas.width, draftCanvas.height);
  const hasDraftChanges = JSON.stringify(draftCanvas) !== JSON.stringify(canvas);

  return (
    <Collapse
      className="zone-card zone-inspector canvas-inspector-collapse"
      defaultActiveKey={[]}
      items={[
        {
          children: (
            <div className="canvas-inspector">
              <Text type="secondary">舞台输出比例：{ratioText}</Text>
              <label className="inspector-field">
                <Text strong>白板规格</Text>
                <Select
                  options={canvasPresets.map((preset) => ({ label: preset.label, value: preset.value }))}
                  onChange={(value) => {
                    const preset = canvasPresets.find((item) => item.value === value) ?? selectedPreset;
                    setDraftCanvas({
                      ...draftCanvas,
                      height: preset.height,
                      preset: preset.value,
                      width: preset.width,
                    });
                  }}
                  value={selectedPreset.value}
                />
              </label>
              <div className="inspector-field-grid">
                <label className="inspector-field">
                  <Text strong>宽度</Text>
                  <InputNumber
                    max={3840}
                    min={360}
                    onChange={(value) =>
                      setDraftCanvas({
                        ...draftCanvas,
                        preset: 'custom',
                        width: normalizeNumber(value, draftCanvas.width),
                      })
                    }
                    step={10}
                    value={draftCanvas.width}
                  />
                </label>
                <label className="inspector-field">
                  <Text strong>高度</Text>
                  <InputNumber
                    max={3840}
                    min={360}
                    onChange={(value) =>
                      setDraftCanvas({
                        ...draftCanvas,
                        height: normalizeNumber(value, draftCanvas.height),
                        preset: 'custom',
                      })
                    }
                    step={10}
                    value={draftCanvas.height}
                  />
                </label>
              </div>
              <label className="inspector-field">
                <Text strong>背景画布颜色</Text>
                <Input
                  onChange={(event) =>
                    setDraftCanvas({
                      ...draftCanvas,
                      background: event.target.value,
                    })
                  }
                  value={draftCanvas.background}
                />
              </label>
              <Space>
                <Button disabled={!hasDraftChanges} onClick={() => onUpdateCanvas(draftCanvas)} type="primary">
                  应用到当前工程
                </Button>
                <Button disabled={!hasDraftChanges} onClick={() => setDraftCanvas(canvas)}>
                  放弃修改
                </Button>
              </Space>
              <Text type="secondary">
                这里只设置录屏舞台的纸张比例、输出尺寸和背景色；C 素材字体、字号和书写速度在 C 控制区处理。
              </Text>
            </div>
          ),
          extra: <Tag color="cyan">{ratioText}</Tag>,
          key: 'canvas-size',
          label: '画布变量 / 录屏舞台',
        },
      ]}
    />
  );
}

function formatRatio(width: number, height: number) {
  const divisor = gcd(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function gcd(left: number, right: number): number {
  return right === 0 ? Math.max(1, left) : gcd(right, left % right);
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
