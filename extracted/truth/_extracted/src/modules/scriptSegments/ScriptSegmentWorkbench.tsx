// @cleanroom-component: ScriptSegmentWorkbench
// @domain: script-segmentation-preview
// @slot: script-board-summary + voice-workspace
// @depends: createScriptSegments
// @io-input: scriptText, optional onEditScript
// @io-output: visual A/B segment confirmation only
// @boundary: read-only projection; split/merge must edit original <br> text elsewhere

import { AudioOutlined, EditOutlined, FormOutlined } from '@ant-design/icons';
import { Button, Empty, Flex, Space, Statistic, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import { FormulaText } from '../../components/FormulaText';
import { createScriptSegments } from './createScriptSegments';
import { readUserFacingSegmentLabel } from './scriptSegmentDisplayLabels';
import { countAllowedBoardMarkers, readAllowedBoardMarkers } from './scriptSegmentBoardMarkers';

const { Text } = Typography;

export function ScriptSegmentWorkbench({
  actionLabel = '调整文稿',
  emptyText = '确认讲解稿后，会显示将生成的讲解片段。',
  maxVisibleSegments = 8,
  onEditScript,
  scriptChainKeys,
  scriptText,
  title = '生成前确认',
}: {
  actionLabel?: string;
  emptyText?: string;
  maxVisibleSegments?: number;
  onEditScript?: () => void;
  scriptChainKeys?: string[];
  scriptText: string;
  title?: string;
}) {
  const segments = useMemo(() => createScriptSegments(scriptText, { chainKeys: scriptChainKeys }), [scriptChainKeys, scriptText]);
  const visibleSegments = segments.slice(0, maxVisibleSegments);
  const hiddenCount = Math.max(0, segments.length - visibleSegments.length);
  const boardMarkerCount = countAllowedBoardMarkers(segments);
  const estimatedSeconds = Math.round(
    segments.reduce((total, segment) => total + (segment.estimatedDurationMs ?? 0), 0) / 1000,
  );
  // @xiaxia-c-candidate-copy: boardSlice markers are C material candidates before A audio and B lifetime generation.

  return (
    <section className="script-segment-workbench" aria-label={title}>
      <Flex className="script-segment-workbench__head" align="center" justify="space-between" gap={10} wrap="wrap">
        <Space size={8} wrap>
          <Tag color="geekblue">{title}</Tag>
          <Text type="secondary">按换行生成音频片段</Text>
        </Space>
        {onEditScript ? (
          <Button icon={<EditOutlined />} onClick={onEditScript} size="small">
            {actionLabel}
          </Button>
        ) : null}
      </Flex>

      <div className="script-segment-workbench__stats">
        <Statistic prefix={<AudioOutlined />} title="讲解片段" value={segments.length} suffix="段" />
        <Statistic prefix={<FormOutlined />} title="板书候选" value={boardMarkerCount} suffix="个" />
        <Statistic title="预计时长" value={estimatedSeconds || 0} suffix="秒" />
      </div>

      {segments.length ? (
        <div className="script-segment-workbench__list">
          {visibleSegments.map((segment, segmentIndex) => (
            <article className="script-segment-workbench__row" key={segment.id}>
              <div className="script-segment-workbench__rail">
                <span>{readUserFacingSegmentLabel(segment.chainKey, segmentIndex)}</span>
                <small>{segment.estimatedDurationMs ? `${Math.round(segment.estimatedDurationMs / 1000)}s` : '待测'}</small>
              </div>
              <div className="script-segment-workbench__body">
                <FormulaText as="p" className="script-segment-workbench__text">
                  {segment.text}
                </FormulaText>
                {readAllowedBoardMarkers(segment).length ? (
                  <div className="script-segment-workbench__boards">
                    {readAllowedBoardMarkers(segment).map((marker, markerIndex) => (
                      <Tag color="purple" key={`${segment.id}-${markerIndex}`}>
                        <FormulaText className="script-segment-workbench__board-text">{marker.text}</FormulaText>
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <Text className="script-segment-workbench__plain" type="secondary">
                    本段没有板书内容
                  </Text>
                )}
              </div>
            </article>
          ))}
          {hiddenCount ? (
            <Text className="script-segment-workbench__more" type="secondary">
              还有 {hiddenCount} 段未展开，生成音频时会按同一规则处理。
            </Text>
          ) : null}
        </div>
      ) : (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </section>
  );
}
