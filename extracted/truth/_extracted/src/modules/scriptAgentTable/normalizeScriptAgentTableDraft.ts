import type { ScriptAgentTableRow } from './types';
import { createRowChainKey } from '../abcChain/abcChainKey';

export function normalizeScriptAgentTableRows(rows: unknown): ScriptAgentTableRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalizedRows = rows
    .map((row, index) => normalizeScriptAgentTableRow(row, index))
    .filter((row) => row.voiceText || row.boardSlice || row.stepLabel);

  return normalizedRows.map((row) => ({
    ...row,
    chainKey: createRowChainKey(normalizedRows, row),
  }));
}

function normalizeScriptAgentTableRow(row: unknown, index: number): ScriptAgentTableRow {
  const source = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  return {
    boardSlice: stripLegacyTags(readString(source, ['boardSlice', 'board_slice', 'boardText', 'board_text', '板书', '板书内容', '板书贴片', '写什么'])),
    id: readString(source, ['id', 'rowId', 'row_id', '编号']) || `row-${index + 1}`,
    section: readString(source, ['section', '环节', '分类', '模块']),
    stepLabel: readString(source, ['stepLabel', 'step_label', 'step', 'title', '步骤', '步骤名称', '标题']),
    voiceText: stripLegacyTags(readString(source, ['voiceText', 'voice_text', 'spokenText', 'spoken_text', '口播', '口播文稿', '讲解稿', '文稿'])),
  };
}

function readString(source: Record<string, unknown>, fieldNames: string[]): string {
  for (const fieldName of fieldNames) {
    const value = source[fieldName];
    if (typeof value === 'string' && value.trim()) {
      return normalizeWhitespace(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function normalizeWhitespace(text: string): string {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function stripLegacyTags(text: string): string {
  return normalizeWhitespace(text)
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/?\s*b\s*>/gi, '')
    .trim();
}
