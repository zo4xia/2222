import type { ScriptAgentDraft } from '../../domain/teachingProject';
import { createAbcChainLabels, isBoardMaterialChainKey } from '../abcChain/abcChainKey';
import { normalizeScriptAgentTableRows } from './normalizeScriptAgentTableDraft';
import type { ScriptAgentTableDraft, ScriptAgentTableRow } from './types';

export function compileScriptAgentTableDraft(tableDraft: ScriptAgentTableDraft): ScriptAgentDraft {
  const rows = normalizeScriptAgentTableRows(tableDraft.rows);
  const spokenScript = rows.map((row) => compileSpokenSegment(row)).filter(Boolean).join('<br>');
  const boardPlan = rows
    .filter((row) => row.boardSlice && isBoardMaterialChainKey(row.chainKey))
    .map((row) => {
      const labels = createAbcChainLabels(row.chainKey);
      return `${labels.b}/${labels.c}：${row.boardSlice}`;
    })
    .join('\n');

  return {
    boardPlan,
    rows,
    spokenScript,
  };
}

function compileSpokenSegment(row: ScriptAgentTableRow): string {
  const voiceText = stripTrailingPunctuation(row.voiceText);
  const boardSlice = row.boardSlice.trim();
  const shouldProjectBoardSlice = isBoardMaterialChainKey(row.chainKey);

  if (!shouldProjectBoardSlice) {
    return row.voiceText.trim();
  }

  if (!voiceText && boardSlice) {
    return `<b>${boardSlice}</b>`;
  }

  if (!boardSlice) {
    return row.voiceText.trim();
  }

  if (voiceText.includes(boardSlice)) {
    return `${voiceText.replace(boardSlice, `<b>${boardSlice}</b>`)}。`;
  }

  return `${voiceText}，<b>${boardSlice}</b>。`;
}

function stripTrailingPunctuation(text: string): string {
  return text.trim().replace(/[。；;，,、\s]+$/u, '');
}
