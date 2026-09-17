const rowFieldNames = ['rows', 'scriptRows', 'script_rows', 'tableRows', 'table_rows', '步骤表', '表格', '分片表'];

export function readScriptAgentRows(source) {
  const rawRows = findRows(source);
  if (!Array.isArray(rawRows)) {
    return [];
  }

  const normalizedRows = rawRows
    .map((row, index) => normalizeScriptAgentRow(row, index))
    .filter((row) => row.voiceText || row.boardSlice || row.stepLabel);

  return normalizedRows.map((row) => ({
    ...row,
    chainKey: createRowChainKey(normalizedRows, row),
  }));
}

export function compileScriptAgentRowsToDraft(rows) {
  const normalizedRows = readScriptAgentRows({ rows });
  const spokenSegments = normalizedRows.map((row) => compileSpokenSegment(row)).filter(Boolean);
  const boardLines = normalizedRows
    .filter((row) => row.boardSlice && isBoardMaterialChainKey(row.chainKey))
    .map((row) => {
      const labels = createAbcChainLabels(row.chainKey);
      return `${labels.b}/${labels.c}：${row.boardSlice}`;
    });

  return {
    boardPlan: boardLines.join('\n'),
    rows: normalizedRows,
    spokenScript: spokenSegments.join('<br>'),
  };
}

function findRows(source) {
  if (!source || typeof source !== 'object') {
    return [];
  }

  for (const fieldName of rowFieldNames) {
    const value = source[fieldName];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const ownerName of ['draft', 'data', 'result', 'output', '生成结果', '产物']) {
    const owner = source[ownerName];
    if (owner && typeof owner === 'object' && !Array.isArray(owner)) {
      const rows = findRows(owner);
      if (rows.length) {
        return rows;
      }
    }
  }

  return [];
}

function normalizeScriptAgentRow(row, index) {
  const source = row && typeof row === 'object' ? row : {};
  const id = readString(source, ['id', 'rowId', 'row_id', '编号']) || `row-${index + 1}`;
  const section = readString(source, ['section', '环节', '分类', '模块']);
  const stepLabel = readString(source, ['stepLabel', 'step_label', 'step', 'title', '步骤', '步骤名称', '标题']);
  const voiceText = stripLegacyTags(readString(source, ['voiceText', 'voice_text', 'spokenText', 'spoken_text', '口播', '口播文稿', '讲解稿', '文稿']));
  const boardSlice = stripLegacyTags(readString(source, ['boardSlice', 'board_slice', 'boardText', 'board_text', '板书', '板书内容', '板书贴片', '写什么']));

  return {
    boardSlice,
    id,
    section,
    stepLabel,
    voiceText,
  };
}

function compileSpokenSegment(row) {
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

function readString(source, fieldNames) {
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

function normalizeWhitespace(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

function stripLegacyTags(text) {
  return normalizeWhitespace(text)
    .replace(/<\s*br\s*\/?\s*>/gi, ' ')
    .replace(/<\s*\/?\s*b\s*>/gi, '')
    .trim();
}

function stripTrailingPunctuation(text) {
  return text.trim().replace(/[。；;，,、\s]+$/u, '');
}

function createRowChainKey(rows, row) {
  if (row.section === '开场读题') {
    return 'template-open';
  }
  if (row.section === '分析题目') {
    return 'template-pre';
  }
  if (row.section === '梳理总结') {
    return 'template-end';
  }
  if (row.section !== '解题环节') {
    return 'unbound';
  }

  const stepIndex = rows.filter((candidate) => candidate.section === '解题环节').findIndex((candidate) => candidate.id === row.id) + 1;
  return stepIndex > 0 ? `step-${stepIndex}` : 'unbound';
}

function createAbcChainLabels(chainKey) {
  if (chainKey === 'template-open') {
    return { a: 'A-template-open', b: 'B-template-open', c: 'C-template-open' };
  }
  if (chainKey === 'template-pre') {
    return { a: 'A-template-pre', b: 'B-template-pre', c: 'C-template-pre' };
  }
  if (chainKey === 'template-end') {
    return { a: 'A-template-end', b: 'B-template-end', c: 'C-template-end' };
  }
  const match = String(chainKey ?? '').match(/^step-(\d+)$/);
  if (!match) {
    return { a: 'A-unbound', b: 'B-unbound', c: 'C-unbound' };
  }
  const stepIndex = Number.parseInt(match[1], 10);
  if (!Number.isFinite(stepIndex) || stepIndex <= 0) {
    return { a: 'A-unbound', b: 'B-unbound', c: 'C-unbound' };
  }
  const safeStepIndex = stepIndex;
  return { a: `A${safeStepIndex}`, b: `B${safeStepIndex}`, c: `C${safeStepIndex}` };
}

function isBoardMaterialChainKey(chainKey) {
  return chainKey === 'template-open' || chainKey === 'template-pre' || chainKey === 'template-end' || /^step-(\d+)$/.test(String(chainKey ?? ''));
}
