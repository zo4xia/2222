import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ formalProject, pendingProject }) => {
    window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
    window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(formalProject));
    window.localStorage.setItem('cleanroom-pending-teaching-project-v1', JSON.stringify(pendingProject));
  }, { formalProject: createProject('formal-old-project', '旧正式工程'), pendingProject: createProject('pending-new-project', '新题目草稿') });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.evaluate(() => {
    window.__TEACHING_EDITOR_STORE__?.getState().applyScriptAgentDraft({
      boardPlan: '1 + 1 = 2',
      rows: [
        {
          boardSlice: '1 + 1 = 2',
          id: 'row-1',
          section: '正式解题',
          stepLabel: '第一步',
          voiceText: '我们把一加一算出来，等于二。',
        },
      ],
      spokenScript: '',
    });
  });
  await page.waitForFunction(() => {
    const project = JSON.parse(window.localStorage.getItem('cleanroom-teaching-project-v1') || '{}');
    return project.title === '新题目草稿' && !window.localStorage.getItem('cleanroom-pending-teaching-project-v1');
  }, null, { timeout: 10000 });

  const result = await page.evaluate(() => {
    const project = JSON.parse(window.localStorage.getItem('cleanroom-teaching-project-v1') || '{}');
    return {
      formalProjectTitle: project.title || '',
      hasPendingProject: Boolean(window.localStorage.getItem('cleanroom-pending-teaching-project-v1')),
      scriptSummary: project.assets?.find((asset) => asset.kind === 'scriptText')?.summary || '',
    };
  });

  console.log(JSON.stringify({ ...result, targetUrl }, null, 2));

  if (result.formalProjectTitle !== '新题目草稿' || result.hasPendingProject || !result.scriptSummary.trim()) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function createProject(id, title) {
  return {
    id,
    title,
    createdAt: new Date().toISOString(),
    stage: {
      canvas: {
        background: '#ffffff',
        boardFontFamily: '"Microsoft YaHei", sans-serif',
        boardFontName: 'Microsoft YaHei',
        boardFontSize: 42,
        boardFontUrl: '',
        height: 1080,
        preset: 'landscape-1080p',
        width: 1920,
      },
    },
    task: {
      source: 'manual',
      taskId: id,
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: title,
        title: '图片题目文本',
      },
      {
        id: 'asset-script',
        kind: 'scriptText',
        source: 'manual',
        status: 'missing',
        summary: '',
        title: '解题讲解文稿',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        source: 'manual',
        status: 'missing',
        summary: '',
        title: 'C素材候选',
      },
      {
        id: 'asset-voice-audio',
        kind: 'voiceAudio',
        source: 'tts',
        status: 'missing',
        summary: '',
        title: 'A 语音音频',
      },
      {
        id: 'asset-voice-timing',
        kind: 'voiceTiming',
        source: 'tts',
        status: 'missing',
        summary: '',
        title: '语音时序 JSON',
      },
    ],
    timeline: {
      clips: [],
      durationMs: 9000,
      playheadMs: 0,
      tracks: [
        { id: 'track-voice', kind: 'voice', name: 'A 语音轨' },
        { id: 'track-board', kind: 'board', name: 'B 寿命轨' },
      ],
    },
  };
}

function resolveChromiumExecutablePath() {
  if (process.env.CLEANROOM_CHROMIUM_PATH) {
    return process.env.CLEANROOM_CHROMIUM_PATH;
  }

  const localDebugBrowsers = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];

  return localDebugBrowsers.find((browserPath) => existsSync(browserPath)) || '';
}
