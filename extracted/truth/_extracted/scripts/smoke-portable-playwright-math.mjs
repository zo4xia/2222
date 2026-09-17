import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const portableRoot = process.env.CLEANROOM_PORTABLE_DIST;
if (!portableRoot) {
  throw new Error('CLEANROOM_PORTABLE_DIST is required. Do not hardcode a machine-local portable dist path in this project.');
}
const { chromium } = require(path.join(portableRoot, 'node_modules', 'playwright'));
const executablePath =
  process.env.CLEANROOM_CHROMIUM_PATH ||
  path.join(portableRoot, '.playwright-browsers', 'chromium-1176', 'chrome-win', 'chrome.exe');
const outputDir = path.resolve('.tmp-smoke');

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath,
  headless: true,
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://127.0.0.1:5197', { waitUntil: 'networkidle', timeout: 30000 });

  const result = await page.evaluate(() => {
    const mathText = Array.from(document.querySelectorAll('.math-text'));
    const mathEditorInput = Array.from(document.querySelectorAll('.math-editor-input'));
    const firstMathText = mathText[0];
    const mathStyle = firstMathText ? window.getComputedStyle(firstMathText) : null;

    return {
      bodyTextSample: document.body.innerText.slice(0, 600),
      mathEditorInputCount: mathEditorInput.length,
      mathTextCount: mathText.length,
      mathTextWhiteSpace: mathStyle?.whiteSpace ?? '',
      title: document.title,
    };
  });

  await page.screenshot({ fullPage: true, path: path.join(outputDir, 'portable-playwright-math-smoke.png') });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
