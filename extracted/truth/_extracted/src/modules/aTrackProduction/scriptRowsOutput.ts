// @boundary: A Track Production Kit script rows output only.
// Converts current candidate rows to Protocol ScriptRowDraft without touching TTS, stage, B/C timeline, or board rendering.

import type { ScriptAgentDraft } from '../../domain/teachingProject';
import type { ScriptRow, ScriptRowDraft } from '../../protocols';
import { normalizeScriptAgentTableRows } from '../scriptAgentTable/normalizeScriptAgentTableDraft';
import type { ScriptAgentTableRow } from '../scriptAgentTable/types';

export type ATrackScriptRowsOutput = ScriptRowDraft;

export function createATrackScriptRowsOutput(rows: unknown): ATrackScriptRowsOutput {
  return {
    rows: normalizeScriptAgentTableRows(rows).map(toProtocolScriptRow),
  };
}

export function createATrackScriptRowsOutputFromDraft(draft: Pick<ScriptAgentDraft, 'rows'>): ATrackScriptRowsOutput {
  return createATrackScriptRowsOutput(draft.rows);
}

function toProtocolScriptRow(row: ScriptAgentTableRow): ScriptRow {
  return {
    boardSlice: row.boardSlice,
    id: row.id,
    section: row.section,
    stepLabel: row.stepLabel,
    voiceText: row.voiceText,
  };
}
