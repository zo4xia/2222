// @cleanroom-component: ProblemWorkspace
// @domain: teaching-assets
// @slot: left-sider/problem-workspace
// @depends: TeachingProject.assets(problemImage/problemText/scriptText)
// @feature-branch: problem-text-edit
// @feature-branch: script-agent-interface
// ID: cleanroom-assets-problem-edit-001
// 💾 数据: problemText.summary -> ScriptAgentWorkspace problem context
// 🔌 事件: editable.onChange -> onUpdateProblemText; 讲解生成 -> onGenerateScriptAgent
// ⚠️ 边界: 这里只改题文，不生成 TTS，不写 timeline
// @io-input: imageAsset, textAsset, scriptTextAsset, onUpdateProblemText, onOpenScriptAgent, onGenerateScriptAgent
// @io-output: onUpdateProblemText(text), onOpenScriptAgent(), onGenerateScriptAgent()
// @route: App shell / left sider / assets problem tab
// @fields: TeachingProject.assets(kind=problemText), TeachingProject.assets(kind=scriptText).status
// @api-needed: recognition-ai-api | trigger: import/confirm problem image or text | output: TeachingProject.assets(kind=problemText)
// @boundary: problem text editing and agent entry only; no TTS, no board events, no timeline writes

import { EditOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Input, Space, Tag, Typography } from 'antd';
import { useState } from 'react';
import type { AppConfig } from '../config/defaultConfig';
import type { TeachingAsset } from '../domain/teachingProject';
import { MathText } from './MathText';
import { ProblemUploadPreview } from './ProblemUploadPreview';

const { Text } = Typography;

export function ProblemWorkspace({
  boardSummary,
  hasConfirmedBoard,
  imageAsset,
  isRecognizingProblem,
  onConfirmProblemText,
  onGenerateScriptAgent,
  onImportProblemImage,
  onOpenScriptAgent,
  onUpdateProblemText,
  recognitionConfig,
  recognitionError,
  scriptTextAsset,
  textAsset,
}: {
  boardSummary: string | undefined;
  hasConfirmedBoard: boolean;
  imageAsset: TeachingAsset | undefined;
  isRecognizingProblem: boolean;
  onConfirmProblemText: () => void;
  onGenerateScriptAgent: () => void;
  onImportProblemImage: (file: File) => void;
  onOpenScriptAgent: () => void;
  onUpdateProblemText: (text: string) => void;
  recognitionConfig: AppConfig['recognition'];
  recognitionError: string;
  scriptTextAsset: TeachingAsset | undefined;
  textAsset: TeachingAsset | undefined;
}) {
  const problemText = textAsset?.summary.trim() ?? '';
  const displayedProblemText = textAsset?.summary || '识别结果正文，如果是没有图片的题目，文本直接入这里。';
  const isProblemConfirmed = textAsset?.status === 'ready' && Boolean(problemText);
  const hasProblemText = Boolean(problemText);
  const [isEditingProblemText, setIsEditingProblemText] = useState(false);
  const handlePrimaryAction = () => {
    if (!hasProblemText) return;
    if (!isProblemConfirmed) {
      onConfirmProblemText();
    }
    onGenerateScriptAgent();
  };

  return (
    <div className="problem-workspace">
      <section className="problem-intake-card">
        <Flex align="center" className="problem-intake-status" justify="space-between" wrap="wrap">
          <Text strong>题目输入</Text>
          <Space size={6} wrap>
            <Tag color={imageAsset ? 'blue' : 'default'}>{imageAsset ? '图片已上传' : '等待上传'}</Tag>
            <Tag color={isRecognizingProblem ? 'processing' : 'default'}>{isRecognizingProblem ? '识别中' : recognitionConfig.modelName}</Tag>
          </Space>
        </Flex>
        <ProblemUploadPreview
          asset={imageAsset}
          boardSummary={boardSummary}
          hasConfirmedBoard={hasConfirmedBoard}
          onImportProblemImage={onImportProblemImage}
        />
        {recognitionError ? <Alert showIcon title={recognitionError} type="error" /> : null}
      </section>

      <section className="recognized-result-card">
        <Flex align="center" justify="space-between">
          <Text className="recognized-result-title" strong>
            题文确认
          </Text>
          <Space size={6}>
            <Tag color={isProblemConfirmed ? 'green' : 'orange'}>{isProblemConfirmed ? '已确认' : '待确认'}</Tag>
            <Button
              icon={<EditOutlined />}
              onClick={() => setIsEditingProblemText((current) => !current)}
              size="small"
              type="text"
            >
              修改
            </Button>
          </Space>
        </Flex>
        {isEditingProblemText ? (
          <Input.TextArea
            autoFocus
            autoSize={{ minRows: 5, maxRows: 10 }}
            className="recognized-result-text recognized-result-text--editor math-editor-input"
            onBlur={(event) => {
              const nextFocused = event.relatedTarget;
              if (
                nextFocused instanceof HTMLElement &&
                nextFocused.closest('.recognized-result-card')
              ) {
                return;
              }
              setIsEditingProblemText(false);
            }}
            onChange={(event) => onUpdateProblemText(event.target.value)}
            value={textAsset?.summary ?? ''}
          />
        ) : (
          <button
            className="recognized-result-text recognized-result-text--display"
            onClick={() => setIsEditingProblemText(true)}
            type="button"
          >
            <MathText as="span">{displayedProblemText}</MathText>
          </button>
        )}
        {scriptTextAsset?.status === 'ready' ? (
          <div className="script-confirmed-tip">
            <Tag color="green">文稿已应用</Tag>
            <Text type="secondary">文本框仍可手工编辑。</Text>
          </div>
        ) : null}
        <Flex gap={8} vertical>
          <Text type="secondary">点击正文即可编辑；阅读态保留数学公式显示。</Text>
          <Button block className="problem-primary-action" disabled={!hasProblemText} onClick={handlePrimaryAction} type="primary">
            讲解生成
          </Button>
          <Button block disabled={!isProblemConfirmed} onClick={onOpenScriptAgent}>
            打开文稿与 C 素材 Agent
          </Button>
        </Flex>
        {!isProblemConfirmed ? (
          <Text className="problem-merge-tip" type="secondary">
            先确认题文，才能把它交给文稿模型生成 rows 讲解和 C 素材候选。
          </Text>
        ) : (
          <Text className="problem-merge-tip" type="secondary">
            已确认题文会作为 Agent 的正式输入。
          </Text>
        )}
      </section>

      <Text className="problem-merge-tip" type="secondary">
        题图和题文二合一，减少占用。
      </Text>
    </div>
  );
}
