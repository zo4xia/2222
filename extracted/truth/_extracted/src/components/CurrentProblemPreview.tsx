// @cleanroom-component: CurrentProblemPreview
// @domain: teaching-assets
// @slot: left-sider/current-problem-preview
// @depends: TeachingProject.assets(problemImage)
// @route-impact: App shell only

import { Flex, Tag, Typography } from 'antd';
import type { TeachingAsset } from '../domain/teachingProject';

const { Text } = Typography;

export function CurrentProblemPreview({ asset }: { asset: TeachingAsset | undefined }) {
  return (
    <section className="current-problem-card" aria-label="当前题图">
      <Flex align="center" justify="space-between">
        <Text strong>当前图片</Text>
        <Tag color={asset?.sourceRef ? 'green' : 'default'}>{asset?.sourceRef ? '本地' : '等待上传'}</Tag>
      </Flex>
      <div className="current-problem-preview">
        {asset?.sourceRef ? <img alt={asset.title} src={asset.sourceRef} /> : <span>未上传题图</span>}
      </div>
      <Text className="current-problem-name" type="secondary">
        {asset?.title ?? '上传后，题图和题文会二合一显示。'}
      </Text>
    </section>
  );
}
