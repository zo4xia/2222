// @cleanroom-module: workflow-step-sdk
// @domain: workflow-orchestration
// ID: cleanroom-workflow-step-sdk-contract-001
// @io-input: step props, TeachingProject fields, injected actions
// @io-output: step events, derived status, output fields
// @route: App shell / workflow tabs / future route slots
// @fields: declared inputFields/outputFields
// @boundary: contract only; does not own UI state or mutate TeachingProject directly

import type { ReactNode } from 'react';

export type WorkflowStepStatus = 'available' | 'needsInput' | 'ready' | 'done' | 'blocked';

export type WorkflowStepSdk = {
  id: string;
  title: string;
  routeSlot: string;
  inputFields: string[];
  outputFields: string[];
  events: string[];
  boundary: string;
  status?: WorkflowStepStatus;
  render: () => ReactNode;
};
