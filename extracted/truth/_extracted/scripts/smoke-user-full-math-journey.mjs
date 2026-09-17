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
const mathProblem = '计算：12÷3+4等于多少？';

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

  const screenshots = [];
  const shot = async (name) => {
    const fileName = `user-journey-${name}-${stamp}.png`;
    await page.screenshot({ path: join(outputDir, fileName), fullPage: true });
    screenshots.push(fileName);
  };

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await shot('01-home');

  await page.locator('.recognized-result-text--display').click();
  await page.locator('.recognized-result-text--editor').fill(mathProblem);
  await shot('02-problem-filled');

  await page.locator('button.problem-primary-action').click();
  await page.waitForSelector('.script-agent-workspace', { timeout: 30000 });
  await shot('03-agent-opened');

  const applyButton = page.getByRole('button', { name: /确认应用到正式稿|已应用到正式稿/ });
  const agentError = page.locator('.agent-review-card .ant-alert-error');
  const agentReady = await waitForOneOf([
    async () => (await applyButton.count()) > 0 && !(await applyButton.isDisabled()) ? 'ready' : '',
    async () => await agentError.count() ? 'error' : '',
  ], 90000);

  let agentStage = 'unknown';
  let agentErrorText = '';
  if (agentReady === 'error') {
    agentStage = 'error';
    agentErrorText = ((await agentError.first().textContent()) || '').trim();
  } else if (agentReady === 'ready') {
    agentStage = 'ready';
  }

  await shot('04-agent-result');

  let applied = false;
  if (agentStage === 'ready') {
    await applyButton.click();
    await page.waitForTimeout(1500);
    await shot('05-after-apply');
    applied = true;
  }

  let ttsStage = 'skipped';
  let ttsErrorText = '';
  if (applied) {
    const ttsButton = page.locator('.voice-action-card button.ant-btn-primary');
    await ttsButton.click();
    const ttsError = page.locator('.voice-action-card .ant-alert-error');
    const ttsSuccess = page.locator('.voice-action-card .ant-alert-success, .voice-action-card .ant-alert-warning');
    const ttsReady = await waitForOneOf([
      async () => await ttsSuccess.count() ? 'ready' : '',
      async () => await ttsError.count() ? 'error' : '',
    ], 180000);
    if (ttsReady === 'ready') {
      ttsStage = 'ready';
    } else if (ttsReady === 'error') {
      ttsStage = 'error';
      ttsErrorText = ((await ttsError.first().textContent()) || '').trim();
    }
    await shot('06-tts-result');
  }

  let playback = { attempted: false, before: '', after: '' };
  if (ttsStage === 'ready') {
    const playButton = page.locator('.timeline-play-button');
    const timelineBar = page.locator('.timeline-playbar');
    playback.before = (((await timelineBar.textContent()) || '').replace(/\s+/g, ' ')).trim();
    await playButton.click();
    await page.waitForTimeout(3000);
    playback.after = (((await timelineBar.textContent()) || '').replace(/\s+/g, ' ')).trim();
    playback.attempted = true;
    await shot('07-playback');
  }

  const summary = await page.evaluate(() => {
    const project = JSON.parse(window.localStorage.getItem('cleanroom-teaching-project-v1') || '{}');
    return {
      assetStatuses: (project.assets || []).map((asset) => ({
        kind: asset.kind,
        status: asset.status,
        summaryPreview: String(asset.summary || '').slice(0, 80),
      })),
      bodyHead: document.body.innerText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 80),
      clipCount: project.timeline?.clips?.length || 0,
      hasAgentModal: Boolean(document.querySelector('.ant-modal-root')),
      locationHref: window.location.href,
    };
  });

  console.log(JSON.stringify({
    agentErrorText,
    agentStage,
    consoleMessages: consoleMessages.slice(-30),
    mathProblem,
    pageErrors,
    playback,
    screenshots,
    summary,
    targetUrl,
    ttsErrorText,
    ttsStage,
  }, null, 2));
} finally {
  await browser.close();
}

async function waitForOneOf(checks, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const check of checks) {
      const value = await check();
      if (value) {
        return value;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return 'timeout';
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
