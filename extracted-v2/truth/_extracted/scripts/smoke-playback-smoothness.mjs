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
  }, { project: createPlaybackSmoothnessProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.timeline-play-button', { timeout: 30000 });
  await page.evaluate(() => {
    const store = window.__TEACHING_EDITOR_STORE__;
    const samples = [];
    const readVisiblePlayhead = (state) => state.livePlayheadMs ?? state.project.timeline.playheadMs;
    let previousPlayheadMs = readVisiblePlayhead(store.getState());
    const unsubscribe = store.subscribe((state) => {
      const playheadMs = readVisiblePlayhead(state);
      if (playheadMs === previousPlayheadMs) {
        return;
      }
      previousPlayheadMs = playheadMs;
      samples.push({ at: performance.now(), playheadMs });
    });
    window.__PLAYBACK_SMOOTHNESS_SAMPLES__ = samples;
    window.__PLAYBACK_SMOOTHNESS_UNSUBSCRIBE__ = unsubscribe;
  });

  await page.locator('.timeline-play-button').click();
  await page.waitForFunction(() => {
    const samples = window.__PLAYBACK_SMOOTHNESS_SAMPLES__ || [];
    return samples.length >= 18 && samples[samples.length - 1].playheadMs - samples[0].playheadMs >= 900;
  }, null, { timeout: 5000 });
  const result = await page.evaluate(() => {
    window.__PLAYBACK_SMOOTHNESS_UNSUBSCRIBE__?.();
    const samples = window.__PLAYBACK_SMOOTHNESS_SAMPLES__ || [];
    const steadySamples = samples.slice(Math.min(4, Math.floor(samples.length / 4)));
    const intervals = steadySamples.slice(1).map((sample, index) => sample.at - steadySamples[index].at);
    const playheadSteps = steadySamples.slice(1).map((sample, index) => sample.playheadMs - steadySamples[index].playheadMs);
    return {
      maxIntervalMs: intervals.length ? Math.round(Math.max(...intervals)) : null,
      minIntervalMs: intervals.length ? Math.round(Math.min(...intervals)) : null,
      sampleCount: samples.length,
      steadySampleCount: steadySamples.length,
      targetUrl: window.location.href,
      totalAdvanceMs: samples.length ? samples[samples.length - 1].playheadMs - samples[0].playheadMs : 0,
      steadyAdvanceMs: steadySamples.length ? steadySamples[steadySamples.length - 1].playheadMs - steadySamples[0].playheadMs : 0,
      maxPlayheadStepMs: playheadSteps.length ? Math.max(...playheadSteps) : null,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (
    result.sampleCount < 18 ||
    result.steadySampleCount < 14 ||
    result.totalAdvanceMs < 900 ||
    result.steadyAdvanceMs < 650 ||
    result.maxIntervalMs === null ||
    result.maxIntervalMs > 180 ||
    result.maxPlayheadStepMs === null ||
    result.maxPlayheadStepMs > 220
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

function createPlaybackSmoothnessProject() {
  const sourceRef = createSilentWavDataUrl(4);
  return {
    id: 'playback-smoothness-smoke',
    title: '播放流畅度检查',
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
    task: { source: 'manual', taskId: 'playback-smoothness-smoke' },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '播放流畅度检查',
        title: '图片题目文本',
      },
    ],
    timeline: {
      clips: [
        {
          endMs: 4000,
          id: 'clip-voice-tts-001',
          kind: 'audio',
          label: 'A1｜播放流畅度检查',
          sourceRef,
          startMs: 0,
          trackId: 'track-voice',
        },
        {
          chainKey: 'step-1',
          drawSpeed: 2,
          endMs: 4000,
          id: 'clip-board-001',
          kind: 'board',
          label: '播放头应平滑推进',
          revealEndMs: 2600,
          revealStartMs: 0,
          startMs: 0,
          trackId: 'track-board',
          widthPercent: 42,
          xPercent: 9,
          yPercent: 18,
        },
      ],
      durationMs: 4000,
      playheadMs: 0,
      tracks: [
        { id: 'track-voice', kind: 'voice', name: 'A 语音轨' },
        { id: 'track-board', kind: 'board', name: 'B 寿命轨' },
      ],
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
