// @cleanroom-component: CurrentProjectBoardFontInspector
// @domain: inspector/c-current-font
// @slot: right-inspector/c-current-font-card
// @depends: StageCanvasConfig, BoardTypographyControlledFields
// @io-input: current project canvas typography fields
// @io-output: draft C default typography -> explicit apply -> onUpdateCanvas(canvas)
// @fields: canvas.boardFontName, canvas.boardFontSize, canvas.boardFontUrl, canvas.boardFontFamily
// @boundary: Current project C default typography only; not Canvas stage size/background, not per-clip C font fields

import { useEffect, useState } from 'react';
import { Button, Collapse, Space, Tag, Typography } from 'antd';
import type { StageCanvasConfig } from '../domain/teachingProject';
import { BoardTypographyControlledFields } from './BoardTypographyFields';

const { Text } = Typography;

export function CurrentProjectBoardFontInspector({
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

  const hasDraftChanges =
    draftCanvas.boardFontName !== canvas.boardFontName ||
    draftCanvas.boardFontSize !== canvas.boardFontSize ||
    draftCanvas.boardFontUrl !== canvas.boardFontUrl ||
    draftCanvas.boardFontFamily !== canvas.boardFontFamily;

  return (
    <Collapse
      className="zone-card zone-inspector current-project-board-font-collapse"
      defaultActiveKey={[]}
      items={[
        {
          children: (
            <div className="canvas-inspector">
              <Text type="secondary">
                当前工程的 C 素材默认书写风格；已选中的单个 C 角色字号仍在右侧“选中 C 角色内容”里调整。
              </Text>
              <BoardTypographyControlledFields
                labelPrefix="C 默认"
                onChange={(patch) =>
                  setDraftCanvas({
                    ...draftCanvas,
                    ...patch,
                  })
                }
                value={draftCanvas}
              />
              <Space>
                <Button disabled={!hasDraftChanges} onClick={() => onUpdateCanvas(draftCanvas)} type="primary">
                  应用到当前工程
                </Button>
                <Button disabled={!hasDraftChanges} onClick={() => setDraftCanvas(canvas)}>
                  放弃修改
                </Button>
              </Space>
              <Text type="secondary">
                这是 C 素材的默认字体入口，不改变画布尺寸、背景、A 语音或 B 寿命；字体地址可填 HTTPS 在线字体 CSS。
              </Text>
            </div>
          ),
          extra: <Tag color="green">C</Tag>,
          key: 'current-project-board-font',
          label: 'C 默认字体 / 当前工程',
        },
      ]}
    />
  );
}
