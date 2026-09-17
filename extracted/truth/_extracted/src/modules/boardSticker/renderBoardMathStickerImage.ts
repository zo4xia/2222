// @cleanroom-module: renderBoardMathStickerImage
// @domain: board-sticker-rendering/math-image
// @depends: browser Canvas API, KaTeX, board math tokenization
// @boundary: local transparent image generation only; no timeline, no AI, no storage

import katex from 'katex';
import { createBoardFontFamily, DEFAULT_BOARD_FONT_NAME, DEFAULT_BOARD_FONT_SIZE } from '../boardFont/boardFontConfig';
import { tokenizeBoardText } from './mathBoardText';

const mathStickerImageCache = new Map<string, BoardTextStickerImage>();
const MAX_CACHE_SIZE = 100;

export type BoardTextStickerImage = {
  dataUrl: string;
  height: number;
  width: number;
};

export type BoardTextStickerImageOptions = {
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
};

const DEFAULT_OPTIONS = {
  color: '#111111',
  fontFamily: createBoardFontFamily(DEFAULT_BOARD_FONT_NAME),
  fontSize: DEFAULT_BOARD_FONT_SIZE,
  lineHeight: 1.22,
  paddingX: 6,
  paddingY: 4,
} satisfies Required<BoardTextStickerImageOptions>;

export async function renderBoardMathStickerImage(
  text: string,
  options: BoardTextStickerImageOptions = {},
): Promise<BoardTextStickerImage> {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalizedText = text.trim();
  const cacheKey = `${normalizedText}:${resolvedOptions.fontFamily}:${resolvedOptions.fontSize}:${resolvedOptions.color}`;
  const cached = mathStickerImageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'display:inline-block',
    'box-sizing:border-box',
    'white-space:normal',
    'pointer-events:none',
    'font-family:' + resolvedOptions.fontFamily,
    'font-size:' + resolvedOptions.fontSize + 'px',
    'line-height:' + resolvedOptions.lineHeight,
    'color:' + resolvedOptions.color,
    'padding:' + `${resolvedOptions.paddingY}px ${resolvedOptions.paddingX}px`,
  ].join(';');
  probe.innerHTML = buildBoardMathHtml(normalizedText);
  document.body.appendChild(probe);

  try {
    await document.fonts?.load?.(`${resolvedOptions.fontSize}px ${resolvedOptions.fontFamily}`);
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

    const rect = probe.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(rect.width));
    const height = Math.max(1, Math.ceil(rect.height));

    const svg = buildSvgFromProbe(probe.innerHTML, width, height, resolvedOptions);
    const image = await loadImageFromSvg(svg);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(image, 0, 0, width, height);
    }

    const result = {
      dataUrl: canvas.toDataURL('image/png'),
      height,
      width,
    };

    manageCache(result, cacheKey);
    return result;
  } finally {
    probe.remove();
  }
}

function buildBoardMathHtml(text: string) {
  const lines = tokenizeBoardText(text).map((line) => {
    const lineHtml = line.map((token) => {
      if (token.kind === 'text') {
        return `<span class="board-text-sticker__text-run">${escapeHtml(token.text)}</span>`;
      }

      return `<span class="board-text-sticker__math-run">${katex.renderToString(token.latex, {
        displayMode: false,
        output: 'html',
        strict: false,
        throwOnError: false,
        trust: false,
      })}</span>`;
    }).join('');

    return `<span class="board-text-sticker__line">${lineHtml}</span>`;
  }).join('');

  return `<span class="board-text-sticker__rich">${lines}</span>`;
}

function buildSvgFromProbe(innerHtml: string, width: number, height: number, options: Required<BoardTextStickerImageOptions>) {
  const style = [
    'display:inline-grid',
    'gap:4px',
    'box-sizing:border-box',
    'white-space:normal',
    'font-family:' + options.fontFamily,
    'font-size:' + options.fontSize + 'px',
    'line-height:' + options.lineHeight,
    'color:' + options.color,
    'padding:' + `${options.paddingY}px ${options.paddingX}px`,
    'background:transparent',
  ].join(';');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject x="0" y="0" width="100%" height="100%">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="${style}">${innerHtml}</div>`,
    '</foreignObject>',
    '</svg>',
  ].join('');
}

function loadImageFromSvg(svg: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load math sticker image.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function manageCache(result: BoardTextStickerImage, cacheKey: string) {
  if (mathStickerImageCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mathStickerImageCache.keys().next().value;
    if (firstKey) {
      mathStickerImageCache.delete(firstKey);
    }
  }
  mathStickerImageCache.set(cacheKey, result);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
