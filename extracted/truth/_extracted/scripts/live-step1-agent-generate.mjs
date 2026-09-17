import { existsSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const problem = process.env.CLEANROOM_PROBLEM || '小红有18支铅笔，平均分给6个同学，每个同学分到几支？';
const outputDir = path.resolve('.tmp-ui-smoke');
const logDir = path.resolve('logs');
const logPath = path.join(logDir, 'live-step1-agent-generate.log');
const executablePath = resolveChromiumExecutablePath();

if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: false,
  slowMo: 120,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('console', (msg) => void writeLog(`CONSOLE ${msg.type()} ${msg.text()}`));
  page.on('pageerror', (error) => void writeLog(`PAGEERROR ${error.message}`));
  page.on('requestfailed', (request) =>
    void writeLog(`REQUEST_FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`),
  );

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

  await writeLog(`START ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await shot(page, '01-home');

  await page.locator('.recognized-result-text--display').click();
  await page.locator('.recognized-result-text--editor').fill(problem);
  await shot(page, '02-problem-filled');
  await writeLog(`FILLED ${problem}`);

  await page.locator('button.problem-primary-action').click();
  await writeLog('CLICKED_PROBLEM_PRIMARY_ACTION');

  await Promise.race([
    page.waitForSelector('.script-agent-workspace', { timeout: 90000 }),
    page.waitForSelector('.ant-alert-error', { timeout: 90000 }),
  ]);

  await shot(page, '03-agent-stage');
  const state = await page.evaluate(() => ({
    bodyHead: document.body.innerText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 80),
    hasAgentWorkspace: Boolean(document.querySelector('.script-agent-workspace')),
    hasErrorAlert: Boolean(document.querySelector('.ant-alert-error')),
    pendingDraft: Boolean(localStorage.getItem('cleanroom-script-agent-candidate-draft-v1')),
  }));
  await writeLog(`STATE ${JSON.stringify(state)}`);

  await writeLog('WINDOW_STAYS_OPEN_5MIN');
  await page.waitForTimeout(300000);
} finally {
  await browser.close();
}

async function shot(page, name) {
  const filePath = path.join(outputDir, `live-step1-agent-generate-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  await writeLog(`SHOT ${filePath}`);
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

  const localDebugBrowsers = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];

  return localDebugBrowsers.find((browserPath) => existsSync(browserPath)) || '';
}
