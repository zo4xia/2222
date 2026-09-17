import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const audioSource = createSilentWavDataUrl(3);
const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(({ project }) => {
    window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
    window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(project));
    window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
  }, { project: createMixedArithmeticProject(audioSource) });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('小学混合运算实例'), null, { timeout: 10000 });

  const beforePlay = await readStageState(page);
  await setPlayhead(page, 900);
  const duringSecondClip = await readStageState(page);
  await setPlayhead(page, 1900);
  const duringThirdClip = await readStageState(page);
  await setPlayhead(page, 2600);
  const staticTail = await readStageState(page);

  console.log(JSON.stringify({ beforePlay, duringSecondClip, duringThirdClip, staticTail, targetUrl }, null, 2));

  if (
    !beforePlay.text.includes('18÷(3+3)×2') ||
    !duringSecondClip.text.includes('3+3=6') ||
    !duringThirdClip.text.includes('18÷6×2=6') ||
    !staticTail.text.includes('18÷6×2=6') ||
    duringSecondClip.playheadMs < 900 ||
    duringThirdClip.playheadMs < 1900
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function setPlayhead(page, playheadMs) {
  await page.evaluate((nextPlayheadMs) => {
    window.__TEACHING_EDITOR_STORE__?.getState().setTimelinePlayhead(nextPlayheadMs);
  }, playheadMs);
  await page.waitForFunction((nextPlayheadMs) => {
    const playheadText = Array.from(document.querySelectorAll('.timeline-playbar .ant-typography')).map((element) => element.textContent || '').join(' ');
    return playheadText.includes(`${(nextPlayheadMs / 1000).toFixed(1)}s`);
  }, playheadMs, { timeout: 10000 });
}

async function readStageState(page) {
  return page.evaluate(() => {
    const stickerTexts = Array.from(document.querySelectorAll('.board-text-sticker')).map((element) => {
      const ariaText = element.getAttribute('aria-label')?.replace(/^C 素材：/, '') || '';
      return ariaText || element.textContent?.trim() || '';
    });
    const playheadText = Array.from(document.querySelectorAll('.timeline-playbar .ant-typography')).map((element) => element.textContent || '').join(' ');
    const playheadMatch = playheadText.match(/(\d+(?:\.\d+)?)s\s*\/\s*(\d+(?:\.\d+)?)s/);
    return {
      playheadMs: playheadMatch ? Math.round(Number(playheadMatch[1]) * 1000) : 0,
      text: stickerTexts.join('\n'),
      visibleStickerCount: stickerTexts.length,
    };
  });
}

function createMixedArithmeticProject(sourceRef) {
  return {
    id: 'abc-mixed-arithmetic-smoke',
    title: '小学混合运算实例',
    createdAt: new Date().toISOString(),
    stage: {
      canvas: {
        background: '#ffffff',
        boardFontFamily: '"Microsoft YaHei", sans-serif',
        boardFontName: 'Microsoft YaHei',
        boardFontSize: 48,
        boardFontUrl: '',
        height: 1080,
        preset: 'landscape-1080p',
        width: 1920,
      },
    },
    task: {
      source: 'manual',
      taskId: 'abc-mixed-arithmetic-smoke',
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '计算：18÷(3+3)×2',
        title: '图片题目文本',
      },
      {
        id: 'asset-script',
        kind: 'scriptText',
        source: 'agent',
        status: 'ready',
        summary: '先看原式。<br>先算括号。<br>再按从左到右计算乘除。',
        title: '解题讲解文稿',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        source: 'agent',
        status: 'ready',
        summary: '18÷(3+3)×2\n3+3=6\n18÷6×2=6',
        title: 'C素材候选',
      },
      {
        id: 'asset-voice-audio',
        kind: 'voiceAudio',
        source: 'tts',
        sourceRef,
        status: 'ready',
        summary: '测试 A 轨音频。',
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
          endMs: 3000,
          id: 'clip-voice-tts-001',
          kind: 'audio',
          label: 'A1｜混合运算讲解',
          sourceRef,
          startMs: 0,
          trackId: 'track-voice',
        },
        {
          chainKey: 'A1',
          endMs: 900,
          id: 'clip-board-001',
          kind: 'board',
          label: '18÷(3+3)×2',
          revealEndMs: 900,
          revealStartMs: 0,
          sourceEndMs: 900,
          sourceRef: 'tts-sentence-001',
          sourceStartMs: 0,
          startMs: 0,
          trackId: 'track-board',
          widthPercent: 42,
          xPercent: 9,
          yPercent: 18,
        },
        {
          chainKey: 'A2',
          endMs: 1900,
          id: 'clip-board-002',
          kind: 'board',
          label: '3+3=6',
          revealEndMs: 1900,
          revealStartMs: 900,
          sourceEndMs: 1900,
          sourceRef: 'tts-sentence-002',
          sourceStartMs: 900,
          startMs: 900,
          trackId: 'track-board',
          widthPercent: 26,
          xPercent: 12,
          yPercent: 34,
        },
        {
          chainKey: 'A3',
          endMs: 3000,
          id: 'clip-board-003',
          kind: 'board',
          label: '18÷6×2=6',
          revealEndMs: 2400,
          revealStartMs: 1900,
          sourceEndMs: 2400,
          sourceRef: 'tts-sentence-003',
          sourceStartMs: 1900,
          startMs: 1900,
          trackId: 'track-board',
          widthPercent: 36,
          xPercent: 14,
          yPercent: 50,
        },
      ],
      durationMs: 3000,
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

  const localDebugBrowsers = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];

  return localDebugBrowsers.find((browserPath) => existsSync(browserPath)) || '';
}
