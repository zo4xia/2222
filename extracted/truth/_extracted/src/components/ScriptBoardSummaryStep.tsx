// @cleanroom-component: ScriptBoardSummaryStep
// @domain: script-agent-interface
// @slot: left-sider/script-board-summary-step
// @depends: TeachingProject.assets(scriptText/boardLayout), onOpenScriptAgent
// @feature-branch: script-agent-interface
// @feature-branch: script-board-combined-output
// ID: cleanroom-assets-script-board-step-001
// @io-input: scriptTextAsset, boardLayoutAsset, onOpenScriptAgent
// @io-output: onOpenScriptAgent()
// @route: left-sider/assets/script-board
// @fields: TeachingProject.assets(kind=scriptText), TeachingProject.assets(kind=boardLayout)
// @boundary: workflow step summary only; real editing stays in ScriptAgentWorkspace Drawer

import { EditOutlined, FileTextOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import type { CLayoutPreviewDraft, StageCanvasConfig, TeachingAsset } from '../domain/teachingProject';
import { readScriptChainKeysSourceRef } from '../modules/abcChain/abcChainKey';
import { ScriptSegmentWorkbench } from '../modules/scriptSegments';
import { BoardPreviewCard } from './BoardPreviewCard';
import { MathText } from './MathText';

const { Text, Title } = Typography;

export function ScriptBoardSummaryStep({
  boardLayoutAsset,
  canOpenAgent,
  onOpenScriptAgent,
  scriptTextAsset,
  layoutPreviewDraft,
  stageCanvas,
}: {
  boardLayoutAsset: TeachingAsset | undefined;
  canOpenAgent: boolean;
  onOpenScriptAgent: () => void;
  scriptTextAsset: TeachingAsset | undefined;
  layoutPreviewDraft: CLayoutPreviewDraft | null;
  stageCanvas: StageCanvasConfig;
}) {
  const scriptChainKeys = useMemo(() => readScriptChainKeysSourceRef(scriptTextAsset?.sourceRef), [scriptTextAsset?.sourceRef]);

  return (
    <div className="script-board-summary-step">
      <Card size="small">
        <Flex align="center" justify="space-between" gap={12}>
          <Space>
            <FileTextOutlined />
            <div>
              <Title level={5}>文稿与板书</Title>
              <Text type="secondary">先确认内容，再生成音频和时间轴。</Text>
            </div>
          </Space>
          <Button disabled={!canOpenAgent} icon={<EditOutlined />} onClick={onOpenScriptAgent} type="primary">
            打开 Agent
          </Button>
        </Flex>
      </Card>
      <Card size="small">
        <Flex align="center" justify="space-between">
          <Tag color="blue">讲解稿</Tag>
          <Tag color={scriptTextAsset?.status === 'ready' ? 'green' : 'orange'}>
            {scriptTextAsset?.status === 'ready' ? '已确认' : '待校准'}
          </Tag>
        </Flex>
        <MathText as="div" className="script-board-summary-text">
          {scriptTextAsset?.summary || '等待 Agent 生成讲解文稿。'}
        </MathText>
        <ScriptSegmentWorkbench
          actionLabel="回 Agent 调整"
          maxVisibleSegments={5}
          onEditScript={canOpenAgent ? onOpenScriptAgent : undefined}
          scriptChainKeys={scriptChainKeys}
          scriptText={scriptTextAsset?.summary ?? ''}
          title="分段确认"
        />
      </Card>
      <Card size="small">
        <Flex align="center" justify="space-between">
          <Tag color="blue">板书候选</Tag>
          <Tag color={boardLayoutAsset?.status === 'ready' ? 'green' : 'orange'}>
            {boardLayoutAsset?.status === 'ready' ? '已确认' : '待校准'}
          </Tag>
        </Flex>
        <MathText as="div" className="script-board-summary-text">
          {boardLayoutAsset?.summary || '等待 Agent 生成板书候选。'}
        </MathText>
      </Card>
      <BoardPreviewCard draft={layoutPreviewDraft} stageCanvas={stageCanvas} />
    </div>
  );
}
