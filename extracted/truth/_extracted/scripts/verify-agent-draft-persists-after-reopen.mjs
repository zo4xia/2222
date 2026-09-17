import { existsSync, mkdirSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const problem = process.env.CLEANROOM_PROBLEM || '小红有18支铅笔，平均分给6个同学，每个同学分到几支？';
const outputDir = path.resolve('.tmp-ui-smoke');
const logDir = path.resolve('logs');
const logPath = path.join(logDir, 'verify-agent-draft-persists-after-reopen.log');
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

  await page.locator('button.problem-primary-action').click();
  await page.waitForSelector('.script-agent-workspace', { timeout: 90000 });
  await shot(page, '03-agent-opened');

  await waitForRows(page, 90000);
  await shot(page, '04-agent-generated');

  await page.locator('.ant-modal-close').click();
  await shot(page, '05-agent-closed');

  await page.getByRole('button', { name: '文稿与 C 素材 Agent' }).first().click();
  await page.waitForSelector('.script-agent-workspace', { timeout: 30000 });
  await shot(page, '06-agent-reopened');

  const state = await page.evaluate(() => {
    const draftRaw = localStorage.getItem('cleanroom-script-agent-candidate-draft-v1');
    const draft = draftRaw ? JSON.parse(draftRaw) : null;
    return {
      bodyHead: document.body.innerText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 80),
      draftRowCount: Array.isArray(draft?.rows) ? draft.rows.length : 0,
      hasApplyButton: Boolean([...document.querySelectorAll('button')].find((button) => button.textContent?.includes('确认应用到正式稿'))),
      hasRowsCountText: document.body.innerText.includes('行切片'),
    };
  });

  await writeLog(`STATE ${JSON.stringify(state)}`);
  await page.waitForTimeout(300000);
} finally {
  await browser.close();
}

async function waitForRows(page, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('行切片') || body.includes('确认应用到正式稿');
    });
    if (ready) {
      return;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Timed out waiting for generated rows after ${timeoutMs}ms`);
}

async function shot(page, name) {
  const filePath = path.join(outputDir, `verify-agent-draft-persists-${name}.png`);
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

  return (
    [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    ].find((browserPath) => existsSync(browserPath)) || ''
  );
}
