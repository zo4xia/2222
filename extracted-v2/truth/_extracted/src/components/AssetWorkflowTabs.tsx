// @cleanroom-component: AssetWorkflowTabs
// @domain: workflow-orchestration
// @slot: left-sider/asset-workflow-tabs
// @depends: WorkflowStepSdk[], AntD Tabs
// ID: cleanroom-assets-workflow-tabs-001
// @io-input: steps
// @io-output: active tab render only
// @route: App shell / left sider / asset room
// @fields: step.inputFields, step.outputFields
// @boundary: menu shell only; does not know step internals or mutate project

import { Tag, Typography } from 'antd';
import { useEffect } from 'react';
import type { WorkflowStepSdk } from '../workflow/workflowStepSdk';

const { Text } = Typography;

export function AssetWorkflowTabs({
  activeKey,
  onActiveKeyChange,
  steps,
}: {
  activeKey: string;
  onActiveKeyChange: (key: string) => void;
  steps: WorkflowStepSdk[];
}) {
  const activeStep = steps.find((step) => step.id === activeKey) ?? steps[0];
  const activeStepId = activeStep?.id;

  useEffect(() => {
    if (activeStepId && activeStepId !== activeKey) {
      onActiveKeyChange(activeStepId);
    }
  }, [activeKey, activeStepId, onActiveKeyChange]);

  if (!activeStep) {
    return null;
  }

  return (
    <section className="asset-step-panel">
      <div className="asset-step-panel-head">
        <Text type="secondary">当前步骤</Text>
        <Tag color="blue">{activeStep.title}</Tag>
      </div>
      <div className="asset-step-panel-body">{activeStep.render()}</div>
    </section>
  );
}
