// @cleanroom-component: ScriptSegmentPreview
// @domain: script-segmentation-preview
// @slot: script-board-summary + voice-workspace
// @depends: createScriptSegments
// @io-input: scriptText
// @io-output: visual <br> segment preview only
// @boundary: read-only projection; no store writes, no TTS request, no B timeline generation

import { Alert, Empty, Flex, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { FormulaText } from '../../components/FormulaText';
import { createScriptSegments } from './createScriptSegments';
import { readUserFacingSegmentLabel } from './scriptSegmentDisplayLabels';
import { countAllowedBoardMarkers, readAllowedBoardMarkers } from './scriptSegmentBoardMarkers';

const { Text } = Typography;

export function ScriptSegmentPreview({
  emptyText = '暂无按换行生成的讲解片段。',
  maxVisibleSegments = 8,
  scriptChainKeys,
  scriptText,
  title = '智能断句预览',
}: {
  emptyText?: string;
  maxVisibleSegments?: number;
  scriptChainKeys?: string[];
  scriptText: string;
  title?: string;
}) {
  const segments = useMemo(() => createScriptSegments(scriptText, { chainKeys: scriptChainKeys }), [scriptChainKeys, scriptText]);
  const visibleSegments = segments.slice(0, maxVisibleSegments);
  const hiddenCount = Math.max(0, segments.length - visibleSegments.length);
  const markerCount = countAllowedBoardMarkers(segments);
  // @xiaxia-c-candidate-copy: boardSlice markers are C material candidates, not a B/C timeline track.

  return (
    <section className="script-segment-preview" aria-label={title}>
      <Flex align="center" className="script-segment-preview__header" justify="space-between" gap={8} wrap="wrap">
        <Space size={6} wrap>
          <Tag color="blue">{title}</Tag>
          <Tag color={segments.length ? 'cyan' : 'default'}>{segments.length} 个分片</Tag>
          <Tag color={markerCount ? 'purple' : 'default'}>{markerCount} 个板书候选</Tag>
        </Space>
        <Text type="secondary">仅按换行分段</Text>
      </Flex>

      <Alert
        className="script-segment-preview__rule"
        message="AI 可以建议断句；换行代表一次明显停顿和一段讲解音频，不是每句话都切。分片数量没有固定上限，以步骤清楚、播放节奏自然为准。"
        showIcon
        type="info"
      />

      {segments.length > 10 ? (
        <Alert
          className="script-segment-preview__rule"
          message={`当前有 ${segments.length} 个分片。请确认每段都在讲一个清楚动作；如果只是口语过渡，可以合并相邻分片。`}
          showIcon
          type="info"
        />
      ) : null}

      {segments.length ? (
        <div className="script-segment-preview__list">
          {visibleSegments.map((segment, segmentIndex) => (
            <article className="script-segment-preview__item" key={segment.id}>
              <Flex align="center" justify="space-between" gap={8} wrap="wrap">
                <Space size={6} wrap>
                  <Tag color="gold">{readUserFacingSegmentLabel(segment.chainKey, segmentIndex)}</Tag>
                  {readAllowedBoardMarkers(segment).length ? <Tag color="purple">含板书 {readAllowedBoardMarkers(segment).length}</Tag> : null}
                </Space>
                {segment.estimatedDurationMs ? (
                  <Text type="secondary">约 {Math.round(segment.estimatedDurationMs / 1000)} 秒</Text>
                ) : null}
              </Flex>
              <FormulaText as="p" className="script-segment-preview__text">
                {segment.text}
              </FormulaText>
              {readAllowedBoardMarkers(segment).length ? (
                <div className="script-segment-preview__markers">
                  {readAllowedBoardMarkers(segment).map((marker, markerIndex) => (
                    <Tag color="purple" key={`${segment.id}-${markerIndex}`}>
                      <FormulaText className="script-segment-preview__marker-text">{marker.text}</FormulaText>
                    </Tag>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {hiddenCount ? <Text type="secondary">还有 {hiddenCount} 个分片未展开，可在语音步骤查看完整列表。</Text> : null}
        </div>
      ) : (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </section>
  );
}
