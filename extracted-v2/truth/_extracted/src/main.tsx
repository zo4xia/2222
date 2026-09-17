// @@ROUTE_MAIN @@ROUTE_C_STICKER @@ROUTE_DRAWBOARD_CORE @@ROUTE_HYBRID
// 路由分发点：standalone 参数解析集中于此处，不再靠多段 includes 条件链
// 施工目录唯一端口：npm run dev => 127.0.0.1:5196（非 5210/5197/5198 等临时端口）
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CStickerStandalonePage } from './standalone/CStickerStandalonePage';
import { DrawboardCoreStandalonePage } from './standalone/DrawboardCoreStandalonePage';
import { DrawboardHybridPrototypePage } from './standalone/DrawboardHybridPrototypePage';
import { TldrawProofPage } from './standalone/TldrawProofPage';
import 'antd/dist/reset.css';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Missing #root element');
}

const standalone = new URLSearchParams(window.location.search).get('standalone');

function resolveEntry() {
  switch (standalone) {
    case 'c-sticker':
      return <CStickerStandalonePage />;
    case 'drawboard-core':
      return <DrawboardCoreStandalonePage />;
    case 'drawboard-hybrid':
      return <DrawboardHybridPrototypePage />;
    case 'tldraw-proof':
      return <TldrawProofPage />;
    default:
      return <App />;
  }
}

createRoot(root).render(
  <React.StrictMode>
    {resolveEntry()}
  </React.StrictMode>,
);
