import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const outputDir = path.resolve('.tmp-ui-smoke');
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(
    ({ project }) => {
      window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
      window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(project));
      window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
    },
    { project: createReadyProject(createSilentWavDataUrl(3)) },
  );

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForSelector('.workspace-grid--assets-collapsed', { timeout: 10000 });
  const afterAutoCollapse = await readLayoutState(page);
  const autoCollapseScreenshotPath = path.join(
    outputDir,
    `asset-panel-collapse-auto-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
  );
  await page.screenshot({ path: autoCollapseScreenshotPath, fullPage: true });

  await page.getByRole('button', { name: '展开流程面板' }).click();
  await page.waitForSelector('.workflow-card', { timeout: 10000 });
  const afterManualExpand = await readLayoutState(page);
  const manualExpandScreenshotPath = path.join(
    outputDir,
    `asset-panel-collapse-manual-expand-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
  );
  await page.screenshot({ path: manualExpandScreenshotPath, fullPage: true });

  await page.setInputFiles('input[type="file"]', {
    buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    mimeType: 'image/png',
    name: 'new-problem.png',
  });
  await page.waitForFunction(() => Boolean(window.localStorage.getItem('cleanroom-pending-teaching-project-v1')), null, { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('.workspace-grid--assets-collapsed'), null, { timeout: 10000 });
  const afterPendingProblem = await readLayoutState(page);

  const pendingProblemScreenshotPath = path.join(
    outputDir,
    `asset-panel-collapse-pending-problem-${new Date().toISOString().replace(/[:.]/g, '-')}.png`,
  );
  await page.screenshot({ path: pendingProblemScreenshotPath, fullPage: true });
  const result = {
    afterAutoCollapse,
    afterManualExpand,
    afterPendingProblem,
    screenshots: {
      afterAutoCollapse: autoCollapseScreenshotPath,
      afterManualExpand: manualExpandScreenshotPath,
      afterPendingProblem: pendingProblemScreenshotPath,
    },
    targetUrl,
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    !afterAutoCollapse.collapsed ||
    !afterAutoCollapse.stageCanvasVisible ||
    afterManualExpand.collapsed ||
    !afterManualExpand.workflowVisible ||
    afterPendingProblem.collapsed ||
    !afterPendingProblem.workflowVisible
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function readLayoutState(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return {
      collapsed: Boolean(document.querySelector('.workspace-grid--assets-collapsed')),
      collapseButtonLabel: document.querySelector('.asset-panel-collapse-button')?.getAttribute('aria-label') || '',
      stageCanvasVisible: visible('.stage-canvas'),
      workflowVisible: visible('.workflow-card'),
    };
  });
}

function createReadyProject(sourceRef) {
  return {
    id: 'asset-panel-collapse-smoke',
    title: 'A/B 入轨收起实例',
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
    task: { source: 'manual', taskId: 'asset-panel-collapse-smoke' },
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
        summary: '先看原式。',
        title: '解题讲解文稿',
      },
      {
        id: 'asset-board-layout',
        kind: 'boardLayout',
        source: 'agent',
        status: 'ready',
        summary: '18÷(3+3)×2',
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

  return (
    [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ].find((browserPath) => existsSync(browserPath)) || ''
  );
}
