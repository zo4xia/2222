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
    },
  },
})
