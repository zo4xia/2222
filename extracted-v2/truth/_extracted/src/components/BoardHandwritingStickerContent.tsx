// @cleanroom-component: BoardHandwritingStickerContent
// @domain: board-sticker-rendering/handwriting
// @slot: center-stage/c-canvas-sticker/handwriting
// @depends: renderBoardTextStickerImage
// @io-input: text, fontFamily, fontSize, fontLoadKey
// @io-output: transparent handwriting image or fallback text
// @boundary: handwriting content renderer only; does not own C frame geometry, math rendering, A timing, or B display

import { useEffect, useState } from 'react';
import { normalizeBoardFontSize } from '../modules/boardFont/boardFontConfig';
import { renderBoardTextStickerImage, type BoardTextStickerImage } from '../modules/boardSticker';

export function BoardHandwritingStickerContent({
  color,
  fontFamily,
  fontLoadKey,
  fontSize,
  text,
}: {
  color: string;
  fontFamily: string;
  fontLoadKey: string;
  fontSize: number;
  text: string;
}) {
  const [stickerImage, setStickerImage] = useState<BoardTextStickerImage | null>(null);
  const resolvedFontSize = normalizeBoardFontSize(fontSize);

  useEffect(() => {
    let isCancelled = false;

    void renderBoardTextStickerImage(text, {
      color,
      fontFamily,
      fontSize: resolvedFontSize,
    }).then((nextImage) => {
      if (!isCancelled) {
        setStickerImage(nextImage);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [color, fontFamily, fontLoadKey, resolvedFontSize, text]);

  return stickerImage ? (
    <img
      alt=""
      className="board-text-sticker__image"
      draggable={false}
      src={stickerImage.dataUrl}
    />
  ) : (
    <span className="board-text-sticker__fallback">{text}</span>
  );
}
