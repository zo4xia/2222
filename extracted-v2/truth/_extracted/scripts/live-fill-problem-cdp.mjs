import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('.tmp-ui-smoke');
mkdirSync(outputDir, { recursive: true });

const problemText = '小明有12支铅笔，送给同桌3支后，又买了5支。现在小明一共有多少支铅笔？';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');

try {
  const [context] = browser.contexts();
  if (!context) {
    throw new Error('No Chrome context found on 9222.');
  }

  const page = context.pages().find((candidate) => candidate.url().includes('127.0.0.1:5196')) ?? context.pages()[0];
  if (!page) {
    throw new Error('No page found for local dev server.');
  }

  await page.bringToFront();
  await page.waitForSelector('.recognized-result-text--display', { timeout: 30000 });
  await page.locator('.recognized-result-text--display').click();
  await page.locator('.recognized-result-text--editor').fill(problemText);
  await page.screenshot({ path: path.join(outputDir, 'live-fill-problem-cdp.png'), fullPage: true });
} finally {
  await browser.close();
}
