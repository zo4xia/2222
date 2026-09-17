// @cleanroom-component: AssetList
// @domain: teaching-assets
// @slot: left-sider/asset-list
// @depends: TeachingProject.assets
// ID: cleanroom-assets-list-001
// 💾 数据: TeachingAsset[]
// 🎨 状态: asset.kind + asset.status -> tag label/color
// 🧩 复用: all asset tabs
// @io-input: assets
// @io-output: none
// @route: App shell / left sider / reusable asset list
// @fields: TeachingAsset.kind, TeachingAsset.status, TeachingAsset.title, TeachingAsset.summary, TeachingAsset.source, TeachingAsset.sourceRef
// @boundary: render only; does not mutate assets or call external services

import { Card, Flex, List, Tag, Typography } from 'antd';
import type { TeachingAsset } from '../domain/teachingProject';
import { assetKindLabels, assetStatusColors, assetStatusLabels } from './assetPanelMeta';
import { MathText } from './MathText';

const { Text, Title } = Typography;

export function AssetList({ assets }: { assets: TeachingAsset[] }) {
  return (
    <List
      className="asset-list"
      dataSource={assets}
      locale={{ emptyText: '暂无素材' }}
      renderItem={(asset) => (
        <List.Item>
          <Card className="asset-card" size="small">
            {asset.kind === 'problemImage' && asset.sourceRef ? (
              <img alt={asset.title} className="asset-card__thumb" src={asset.sourceRef} />
            ) : null}
            <Flex align="center" justify="space-between" gap={8}>
              <Tag color="processing">{assetKindLabels[asset.kind]}</Tag>
              <Tag color={assetStatusColors[asset.status]}>{assetStatusLabels[asset.status]}</Tag>
            </Flex>
            <Title className="asset-title" level={5}>
              {asset.title}
            </Title>
            <Text type="secondary">
              <MathText>{asset.summary}</MathText>
            </Text>
            <div className="asset-source">来源：{asset.source}</div>
          </Card>
        </List.Item>
      )}
    />
  );
}
