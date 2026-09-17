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
  await page.addInitScript(({ project }) => {
    window.localStorage.setItem('cleanroom-app-config-v1', JSON.stringify({ recognition: { provider: 'manual-first' } }));
    window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(project));
    window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
  }, { project: createDragLaneProject() });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('B 轨拖动不飘轴实例'), null, { timeout: 10000 });

  const b2Clip = page.locator('.board-sticker-lane-row', { hasText: 'B2 draggable middle' }).locator('.clip').first();
  await b2Clip.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);

  const beforeDrag = await readBoardLaneState(page);
  const b2Before = beforeDrag.rows.find((row) => row.clipTitle.includes('B2 draggable middle'));
  if (!b2Before) {
    throw new Error('B2 clip is missing before drag.');
  }

  const b2Box = await b2Clip.boundingBox();
  if (!b2Box) {
    throw new Error('B2 clip has no visible bounding box.');
  }

  const startX = b2Box.x + b2Box.width / 2;
  const startY = b2Box.y + b2Box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX - 380, startY, { steps: 8 });
  await page.waitForTimeout(120);

  const duringDrag = await readBoardLaneState(page);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const afterDrag = await readBoardLaneState(page);

  console.log(JSON.stringify({ afterDrag, beforeDrag, duringDrag, targetUrl }, null, 2));

  assertB2StayedInLane(beforeDrag, duringDrag, 'during drag');
  assertB2StayedInLane(beforeDrag, afterDrag, 'after drag');
} finally {
  await browser.close();
}

function assertB2StayedInLane(beforeDrag, nextState, phase) {
  const beforeB2 = beforeDrag.rows.find((row) => row.clipTitle.includes('B2 draggable middle'));
  const nextB2 = nextState.rows.find((row) => row.clipTitle.includes('B2 draggable middle'));
  if (!beforeB2 || !nextB2) {
    throw new Error(`B2 clip is missing ${phase}.`);
  }
  if (nextB2.rowIndex !== beforeB2.rowIndex) {
    throw new Error(`B2 clip drifted from row ${beforeB2.rowIndex} to row ${nextB2.rowIndex} ${phase}.`);
  }
  if (nextB2.clipCenterY < nextB2.laneTop || nextB2.clipCenterY > nextB2.laneBottom) {
    throw new Error(`B2 clip vertical center left its current B lane ${phase}.`);
  }
  if (nextB2.clipTop < nextB2.laneTop - 0.5 || nextB2.clipBottom > nextB2.laneBottom + 0.5) {
    throw new Error(`B2 clip box escaped its current B lane ${phase}.`);
  }
}

async function readBoardLaneState(page) {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.board-sticker-lane-row')).map((row, rowIndex) => {
      const lane = row.querySelector('.board-sticker-lane');
      const clip = row.querySelector('.clip');
      const laneRect = lane?.getBoundingClientRect();
      const clipRect = clip?.getBoundingClientRect();
      return {
        clipBottom: clipRect?.bottom ?? 0,
        clipCenterY: clipRect ? clipRect.top + clipRect.height / 2 : 0,
        clipTitle: clip?.textContent?.trim() || '',
        clipTop: clipRect?.top ?? 0,
        label: row.querySelector('.board-sticker-lane-label')?.textContent?.trim() || '',
        laneBottom: laneRect?.bottom ?? 0,
        laneTop: laneRect?.top ?? 0,
        rowIndex,
      };
    });
    const project = window.__TEACHING_EDITOR_STORE__?.getState().project;
    const b2Clip = project?.timeline.clips.find((clip) => clip.id === 'clip-board-002');
    return {
      b2Timing: b2Clip ? { endMs: b2Clip.endMs, startMs: b2Clip.startMs } : null,
      rows,
    };
  });
}

function createDragLaneProject() {
  return {
    id: 'b-timeline-drag-lane-smoke',
    title: 'B 轨拖动不飘轴实例',
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
      taskId: 'b-timeline-drag-lane-smoke',
    },
    assets: [
      {
        id: 'asset-problem-text',
        kind: 'problemText',
        source: 'manual',
        status: 'ready',
        summary: '拖动 B2 不能跑到 B1 行。',
        title: '图片题目文本',
      },
    ],
    timeline: {
      clips: [
        {
          chainKey: 'step-1',
          endMs: 1300,
          id: 'clip-board-001',
          kind: 'board',
          label: 'B1 stable first',
          revealEndMs: 1300,
          revealStartMs: 800,
          sourceEndMs: 1300,
          sourceRef: 'tts-sentence-001',
          sourceStartMs: 800,
          startMs: 800,
          trackId: 'track-board',
        },
        {
          chainKey: 'step-2',
          endMs: 2100,
          id: 'clip-board-002',
          kind: 'board',
          label: 'B2 draggable middle',
          revealEndMs: 2100,
          revealStartMs: 1500,
          sourceEndMs: 2100,
          sourceRef: 'tts-sentence-002',
          sourceStartMs: 1500,
          startMs: 1500,
          trackId: 'track-board',
        },
        {
          chainKey: 'step-3',
          endMs: 2800,
          id: 'clip-board-003',
          kind: 'board',
          label: 'B3 stable last',
          revealEndMs: 2800,
          revealStartMs: 2200,
          sourceEndMs: 2800,
          sourceRef: 'tts-sentence-003',
          sourceStartMs: 2200,
          startMs: 2200,
          trackId: 'track-board',
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
