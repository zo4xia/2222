// @cleanroom-module: scriptAgentTable
// @domain: script-agent-interface
// @boundary: candidate rows editing layer only; formal assets remain scriptText and boardLayout

import type { ScriptAgentDraftRow } from '../../domain/teachingProject';

export type ScriptAgentTableRow = ScriptAgentDraftRow;

export type ScriptAgentTableDraft = {
  rows: ScriptAgentTableRow[];
};
