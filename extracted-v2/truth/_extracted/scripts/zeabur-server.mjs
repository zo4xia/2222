import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFeishuBoardScriptImportResponse } from './feishu-board-script-import.mjs';
import {
  compileScriptAgentRowsToDraft,
  readScriptAgentRows,
} from './script-agent-rows-contract.mjs';
import { loadLocalEnv } from './load-local-env.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distRoot = join(projectRoot, 'dist');
const port = Number(process.env.PORT || process.env.ZEABUR_PORT || 3000);
const recentFeishuImports = [];

if (!Number.isFinite(port) || port <= 0) {
  throw new Error(`Invalid PORT: ${process.env.PORT || process.env.ZEABUR_PORT}`);
}

loadLocalEnv({ cwd: projectRoot });

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;

    if (request.method === 'OPTIONS') {
      sendCors(response);
      response.statusCode = 204;
      response.end();
      return;
    }

    if (pathname === '/api/health') {
      sendJson(response, 200, {
        service: 'cleanroom-zeabur-node',
        status: 'ok',
      });
      return;
    }

    if (pathname === '/api/feishu/board-script/import') {
      await handleFeishuImport(request, response);
      return;
    }

    if (pathname === '/api/feishu/board-script/import/latest') {
      sendJson(response, 200, {
        imports: recentFeishuImports,
        status: 'ok',
      });
      return;
    }

    if (pathname === '/api/agent/script-board') {
      await handleScriptBoardAgent(request, response);
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(response, 404, {
        error: { code: 'API_NOT_FOUND', message: `${pathname} is not implemented in production server.` },
        status: 'failed',
      });
      return;
    }

    await serveStaticOrSpaFallback(pathname, response);
  } catch (error) {
    sendJson(response, 500, {
      error: {
        code: 'ZEABUR_SERVER_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
      status: 'failed',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`cleanroom zeabur node server listening on 0.0.0.0:${port}`);
});

async function handleFeishuImport(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, status: 'failed' });
    return;
  }

  const secret = (process.env.FEISHU_WEBHOOK_SECRET || '').trim();
  const secretHeaderName = (process.env.FEISHU_WEBHOOK_SECRET_HEADER || 'X-Feishu-Webhook-Secret').trim();
  if (secret) {
    const receivedSecret = request.headers[secretHeaderName.toLowerCase()];
    if (receivedSecret !== secret) {
      sendJson(response, 401, {
        error: { code: 'INVALID_FEISHU_WEBHOOK_SECRET', message: `${secretHeaderName} is invalid.` },
        status: 'failed',
      });
      return;
    }
  }

  const body = await readJsonBody(request);
  const importResponse = createFeishuBoardScriptImportResponse(body, { secretConfigured: Boolean(secret) });
  rememberFeishuImport(importResponse);
  sendJson(response, 200, importResponse);
}

function rememberFeishuImport(importResponse) {
  const importPayload = importResponse.import || {};
  const draft = importPayload.draft || {};
  const summary = {
    boardPlanLength: String(draft.boardPlan || '').length,
    mappingStatus: importResponse.mappingStatus,
    problemTextPreview: String(importPayload.problemText || '').slice(0, 80),
    receivedAt: importResponse.receivedAt,
    sourceRecordId: importPayload.sourceRecordId || '',
    spokenScriptLength: String(draft.spokenScript || '').length,
    status: importResponse.status,
  };

  recentFeishuImports.unshift(summary);
  recentFeishuImports.splice(20);
  console.log(
    `[feishu-import] status=${summary.status} sourceRecordId=${summary.sourceRecordId || '-'} spoken=${summary.spokenScriptLength} board=${summary.boardPlanLength}`,
  );
}

async function handleScriptBoardAgent(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' }, status: 'failed' });
    return;
  }

  try {
    const body = await readJsonBody(request);
    const config = body.config && typeof body.config === 'object' ? body.config : {};
    const apiKeyRef = typeof config.apiKeyRef === 'string' && config.apiKeyRef.trim() ? config.apiKeyRef.trim() : 'DASHSCOPE_API_KEY';
    const apiKey = process.env[apiKeyRef];
    if (!apiKey) {
      sendJson(response, 500, {
        error: { code: 'MISSING_SCRIPT_AGENT_API_KEY', message: `${apiKeyRef} is missing.` },
        status: 'failed',
      });
      return;
    }

    const problemText = typeof body.problemText === 'string' ? body.problemText.trim() : '';
    if (!problemText) {
      sendJson(response, 400, {
        error: { code: 'MISSING_PROBLEM_TEXT', message: 'problemText is required.' },
        status: 'failed',
      });
      return;
    }

    const agentResult = await requestScriptBoardAgent({
      apiKey,
      config,
      problemText,
      revisionPrompt: typeof body.revisionPrompt === 'string' ? body.revisionPrompt.trim() : '',
    });

    sendJson(response, 200, {
      draft: agentResult.draft,
      model: agentResult.model,
      requestId: agentResult.requestId,
      status: 'ok',
    });
  } catch (error) {
    sendJson(response, 500, {
      error: {
        code: 'SCRIPT_AGENT_GATEWAY_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
      status: 'failed',
    });
  }
}

async function serveStaticOrSpaFallback(pathname, response) {
  const candidatePath = resolveStaticPath(pathname);
  const filePath = candidatePath && existsSync(candidatePath) && (await stat(candidatePath)).isFile() ? candidatePath : join(distRoot, 'index.html');

  if (!existsSync(filePath)) {
    sendJson(response, 500, {
      error: { code: 'DIST_NOT_FOUND', message: 'dist/index.html is missing. Run npm run build first.' },
      status: 'failed',
    });
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', getContentType(filePath));
  createReadStream(filePath).pipe(response);
}

function resolveStaticPath(pathname) {
  const decodedPath = decodeURIComponent(pathname.split('?')[0] || '/');
  const safeRelativePath = normalize(decodedPath).replace(/^([/\\])+/, '');
  const filePath = resolve(distRoot, safeRelativePath || 'index.html');
  if (filePath !== distRoot && !filePath.startsWith(`${distRoot}${sep}`)) {
    return '';
  }
  return filePath;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024 * 1024) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  if (!rawBody.trim()) {
    return {};
  }
  return JSON.parse(rawBody);
}

function sendCors(response) {
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Feishu-Webhook-Secret');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Origin', '*');
}

function sendJson(response, statusCode, payload) {
  sendCors(response);
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function requestScriptBoardAgent({ apiKey, config, problemText, revisionPrompt }) {
  const endpoint =
    typeof config.endpoint === 'string' && config.endpoint.trim()
      ? config.endpoint.trim()
      : 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const model = typeof config.modelName === 'string' && config.modelName.trim() ? config.modelName.trim() : 'qwen3.6-flash';
  const systemPrompt = [
    typeof config.promptSystem === 'string' ? config.promptSystem.trim() : '',
    '请严格输出 JSON，不要输出 Markdown。必须输出 {"rows":[{"id":"row-1","section":"开场读题","stepLabel":"读题","voiceText":"口播内容","boardSlice":"板书内容或空字符串"}]}。一行 rows 是一个候选 A 轨语音切片；开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位；当前 boardSlice 必须留空；正式解题步骤才允许 A1/B1/C1 递增，boardSlice 写核心 C 素材候选。不要输出 spokenScript/boardPlan；表格模式不要手写 <br> 或 <b>。语气要求：易懂短句，不端着，不硬拗术语。',
  ]
    .filter(Boolean)
    .join('\n\n');
  const template =
    typeof config.promptUserTemplate === 'string' && config.promptUserTemplate.trim()
      ? config.promptUserTemplate
      : '请基于已确认题文生成 rows 表格候选稿。一行 rows 是一个候选 A 轨语音切片；开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位，当前 boardSlice 必须留空；正式解题步骤才允许 A1/B1/C1 递增，boardSlice 写核心 C 素材候选；Agent 和用户不要手写 <br> / <b> / ##。题文：{{problemText}}';
  const userPrompt = [
    template.replaceAll('{{problemText}}', problemText).replaceAll('{{problemInput}}', problemText),
    revisionPrompt ? `用户补充要求：${revisionPrompt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const providerResponse = await fetch(endpoint, {
    body: JSON.stringify({
      enable_thinking: true,
      messages: [
        { content: systemPrompt, role: 'system' },
        { content: userPrompt, role: 'user' },
      ],
      model,
      stream: false,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const providerText = await providerResponse.text();
  if (!providerResponse.ok) {
    throw new Error(`HTTP ${providerResponse.status} ${sanitizeProviderText(providerText, apiKey)}`.trim());
  }

  const payload = JSON.parse(providerText);
  const content = payload.choices?.[0]?.message?.content;
  const draft = parseScriptAgentDraft(typeof content === 'string' ? content : '');
  return {
    draft,
    model,
    requestId: payload.request_id || payload.requestId || payload.id || '',
  };
}

function parseScriptAgentDraft(content) {
  const normalized = content.trim();
  if (!normalized) {
    throw new Error('Agent returned empty content.');
  }

  const jsonText = extractJsonObject(normalized);
  if (jsonText) {
    const parsed = JSON.parse(jsonText);
    const rows = readScriptAgentRows(parsed);
    if (rows.length) {
      return compileScriptAgentRowsToDraft(rows);
    }
  }

  throw new Error('Agent 必须返回 rows 表格候选 JSON；不要返回 spokenScript/boardPlan、Markdown 或普通正文。');
}

function extractJsonObject(content) {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : content;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return '';
  }
  return candidate.slice(start, end + 1);
}

function sanitizeProviderText(text, apiKey) {
  let sanitized = String(text || '').slice(0, 500);
  if (apiKey) {
    sanitized = sanitized.replaceAll(apiKey, '***api-key***');
  }
  return sanitized;
}

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}
