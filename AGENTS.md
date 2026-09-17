# Base44 Dev Environment

## Overview
Vue 3 + Vite single-page app. The backend runs as Vite dev-server middleware
plugins (see `vite.config.js` → `server/` handlers). There is no separate API
process — `npm run dev` serves everything on port 3000.

## Running
```
docker compose -f docker-compose.base44.yml up -d
```
Uses `node:22-bookworm-slim`, bind-mounts the repo, runs `npm install` then
`npm run dev` (Vite with HMR). Edits to source appear live in the preview.

## Architecture notes
- **LLM API keys are user-supplied at runtime** via the frontend "Agent 配置"
  UI. The server reads them from the request body (`resolveUserCredentials`
  in `server/http.js`). No env-var credentials are required to boot.
- **Fish Audio TTS** (`server/fishAudioHandler.js`) has hardcoded default keys
  and works out of the box. Optionally override with `FISH_AUDIO_API_KEY` /
  `FISH_AUDIO_API_KEYS` env vars.
- `CORS_ORIGINS` and `UPSTREAM_HOSTS` env vars are optional allowlists;
  when unset, no restriction is applied.
- The production `Dockerfile` and `docker-compose.yml` build a prebuilt
  bundle — do NOT use those for dev (they freeze source). Use
  `docker-compose.base44.yml` instead.

## Entry points
- Main app: `index.html` → `src/main.js` → `src/App.vue`
- Additional HTML entries: `agent-b-v2.html`, `board-preview.html`
- Server plugins: `server/*.js` (registered in `vite.config.js`)

## Verification
- `curl http://localhost:3000/` → 200 with `@vite/client` (confirms dev server)
- `curl http://localhost:3000/src/main.js` → 200 (confirms source serving)
