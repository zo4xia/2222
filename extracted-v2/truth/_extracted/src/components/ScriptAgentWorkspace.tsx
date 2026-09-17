// @cleanroom-component: ScriptAgentWorkspace
// @domain: script-agent-interface
// @slot: script-workspace
// @depends: TeachingProject.assets(problemText/scriptText/boardLayout), defaultConfig.scriptAgent, defaultConfig.vectorKb
// @feature-branch: script-agent-interface
// @feature-branch: agent-knowledge-base
// @feature-branch: vector-kb-interface
// @feature-branch: customer-agent-adapter
// @feature-branch: script-board-combined-output
// @feature-branch: script-sync-marker
// @feature-branch: board-plan-output
// @route-impact: App shell right/center workspace, future route: script-workspace

// ID: cleanroom-agent-script-workspace-001
// 💾 数据: problemText -> scriptText + boardLayout
// 🔌 事件: AgentReviewCard.apply -> onApplyDraft; rows table change/compile -> candidate edit; toolbar.apply -> formal draft
// 📦 转换: 候选 ScriptAgentDraft -> TeachingProject.assets(scriptText/boardLayout)
// @io-input: TeachingProject.assets(problemText/scriptText/boardLayout)
// @io-output: onApplyDraft(draft)
// @route: App Modal(title=文稿与 C 素材 Agent)
// @fields: problemText -> ScriptAgentDraft -> scriptText + boardLayout
// @api-needed: script-board-agent-api | trigger: user next / agent chat send | config: defaultConfig.scriptAgent + defaultConfig.vectorKb | output: ScriptAgentDraft
// @boundary: AntD Card/Input/Typography compose UI; candidate draft is not truth until apply; no TTS/timeline writes here

import { CheckOutlined, HighlightOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Space, Splitter, Tag, Typography } from 'antd';
import { useState } from 'react';
import { AgentReviewCard } from './AgentReviewCard';
import type { AppConfig } from '../config/defaultConfig';
import type { ScriptAgentDraft, TeachingAsset } from '../domain/teachingProject';
import { createScriptAgentDraftSignature, hasScriptAgentDraftContent } from '../modules/scriptAgentDraft';
import { ScriptAgentTableEditor } from '../modules/scriptAgentTable/ScriptAgentTableEditor';

const { Text, Title } = Typography;

export function ScriptAgentWorkspace({
  autoApplyDraft,
  autoRunRequestId,
  assets,
  candidateDraft,
  scriptAgentConfig,
  onApplyDraft,
  onCandidateDraftChange,
}: {
  autoApplyDraft: boolean;
  autoRunRequestId: number;
  assets: TeachingAsset[];
  candidateDraft: ScriptAgentDraft;
  scriptAgentConfig: AppConfig['scriptAgent'];
  onApplyDraft: (draft: ScriptAgentDraft) => void;
  onCandidateDraftChange: (draft: ScriptAgentDraft) => void;
}) {
  const problemText = assets.find((asset) => asset.kind === 'problemText')?.summary ?? '';
  const candidateSignature = createScriptAgentDraftSignature(candidateDraft);
  const candidateRows = candidateDraft.rows ?? [];
  const [appliedSignature, setAppliedSignature] = useState('');

  const hasCandidateDraft = hasScriptAgentDraftContent(candidateDraft);
  const isCandidateApplied = hasCandidateDraft && appliedSignature === candidateSignature;
  const handleApplyCandidateDraft = () => {
    onApplyDraft(candidateDraft);
    setAppliedSignature(candidateSignature);
  };

  return (
    <section className="script-agent-workspace">
      <Splitter className="script-agent-splitter">
        <Splitter.Panel defaultSize="38%" min="360px">
          <aside className="script-agent-side">
            {/* ID: cleanroom-agent-script-review-001 | 🔌 ask/apply | 🧩 AgentReviewCard */}
            <Space align="center" className="script-agent-side-header" wrap>
              <Title level={5}>对话</Title>
              {scriptAgentConfig.modelName ? <Tag color="green">{scriptAgentConfig.modelName}</Tag> : null}
            </Space>
            <AgentReviewCard
              autoApplyDraft={autoApplyDraft}
              autoRunRequestId={autoRunRequestId}
              draft={candidateDraft}
              onCandidateDraftChange={onCandidateDraftChange}
              problemText={problemText}
              scriptAgentConfig={scriptAgentConfig}
              onApplyDraft={onApplyDraft}
            />
          </aside>
        </Splitter.Panel>
        <Splitter.Panel defaultSize="62%" min="700px">
          <main className="script-agent-preview-frame">
            <FlexHeader
              autoApplyDraft={autoApplyDraft}
              hasCandidateDraft={hasCandidateDraft}
              isCandidateApplied={isCandidateApplied}
              onApplyCandidateDraft={handleApplyCandidateDraft}
              scriptAgentConfig={scriptAgentConfig}
            />
            <div className="script-agent-main">
              <Card
                className="script-field-card"
                extra={<Text type="secondary">可直接改</Text>}
                size="small"
                title={
                  <Space>
                    <HighlightOutlined />
                    <Text strong>讲解切片候选</Text>
                    <Tag color="geekblue">rows</Tag>
                  </Space>
                }
              >
                {/* ID: cleanroom-agent-rows-edit-001 | 💾 candidateDraft.rows | 🔌 table edit | 📦 rows -> ScriptAgentDraft */}
                <ScriptAgentTableEditor
                  onCompile={(rows) =>
                    onCandidateDraftChange({
                      boardPlan: '',
                      rows,
                      spokenScript: '',
                    })
                  }
                  onChange={(rows) =>
                    onCandidateDraftChange({
                      boardPlan: '',
                      rows,
                      spokenScript: '',
                    })
                  }
                  rows={candidateRows}
                />
              </Card>
            </div>
          </main>
        </Splitter.Panel>
      </Splitter>
    </section>
  );
}

function FlexHeader({
  autoApplyDraft,
  hasCandidateDraft,
  isCandidateApplied,
  onApplyCandidateDraft,
  scriptAgentConfig,
}: {
  autoApplyDraft: boolean;
  hasCandidateDraft: boolean;
  isCandidateApplied: boolean;
  onApplyCandidateDraft: () => void;
  scriptAgentConfig: AppConfig['scriptAgent'];
}) {
  return (
    <Card className="script-agent-preview-toolbar" size="small">
      <Space align="center" className="script-agent-preview-toolbar-inner" wrap>
        <Space wrap>
          <Text strong>讲解切片候选</Text>
          <Tag color={autoApplyDraft ? 'red' : 'orange'}>{autoApplyDraft ? '无人值守免审' : '人工确认'}</Tag>
        </Space>
        <Button disabled={!hasCandidateDraft || isCandidateApplied} icon={<CheckOutlined />} onClick={onApplyCandidateDraft} type="primary">
          {isCandidateApplied ? '已应用到正式稿' : '确认应用到正式稿'}
        </Button>
      </Space>
      {isCandidateApplied ? (
        <Alert
          className="script-agent-apply-feedback"
          title="已应用：文稿和板书候选已写入正式预览，可以继续生成语音和时间轴。"
          showIcon
          type="success"
        />
      ) : null}
    </Card>
  );
}
