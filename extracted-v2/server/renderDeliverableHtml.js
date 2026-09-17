/**
 * 统一微课与参数交付物单页生成器
 *
 * @legacy L3-B02 ✅ 已治理 · 内联完整 HTML 模板，替代外部 handdraw-player.html 读取
 * 原模板文件用户已明示"不补回"，所以这里直接内联一份完整的演播页 HTML，
 * 不再依赖 public/deliverable/handdraw-player.html 文件存在。
 *
 * 内置 canvas-drawing-editor Web Component，用于交互式画布编辑与导出。
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const playerTemplatePath = resolve(__dirname, '../public/deliverable/handdraw-player.html')

/**
 * 内联演播页 HTML 模板
 * 含 canvas-drawing-editor Web Component + 小 agent 对话微调面板
 */
function getInlineTemplate() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>青花布手绘板书微课演播 · canvas-drawing-editor</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f5f5; color: #333; }
    .app { display: grid; grid-template-rows: 56px 1fr; height: 100vh; }
    .topbar { display: flex; align-items: center; gap: 16px; padding: 0 20px; background: #fff; border-bottom: 1px solid #e5e5e5; box-shadow: 0 1px 4px rgba(0,0,0,.04); }
    .topbar h1 { font-size: 16px; font-weight: 600; color: #1f1f1f; }
    .topbar .meta { font-size: 12px; color: #888; }
    .topbar .actions { margin-left: auto; display: flex; gap: 8px; }
    .topbar button { padding: 6px 14px; border: 1px solid #d9d9d9; background: #fff; border-radius: 4px; font-size: 13px; cursor: pointer; transition: all .15s; }
    .topbar button:hover { border-color: #5450dc; color: #5450dc; }
    .topbar button.primary { background: #5450dc; border-color: #5450dc; color: #fff; }
    .topbar button.primary:hover { background: #3d3ab8; }
    .body { display: grid; grid-template-columns: 1fr 360px; gap: 0; overflow: hidden; }
    .canvas-area { background: #fafafa; padding: 12px; overflow: auto; position: relative; }
    .canvas-area canvas-drawing-editor { display: block; width: 100%; height: 100%; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
    .side { background: #fff; border-left: 1px solid #e5e5e5; display: flex; flex-direction: column; overflow: hidden; }
    .side .tabs { display: flex; border-bottom: 1px solid #e5e5e5; }
    .side .tab { flex: 1; padding: 12px 8px; text-align: center; font-size: 13px; cursor: pointer; border-bottom: 2px solid transparent; color: #666; transition: all .15s; }
    .side .tab.active { color: #5450dc; border-bottom-color: #5450dc; background: #fafafa; }
    .side .panel { flex: 1; overflow: auto; padding: 16px; display: none; }
    .side .panel.active { display: block; }
    .panel h3 { font-size: 13px; font-weight: 600; color: #1f1f1f; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
    .row-list { display: flex; flex-direction: column; gap: 8px; }
    .row-item { padding: 10px; background: #fafafa; border-radius: 6px; border: 1px solid #f0f0f0; cursor: pointer; font-size: 12px; transition: all .15s; }
    .row-item:hover { background: #f0f0ff; border-color: #5450dc; }
    .row-item .stage { font-weight: 600; color: #5450dc; margin-bottom: 4px; }
    .row-item .speech { color: #666; line-height: 1.5; }
    .chat { display: flex; flex-direction: column; gap: 10px; }
    .chat-msg { padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.5; max-width: 90%; word-wrap: break-word; }
    .chat-msg.user { background: #5450dc; color: #fff; align-self: flex-end; }
    .chat-msg.agent { background: #f0f0f0; color: #333; align-self: flex-start; }
    .chat-input { display: flex; gap: 6px; margin-top: 12px; }
    .chat-input textarea { flex: 1; padding: 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; resize: none; font-family: inherit; }
    .chat-input textarea:focus { outline: none; border-color: #5450dc; }
    .chat-input button { padding: 8px 16px; background: #5450dc; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .chat-input button:hover { background: #3d3ab8; }
    .chat-input button:disabled { background: #ccc; cursor: not-allowed; }
    .empty { text-align: center; color: #999; padding: 40px 20px; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; background: #f0f0ff; color: #5450dc; border-radius: 10px; font-size: 11px; margin-left: 6px; }
    .loading { display: inline-block; width: 12px; height: 12px; border: 2px solid #ccc; border-top-color: #5450dc; border-radius: 50%; animation: spin .6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <h1>🎬 青花布手绘板书微课演播</h1>
      <span class="meta" id="meta">加载中...</span>
      <div class="actions">
        <button onclick="window.__player__.exportPng()">📷 导出 PNG</button>
        <button onclick="window.__player__.exportJson()">📥 导出 JSON</button>
        <button class="primary" onclick="window.__player__.playAll()">▶ 播放全部</button>
      </div>
    </header>
    <div class="body">
      <div class="canvas-area">
        <canvas-drawing-editor
          id="editor"
          title="板书微课演播"
          lang="zh"
          theme-color="#5450dc"
          enable-hotzone="false"
          tool-config='{"pencil":false,"rectangle":false,"circle":false,"line":false,"arrow":false,"text":false,"richText":false,"image":false,"clear":true,"download":true,"exportJson":true,"zoom":true,"layers":true,"group":false,"align":false,"undoRedo":true,"select":true}'
          style="width:100%;height:100%;background:#fff;"
        ></canvas-drawing-editor>
      </div>
      <aside class="side">
        <div class="tabs">
          <div class="tab active" data-tab="rows">📝 步骤</div>
          <div class="tab" data-tab="chat">💬 小 agent 微调</div>
        </div>
        <div class="panel active" data-panel="rows">
          <h3>口播板书步骤</h3>
          <div class="row-list" id="rowList"><div class="empty">暂无数据</div></div>
        </div>
        <div class="panel" data-panel="chat">
          <h3>小 agent 对话微调 <span class="badge">动作 · 板书 · 口播</span></h3>
          <div class="chat" id="chatLog">
            <div class="chat-msg agent">你好！我是小 agent，可以帮你微调板书动作、字号、口播稿等。直接说就行，比如"第2行的字写大一点"。</div>
          </div>
          <div class="chat-input">
            <textarea id="chatInput" rows="2" placeholder="例如：第2行字写大一点 / 把箭头改成红色 / 第3行口播再讲细一点"></textarea>
            <button id="chatSend">发送</button>
          </div>
        </div>
      </aside>
    </div>
  </div>
  <script type="module">
    import 'canvas-drawing-editor'
  </script>
  <script>
    window.__INITIAL_DELIVERABLE__ = window.__INITIAL_DELIVERABLE__ || null
    window.__player__ = {
      async exportPng() {
        const editor = document.getElementById('editor')
        if (editor && editor.exportPNG) {
          editor.exportPNG('board-' + Date.now() + '.png')
        }
      },
      async exportJson() {
        const editor = document.getElementById('editor')
        if (editor && editor.exportJSON) {
          const data = editor.exportJSON()
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = 'board-' + Date.now() + '.json'
          a.click()
          URL.revokeObjectURL(url)
        }
      },
      async playAll() {
        const rows = window.__INITIAL_DELIVERABLE__?.rows || []
        if (!rows.length) { alert('暂无可播放的 rows'); return }
        const editor = document.getElementById('editor')
        for (const row of rows) {
          if (row.board && row.board.content) {
            if (editor && editor.tweenAnimate) {
              editor.tweenAnimate('topic', { opacity: 1 }, { duration: 1000, easing: 'easeOutQuad' })
            }
            await new Promise(r => setTimeout(r, (row.estimatedDurationMs || 2000)))
          }
        }
      }
    }
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'))
        document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'))
        t.classList.add('active')
        document.querySelector('.panel[data-panel="' + t.dataset.tab + '"]').classList.add('active')
      })
    })
    document.getElementById('chatSend').addEventListener('click', async () => {
      const input = document.getElementById('chatInput')
      const text = input.value.trim()
      if (!text) return
      const log = document.getElementById('chatLog')
      log.insertAdjacentHTML('beforeend', '<div class="chat-msg user">' + text.replace(/</g,'&lt;') + '</div>')
      input.value = ''
      log.insertAdjacentHTML('beforeend', '<div class="chat-msg agent" id="thinking"><span class="loading"></span> 正在分析意图...</div>')
      log.scrollTop = log.scrollHeight
      try {
        const res = await fetch('/api/micro-agent/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, deliverable: window.__INITIAL_DELIVERABLE__ })
        })
        const data = await res.json()
        document.getElementById('thinking')?.remove()
        log.insertAdjacentHTML('beforeend', '<div class="chat-msg agent">' + (data.reply || '已收到反馈').replace(/</g,'&lt;').replace(/\\n/g,'<br>') + '</div>')
        if (data.applied) {
          log.insertAdjacentHTML('beforeend', '<div class="chat-msg agent">✅ 已应用：' + data.applied.join('、') + '</div>')
        }
      } catch (err) {
        document.getElementById('thinking')?.remove()
        log.insertAdjacentHTML('beforeend', '<div class="chat-msg agent">⚠️ ' + err.message + '</div>')
      }
      log.scrollTop = log.scrollHeight
    })
    function renderRows() {
      const d = window.__INITIAL_DELIVERABLE__
      if (!d) return
      const meta = document.getElementById('meta')
      meta.textContent = (d.problemText || '').slice(0, 50) + '... | ' + (d.rows || []).length + ' 步'
      const list = document.getElementById('rowList')
      list.innerHTML = ''
      for (const row of (d.rows || [])) {
        const item = document.createElement('div')
        item.className = 'row-item'
        item.innerHTML = '<div class="stage">' + (row.stage || '') + ' · ' + (row.estimatedDurationMs ? Math.round(row.estimatedDurationMs/100)/10 + 's' : '') + '</div><div class="speech">' + (row.speech || '').slice(0, 80) + '</div>'
        item.addEventListener('click', () => {
          if (row.actionSpec && row.actionSpec.length) {
            console.log('播放动作', row.actionSpec)
          }
        })
        list.appendChild(item)
      }
    }
    renderRows()
  </script>
</body>
</html>`
}

/**
 * 统一微课与参数交付物单页生成器
 */
export function renderDeliverableHtml(deliverable) {
  let template
  // 优先用外部模板（如用户后续手放了 handdraw-player.html）
  if (existsSync(playerTemplatePath)) {
    try {
      template = readFileSync(playerTemplatePath, 'utf-8')
    } catch (err) {
      console.warn('[renderDeliverableHtml] 读取外部模板失败，用内联模板:', err.message)
      template = getInlineTemplate()
    }
  } else {
    // @legacy L3-B02 ✅ 已治理 · 内联模板替代缺失文件
    template = getInlineTemplate()
  }

  const safeJson = JSON.stringify(deliverable || {}).replace(/</g, '\\u003c')
  const injectedScript = `<script>window.__INITIAL_DELIVERABLE__ = ${safeJson};</script>\n</head>`
  return template.replace('</head>', injectedScript)
}
