import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = resolveChromiumExecutablePath();
if (!executablePath) {
  throw new Error('CLEANROOM_CHROMIUM_PATH is required, or install Edge/Chrome in a standard Windows location.');
}

const targetUrl = process.env.CLEANROOM_SMOKE_URL || 'http://127.0.0.1:5196';
const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    class MockFileHandle {
      constructor(name) {
        this.name = name;
        this.content = '';
      }

      async createWritable() {
        return {
          close: async () => undefined,
          write: async (data) => {
            this.content = data;
          },
        };
      }

      async getFile() {
        return new File([this.content], this.name);
      }
    }

    class MockDirectoryHandle {
      constructor(name, log) {
        this.name = name;
        this.children = new Map();
        this.files = new Map();
        this.log = log;
      }

      async getDirectoryHandle(name, options = {}) {
        if (!this.children.has(name)) {
          if (!options.create) {
            throw new DOMException(`${name} not found`, 'NotFoundError');
          }
          this.children.set(name, new MockDirectoryHandle(name, this.log));
          this.log.createdDirectories.push(name);
        }
        return this.children.get(name);
      }

      async getFileHandle(name, options = {}) {
        if (!this.files.has(name)) {
          if (!options.create) {
            throw new DOMException(`${name} not found`, 'NotFoundError');
          }
          this.files.set(name, new MockFileHandle(name));
          this.log.writtenFiles.push(name);
        }
        return this.files.get(name);
      }

      async queryPermission() {
        return 'granted';
      }

      async requestPermission() {
        return 'granted';
      }
    }

    const log = {
      createdDirectories: [],
      pickCount: 0,
      writtenFiles: [],
    };
    const rootDirectory = new MockDirectoryHandle('XiaxiaCoursework', log);
    window.__defaultDirectorySmoke = log;
    window.showDirectoryPicker = async () => {
      log.pickCount += 1;
      return rootDirectory;
    };
  });

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('.app-shell', { timeout: 30000 });
  await page.getByRole('button', { name: /设置默认目录/ }).click();
  await page.waitForFunction(() => document.body.innerText.includes('已设置默认保存目录：XiaxiaCoursework'), null, { timeout: 10000 });
  await page.locator('.project-archive-actions button').filter({ hasText: '保存目录' }).click();
  await page.waitForFunction(() => document.body.innerText.includes('默认目录 XiaxiaCoursework'), null, { timeout: 10000 });

  const result = await page.evaluate(() => window.__defaultDirectorySmoke);
  console.log(JSON.stringify({ ...result, targetUrl }, null, 2));

  if (
    result.pickCount !== 1 ||
    result.createdDirectories.length !== 1 ||
    !result.writtenFiles.includes('project.json')
  ) {
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
