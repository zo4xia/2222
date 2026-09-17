// @cleanroom-module: boardTextDisplayRoute
// @domain: board-sticker-rendering
// @boundary: single C display route only; A/TTS math delimiters must not decide C font rendering
// Components ask this router instead of branching on hasBoardMath directly.

import {
  hasBoardMath,
  isBoardTextSupportedByHandwritingFont,
  normalizeElementaryBoardHandwritingText,
  stripSimpleBoardMathDelimiters,
} from './mathBoardText';

export type BoardTextDisplayRoute =
  | {
      kind: 'handwriting';
      text: string;
    }
  | {
      kind: 'formula';
      text: string;
    };

export function resolveBoardTextDisplayRoute(text: string): BoardTextDisplayRoute {
  const elementaryHandwritingText = normalizeElementaryBoardHandwritingText(text);
  if (elementaryHandwritingText !== text) {
    return {
      kind: 'handwriting',
      text: elementaryHandwritingText,
    };
  }

  const handwritingText = stripSimpleBoardMathDelimiters(text);
  if (handwritingText !== text) {
    return {
      kind: 'handwriting',
      text: handwritingText,
    };
  }

  if (isBoardTextSupportedByHandwritingFont(text)) {
    return {
      kind: 'handwriting',
      text,
    };
  }

  if (hasBoardMath(text)) {
    return {
      kind: 'formula',
      text,
    };
  }

  return {
    kind: 'handwriting',
    text,
  };
}
