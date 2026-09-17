import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const targetUrl = process.env.CLEANROOM_TARGET_URL || 'http://127.0.0.1:5196';
const executablePath = resolveChromiumExecutablePath();

if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  const result = await page.evaluate(() => {
    const rawProject = localStorage.getItem('cleanroom-teaching-project-v1');
    const project = rawProject ? JSON.parse(rawProject) : null;
    const clips = project?.timeline?.clips ?? [];
    const cAssets = Array.isArray(project?.cAssets) ? project.cAssets : [];

    return {
      audioClipCount: clips.filter((clip) => clip.kind === 'audio').length,
      boardClipCount: clips.filter((clip) => clip.kind === 'board').length,
      cAssets: cAssets.map((asset) => ({
        chainKey: asset.chainKey,
        id: asset.id,
        markerText: asset.markerText,
        sentenceId: asset.sentenceId,
        status: asset.status,
      })),
      cAssetsLength: cAssets.length,
      hasProject: Boolean(project),
      voiceAudio: project?.assets?.find((asset) => asset.kind === 'voiceAudio') ?? null,
      voiceTiming: project?.assets?.find((asset) => asset.kind === 'voiceTiming') ?? null,
    };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
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
