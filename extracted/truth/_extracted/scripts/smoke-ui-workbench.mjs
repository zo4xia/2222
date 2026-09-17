import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}
const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const outputDir = path.resolve('.tmp-ui-smoke');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const screenshotPath = path.join(outputDir, `workbench-${timestamp}.png`);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => {
    const count = (selector) => document.querySelectorAll(selector).length;
    const visible = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const bodyText = document.body.innerText;
    const headerActionLabels = ['配置', '设置默认目录', '保存目录', '历史工程', '导入 project.json'];
    const headerButtonTexts = Array.from(document.querySelectorAll('.app-command-bar button')).map((button) => button.textContent?.trim() || '');
    return {
      bodyTextSample: bodyText.slice(0, 500),
      hasAppShell: visible('.app-shell'),
      hasHeaderActions: headerActionLabels.every((label) => headerButtonTexts.some((text) => text.includes(label))),
      hasStageCanvas: visible('.stage-canvas'),
      hasTimeline: visible('.timeline'),
      hasWorkflow: visible('.workflow-card'),
      headerButtonTexts,
      scriptSegmentPreviewCount: count('.script-segment-preview'),
      scriptSegmentWorkbenchCount: count('.script-segment-workbench'),
      stageCanvasCount: count('.stage-canvas'),
      timelineClipCount: count('.clip'),
      title: document.title,
      workflowStepCount: count('.workflow-step'),
    };
  });

  await page.screenshot({ fullPage: true, path: screenshotPath });

  const requiredChecks = ['hasAppShell', 'hasHeaderActions', 'hasStageCanvas', 'hasTimeline', 'hasWorkflow'];
  const missing = requiredChecks.filter((key) => !result[key]);

  console.log(
    JSON.stringify(
      {
        ...result,
        missing,
        screenshotPath,
        targetUrl,
      },
      null,
      2,
    ),
  );

  if (missing.length) {
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
