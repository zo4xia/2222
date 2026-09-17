# ============================================================
# clean-package · Zeabur / Ubuntu 服务器 Docker 部署包
# 构建链路：vite build -> dist；运行：node server/productionServer.js
# 真相源：package.json / vite.config.js / server/productionServer.js
# ============================================================

# ---------- Stage 1：构建前端（含 devDeps：vite） ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# 先拷锁文件装依赖，利用 Docker 层缓存（源码改动不重装 node_modules）
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 拷源码树：server/* 被 vite.config 加载；src/、doc/ 被 server 端 import/读取，必须全带
COPY index.html board-preview.html vite.config.js ./
COPY server ./server
COPY src ./src
COPY doc ./doc
COPY public ./public

RUN npm run build

# ---------- Stage 2：生产运行（仅运行时依赖） ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 运行时依赖（--omit=dev：vite/eslint 等构建工具不进镜像）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# 运行镜像四件套：dist（前端产物）+ server（HTTP 服务）+ src（被 server import）+ doc（知识库）
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/doc ./doc
# public 预置内容（静态源 + 目录骨架）；运行时数据子目录由各 handler mkdirSync 自愈，
# 持久化请挂载卷到 /app/public（见 docker-compose.yml / Zeabur Storage）
COPY --from=build /app/public ./public
RUN mkdir -p public/audio-cache public/deliverable public/handoff public/pic public/board-result

EXPOSE 3000
CMD ["node", "server/productionServer.js"]
