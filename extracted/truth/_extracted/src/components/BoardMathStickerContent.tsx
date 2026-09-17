// @cleanroom-component: BoardMathStickerContent
// @domain: board-sticker-rendering/math
// @slot: center-stage/c-canvas-sticker/math
// @depends: FormulaText, boardSticker/mathBoardText
// @boundary: math content renderer only; does not own C frame geometry, handwriting PNG rendering, A timing, or B display

import { FormulaText } from './FormulaText';

export function BoardMathStickerContent({ color, text }: { color: string; text: string }) {
  return (
    <FormulaText
      as="span"
      className="board-text-sticker__formula"
      classNamePrefix="board-text-sticker"
      rootClassName=""
      style={{ color }}
    >
      {text}
    </FormulaText>
  );
}
