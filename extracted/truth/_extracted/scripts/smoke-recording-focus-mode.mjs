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
      class FakeTrack extends EventTarget {
        stop() {
          this.dispatchEvent(new Event('ended'));
        }
      }

      class FakeMediaStream {
        constructor() {
          this.track = new FakeTrack();
        }

        getTracks() {
          return [this.track];
        }

        getVideoTracks() {
          return [this.track];
        }
      }

      class FakeMediaRecorder extends EventTarget {
        static isTypeSupported() {
          return true;
        }

        constructor(stream, options) {
          super();
          this.mimeType = options?.mimeType || 'video/webm';
          this.state = 'inactive';
          this.stream = stream;
        }

        start() {
          this.state = 'recording';
        }

        stop() {
          if (this.state === 'inactive') {
            return;
          }

          this.state = 'inactive';
          const dataEvent = new Event('dataavailable');
          Object.defineProperty(dataEvent, 'data', {
            value: new Blob(['recording-focus-smoke'], { type: this.mimeType }),
          });
          this.dispatchEvent(dataEvent);
          this.dispatchEvent(new Event('stop'));
        }
      }

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getDisplayMedia: async () => new FakeMediaStream(),
        },
      });
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: FakeMediaRecorder,
      });
      window.__cleanroomLastCapturedCanvas = null;
      HTMLCanvasElement.prototype.captureStream = function captureStream() {
        window.__cleanroomLastCapturedCanvas = this;
        return new FakeMediaStream();
      };

      window.localStorage.setItem('cleanroom-teaching-project-v1', JSON.stringify(project));
      window.localStorage.removeItem('cleanroom-pending-teaching-project-v1');
    },
    { project: createReadyProject(createSilentWavDataUrl(3)) },
  );

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });

  const beforeRecording = await readFocusState(page);
  await page.locator('.stage-recorder-control button').first().click();
  await page.waitForSelector('.app-shell--recording-focus', { timeout: 10000 });
  await page.waitForFunction(() => {
    const canvas = window.__cleanroomLastCapturedCanvas;
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const context = canvas.getContext('2d');
    if (!context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let darkPixels = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 80 && data[index + 1] < 80 && data[index + 2] < 80 && data[index + 3] > 0) {
        darkPixels += 1;
      }
      if (darkPixels > 24) return true;
    }
    return false;
  }, null, { timeout: 10000 });
  const duringRecording = await readFocusState(page);
  const duringScreenshotPath = path.join(outputDir, `recording-focus-active-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await page.screenshot({ path: duringScreenshotPath, fullPage: true });

  await page.locator('.stage-recorder-control button').first().click();
  await page.waitForFunction(() => !document.querySelector('.app-shell--recording-focus'), null, { timeout: 10000 });
  const afterRecording = await readFocusState(page);
  const afterScreenshotPath = path.join(outputDir, `recording-focus-restored-${new Date().toISOString().replace(/[:.]/g, '-')}.png`);
  await page.screenshot({ path: afterScreenshotPath, fullPage: true });

  const result = {
    afterRecording,
    beforeRecording,
    duringRecording,
    screenshots: {
      afterRecording: afterScreenshotPath,
      duringRecording: duringScreenshotPath,
    },
    targetUrl,
  };
  console.log(JSON.stringify(result, null, 2));

  if (
    beforeRecording.focusMode ||
    !beforeRecording.headerVisible ||
    !beforeRecording.timelineVisible ||
    !duringRecording.focusMode ||
    duringRecording.headerVisible ||
    duringRecording.assetsVisible ||
    duringRecording.inspectorVisible ||
    duringRecording.sideToolDockVisible ||
    duringRecording.stageToolOverlayVisible ||
    duringRecording.timelineVisible ||
    !duringRecording.stageVisible ||
    duringRecording.recordButtonText !== '停止' ||
    afterRecording.focusMode ||
    !afterRecording.headerVisible ||
    !afterRecording.timelineVisible ||
    !afterRecording.stageVisible
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}

async function readFocusState(page) {
  return page.evaluate(() => {
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };

    return {
      assetsVisible: visible('.workspace-sider--assets'),
      focusMode: Boolean(document.querySelector('.app-shell--recording-focus')),
      headerVisible: visible('.app-header'),
      inspectorVisible: visible('.workspace-sider--inspector'),
      recordButtonText: document.querySelector('.stage-recorder-control button')?.textContent?.trim() || '',
      sideToolDockVisible: visible('.side-tool-dock'),
      stageToolOverlayVisible: visible('.board-stage-tool-overlay'),
      stageVisible: visible('.zone-stage'),
      timelineVisible: visible('.zone-timeline'),
    };
  });
}

function createReadyProject(sourceRef) {
  return {
    id: 'recording-focus-smoke',
    title: '录制聚焦实例',
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
    task: { source: 'manual', taskId: 'recording-focus-smoke' },
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
      playheadMs: 600,
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
