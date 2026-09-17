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
  await page.addInitScript(({ formalProject }) => {
    if (window.localStorage.getItem('__pending-new-problem-smoke-seeded') === 'yes') {
      return;
    }
    window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
    window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(formalProject));
    window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
    window.localStorage.setItem('__pending-new-problem-smoke-seeded', 'yes');
  }, { formalProject: createFormalProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.setInputFiles('input[type="file"]', {
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    mimeType: 'image/png',
    name: 'new-problem.png',
  });
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('cleanroom-pending-teaching-project-v1')), null, { timeout: 10000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-shell', { timeout: 30000 });

  const result = await page.evaluate(() => {
    const formalProject = JSON.parse(window.localStorage.getItem('cleanroom-teaching-project-v1') || '{}');
    const pendingProject = JSON.parse(window.localStorage.getItem('cleanroom-pending-teaching-project-v1') || '{}');
    return {
      bodyHasFormalTitle: document.body.innerText.includes('旧正式工程'),
      formalProjectTitle: formalProject.title || '',
      pendingProjectTitle: pendingProject.title || '',
    };
  });

  console.log(JSON.stringify({ ...result, targetUrl }, null, 2));

  if (result.formalProjectTitle !== '旧正式工程' || !result.pendingProjectTitle.includes('new-problem')) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function createFormalProject() {
  return {
    id: 'formal-old-project',
    title: '旧正式工程',
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
      taskId: 'formal-old-project',
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '旧题目',
        title: '图片题目文本',
      },
      {
        id: 'asset-script',
        kind: 'scriptText',
        source: 'agent',
        status: 'ready',
        summary: '旧讲解',
        title: '解题讲解文稿',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        source: 'agent',
        status: 'ready',
        summary: '旧板书',
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
      clips: [
        {
          endMs: 1200,
          id: 'clip-voice-old-001',
          kind: 'audio',
          label: '旧音频',
          startMs: 0,
          trackId: 'track-voice',
        },
      ],
      durationMs: 1200,
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
