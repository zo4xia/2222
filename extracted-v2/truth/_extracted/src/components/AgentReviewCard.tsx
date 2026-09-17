// @cleanroom-component: AgentReviewCard
// @domain: script-agent-interface
// @slot: lower-left-agent-dock
// @depends: local draft state, future scriptAgent config, future vectorKb config
// @feature-branch: script-agent-interface
// @feature-branch: agent-review-card
// @feature-branch: agent-draft-apply
// @feature-branch: customer-agent-adapter
// @feature-branch: vector-kb-interface
// @io-input: ScriptAgentDraft
// @io-output: onApplyDraft(draft)
// @route: ScriptAgentWorkspace Drawer / agent conversation zone
// @fields: ScriptAgentDraft.rows -> compiler -> ScriptAgentDraft.spokenScript / ScriptAgentDraft.boardPlan
// @boundary: uses AntD Card/Avatar/Alert/Input/Button as UI base; no custom chat shell; does not write TeachingProject directly
// @route-impact: App shell only, future route: script-workspace
// @api-needed: script-agent-chat-api | trigger: send user revision message | output: candidate ScriptAgentDraft

import { RobotOutlined } from '@ant-design/icons';
import { Bubble, Sender, type BubbleItemType } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import Latex from '@ant-design/x-markdown/plugins/Latex';
import { Alert, Avatar, Button, Flex, Space, Typography } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppConfig } from '../config/defaultConfig';
import type { ScriptAgentDraft } from '../domain/teachingProject';
import { hasScriptAgentDraftContent } from '../modules/scriptAgentDraft';
import { requestScriptAgentDraft } from '../services/scriptAgentGatewayClient';

const { Text } = Typography;

export function AgentReviewCard({
  autoApplyDraft,
  autoRunRequestId,
  draft,
  onCandidateDraftChange,
  problemText,
  scriptAgentConfig,
  onApplyDraft,
}: {
  autoApplyDraft: boolean;
  autoRunRequestId: number;
  draft: ScriptAgentDraft;
  onCandidateDraftChange: (draft: ScriptAgentDraft) => void;
  problemText: string;
  scriptAgentConfig: AppConfig['scriptAgent'];
  onApplyDraft: (draft: ScriptAgentDraft) => void;
}) {
  const [prompt, setPrompt] = useState('');
  const [candidateDraft, setCandidateDraft] = useState(draft);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState('');
  const [chatMessages, setChatMessages] = useState<AgentChatHistoryItem[]>(() => readStoredChatMessages());
  const autoRunRequestRef = useRef(0);
  const activeDraft = hasScriptAgentDraftContent(candidateDraft) ? candidateDraft : draft;

  useEffect(() => {
    setCandidateDraft(draft);
    setError('');
  }, [draft]);

  const hasCandidateRows = Boolean(activeDraft.rows?.length);
  const draftStatusText =
    hasCandidateRows
      ? '候选切片表格已生成或正在编辑；右侧表格是唯一候选编辑面，确认后才写入正式文稿和 C 素材候选。'
      : activeDraft.spokenScript || activeDraft.boardPlan
      ? autoApplyDraft
        ? '候选草稿已生成，并已按无人值守模式应用到正式预览。'
        : '候选草稿已生成。点击应用后才写入正式文稿和 C 素材候选。'
      : '打开对话不会自动发送题目；点击讲解生成或在这里发送消息后，候选结果才会更新。';

  useEffect(() => {
    writeStoredChatMessages(chatMessages);
  }, [chatMessages]);

  const handleRequestAgent = useCallback(async (revisionPrompt = prompt) => {
    if (!problemText.trim()) {
      return;
    }

    const submittedPrompt = revisionPrompt || '请基于已确认题文一步一步填写讲解切片表格候选。';
    setIsRequesting(true);
    setError('');
    setChatMessages((current) => [
      ...current,
      createChatMessage('user', submittedPrompt),
    ]);
    try {
      const nextDraft = await requestScriptAgentDraft({
        config: scriptAgentConfig,
        problemText,
        revisionPrompt,
      });
      setCandidateDraft(nextDraft);
      onCandidateDraftChange(nextDraft);
      setChatMessages((current) => [
        ...current,
        createChatMessage('ai', formatDraftReceipt(nextDraft)),
      ]);
      if (autoApplyDraft) {
        onApplyDraft(nextDraft);
      }
    } catch (requestError) {
      const errorMessage = requestError instanceof Error ? requestError.message : String(requestError);
      setError(errorMessage);
      setChatMessages((current) => [
        ...current,
        createChatMessage('ai', `请求失败：${errorMessage}`),
      ]);
    } finally {
      setIsRequesting(false);
    }
  }, [autoApplyDraft, onApplyDraft, onCandidateDraftChange, problemText, prompt, scriptAgentConfig]);

  useEffect(() => {
    if (!autoRunRequestId || autoRunRequestRef.current === autoRunRequestId || !problemText.trim()) {
      return;
    }

    autoRunRequestRef.current = autoRunRequestId;
    void handleRequestAgent('');
  }, [autoRunRequestId, handleRequestAgent, problemText]);

  const messages = useMemo<BubbleItemType[]>(() => {
    const persistedItems = chatMessages.length
      ? chatMessages
      : [
          {
            content: '已打开文稿与 C 素材 Agent。这里会保留本地聊天记录；打开窗口本身不会发送题目。',
            key: 'system-ready',
            role: 'ai' as const,
          },
        ];

    if (isRequesting) {
      return [
        ...persistedItems,
        {
          content: '正在生成回答，请稍等。',
          key: 'agent-loading',
          loading: true,
          role: 'ai',
        },
      ];
    }

    return persistedItems;
  }, [chatMessages, isRequesting]);

  return (
    <section className="agent-review-card">
      <Space className="agent-review-title">
        <Avatar className="agent-avatar" icon={<RobotOutlined />} shape="square" />
        <span>
          <Text strong>文稿与 C 素材 Agent</Text>
          <Text className="agent-review-subtitle" type="secondary">
            对话调整，满意后应用
          </Text>
        </span>
      </Space>

      <Bubble.List
        autoScroll
        className="agent-chat-list"
        items={messages}
        role={{
          ai: {
            avatar: <Avatar className="agent-avatar" icon={<RobotOutlined />} shape="square" />,
            contentRender: (content) => (
              <XMarkdown
                className="agent-markdown math-markdown"
                config={{ extensions: Latex() }}
                content={String(content)}
                escapeRawHtml
                openLinksInNewTab
              />
            ),
            placement: 'start',
            variant: 'filled',
          },
          user: {
            placement: 'end',
            variant: 'outlined',
          },
        }}
      />

      <Alert className="agent-draft-preview" showIcon title={draftStatusText} type="info" />
      {error ? <Alert showIcon title={error} type="error" /> : null}
      <Text className="agent-config-hint" type="secondary">
        当前 Agent 提示词来自全局配置；返回结果会进入右侧切片表格。
      </Text>

      <Sender
        autoSize={{ minRows: 2, maxRows: 5 }}
        className="agent-sender"
        loading={isRequesting}
        onCancel={() => setIsRequesting(false)}
        onChange={setPrompt}
        onSubmit={(message) => {
          setPrompt('');
          void handleRequestAgent(message);
        }}
        placeholder="例如：语气再温柔一点；C 素材少一些；换成初中口吻。"
        value={prompt}
      />

      <Flex className="agent-review-actions" gap={8} justify="end">
        <Button disabled={isRequesting || chatMessages.length === 0} onClick={() => setChatMessages([])}>
          清空本地记录
        </Button>
        <Button disabled={!problemText.trim() || isRequesting} onClick={() => void handleRequestAgent('')}>
          重新生成
        </Button>
      </Flex>
    </section>
  );
}

type AgentChatHistoryItem = {
  content: string;
  key: string;
  role: 'ai' | 'user';
};

const agentChatStorageKey = 'cleanroom-script-agent-chat-history-v2';

function createChatMessage(role: AgentChatHistoryItem['role'], content: string): AgentChatHistoryItem {
  return {
    content,
    key: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
  };
}

function readStoredChatMessages(): AgentChatHistoryItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(agentChatStorageKey);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isAgentChatHistoryItem).filter((message) => !isLegacyPreviewMessage(message.content));
  } catch {
    return [];
  }
}

function writeStoredChatMessages(messages: AgentChatHistoryItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(agentChatStorageKey, JSON.stringify(messages.slice(-40)));
  } catch {
    // Local history is a convenience cache; failures should not block generation.
  }
}

function isAgentChatHistoryItem(value: unknown): value is AgentChatHistoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AgentChatHistoryItem>;
  return typeof candidate.key === 'string' && typeof candidate.content === 'string' && (candidate.role === 'ai' || candidate.role === 'user');
}

function formatDraftReceipt(draft: ScriptAgentDraft) {
  if (draft.rows?.length) {
    return `已生成 ${draft.rows.length} 行讲解切片，内容已放到右侧表格编辑区。`;
  }

  const sections = [];
  if (draft.spokenScript.trim()) {
    sections.push('文案候选');
  }
  if (draft.boardPlan.trim()) {
    sections.push('C 素材候选');
  }
  return sections.length ? `已生成${sections.join('和')}，内容已放到右侧候选编辑区。` : 'Agent 已返回候选结果。';
}

function isLegacyPreviewMessage(content: string) {
  return [
    '### rows 表格候选',
    '### compiler 文案预览',
    '### 文案预览',
    '### 板书预览',
    '<br>',
    '<b>',
  ].some((legacyPreviewMarker) => content.includes(legacyPreviewMarker));
}
