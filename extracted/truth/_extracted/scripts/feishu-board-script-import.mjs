export const FEISHU_IMPORT_ACCEPTED_FIELDS = [
  'problemText',
  'boardScriptText',
  'speechMarkedScript',
  'sourceRecordId',
];

export const FEISHU_IMPORT_VISIBLE_FIELD_HINTS = ['任务编号', '测试2', '测试2.输出结果'];

export function createFeishuBoardScriptImportResponse(payload, options = {}) {
  const normalizedImport = normalizeFeishuBoardScriptPayload(payload);
  const hasDraft = Boolean(normalizedImport.draft.spokenScript || normalizedImport.draft.boardPlan);

  return {
    acceptedFields: FEISHU_IMPORT_ACCEPTED_FIELDS,
    import: normalizedImport,
    mappingStatus: normalizedImport.problemText ? 'problemText_ready' : 'problemText_missing',
    receivedAt: options.receivedAt || new Date().toISOString(),
    status: hasDraft ? 'ok' : 'needs_mapping',
    visibleFeishuFieldHints: FEISHU_IMPORT_VISIBLE_FIELD_HINTS,
    warning: options.secretConfigured ? '' : 'FEISHU_WEBHOOK_SECRET is not set; debug import accepted without secret.',
  };
}

export function normalizeFeishuBoardScriptPayload(payload) {
  const fields = collectFeishuCandidateFields(payload);
  const explicitProblemText = readFirstPayloadText(fields, [
    'problemText',
    'problem_text',
    'question_content',
    'questionContent',
    '题目',
    '题目内容',
    '题文',
    '问题',
  ]);
  const boardScriptText = readFirstPayloadText(fields, [
    'boardScriptText',
    'board_script_text',
    'boardScript',
    'board_script',
    'script_board',
    '板书-文稿',
    '板书文稿',
    '板书内容',
    '讲解稿',
    '文稿',
    '测试2',
    '测试2.输出结果',
    'AI输出结果',
    '输出结果',
  ]);
  const speechMarkedScript = readFirstPayloadText(fields, [
    'speechMarkedScript',
    'speech_marked_script',
    'spokenScript',
    'spoken_script',
    'voiceScript',
    'voice_script',
    '语音标记文稿',
    '口播文稿',
    '口播稿',
    '测试2.输出结果',
    'AI输出结果',
    '输出结果',
  ]);
  const sourceRecordId = readFirstPayloadText(fields, [
    'sourceRecordId',
    'source_record_id',
    'record_id',
    'recordId',
    'task_id',
    'taskId',
    '任务ID',
    '任务 id',
    '任务编号',
  ]);

  const speechSections = parseTeachingOutputSections(speechMarkedScript);
  const boardSections = parseTeachingOutputSections(boardScriptText);

  return {
    draft: {
      boardPlan: boardSections.boardPlan || speechSections.boardPlan || boardScriptText,
      spokenScript: speechSections.spokenScript || boardSections.spokenScript || speechMarkedScript || boardScriptText,
    },
    problemText: explicitProblemText || speechSections.problemText || boardSections.problemText,
    sourceRecordId: sourceRecordId || undefined,
  };
}

export function parseTeachingOutputSections(text) {
  const normalizedText = normalizeFeishuPayloadText(text).replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!normalizedText) {
    return {
      boardPlan: '',
      problemText: '',
      spokenScript: '',
    };
  }

  const sections = {
    boardPlan: '',
    problemText: '',
    spokenScript: '',
  };
  const headerPattern = /【\s*(题目识别|口播文稿|板书内容)\s*】\s*[：:]?/g;
  const matches = Array.from(normalizedText.matchAll(headerPattern));

  if (matches.length === 0) {
    return sections;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const nextMatch = matches[index + 1];
    const header = match[1];
    const start = match.index + match[0].length;
    const end = nextMatch ? nextMatch.index : normalizedText.length;
    const content = normalizedText.slice(start, end).trim();

    if (header === '题目识别') {
      sections.problemText = content;
    }
    if (header === '口播文稿') {
      sections.spokenScript = content;
    }
    if (header === '板书内容') {
      sections.boardPlan = content;
    }
  }

  return sections;
}

function collectFeishuCandidateFields(payload) {
  const merged = {};
  mergePlainObject(merged, payload);
  mergePlainObject(merged, payload?.fields);
  mergePlainObject(merged, payload?.record);
  mergePlainObject(merged, payload?.record?.fields);
  mergePlainObject(merged, payload?.data);
  mergePlainObject(merged, payload?.data?.fields);
  mergePlainObject(merged, payload?.event);
  mergePlainObject(merged, payload?.event?.fields);
  mergePlainObject(merged, payload?.event?.record);
  mergePlainObject(merged, payload?.event?.record?.fields);
  return merged;
}

function mergePlainObject(target, source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (target[key] === undefined) {
      target[key] = value;
    }
  }
}

function readFirstPayloadText(source, fieldNames) {
  for (const fieldName of fieldNames) {
    const directValue = source[fieldName];
    const normalizedDirectValue = normalizeFeishuPayloadText(directValue);
    if (normalizedDirectValue) {
      return normalizedDirectValue;
    }

    const normalizedFieldName = normalizeFieldName(fieldName);
    const matchedEntry = Object.entries(source).find(([candidateName]) => normalizeFieldName(candidateName) === normalizedFieldName);
    if (matchedEntry) {
      const normalizedMatchedValue = normalizeFeishuPayloadText(matchedEntry[1]);
      if (normalizedMatchedValue) {
        return normalizedMatchedValue;
      }
    }
  }

  return '';
}

function normalizeFieldName(fieldName) {
  return String(fieldName).replace(/[\s_-]+/g, '').toLowerCase();
}

function normalizeFeishuPayloadText(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).replace(/\r\n/g, '\n').trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFeishuPayloadText(item)).filter(Boolean).join('\n').trim();
  }

  if (typeof value === 'object') {
    for (const key of ['text', 'name', 'value', 'url', 'link', 'id']) {
      const normalizedValue = normalizeFeishuPayloadText(value[key]);
      if (normalizedValue) {
        return normalizedValue;
      }
    }
  }

  return '';
}
