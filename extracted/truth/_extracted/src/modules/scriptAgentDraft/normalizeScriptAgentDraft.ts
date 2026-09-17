// @cleanroom-module: scriptAgentDraft
// @domain: script-agent-interface
// @boundary: candidate formatting gate only; does not generate content or create a second truth

import type { ScriptAgentDraft } from '../../domain/teachingProject';
import { compileScriptAgentTableDraft } from '../scriptAgentTable/compileScriptAgentTableDraft';
import { normalizeScriptAgentTableRows } from '../scriptAgentTable/normalizeScriptAgentTableDraft';
import { repairCommonLatexEscapeDamage } from '../speechText/aliyunMathSpeechText';

export function normalizeScriptAgentDraft(draft: Partial<ScriptAgentDraft> | null | undefined): ScriptAgentDraft {
  const rows = normalizeScriptAgentTableRows(draft?.rows);
  if (rows.length) {
    return compileScriptAgentTableDraft({ rows });
  }

  return {
    boardPlan: normalizeBoardPlan(draft?.boardPlan ?? ''),
    spokenScript: normalizeSpokenScript(draft?.spokenScript ?? ''),
  };
}

function normalizeSpokenScript(text: string): string {
  return normalizeCommonDraftText(text)
    .replace(/<\s*br\s*\/?\s*>/gi, '<br>')
    .replace(/(?:<br>){2,}/g, '<br>');
}

function normalizeBoardPlan(text: string): string {
  return normalizeCommonDraftText(text);
}

function normalizeCommonDraftText(text: string): string {
  const normalizedTags = String(text)
    .replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '<br>')
    .replace(/&lt;\s*b\s*&gt;/gi, '<b>')
    .replace(/&lt;\s*\/\s*b\s*&gt;/gi, '</b>')
    .replace(/<\s*strong\s*>/gi, '<b>')
    .replace(/<\s*\/\s*strong\s*>/gi, '</b>')
    .replace(/<\s*b\s*>/gi, '<b>')
    .replace(/<\s*\/\s*b\s*>/gi, '</b>');

  return repairCommonLatexEscapeDamage(normalizedTags)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}
