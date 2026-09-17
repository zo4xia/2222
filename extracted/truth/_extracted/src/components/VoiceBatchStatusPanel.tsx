// @cleanroom-component: VoiceBatchStatusPanel
// @domain: voice-audio-timeline
// @slot: left-sider/voice-batch-status
// @depends: TtsBatchUiItem[], future TtsBatchJob, future TtsBatchResult
// @feature-branch: tts-audio-pipeline
// @feature-branch: voice-timing-json
// @feature-branch: board-audio-alignment
// @route-impact: App shell only, future route: task-review
// @api-needed: aliyun-tts-api | trigger: confirmed scriptText batches | output: voiceAudio URL/cache + voiceTiming JSON

import { CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, LoadingOutlined, SoundFilled } from '@ant-design/icons';
import { Card, Empty, Flex, List, Progress, Space, Steps, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import type { TtsBatchUiItem, TtsBatchUiStatus } from '../domain/teachingProject';

const { Text } = Typography;

const statusMeta: Record<TtsBatchUiStatus, { label: string; tone: string; icon: ReactNode }> = {
  audioReady: { icon: <CheckCircleFilled />, label: '生成成功', tone: 'green' },
  failed: { icon: <CloseCircleFilled />, label: '失败', tone: 'red' },
  jsonReady: { icon: <CheckCircleFilled />, label: 'json已获取', tone: 'blue' },
  onTrack: { icon: <SoundFilled />, label: '已音轨', tone: 'green' },
  pending: { icon: <ClockCircleFilled />, label: '等待', tone: 'default' },
  requesting: { icon: <LoadingOutlined />, label: '生成中', tone: 'processing' },
};

export function VoiceBatchStatusPanel({
  batches = [],
  isRealGatewayReady = false,
}: {
  batches?: TtsBatchUiItem[];
  isRealGatewayReady?: boolean;
}) {
  const onTrackCount = batches.filter((batch) => batch.status === 'onTrack').length;
  const readyAudioCount = batches.filter((batch) => isAtLeast(batch.status, 'audioReady')).length;
  const progressPercent = batches.length ? Math.round((onTrackCount / batches.length) * 100) : 0;

  return (
    <Card className="voice-batch-card" size="small">
      <Flex align="center" justify="space-between">
        <Space size={6}>
          <Tag color="blue">音频</Tag>
          <Text strong>A 语音音频</Text>
        </Space>
        <Tag color={isRealGatewayReady ? 'green' : 'volcano'}>{isRealGatewayReady ? '真实网关' : '未接 API'}</Tag>
      </Flex>
      <Flex align="center" className="voice-batch-summary" gap={8}>
        <Progress percent={progressPercent} showInfo={false} size="small" />
        <Tag color={onTrackCount === batches.length && batches.length ? 'green' : 'orange'}>
          {onTrackCount}/{batches.length} 入A轨
        </Tag>
      </Flex>
      {batches.length ? (
        <List
          className="voice-batch-list"
          dataSource={batches}
          renderItem={(batch) => (
            <List.Item className="voice-batch-list-item">
              <List.Item.Meta
                description={
                  <Text type="secondary">
                    {batch.sentenceIds.join(' / ')}
                    {batch.error ? ` · ${batch.error}` : ''}
                  </Text>
                }
                title={
                  <Space size={6}>
                    <Tag color={statusMeta[batch.status].tone}>{statusMeta[batch.status].icon}</Tag>
                    <Text strong>{batch.label}</Text>
                    {batch.audioTrackLabel ? <Tag color="green">{batch.audioTrackLabel}</Tag> : null}
                  </Space>
                }
              />
              <VoiceBatchStatusSteps batch={batch} />
            </List.Item>
          )}
        />
      ) : (
        <Empty description="确认文稿后，会按 <br> 生成 A 轨分段任务。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      <Text className="voice-batch-hint" type="secondary">
        按口播稿里的 &lt;br&gt; 分段请求阿里云；JSON 返回、MP3 音频、入 A 轨分步点亮。
        当前已生成 MP3 {readyAudioCount} 段。
      </Text>
    </Card>
  );
}

function VoiceBatchStatusSteps({ batch }: { batch: TtsBatchUiItem }) {
  const isFailed = batch.status === 'failed';

  return (
    <Steps
      className="voice-batch-steps"
      current={getStepCurrent(batch.status)}
      items={[
        {
          status: isFailed ? 'error' : isAtLeast(batch.status, 'jsonReady') ? 'finish' : batch.status === 'requesting' ? 'process' : 'wait',
          title: 'JSON',
        },
        {
          status: isFailed ? 'error' : isAtLeast(batch.status, 'audioReady') ? 'finish' : batch.status === 'requesting' ? 'process' : 'wait',
          title: 'MP3',
        },
        {
          status: isFailed ? 'error' : batch.status === 'onTrack' ? 'finish' : 'wait',
          title: 'A轨',
        },
      ]}
      labelPlacement="vertical"
      size="small"
    />
  );
}

function isAtLeast(current: TtsBatchUiStatus, target: TtsBatchUiStatus) {
  const order: TtsBatchUiStatus[] = ['pending', 'requesting', 'jsonReady', 'audioReady', 'onTrack'];
  return order.indexOf(current) >= order.indexOf(target);
}

function getStepCurrent(status: TtsBatchUiStatus) {
  if (status === 'onTrack') {
    return 2;
  }
  if (status === 'audioReady') {
    return 1;
  }
  return 0;
}
