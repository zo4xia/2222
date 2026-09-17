// @cleanroom-module: scriptAgentDraft
// @domain: script-agent-interface
// @boundary: candidate draft state helpers only; no formal asset writes

import type { ScriptAgentDraft } from '../../domain/teachingProject';

export function hasScriptAgentDraftContent(draft: ScriptAgentDraft): boolean {
  return Boolean(draft.rows?.length || draft.spokenScript.trim() || draft.boardPlan.trim());
}

export function createScriptAgentDraftSignature(draft: ScriptAgentDraft): string {
  return JSON.stringify({
    boardPlan: draft.boardPlan,
    rows: draft.rows ?? [],
    spokenScript: draft.spokenScript,
  });
}
