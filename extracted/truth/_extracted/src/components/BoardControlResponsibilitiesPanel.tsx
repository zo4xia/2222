// @cleanroom-component: BoardControlResponsibilitiesPanel
// @domain: inspector/control-responsibilities
// @slot: right-inspector/read-only-control-index
// @depends: boardControlResponsibilities
// @io-input: static board control responsibility rows
// @io-output: read-only UI only
// @boundary: Never edits A/B/C data; all text comes from the single boardControlResponsibilities source.

import { Collapse, Space, Tag, Typography } from 'antd';
import { boardControlResponsibilities } from '../modules/boardControlLayers/boardControlResponsibilities';

const { Text } = Typography;

export function BoardControlResponsibilitiesPanel() {
  return (
    <Collapse
      className="zone-card zone-inspector board-control-responsibilities-collapse"
      defaultActiveKey={[]}
      items={[
        {
          children: (
            <div className="board-control-responsibilities" data-anchor="abc-control-responsibilities-panel-001">
              {boardControlResponsibilities.map((row) => (
                <section className="board-control-responsibility" data-control-id={row.id} key={row.id}>
                  <div className="board-control-responsibility__header">
                    <Text strong>{row.component}</Text>
                    <Tag color={row.uniqueness.includes('唯一') ? 'blue' : 'orange'}>{row.uniqueness}</Tag>
                  </div>
                  <Text type="secondary">{row.purpose}</Text>
                  <dl className="board-control-responsibility__facts">
                    <div>
                      <dt>负责</dt>
                      <dd>{row.owns}</dd>
                    </div>
                    <div>
                      <dt>不负责</dt>
                      <dd>{row.notOwns}</dd>
                    </div>
                    <div>
                      <dt>影响关系</dt>
                      <dd>{row.effect}</dd>
                    </div>
                    <div>
                      <dt>对应前端</dt>
                      <dd>{row.frontend}</dd>
                    </div>
                  </dl>
                  <Space size={[4, 4]} wrap>
                    {row.fields.map((field) => (
                      <Tag key={`${row.id}-${field}`}>{field}</Tag>
                    ))}
                  </Space>
                </section>
              ))}
            </div>
          ),
          extra: <Tag color="purple">{boardControlResponsibilities.length} 项</Tag>,
          key: 'board-control-responsibilities',
          label: 'A/B/C 控制层职责表',
        },
      ]}
    />
  );
}
