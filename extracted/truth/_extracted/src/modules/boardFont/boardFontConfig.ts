// @cleanroom-module: boardFontConfig
// @domain: c-canvas-font
// @io-input: customer-provided stylesheet url + font family
// @io-output: sanitized C board font url/family
// @boundary: C board font only; never applies customer font to the whole app body

export const DEFAULT_BOARD_FONT_URL = '';
export const DEFAULT_BOARD_FONT_NAME = '平方乔木体';
export const DEFAULT_BOARD_FONT_SIZE = 38;
export const LOCAL_BOARD_FONT_FALLBACK = '"Xiaxia Qiaomu Board", "KaiTi", "STKaiti", serif';

export type BoardTypographyConfig = {
  boardFontFamily: string;
  boardFontName: string;
  boardFontSize: number;
  boardFontUrl: string;
};

export type BoardTypographyInput = Partial<{
  boardFontName: number | string;
  boardFontSize: number | string;
  boardFontUrl: string;
}>;

export function createBoardTypographyConfig(input: BoardTypographyInput = {}): BoardTypographyConfig {
  const boardFontName = normalizeBoardFontName(String(input.boardFontName ?? DEFAULT_BOARD_FONT_NAME));

  return {
    boardFontFamily: createBoardFontFamily(boardFontName),
    boardFontName,
    boardFontSize: normalizeBoardFontSize(input.boardFontSize ?? DEFAULT_BOARD_FONT_SIZE),
    boardFontUrl: normalizeBoardFontUrl(input.boardFontUrl),
  };
}

export function normalizeBoardFontUrl(url: string | undefined): string {
  const candidateUrl = url?.trim();

  if (!candidateUrl) {
    return DEFAULT_BOARD_FONT_URL;
  }

  try {
    const parsedUrl = new URL(candidateUrl);
    return parsedUrl.protocol === 'https:' ? parsedUrl.toString() : DEFAULT_BOARD_FONT_URL;
  } catch {
    return DEFAULT_BOARD_FONT_URL;
  }
}

export function normalizeBoardFontName(fontName: string | undefined): string {
  return stripWrappingQuotes(fontName?.trim() || DEFAULT_BOARD_FONT_NAME) || DEFAULT_BOARD_FONT_NAME;
}

export function createBoardFontFamily(fontName: string | undefined): string {
  const normalizedFontName = normalizeBoardFontName(fontName);
  return `"${normalizedFontName}", ${LOCAL_BOARD_FONT_FALLBACK}`;
}

export function normalizeBoardFontSize(fontSize: number | string | undefined): number {
  const parsedFontSize = typeof fontSize === 'string' ? Number(fontSize) : fontSize;
  if (!parsedFontSize || Number.isNaN(parsedFontSize)) {
    return DEFAULT_BOARD_FONT_SIZE;
  }
  return Math.round(Math.min(96, Math.max(12, parsedFontSize)));
}

function stripWrappingQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '').trim();
}
