// @cleanroom-module: renderBoardTextStickerImage
// @domain: board-sticker-rendering
// @depends: browser Canvas API, CSS-loaded board font
// @boundary: local transparent image generation only; no timeline, no AI, no storage

import {
  createBoardFontFamily,
  DEFAULT_BOARD_FONT_NAME,
  DEFAULT_BOARD_FONT_SIZE,
} from '../boardFont/boardFontConfig';

// LRU缓存避免Canvas重复创建
const stickerImageCache = new Map<string, BoardTextStickerImage>();
const MAX_CACHE_SIZE = 100;
const GLYPH_FONT_JITTER_RATIO = 0.045;
const GLYPH_BASELINE_JITTER_RATIO = 0.08;
const GLYPH_SPACING_JITTER_RATIO = 0.08;

function getCacheKey(text: string, options: BoardTextStickerImageOptions): string {
  const normalizedOptions = {
    color: options.color || '#111111',
    fontFamily: options.fontFamily || createBoardFontFamily(DEFAULT_BOARD_FONT_NAME),
    fontSize: options.fontSize || DEFAULT_BOARD_FONT_SIZE,
    lineHeight: options.lineHeight || 1.38,
    maxTextWidth: options.maxTextWidth || 720,
    paddingX: options.paddingX || 8,
    paddingY: options.paddingY || 6,
  };
  return `${text}:${normalizedOptions.fontFamily}:${normalizedOptions.fontSize}:${normalizedOptions.color}:${normalizedOptions.maxTextWidth}`;
}

function manageCacheSize() {
  if (stickerImageCache.size > MAX_CACHE_SIZE) {
    // 删除最旧的缓存项（简单的LRU实现）
    const firstKey = stickerImageCache.keys().next().value;
    if (firstKey) {
      stickerImageCache.delete(firstKey);
    }
  }
}

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
  maxTextWidth?: number;
  paddingX?: number;
  paddingY?: number;
};

const DEFAULT_OPTIONS = {
  color: '#111111',
  fontFamily: createBoardFontFamily(DEFAULT_BOARD_FONT_NAME),
  fontSize: DEFAULT_BOARD_FONT_SIZE,
  lineHeight: 1.38,
  maxTextWidth: 720,
  paddingX: 8,
  paddingY: 6,
} satisfies Required<BoardTextStickerImageOptions>;

export async function renderBoardTextStickerImage(
  text: string,
  options: BoardTextStickerImageOptions = {},
): Promise<BoardTextStickerImage> {
  const resolvedOptions = { ...DEFAULT_OPTIONS, ...options };
  const normalizedText = text.trim();

  // 检查缓存
  const cacheKey = getCacheKey(normalizedText, resolvedOptions);
  const cached = stickerImageCache.get(cacheKey);

  if (cached) {
    return cached; // 直接返回缓存，避免重复创建Canvas
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context || !normalizedText) {
    return createEmptyStickerImage(canvas);
  }

  await loadStickerFont(resolvedOptions);

  context.font = buildCanvasFont(resolvedOptions);
  context.textBaseline = 'top';

  const lines = wrapStickerText(context, normalizedText, resolvedOptions.maxTextWidth);
  const lineLayouts = lines.map((line, index) => layoutStickerGlyphLine(context, line, resolvedOptions, index));
  const jitterPaddingPx = Math.ceil(resolvedOptions.fontSize * 0.2);
  const measuredWidth = Math.ceil(Math.max(...lineLayouts.map((layout) => layout.width), resolvedOptions.fontSize));
  const lineHeightPx = Math.ceil(resolvedOptions.fontSize * resolvedOptions.lineHeight) + jitterPaddingPx;
  const width = measuredWidth + resolvedOptions.paddingX * 2;
  const height = lines.length * lineHeightPx + resolvedOptions.paddingY * 2 + jitterPaddingPx;
  const ratio = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));

  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  context.scale(ratio, ratio);
  context.font = buildCanvasFont(resolvedOptions);
  context.fillStyle = resolvedOptions.color;
  context.textBaseline = 'top';

  lineLayouts.forEach((lineLayout, index) => {
    const lineTop = resolvedOptions.paddingY + index * lineHeightPx + jitterPaddingPx / 2;
    drawStickerGlyphLine(context, lineLayout, resolvedOptions, lineTop);
  });

  const result = {
    dataUrl: canvas.toDataURL('image/png'),
    height,
    width,
  };

  // 缓存结果
  manageCacheSize();
  stickerImageCache.set(cacheKey, result);

  return result;
}

function buildCanvasFont({ fontFamily, fontSize }: Required<BoardTextStickerImageOptions>) {
  return `${fontSize}px ${fontFamily}`;
}

async function loadStickerFont(options: Required<BoardTextStickerImageOptions>) {
  if (!document.fonts?.load) {
    return;
  }

  await document.fonts.load(buildCanvasFont(options));
}

function wrapStickerText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  return text
    .split('\n')
    .flatMap((line) => wrapStickerLine(context, line.trim(), maxWidth))
    .filter(Boolean);
}

function wrapStickerLine(context: CanvasRenderingContext2D, line: string, maxWidth: number) {
  if (!line || context.measureText(line).width <= maxWidth) {
    return [line];
  }

  const wrappedLines: string[] = [];
  let currentLine = '';
  for (const char of line) {
    const candidate = `${currentLine}${char}`;
    if (currentLine && context.measureText(candidate).width > maxWidth) {
      wrappedLines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    wrappedLines.push(currentLine);
  }

  return wrappedLines;
}

type StickerGlyphLayout = {
  char: string;
  fontSize: number;
  width: number;
  x: number;
  y: number;
};

type StickerGlyphLineLayout = {
  glyphs: StickerGlyphLayout[];
  width: number;
};

function layoutStickerGlyphLine(
  context: CanvasRenderingContext2D,
  line: string,
  options: Required<BoardTextStickerImageOptions>,
  lineIndex: number,
): StickerGlyphLineLayout {
  const glyphs: StickerGlyphLayout[] = [];
  const jitter = createDeterministicJitter(`${lineIndex}:${line}:${options.fontSize}:${options.fontFamily}`);
  let xCursor = 0;
  const baselineJitterPx = options.fontSize * GLYPH_BASELINE_JITTER_RATIO;
  const spacingJitterPx = options.fontSize * GLYPH_SPACING_JITTER_RATIO;

  for (const char of line) {
    const fontSize = Math.max(12, Math.round(options.fontSize * (1 + jitter() * GLYPH_FONT_JITTER_RATIO)));
    context.font = buildCanvasFont({ ...options, fontSize });
    const width = Math.max(1, context.measureText(char).width);
    const y = Math.round(jitter() * baselineJitterPx);

    glyphs.push({
      char,
      fontSize,
      width,
      x: xCursor,
      y,
    });

    const spacingOffset = /\s/.test(char) ? 0 : jitter() * spacingJitterPx;
    xCursor += width + spacingOffset;
  }

  context.font = buildCanvasFont(options);
  return {
    glyphs,
    width: Math.ceil(Math.max(options.fontSize, xCursor)),
  };
}

function drawStickerGlyphLine(
  context: CanvasRenderingContext2D,
  lineLayout: StickerGlyphLineLayout,
  options: Required<BoardTextStickerImageOptions>,
  lineTop: number,
) {
  context.fillStyle = options.color;
  context.textBaseline = 'top';

  for (const glyph of lineLayout.glyphs) {
    context.font = buildCanvasFont({ ...options, fontSize: glyph.fontSize });
    context.fillText(glyph.char, options.paddingX + glyph.x, lineTop + glyph.y);
  }
}

function createDeterministicJitter(seed: string) {
  let state = hashString(seed) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function createEmptyStickerImage(canvas: HTMLCanvasElement): BoardTextStickerImage {
  canvas.width = 1;
  canvas.height = 1;
  return {
    dataUrl: canvas.toDataURL('image/png'),
    height: 1,
    width: 1,
  };
}
