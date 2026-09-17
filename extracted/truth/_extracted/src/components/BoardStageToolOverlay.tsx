// @cleanroom-component: BoardStageToolOverlay
// @domain: drawboard-stage/golden-finger-tools
// @slot: drawboard-stage/tool-overlay（与 stage-canvas 同级，完全在录制区域之外）
// @depends: BoardStageToolMode
// @io-input: activeToolMode, activeColor
// @io-output: onChangeToolMode, onChangeColor
// @boundary: tool state only; no A/B/C mutation, no timeline writes
// @design: 隔层板模式
//   - 关闭态：画布上方只浮一个 "开启标注隔层板" 按钮，C 可自由拖拽
//   - 激活态：完整工具面板 + 隔层板header标识，GoldenFinger canvas 拦截所有指针事件形成透明隔离层
//   - 核心隐喻：像是在画布上盖了一层透明玻璃板，在板上标注不影响板下 C 的演绎

import { Button, ColorPicker, Drawer, Tooltip } from 'antd';
import { Circle, Eraser, Highlighter, PenLine, Palette, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { BoardStageToolMode } from './drawboardStageTypes';

const COLORS = ['#111111', '#d14343', '#246bfe', '#118a4f'];
const STROKE_WIDTH_OPTIONS = [3, 5, 8];

/** 工具定义：标签 + 图标 + 模式值 */
const TOOLS: { icon: typeof PenLine; label: string; mode: BoardStageToolMode }[] = [
  { icon: PenLine, label: '标注', mode: 'pen' },
  { icon: Eraser, label: '橡皮', mode: 'eraser' },
  { icon: Highlighter, label: '重点', mode: 'highlight' },
  { icon: Circle, label: '圈画', mode: 'circle' },
  { icon: X, label: '划掉', mode: 'cross' },
];

export function BoardStageToolOverlay({
  activeColor,
  activeToolMode,
  activeStrokeWidth,
  onChangeColor,
  onChangeStrokeWidth,
  onChangeToolMode,
  onClear,
  onUndo,
}: {
  activeColor: string;
  activeToolMode: BoardStageToolMode;
  activeStrokeWidth: number;
  onChangeColor: (color: string) => void;
  onChangeStrokeWidth: (width: number) => void;
  onChangeToolMode: (mode: BoardStageToolMode) => void;
  onClear: () => void;
  onUndo: () => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 隔层板是否激活（任意标注工具开启即为激活） */
  const glassActive = activeToolMode !== 'off';

  return (
    <>
      <aside className={`board-stage-tool-overlay ${glassActive ? 'board-stage-tool-overlay--on' : 'board-stage-tool-overlay--off'}`}>
        {!glassActive ? (
          <Tooltip
            title={
              <div style={{ maxWidth: 200 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>标注隔层板</div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  开启后在画布侧边打开工具条，标注不会压住画布本体。
                </div>
              </div>
            }
          >
            <Button
              className="board-stage-tool-button board-stage-tool-button--toggle"
              aria-label="开启标注隔层板"
              icon={<PenLine size={16} />}
              onClick={() => onChangeToolMode('pen')}
              shape="circle"
              type="default"
            />
          </Tooltip>
        ) : (
          <div className="board-stage-tool-rail" role="toolbar" aria-label="标注工具栏">
            <div className="board-stage-tool-rail__badge">
              <ShieldCheck size={14} />
              <span>隔层板</span>
            </div>
            {TOOLS.map(({ icon: Icon, label, mode }) => (
              <Tooltip key={mode} title={mode === 'pen' ? '自由标注画笔' : `${label}模式`}>
                <Button
                  aria-label={label}
                  className="board-stage-tool-button"
                  data-testid={`gf-mode-${mode}`}
                  icon={<Icon size={16} />}
                  onClick={() => onChangeToolMode(mode)}
                  shape="circle"
                  type={activeToolMode === mode ? 'primary' : 'default'}
                />
              </Tooltip>
            ))}
            <Tooltip title="设置颜色和粗细">
              <Button
                aria-label="设置标注样式"
                className="board-stage-tool-button"
                icon={<Palette size={16} />}
                onClick={() => setSettingsOpen(true)}
                shape="circle"
              />
            </Tooltip>
            <Tooltip title="撤销上一笔">
              <Button
                aria-label="撤销"
                className="board-stage-tool-button"
                data-testid="gf-undo"
                icon={<RotateCcw size={16} />}
                onClick={onUndo}
                shape="circle"
              />
            </Tooltip>
            <Tooltip title="清空所有标注">
              <Button
                aria-label="清空所有标注"
                className="board-stage-tool-button"
                data-testid="gf-clear"
                icon={<Trash2 size={16} />}
                onClick={onClear}
                shape="circle"
              />
            </Tooltip>
            <Tooltip title="关闭隔层板">
              <Button
                aria-label="关闭隔层板"
                className="board-stage-tool-button"
                icon={<X size={16} />}
                onClick={() => onChangeToolMode('off')}
                shape="circle"
                type="default"
              />
            </Tooltip>
          </div>
        )}
      </aside>

      <Drawer
        destroyOnHidden
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        placement="right"
        title="标注设置"
        width={320}
      >
        <div className="board-stage-settings-panel">
          <div className="board-stage-settings-panel__section">
            <strong>颜色</strong>
            <div className="board-stage-color-group" aria-label="标注颜色">
              {COLORS.map((color) => (
                <button
                  aria-label={`颜色 ${color}`}
                  className="board-stage-color-swatch"
                  data-selected={activeColor === color ? 'true' : 'false'}
                  key={color}
                  onClick={() => onChangeColor(color)}
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
              <div className="board-stage-color-picker">
                <ColorPicker
                  onChange={(value) => {
                    const hex = typeof value === 'string' ? value : value?.toHexString?.() ?? String(value);
                    onChangeColor(hex);
                  }}
                  size="small"
                  value={activeColor}
                />
              </div>
            </div>
          </div>

          <div className="board-stage-settings-panel__section">
            <strong>粗细</strong>
            <div className="board-stage-size-group" aria-label="标注粗细">
              {STROKE_WIDTH_OPTIONS.map((width) => (
                <button
                  aria-label={`粗细 ${width}`}
                  className="board-stage-size-chip"
                  data-selected={activeStrokeWidth === width ? 'true' : 'false'}
                  key={width}
                  onClick={() => onChangeStrokeWidth(width)}
                  type="button"
                >
                  <span className="board-stage-size-dot" style={{ height: width, width }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
