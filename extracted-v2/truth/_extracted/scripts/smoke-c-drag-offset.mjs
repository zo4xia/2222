import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const targetUrl = process.env.TARGET_URL || 'http://127.0.0.1:5196';
const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.board-text-sticker', { timeout: 15000 });

  const sticker = page.locator('.board-text-sticker').first();
  const before = await sticker.boundingBox();
  if (!before) {
    throw new Error('No board sticker bounding box before drag.');
  }

  const startX = before.x + 12;
  const startY = before.y + Math.max(12, before.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 40, startY + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);

  const after = await sticker.boundingBox();
  if (!after) {
    throw new Error('No board sticker bounding box after drag.');
  }

  const screenshotDir = path.join(process.cwd(), '.tmp-ui-smoke');
  await mkdir(screenshotDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshot = path.join(screenshotDir, `c-drag-offset-${stamp}.png`);
  await page.screenshot({ fullPage: true, path: screenshot });

  const deltaX = Math.round(after.x - before.x);
  const deltaY = Math.round(after.y - before.y);
  const movedWithPointer = Math.abs(deltaX - 40) <= 12 && Math.abs(deltaY - 20) <= 12;

  console.log(
    JSON.stringify(
      {
        after: { x: Math.round(after.x), y: Math.round(after.y) },
        before: { x: Math.round(before.x), y: Math.round(before.y) },
        delta: { x: deltaX, y: deltaY },
        movedWithPointer,
        screenshot,
        targetUrl,
      },
      null,
      2,
    ),
  );

  if (!movedWithPointer) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
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
