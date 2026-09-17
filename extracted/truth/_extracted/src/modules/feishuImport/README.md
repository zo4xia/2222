# feishuImport

`feishuImport` owns the contract for importing rows from Feishu Bitable / automation.

- Input: a normalized row payload from Feishu automation or a pasted JSON row.
- Output: internal problem text plus a `ScriptAgentDraft` candidate.
- Boundary: no HTTP, no Feishu token, no UI, no TTS request, no timeline mutation.

Current target fields:

- `problemText`: 题目文本。
- `boardScriptText`: 飞书生成好的板书-文稿合并内容。
- `speechMarkedScript`: 带阿里云语音符号/口播标记的文稿，可选。
- `sourceRecordId`: 飞书记录 ID，可选。

The gateway endpoint receives Feishu POST payloads, normalizes them, and returns a candidate for the app's third step before any store write.

## debug receive endpoint

Current Zeabur / gateway receive endpoint:

```text
POST /api/feishu/board-script/import
```

Full debug URL on the current Zeabur service:

```text
https://80800.zeabur.app/api/feishu/board-script/import
```

This endpoint is only an import/debug receiver:

- It accepts Feishu automation HTTP POST payloads.
- It normalizes visible Feishu fields into a `ScriptAgentDraft` candidate.
- It can split the current combined Feishu output template into sections:
  - `【题目识别】` -> `problemText` fallback.
  - `【口播文稿】` -> `draft.spokenScript`.
  - `【板书内容】` -> `draft.boardPlan`.
- It returns what it parsed so Feishu "运行日志" can be checked.
- It does not write `TeachingProject`.
- It does not start TTS.
- It does not generate timeline clips.

Recommended first debug body:

```json
{
  "任务编号": "3",
  "测试2.输出结果": "{{测试2.输出结果}}"
}
```

If Feishu can map fields by stable English keys, prefer:

```json
{
  "sourceRecordId": "{{任务编号}}",
  "speechMarkedScript": "{{测试2.输出结果}}",
  "boardScriptText": "{{测试2.输出结果}}"
}
```

The intended insertion point is the app's third step:

```text
Feishu result
  -> /api/feishu/board-script/import
  -> ScriptAgentDraft candidate
  -> 文稿/板书确认
  -> user applies draft
  -> A/B segment confirmation
  -> TTS
```

Do not send Feishu output directly to TTS.

## production server boundary

The live Zeabur service must run `scripts/zeabur-server.mjs`, not a static Caddy-only deployment.

- `scripts/feishu-board-script-import.mjs` owns the production payload parser used by both the Node server and the Vite dev gateway.
- `scripts/zeabur-server.mjs` serves `dist` and handles `GET /api/health` plus `POST /api/feishu/board-script/import`.
- `GET /api/feishu/board-script/import/latest` returns the latest in-memory debug receipt summaries for checking whether Feishu reached the server.
- `Dockerfile` exists so Zeabur builds a Node runtime image instead of auto-selecting `zeabur/caddy-static`.
- `npm run start` now runs the production Node server.

If the live endpoint returns `405 Method Not Allowed` with `Allow: GET, HEAD`, Zeabur is still serving static Caddy and the Docker/Node runtime has not taken effect.

## lark-cli debug path

`tool/cli-main` is a local reference copy of the official `lark-cli` project. It is for development/debugging only and stays under ignored `tool/` assets.

Use it to inspect Feishu Bitable shape before wiring automation:

- Read `tool/cli-main/skills/lark-base/SKILL.md` before Base operations.
- Use `lark-cli base +field-list` first when field IDs/types are unclear.
- Use `lark-cli base +record-get` when `record_id` is known.
- Use `lark-cli base +record-search` only for keyword search.
- Use `lark-cli base +record-list` for normal row previews or exports.
- Do not guess field names from natural language; map real Feishu fields to this module's input contract.

## production path

The production path should remain:

1. Feishu Bitable / automation generates or stores the teaching row.
2. Feishu automation sends a POST payload to our backend/gateway.
3. The gateway normalizes field names and calls the shared Feishu import parser.
4. The frontend receives only safe teaching data, never Feishu app credentials or user tokens.

Recommended Feishu field mapping:

| Feishu field | Import field | Notes |
| --- | --- | --- |
| `题目` | `problemText` | Problem text recognized or manually edited in Feishu. |
| `板书-文稿` | `boardScriptText` | Board/script combined draft from Feishu workflow. |
| `语音标记文稿` | `speechMarkedScript` | Optional Aliyun-ready speech text; falls back to `boardScriptText`. |
| `record_id` | `sourceRecordId` | Optional trace ID for debugging and regeneration. |
