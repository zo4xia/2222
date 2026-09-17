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
    { project: createMixedArithmeticProject(createSilentWavDataUrl(3)) },
  );

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.board-text-sticker', { timeout: 10000 });
  await page.waitForSelector('.golden-finger-canvas-layer', { timeout: 10000 });

  const selectDrag = await dragFirstSticker(page, 80, 40);
  const beforePixels = await countGoldenFingerPixels(page);

  await page.getByRole('button', { name: '开启标注隔层板' }).click();
  await page.getByTestId('gf-mode-pen').click();
  const canvasBox = await page.locator('.golden-finger-canvas-layer').boundingBox();
  const stageBox = await page.locator('.stage-canvas--courseware').boundingBox();
  const stageBorder = await page.locator('.stage-canvas--courseware').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      bottom: Number.parseFloat(style.borderBottomWidth || '0'),
      left: Number.parseFloat(style.borderLeftWidth || '0'),
      right: Number.parseFloat(style.borderRightWidth || '0'),
      top: Number.parseFloat(style.borderTopWidth || '0'),
    };
  });
  if (!canvasBox) {
    throw new Error('GoldenFinger canvas layer is missing.');
  }
  if (!stageBox) {
    throw new Error('Stage canvas box is missing.');
  }
  const expectedCanvasWidth = stageBox.width - stageBorder.left - stageBorder.right;
  const expectedCanvasHeight = stageBox.height - stageBorder.top - stageBorder.bottom;
  const expectedCanvasX = stageBox.x + stageBorder.left;
  const expectedCanvasY = stageBox.y + stageBorder.top;
  if (
    Math.abs(canvasBox.width - expectedCanvasWidth) > 2 ||
    Math.abs(canvasBox.height - expectedCanvasHeight) > 2 ||
    Math.abs(canvasBox.x - expectedCanvasX) > 2 ||
    Math.abs(canvasBox.y - expectedCanvasY) > 2
  ) {
    console.log(JSON.stringify({ canvasBox, expectedCanvasHeight, expectedCanvasWidth, expectedCanvasX, expectedCanvasY, stageBorder, stageBox }, null, 2));
    throw new Error('GoldenFinger canvas must cover whole stage content box.');
  }

  const firstLine = {
    endX: canvasBox.width * 0.92,
    endY: canvasBox.height * 0.08,
    startX: canvasBox.width * 0.08,
    startY: canvasBox.height * 0.08,
  };
  const secondLine = {
    endX: canvasBox.width * 0.9,
    endY: canvasBox.height * 0.88,
    startX: canvasBox.width * 0.12,
    startY: canvasBox.height * 0.88,
  };

  await drawLine(page, canvasBox, firstLine.startX, firstLine.startY, firstLine.endX, firstLine.endY);
  const afterFirstLinePixels = await countGoldenFingerPixels(page);
  const afterFirstLineStrokeCount = await readStrokeCount(page);
  await drawLine(page, canvasBox, secondLine.startX, secondLine.startY, secondLine.endX, secondLine.endY);

  const afterPixels = await countGoldenFingerPixels(page);
  const afterStrokeCount = await readStrokeCount(page);
  const stateAfterPen = await readClipState(page);
  await page.getByTestId('gf-undo').click();
  const afterUndoPixels = await countGoldenFingerPixels(page);
  const afterUndoStrokeCount = await readStrokeCount(page);
  await page.getByTestId('gf-clear').click();
  const afterClearPixels = await countGoldenFingerPixels(page);
  const afterClearStrokeCount = await readStrokeCount(page);

  await page.getByRole('button', { name: '关闭隔层板' }).click();
  const selectDragAfterPen = await dragFirstSticker(page, -50, -20);
  const screenshotPath = path.join(outputDir, `golden-finger-minimal-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const result = {
    afterPixels,
    afterClearPixels,
    afterClearStrokeCount,
    afterFirstLinePixels,
    afterFirstLineStrokeCount,
    afterStrokeCount,
    afterUndoPixels,
    afterUndoStrokeCount,
    beforePixels,
    canvasBox,
    drew: afterPixels > beforePixels,
    screenshotPath,
    selectDrag,
    selectDragAfterPen,
    selectedAfterPen: stateAfterPen.selectedClipId,
    targetUrl,
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    !result.drew ||
    !(afterFirstLinePixels > beforePixels) ||
    afterFirstLineStrokeCount !== 1 ||
    afterStrokeCount !== 2 ||
    afterUndoStrokeCount !== 1 ||
    afterClearStrokeCount !== 0 ||
    !(afterPixels > afterFirstLinePixels) ||
    !(afterUndoPixels < afterPixels && afterUndoPixels >= afterFirstLinePixels * 0.75) ||
    afterClearPixels !== 0 ||
    Math.abs(selectDrag.movedX) < 20 ||
    Math.abs(selectDragAfterPen.movedX) < 20 ||
    stateAfterPen.selectedClipId !== 'clip-board-001'
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function drawLine(page, canvasBox, startX, startY, endX, endY) {
  await page.mouse.move(canvasBox.x + startX, canvasBox.y + startY);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + endX, canvasBox.y + endY, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

async function dragFirstSticker(page, dx, dy) {
  const sticker = page.locator('.board-text-sticker').first();
  const beforeBox = await sticker.boundingBox();
  if (!beforeBox) {
    throw new Error('Board sticker has no visible bounding box.');
  }

  await page.mouse.move(beforeBox.x + beforeBox.width / 2, beforeBox.y + beforeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(beforeBox.x + beforeBox.width / 2 + dx, beforeBox.y + beforeBox.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const afterBox = await sticker.boundingBox();
  const state = await readClipState(page);
  return {
    movedX: afterBox ? Math.round((afterBox.x - beforeBox.x) * 10) / 10 : 0,
    movedY: afterBox ? Math.round((afterBox.y - beforeBox.y) * 10) / 10 : 0,
    selectedClipId: state.selectedClipId,
  };
}

async function countGoldenFingerPixels(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('.golden-finger-canvas-layer');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return -1;
    }

    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        count += 1;
      }
    }
    return count;
  });
}

async function readStrokeCount(page) {
  return page.evaluate(() => Number(document.querySelector('.golden-finger-canvas-layer')?.getAttribute('data-stroke-count') || '0'));
}

async function readClipState(page) {
  return page.evaluate(() => ({
    clip: window.__TEACHING_EDITOR_STORE__?.getState().project.timeline.clips.find((item) => item.id === 'clip-board-001'),
    selectedClipId: window.__TEACHING_EDITOR_STORE__?.getState().selectedClipId,
  }));
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
    task: { source: 'manual', taskId: 'abc-mixed-arithmetic-smoke' },
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
