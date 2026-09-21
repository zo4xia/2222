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
// CDN External Plugin（Task 1: vendor 库 external 到 esm.sh，浏览器直拉 ESM）
//  - pin 同一 Vue 实例（?deps=vue@3.5.39）避免 ant-design-vue 与 icons-vue 重复运行时
//  - dev + build 双模式生效（dev: resolveId/importAnalysis 钩子改写 import；build: rollupOptions.external）
//  - CSS（reset.css / katex.min.css）保留本地打包，字体 url() 引用本地最稳
// ─────────────────────────────────────────────────────────────────────────────
const CDN_VERSIONS = {
  vue: '3.5.39',
  'ant-design-vue': '4.2.6',
  '@ant-design/icons-vue': '7.0.1',
  katex: '0.18.4',
  'rough-notation': '0.5.1',
  roughjs: '4.6.6',
}

const CDN_URLS = {
  vue: `https://esm.sh/vue@${CDN_VERSIONS.vue}`,
  'ant-design-vue': `https://esm.sh/ant-design-vue@${CDN_VERSIONS['ant-design-vue']}?deps=vue@${CDN_VERSIONS.vue}`,
  '@ant-design/icons-vue': `https://esm.sh/@ant-design/icons-vue@${CDN_VERSIONS['@ant-design/icons-vue']}?deps=vue@${CDN_VERSIONS.vue}`,
  katex: `https://esm.sh/katex@${CDN_VERSIONS.katex}`,
  'rough-notation': `https://esm.sh/rough-notation@${CDN_VERSIONS['rough-notation']}`,
  roughjs: `https://esm.sh/roughjs@${CDN_VERSIONS.roughjs}/bundled/rough.esm.js`,
}

// 精确匹配（防止子路径导入如 roughjs/bundled/rough.esm.js 被漏掉）
function toCdnUrl(spec) {
  // 精确匹配
  if (CDN_URLS[spec]) return CDN_URLS[spec]
  // roughjs 子路径（roughjs/bundled/rough.esm.js）
  if (spec === 'roughjs/bundled/rough.esm.js') return CDN_URLS.roughjs
  // 其他子路径尝试前缀匹配（如 'ant-design-vue/es/xxx'）
  for (const pkg of Object.keys(CDN_URLS)) {
    if (spec === pkg || spec.startsWith(pkg + '/')) return CDN_URLS[pkg]
  }
  return null
}

function cdnExternalPlugin() {
  return {
    name: 'cdn-external-plugin',
    enforce: 'pre',
    resolveId(source, importer) {
      // 只改写 bare import，不改写相对路径 / 已是 URL 的
      if (!source || source.startsWith('.') || source.startsWith('/')) return null
      if (/^https?:\/\//.test(source)) return null
      // virtual / vite 内部模块不动
      if (source.startsWith('\0') || source.startsWith('virtual:')) return null
      const cdnUrl = toCdnUrl(source)
      if (!cdnUrl) return null
      // 返回 { id, external: true } 把它外置，浏览器直接走 esm.sh
      return { id: cdnUrl, external: true }
    },
  }
}

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
    cdnExternalPlugin(),  // ← Task 1 CDN external 优化（必须在 vue() 之前）
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
  // dev 模式：不让 vite 预打包这些 vendor，否则 cdnExternalPlugin 会被 .vite/deps 缓存绕过
  optimizeDeps: {
    exclude: Object.keys(CDN_URLS),
  },
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
      // build 模式：把 CDN 列表 external 出去，rollup 不会把它们打包进 chunk
      external: Object.keys(CDN_URLS).concat(['roughjs/bundled/rough.esm.js']),
    },
  },
})
