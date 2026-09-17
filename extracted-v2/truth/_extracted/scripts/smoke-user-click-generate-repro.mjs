import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const outputDir = join(process.cwd(), '.tmp-ui-smoke');
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');

const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleMessages = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (error) => pageErrors.push(String(error)));

  await page.addInitScript(() => {
    const configKey = 'cleanroom-app-config-v1';
    const projectKey = 'cleanroom-teaching-project-v1';
    const pendingKey = 'cleanroom-pending-teaching-project-v1';
    const draftKey = 'cleanroom-script-agent-candidate-draft-v1';
    const chatKey = 'cleanroom-script-agent-chat-history-v2';

    const rawConfig = window.localStorage.getItem(configKey);
    const config = rawConfig ? JSON.parse(rawConfig) : {};
    config.recognition = { ...(config.recognition || {}), provider: 'manual-first' };
    config.automation = { ...(config.automation || {}), mode: 'manual-review' };
    window.localStorage.setItem(configKey, JSON.stringify(config));
    window.localStorage.removeItem(projectKey);
    window.localStorage.removeItem(pendingKey);
    window.localStorage.removeItem(draftKey);
    window.localStorage.removeItem(chatKey);
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.screenshot({ path: join(outputDir, `repro-generate-01-home-${stamp}.png`), fullPage: true });

  await page.locator('.recognized-result-text--display').click();
  await page.locator('.recognized-result-text--editor').fill('计算：12÷3+4等于多少？');
  await page.screenshot({ path: join(outputDir, `repro-generate-02-filled-${stamp}.png`), fullPage: true });

  const generateButton = page.getByRole('button', { name: /讲解生成/ });
  await generateButton.click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(outputDir, `repro-generate-03-after-click-${stamp}.png`), fullPage: true });

  const result = await page.evaluate(() => ({
    bodyTextHead: document.body.innerText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 60),
    hasAppShell: Boolean(document.querySelector('.app-shell')),
    hasScriptAgentWorkspace: Boolean(document.querySelector('.script-agent-workspace')),
    hasModal: Boolean(document.querySelector('.ant-modal-root')),
    locationHref: window.location.href,
    pendingProject: window.localStorage.getItem('cleanroom-pending-teaching-project-v1'),
    project: window.localStorage.getItem('cleanroom-teaching-project-v1'),
  }));

  console.log(JSON.stringify({
    consoleMessages: consoleMessages.slice(-20),
    pageErrors,
    result,
    screenshots: [
      `repro-generate-01-home-${stamp}.png`,
      `repro-generate-02-filled-${stamp}.png`,
      `repro-generate-03-after-click-${stamp}.png`,
    ],
    targetUrl,
  }, null, 2));
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
