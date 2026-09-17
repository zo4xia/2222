# syntax=docker/dockerfile:1
# clean-package · Zeabur / Docker deployment
# Build: Vite -> /app/dist; runtime: the Node HTTP server on $PORT.

# ---------- Stage 1: build the frontend ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Keep npm's behavior deterministic and make the build independent of the
# environment variables that Zeabur may inject into the build container.
ENV NODE_ENV=development

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

# Vite loads the server-side proxy modules from vite.config.js while building.
# These directories therefore have to be present in the build stage even
# though they are not bundled into the browser output.
COPY index.html board-preview.html vite.config.js ./
COPY server ./server
COPY src ./src
COPY doc ./doc
COPY public ./public

RUN npm run build

# ---------- Stage 2: production runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# The production server imports server/src modules and reads the knowledge
# base from doc at runtime. Keep all of those runtime inputs in the image.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/doc ./doc
COPY --from=build /app/public ./public

# Runtime writes are intentionally kept under public. Zeabur can mount a
# persistent volume at /app/public; the directories are also created on a
# fresh, volume-less deployment.
RUN mkdir -p \
    /app/public/audio \
    /app/public/audio-cache \
    /app/public/board-result \
    /app/public/deliverable \
    /app/public/handoff \
    /app/public/pic \
    && chown -R node:node /app

USER node
EXPOSE 3000

# Zeabur supplies PORT at runtime; productionServer.js reads it directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000)).then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server/productionServer.js"]
