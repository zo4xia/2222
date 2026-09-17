// @cleanroom-module: boardStickerPluginContract
// @domain: portable-board-sticker-plugin
// @boundary: public plugin contract only; no React, no DOM, no A audio, no B timing, no storage

import { resolveBoardTextDisplayRoute, type BoardTextDisplayRoute } from './boardTextDisplayRoute';
import { normalizeBoardStickerVisualPatch, type BoardStickerVisualPatch } from './boardStickerGeometry';

export const BOARD_STICKER_PLUGIN_ID = 'board-sticker-c-canvas';

export type BoardStickerPluginInput = {
  text: string;
  visual?: BoardStickerVisualPatch;
};

export type BoardStickerPluginState = {
  displayRoute: BoardTextDisplayRoute;
  pluginId: typeof BOARD_STICKER_PLUGIN_ID;
  text: string;
  visual: Required<BoardStickerVisualPatch>;
};

export function resolveBoardStickerPluginState({
  text,
  visual = {},
}: BoardStickerPluginInput): BoardStickerPluginState {
  return {
    displayRoute: resolveBoardTextDisplayRoute(text),
    pluginId: BOARD_STICKER_PLUGIN_ID,
    text,
    visual: normalizeBoardStickerVisualPatch(visual),
  };
}
