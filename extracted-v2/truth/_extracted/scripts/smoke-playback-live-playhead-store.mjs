import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const browser = await chromium.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ project }) => {
    window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
    window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(project));
    window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
  }, { project: createLivePlayheadProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.timeline-play-button', { timeout: 30000 });
  await page.locator('.timeline-play-button').click();
  await page.waitForFunction(() => {
    const state = window.__TEACHING_EDITOR_STORE__?.getState();
    return state && state.livePlayheadMs > 650 && state.project.timeline.playheadMs === 0;
  }, null, { timeout: 5000 });

  const during = await readPlayheadState(page);
  await page.locator('.timeline-play-button').click();
  await page.waitForFunction(() => {
    const state = window.__TEACHING_EDITOR_STORE__?.getState();
    return state && !state.isPlaying && state.livePlayheadMs === null && state.project.timeline.playheadMs > 650;
  }, null, { timeout: 5000 });
  const afterStop = await readPlayheadState(page);

  console.log(JSON.stringify({ afterStop, during, targetUrl }, null, 2));
  if (
    during.projectPlayheadMs !== 0 ||
    during.livePlayheadMs < 650 ||
    afterStop.livePlayheadMs !== null ||
    afterStop.projectPlayheadMs < during.livePlayheadMs
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function readPlayheadState(page) {
  return page.evaluate(() => {
    const state = window.__TEACHING_EDITOR_STORE__?.getState();
    return {
      isPlaying: state?.isPlaying ?? false,
      livePlayheadMs: state?.livePlayheadMs ?? null,
      projectPlayheadMs: state?.project.timeline.playheadMs ?? 0,
    };
  });
}

function createLivePlayheadProject() {
  const sourceRef = createSilentWavDataUrl(3);
  return {
    id: 'playback-live-playhead-smoke',
    title: '播放临时时钟检查',
    createdAt: new Date().toISOString(),
    stage: {
      canvas: {
        background: '#ffffff',
        boardFontFamily: '"Microsoft YaHei", sans-serif',
        boardFontName: 'Microsoft YaHei',
        boardFontSize: 48,
        height: 1080,
        preset: 'landscape-1080p',
        width: 1920,
      },
    },
    task: { source: 'manual', taskId: 'playback-live-playhead-smoke' },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '播放临时时钟检查',
        title: '图片题目文本',
      },
    ],
    timeline: {
      clips: [
        {
          endMs: 3000,
          id: 'clip-voice-tts-001',
          kind: 'audio',
          label: 'A｜播放临时时钟检查',
          sourceRef,
          startMs: 0,
          trackId: 'track-voice',
        },
      ],
      durationMs: 3000,
      playheadMs: 0,
      tracks: [{ id: 'track-voice', kind: 'voice', name: 'A 语音轨' }],
    },
  };
}

function createSilentWavDataUrl(durationSeconds) {
  const sampleRate = 8000;
  const samples = sampleRate * durationSeconds;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return `data:audio/wav;base64,${buffer.toString('base64')}`;
}

function resolveChromiumExecutablePath() {
  if (process.env.CLEANROOM_CHROMIUM_PATH) {
    return process.env.CLEANROOM_CHROMIUM_PATH;
  }

  return (
    [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ].find((browserPath) => existsSync(browserPath)) || ''
  );
}
