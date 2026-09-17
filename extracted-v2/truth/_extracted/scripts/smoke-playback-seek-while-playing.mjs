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
  }, { project: createSeekProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.timeline-play-button', { timeout: 30000 });

  await page.locator('.timeline-play-button').click();
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__TEACHING_EDITOR_STORE__?.getState().setTimelinePlayhead(2600));
  await page.waitForFunction(() => {
    const state = window.__TEACHING_EDITOR_STORE__?.getState();
    const playheadMs = state ? state.livePlayheadMs ?? state.project.timeline.playheadMs : 0;
    return playheadMs >= 2850;
  }, null, { timeout: 3000 });

  const result = await page.evaluate(() => {
    const state = window.__TEACHING_EDITOR_STORE__?.getState();
    const playheadMs = state ? state.livePlayheadMs ?? state.project.timeline.playheadMs : 0;
    const text = Array.from(document.querySelectorAll('.board-text-sticker'))
      .map((element) => element.getAttribute('aria-label')?.replace(/^C 素材：/, '') || element.textContent?.trim() || '')
      .join('\n');
    return {
      isPlaying: state?.isPlaying ?? false,
      playheadMs,
      targetUrl: window.location.href,
      text,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.isPlaying || result.playheadMs < 2750 || result.playheadMs > 3400 || !result.text.includes('第三段')) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function createSeekProject() {
  const sourceRef = createSilentWavDataUrl(1.2);
  return {
    id: 'playback-seek-smoke',
    title: '播放中定位检查',
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
    task: { source: 'manual', taskId: 'playback-seek-smoke' },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '播放中定位检查',
        title: '图片题目文本',
      },
    ],
    timeline: {
      clips: [
        createAudioClip('clip-voice-tts-001', '第一段', sourceRef, 0, 1200),
        createAudioClip('clip-voice-tts-002', '第二段', sourceRef, 1200, 2400),
        createAudioClip('clip-voice-tts-003', '第三段', sourceRef, 2400, 3600),
        createBoardClip('clip-board-001', '第一段', 0, 1200, 18),
        createBoardClip('clip-board-002', '第二段', 1200, 2400, 34),
        createBoardClip('clip-board-003', '第三段', 2400, 3600, 50),
      ],
      durationMs: 3600,
      playheadMs: 0,
      tracks: [
        { id: 'track-voice', kind: 'voice', name: 'A 语音轨' },
        { id: 'track-board', kind: 'board', name: 'B 寿命轨' },
      ],
    },
  };
}

function createAudioClip(id, label, sourceRef, startMs, endMs) {
  return {
    endMs,
    id,
    kind: 'audio',
    label: `A｜${label}`,
    sourceRef,
    startMs,
    trackId: 'track-voice',
  };
}

function createBoardClip(id, label, startMs, endMs, yPercent) {
  return {
    chainKey: id,
    drawSpeed: 2,
    endMs,
    id,
    kind: 'board',
    label,
    revealEndMs: endMs,
    revealStartMs: startMs,
    startMs,
    trackId: 'track-board',
    widthPercent: 24,
    xPercent: 12,
    yPercent,
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
