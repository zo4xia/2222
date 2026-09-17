import { existsSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const targetUrl = process.env.CLEANROOM_TARGET_URL || 'http://127.0.0.1:5196';
const outputDir = path.resolve('logs');
const logPath = path.join(outputDir, 'browser-monitor.log');
const executablePath = resolveChromiumExecutablePath();

if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

mkdirSync(outputDir, { recursive: true });
await writeLog(`START ${targetUrl}`);

const browser = await chromium.launch({
  executablePath,
  headless: false,
});

const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });

page.on('console', (message) => {
  void writeLog(`CONSOLE ${message.type()} ${message.text()}`);
});

page.on('pageerror', (error) => {
  void writeLog(`PAGEERROR ${error.message}`);
});

page.on('requestfailed', (request) => {
  void writeLog(`REQUEST_FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`);
});

page.on('response', (response) => {
  const url = response.url();
  if (/cosyvoice|tts|gateway|api|aliyun/i.test(url) || response.status() >= 400) {
    void writeLog(`RESPONSE ${response.status()} ${url}`);
  }
});

await page.goto(targetUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
await writeSnapshot(page, 'OPENED');

setInterval(() => {
  void writeSnapshot(page, 'POLL');
}, 3000);

async function writeSnapshot(page, label) {
  try {
    const snapshot = await page.evaluate(() => {
      const rawProject = localStorage.getItem('cleanroom-teaching-project-v1');
      const project = rawProject ? JSON.parse(rawProject) : null;
      const clips = project?.timeline?.clips ?? [];
      const assets = project?.assets ?? [];
      const cAssets = Array.isArray(project?.cAssets) ? project.cAssets : [];
      const voiceAudio = assets.find((asset) => asset.kind === 'voiceAudio') ?? null;
      const voiceTiming = assets.find((asset) => asset.kind === 'voiceTiming') ?? null;

      return {
        audioClipCount: clips.filter((clip) => clip.kind === 'audio').length,
        boardClipCount: clips.filter((clip) => clip.kind === 'board').length,
        cAssetsLength: cAssets.length,
        hasProject: Boolean(project),
        voiceAudioStatus: voiceAudio?.status ?? null,
        voiceTimingStatus: voiceTiming?.status ?? null,
      };
    });
    await writeLog(`${label} ${JSON.stringify(snapshot)}`);
  } catch (error) {
    await writeLog(`${label}_ERROR ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeLog(line) {
  const stamp = new Date().toISOString();
  await appendFile(logPath, `[${stamp}] ${line}\n`, 'utf8');
  console.log(`[${stamp}] ${line}`);
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
