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

export default defineConfig({
  plugins: [
    vue(),
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
      },
    },
  },
})
