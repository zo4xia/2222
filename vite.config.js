import { defineConfig } from 'vite'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'
import { createRecognitionProxyPlugin } from './server/recognitionHandler.js'
import { agentBV2ProxyPlugin } from './server/agentBV2Handler.js'
import { checkAgentProxyPlugin } from './server/checkAgentHandler.js'
import { knowledgeRefinePlugin } from './server/knowledgeRefineHandler.js'
import { handoffStorePlugin } from './server/handoffStoreHandler.js'
import { screenshotStorePlugin } from './server/screenshotStoreHandler.js'
import { deliverableStorePlugin } from './server/deliverableStoreHandler.js'
import { fishAudioPlugin } from './server/fishAudioHandler.js'
import { cleanupPlugin } from './server/cleanupHandler.js'
import { AGENT_A_KNOWLEDGE_BASE } from './server/docReferences.js'

const projectRoot = dirname(fileURLToPath(import.meta.url))

// ─────────────────────────────────────────────────────────────────────────────
// ★ Task 12 紧急修复 (2026-09-21): 删除 CDN external 配置
//
// 原因: Task 1/6 的 cdnExternalPlugin 把 vue external 到 esm.sh 引发两个阻断 bug:
//  ① dev 模式: esm.sh vue 是生产版, 无 __VUE_HMR_RUNTIME__ → HMR 报错
//  ② build 模式: rollupOptions.external 外置但 rollup 不改写 bare import
//     → dist 里仍是 `import "vue"` → 浏览器原生 ESM 报
//     "Failed to resolve module specifier 'vue'. Relative references must start..."
//
// 修复方案: dev + build 都走本地 node_modules (vite 预打包 / rollup 打包)
//  - 代价: build 产物变大 (vue + ant-design-vue + rough-notation + roughjs + katex 全部打包)
//  - 优点: 0 风险, HMR 正常, 部署能跑
//  - 后续优化: 如果需要 CDN 减小体积, 用 importmap + vite-plugin-cdn-import (v3 升级)
// ─────────────────────────────────────────────────────────────────────────────

function healthAndMockPlugin() {
  return {
    name: 'health-and-mock-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            ok: true,
            status: 'healthy',
            service: 'qinghuabu-vite-dev',
            timestamp: new Date().toISOString(),
          }))
          return
        }
        if (url.pathname === '/api/mock/problem') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            ok: true,
            data: {
              problemText: '一块平行四边形菜地，底是 30 米，高是 15 米。如果每平方米种 6 棵白菜，这块菜地一共可以种多少棵白菜？',
              problemType: '计算应用题',
              suggestedGrade: '四年级',
              boardFocus: '列式计算、四区排版、平行四边形面积公式',
              relatedKnowledge: ['平行四边形的面积', '乘法运算应用'],
            },
          }))
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    healthAndMockPlugin(),
    createRecognitionProxyPlugin({ knowledgeBase: AGENT_A_KNOWLEDGE_BASE }),
    agentBV2ProxyPlugin(),
    checkAgentProxyPlugin(),
    knowledgeRefinePlugin(),
    handoffStorePlugin(),
    screenshotStorePlugin(),
    deliverableStorePlugin(),
    fishAudioPlugin(),
    cleanupPlugin(),
  ],
  // ★ Task 12: optimizeDeps 不再 exclude 任何包，让 vite 预打包 vendor 到 .vite/deps
  // 这样 dev 模式 HMR 正常 (vite 注入的 __VUE_HMR_RUNTIME__ 由本地 vue dev 版提供)
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        'board-preview': resolve(projectRoot, 'board-preview.html'),
        'agent-b-v2': resolve(projectRoot, 'agent-b-v2.html'),
      },
      // ★ Task 12: 不再 external 任何包, rollup 把 vendor 全部打包进 chunk
      // 浏览器原生 ESM 不需要解析 bare import, 部署到任何静态服务器都能跑
    },
  },
})
