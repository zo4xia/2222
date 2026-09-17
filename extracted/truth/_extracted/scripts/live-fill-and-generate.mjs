import { existsSync, mkdirSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const problem =
  process.env.CLEANROOM_PROBLEM || '小明有12颗糖，平均分给3个同学，每人分到几颗？';
const outputDir = path.resolve('.tmp-ui-smoke');
const logDir = path.resolve('logs');
const logPath = path.join(logDir, 'live-fill-and-generate.log');
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

await writeLog(`START ${targetUrl}`);
await page.goto(targetUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
await page.waitForSelector('.app-shell', { timeout: 30000 });
await page.bringToFront();
await shot(page, '01-open');

await page.locator('.recognized-result-text--display').click();
await page.locator('.recognized-result-text--editor').fill(problem);
await shot(page, '02-filled');
await writeLog(`FILLED ${problem}`);

const agentButton = page.getByRole('button', { name: '文稿与 C 素材 Agent' }).first();
await agentButton.click();
await shot(page, '03-open-agent');
await writeLog('OPENED_SCRIPT_AGENT');

const generateButton = page.getByRole('button', { name: /讲解生成|生成讲解|生成文稿/ }).first();
await generateButton.click();
await shot(page, '04-click-agent-generate');
await writeLog('CLICKED_AGENT_GENERATE');

for (let index = 0; index < 30; index += 1) {
  await page.waitForTimeout(3000);
  const state = await readState(page);
  await writeLog(`POLL ${JSON.stringify(state)}`);
}

await shot(page, '05-after-monitor');
await writeLog('DONE_MONITOR_WINDOW_STAYS_OPEN_5MIN');
await page.waitForTimeout(300000);
await browser.close();

async function shot(page, name) {
  const filePath = path.join(outputDir, `live-flow-${name}.png`);
  await page.screenshot({ fullPage: true, path: filePath });
  await writeLog(`SHOT ${filePath}`);
}

async function readState(page) {
  return page.evaluate(() => {
    const rawProject = localStorage.getItem('cleanroom-teaching-project-v1');
    const pendingRaw = localStorage.getItem('cleanroom-pending-teaching-project-v1');
    const draftRaw = localStorage.getItem('cleanroom-script-agent-candidate-draft-v1');
    const project = rawProject ? JSON.parse(rawProject) : null;
    const pendingProject = pendingRaw ? JSON.parse(pendingRaw) : null;
    const draft = draftRaw ? JSON.parse(draftRaw) : null;
    const clips = project?.timeline?.clips ?? [];
    const assets = project?.assets ?? [];
    const cAssets = Array.isArray(project?.cAssets) ? project.cAssets : [];
    const voiceAudio = assets.find((asset) => asset.kind === 'voiceAudio') ?? null;
    const voiceTiming = assets.find((asset) => asset.kind === 'voiceTiming') ?? null;

    return {
      audioClipCount: clips.filter((clip) => clip.kind === 'audio').length,
      boardClipCount: clips.filter((clip) => clip.kind === 'board').length,
      cAssetsLength: cAssets.length,
      hasDraft: Boolean(draft),
      hasPendingProject: Boolean(pendingProject),
      hasProject: Boolean(project),
      voiceAudioStatus: voiceAudio?.status ?? null,
      voiceTimingStatus: voiceTiming?.status ?? null,
    };
  });
}

async function writeLog(line) {
  const stamp = new Date().toISOString();
  const payload = `[${stamp}] ${line}\n`;
  await appendFile(logPath, payload, 'utf8');
  await writeFile(path.join(outputDir, 'live-flow-last.log'), payload, { encoding: 'utf8', flag: 'a' });
  console.log(payload.trimEnd());
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
