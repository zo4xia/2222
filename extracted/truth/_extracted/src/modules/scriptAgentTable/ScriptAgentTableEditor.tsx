import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Collapse, Input, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { createAbcChainLabels, isBoardMaterialChainKey } from '../abcChain/abcChainKey';
import { SCRIPT_SECTION, SCRIPT_SECTION_OPTIONS } from '../../domain/globalRules';
import type { ScriptAgentTableRow } from './types';

const { Text } = Typography;
const { TextArea } = Input;
// rows table workbench copy anchors:
// 讲解切片预览与编辑 / 添加切片 / 刷新候选稿 / 行切片 / 专业规则 / 分区 / 链路 / 步骤
// 板书素材（按分区） / A轴讲解内容（语音切片） / A 语音行和按分区允许的 C 素材候选 / 个 C 素材候选 / 操作
// A-template-open / A-template-pre / A-template-end
// 四连环：对话生成候选 rows / boardSlice 生成 C 素材候选 / A 返回真实时长后生成 B 寿命窗口 / C 再接排版和演绎资产
// 唯一身份只看 chainKey / 开场读题主身份是 A-template-open
// prompt/template 层同时保留 B-template-open / C-template-open 占位
// 分析题目 A-template-pre 和梳理总结 A-template-end 可按需要填写 C 素材候选
// 正式解题步骤才允许 A1/B1/C1

export function ScriptAgentTableEditor({
  onChange,
  onCompile,
  rows,
  showRules = false,
}: {
  onChange: (rows: ScriptAgentTableRow[]) => void;
  onCompile: (rows: ScriptAgentTableRow[]) => void;
  rows: ScriptAgentTableRow[];
  showRules?: boolean;
}) {
  const boardSliceCount = rows.filter((row) => row.boardSlice.trim() && isBoardMaterialChainKey(row.chainKey)).length;
  const voiceTextCount = rows.filter((row) => row.voiceText.trim()).length;
  const handleAddRow = (afterIndex = rows.length - 1) => {
    const nextRow = createEmptyRow(rows.length);
    const insertIndex = Math.max(0, afterIndex + 1);
    onChange([...rows.slice(0, insertIndex), nextRow, ...rows.slice(insertIndex)]);
  };

  if (!rows.length) {
      return (
      <div className="script-agent-table-workbench">
        <ScriptAgentTableToolbar
          boardSliceCount={0}
          onAddRow={() => handleAddRow()}
          onCompile={() => onCompile(rows)}
          rowCount={0}
          voiceTextCount={0}
        />
        <ScriptAgentRowsTable onAddRow={handleAddRow} onChange={onChange} rows={rows} />
        {showRules ? <ScriptAgentTableRules /> : null}
      </div>
    );
  }

  return (
    <div className="script-agent-table-workbench">
      <ScriptAgentTableToolbar
        boardSliceCount={boardSliceCount}
        onAddRow={() => handleAddRow()}
        onCompile={() => onCompile(rows)}
        rowCount={rows.length}
        voiceTextCount={voiceTextCount}
      />
      <ScriptAgentRowsTable onAddRow={handleAddRow} onChange={onChange} rows={rows} />
      {showRules ? <ScriptAgentTableRules /> : null}
    </div>
  );
}

function ScriptAgentRowsTable({
  onAddRow,
  onChange,
  rows,
}: {
  onAddRow: (afterIndex?: number) => void;
  onChange: (rows: ScriptAgentTableRow[]) => void;
  rows: ScriptAgentTableRow[];
}) {
  // @xiaxia-c-candidate-copy: allowed boardSlice is the editable C material candidate; compiler projects only allowed chainKey rows.
  return (
    <Table
      aria-label="讲解切片预览与编辑"
      className="script-agent-table"
      columns={createColumns(rows, onChange, onAddRow)}
      dataSource={rows}
      locale={{ emptyText: '等待 Agent 生成讲解切片。生成后会在这里展示，也可以先点“添加切片”手工填写。' }}
      pagination={false}
      rowKey={(row) => row.id}
      scroll={{ x: 860 }}
      size="small"
    />
  );
}

function createColumns(
  rows: ScriptAgentTableRow[],
  onChange: (rows: ScriptAgentTableRow[]) => void,
  onAddRow: (afterIndex?: number) => void,
): TableColumnsType<ScriptAgentTableRow> {
  return [
    {
      dataIndex: 'section',
      key: 'section',
      render: (_value, row, index) => (
        <Space className="script-agent-table-section-cell" size={6}>
          <Tooltip title="在这一行后添加切片">
            <Button aria-label="添加切片" icon={<PlusOutlined />} onClick={() => onAddRow(index)} size="small" type="text" />
          </Tooltip>
          <Select
            className="script-agent-table-section"
            onChange={(section) => onChange(updateRow(rows, index, { section }))}
            options={SCRIPT_SECTION_OPTIONS}
            size="small"
            value={row.section || SCRIPT_SECTION.SOLVING}
          />
        </Space>
      ),
      title: '分区',
      width: 170,
    },
    {
      dataIndex: 'stepLabel',
      key: 'stepLabel',
      render: (_value, row, index) => (
        <Input
          className="script-agent-table-step"
          onChange={(event) => onChange(updateRow(rows, index, { stepLabel: event.target.value }))}
          placeholder="步骤名"
          size="small"
          value={row.stepLabel}
        />
      ),
      title: '小标题',
      width: 150,
    },
    {
      dataIndex: 'boardSlice',
      key: 'boardSlice',
      render: (_value, row, index) => (
        <Input
          className="script-agent-table-board-slice"
          onChange={(event) => onChange(updateRow(rows, index, { boardSlice: event.target.value }))}
          placeholder="这一行要写到板书。"
          value={row.boardSlice}
        />
      ),
      title: '板书内容',
      width: 280,
    },
    {
      dataIndex: 'voiceText',
      key: 'voiceText',
      render: (_value, row, index) => (
        <TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          className="math-editor-input script-agent-table-voice-text"
          onChange={(event) => onChange(updateRow(rows, index, { voiceText: event.target.value }))}
          placeholder="这一行老师怎么讲。"
          value={row.voiceText}
        />
      ),
      title: '讲解内容',
      width: 360,
    },
    {
      key: 'actions',
      render: (_value, _row, index) => (
        <Space className="script-agent-table-row-actions" size={4}>
          <Tooltip title="添加切片">
            <Button icon={<PlusOutlined />} onClick={() => onAddRow(index)} size="small" />
          </Tooltip>
          <Tooltip title="上移">
            <Button disabled={index === 0} icon={<ArrowUpOutlined />} onClick={() => onChange(moveRow(rows, index, index - 1))} size="small" />
          </Tooltip>
          <Tooltip title="下移">
            <Button disabled={index === rows.length - 1} icon={<ArrowDownOutlined />} onClick={() => onChange(moveRow(rows, index, index + 1))} size="small" />
          </Tooltip>
          <Tooltip title="删除">
            <Button danger icon={<DeleteOutlined />} onClick={() => onChange(deleteRow(rows, index))} size="small" />
          </Tooltip>
        </Space>
      ),
      title: '操作',
      width: 180,
    },
  ];
}

function ScriptAgentTableToolbar({
  boardSliceCount,
  onAddRow,
  onCompile,
  rowCount,
  voiceTextCount,
}: {
  boardSliceCount: number;
  onAddRow: () => void;
  onCompile: () => void;
  rowCount: number;
  voiceTextCount: number;
}) {
  return (
    <div className="script-agent-table-toolbar">
      <Space align="center" wrap>
        <TableOutlined />
        <Text strong>讲解切片预览与编辑</Text>
      </Space>
      <Space align="center" wrap>
        <Tag color="geekblue">{rowCount} 行切片</Tag>
        <Tag color={voiceTextCount ? 'blue' : 'default'}>{voiceTextCount} 段讲解</Tag>
        <Tag color={boardSliceCount ? 'green' : 'default'}>{boardSliceCount} 个 C 素材候选</Tag>
        <Button icon={<PlusOutlined />} onClick={onAddRow} size="small">
          添加切片
        </Button>
        <Button onClick={onCompile} size="small" type="primary">
          刷新候选稿
        </Button>
      </Space>
    </div>
  );
}

function ScriptAgentTableRules() {
  return (
    <Collapse
      className="script-agent-table-rules"
      ghost
      items={[
        {
          children: (
            <div className="script-agent-table-rule">
              四连环：对话生成候选 rows，voiceText 生成 A 轨语音，boardSlice 生成 C 素材候选；A 返回真实时长后生成 B 寿命窗口，C 再接排版和演绎资产。唯一身份只看 chainKey：
              开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位，当前 boardSlice 必须留空；分析题目 A-template-pre 和梳理总结 A-template-end 可按需要填写 C 素材候选；正式解题步骤才允许 A1/B1/C1 递增。Agent 和用户不手写 &lt;br&gt;、&lt;b&gt; 或 Markdown 分段。
            </div>
          ),
          key: 'rules',
          label: <Text type="secondary">说明</Text>,
        },
      ]}
      size="small"
    />
  );
}

function updateRow(rows: ScriptAgentTableRow[], index: number, patch: Partial<ScriptAgentTableRow>): ScriptAgentTableRow[] {
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
}

function getRowMappingLabel(row: ScriptAgentTableRow): string {
  const labels = createAbcChainLabels(row.chainKey);
  if (!row.chainKey || row.chainKey === 'unbound') {
    return `${labels.a}+${labels.b}+${labels.c}`;
  }
  if (row.chainKey === 'template-open') {
    return labels.a;
  }
  if (row.chainKey.startsWith('step-') || (row.boardSlice.trim() && isBoardMaterialChainKey(row.chainKey))) {
    return `${labels.a}+${labels.b}+${labels.c}`;
  }
  return labels.a;
}

function getRowMappingHint(row: ScriptAgentTableRow): string {
  if (!row.chainKey || row.chainKey === 'unbound') {
    return row.boardSlice.trim()
      ? '未绑定 chainKey：不会伪装成正式 A/B/C 标签，请先选择明确分区后再生成正式素材。'
      : '未绑定 chainKey：当前只保留候选行，不生成正式 A/B/C 身份。';
  }
  if (row.section === SCRIPT_SECTION.OPENING) {
    return row.boardSlice.trim()
      ? '开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位；这行 boardSlice 当前会被 compiler 忽略，请移到分析题目或正式步骤。'
      : '开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位；当前 boardSlice 必须留空。';
  }
  if (row.section === SCRIPT_SECTION.ANALYSIS) {
    return row.boardSlice.trim()
      ? 'A-template-pre + B-template-pre/C-template-pre：强制保留占位符，支持具体用途标识如A-template-pre-analysis/B-template-pre-analysis/C-template-pre-analysis。'
      : 'A-template-pre / B-template-pre / C-template-pre：分析题目三轨占位保留对齐；需要上板时再填写 C 素材候选。';
  }
  if (row.section === SCRIPT_SECTION.SUMMARY) {
    return row.boardSlice.trim()
      ? 'A-template-end：梳理总结可填写 C 素材候选；A 返回真实时长后再生成 B 寿命。'
      : 'A-template-end / B-template-end / C-template-end：梳理总结三轨占位保留对齐；需要上板时再填写 C 素材候选。';
  }
  return row.boardSlice.trim()
    ? '正式解题步骤生成 A/B/C 数字链路，例如 A1/B1/C1，其中：\n• A1：语音主时钟和原始时间来源\n• B1：C1 的寿命/显示窗口，控制上台、下台和静态留场\n• C1：画布演员，拥有内容、位置、字号、书写速度和演绎资产\n\nB1 超过 A1 的尾巴只让 C1 静态留场；C1 书写速度由 C 书写速度控制，不由 B 寿命隐式改写。'
    : '正式解题步骤缺少 boardSlice 时不会生成 B 寿命和 C 演员；通常需要补 C 素材候选。';
}

function createEmptyRow(index: number): ScriptAgentTableRow {
  return {
    boardSlice: '',
    id: `manual-row-${Date.now()}-${index + 1}`,
    section: SCRIPT_SECTION.SOLVING,
    stepLabel: `第 ${index + 1} 步`,
    voiceText: '',
  };
}

function moveRow(rows: ScriptAgentTableRow[], fromIndex: number, toIndex: number): ScriptAgentTableRow[] {
  if (toIndex < 0 || toIndex >= rows.length) {
    return rows;
  }
  const nextRows = [...rows];
  const [movedRow] = nextRows.splice(fromIndex, 1);
  nextRows.splice(toIndex, 0, movedRow);
  return nextRows;
}

function deleteRow(rows: ScriptAgentTableRow[], index: number): ScriptAgentTableRow[] {
  return rows.filter((_, rowIndex) => rowIndex !== index);
}
