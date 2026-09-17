import { existsSync } from 'node:fs';
import path from 'node:path';
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
  await page.addInitScript(({ archiveProject }) => {
    const files = new Map([
      [
        'project.json',
        new File(
          [
            JSON.stringify({
              editRecords: [],
              productManifest: [],
              project: archiveProject,
              savedAt: new Date().toISOString(),
              schema: 'cleanroom-local-task-archive-v2',
            }),
          ],
          'project.json',
          { type: 'application/json' },
        ),
      ],
      ['audio-001.mp3', new File([new Uint8Array([73, 68, 51, 3, 0, 0])], 'audio-001.mp3', { type: 'audio/mpeg' })],
    ]);

    window.showDirectoryPicker = async () => ({
      name: 'mock-imported-task',
      async getFileHandle(name) {
        const file = files.get(name);
        if (!file) {
          throw new DOMException(`${name} not found`, 'NotFoundError');
        }
        return {
          async getFile() {
            return file;
          },
        };
      },
    });
  }, { archiveProject: createArchiveProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.getByRole('button', { name: /导入 project\.json/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes('音频 1/1 个已恢复'), null, { timeout: 10000 });

  const result = await page.evaluate(() => ({
    hasImportMessage: document.body.innerText.includes('音频 1/1 个已恢复'),
    hasVoiceReady: document.body.innerText.includes('A轨'),
    messageText: document.body.innerText.match(/已导入[^\n]+/)?.[0] || '',
  }));

  console.log(JSON.stringify({ ...result, targetUrl }, null, 2));

  if (!result.hasImportMessage) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function createArchiveProject() {
  const now = new Date().toISOString();
  return {
    id: 'mock-archive-project',
    title: '导入音频取回检查',
    createdAt: now,
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
      taskId: 'mock-import-task',
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '1 + 1 = ?',
        title: '图片题目文本',
      },
      {
        id: 'asset-script',
        kind: 'scriptText',
        source: 'manual',
        status: 'ready',
        summary: '我们来算一加一。',
        title: '解题讲解文稿',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        source: 'agent',
        status: 'ready',
        summary: '1 + 1 = 2',
        title: 'C素材候选',
      },
      {
        id: 'asset-voice-audio',
        kind: 'voiceAudio',
        source: 'tts',
        sourceRef: 'http://127.0.0.1:8787/api/tts/cosyvoice/audio/missing-old-url.mp3',
        status: 'ready',
        summary: '旧网关音频引用。',
        title: 'A 语音音频',
      },
      {
        id: 'asset-voice-timing',
        kind: 'voiceTiming',
        source: 'tts',
        sourceRef: '',
        status: 'missing',
        summary: '',
        title: '语音时序 JSON',
      },
    ],
    timeline: {
      clips: [
        {
          endMs: 1200,
          id: 'clip-voice-tts-001',
          kind: 'audio',
          label: 'A1｜我们来算一加一',
          sourceRef: 'http://127.0.0.1:8787/api/tts/cosyvoice/audio/missing-old-url.mp3',
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
