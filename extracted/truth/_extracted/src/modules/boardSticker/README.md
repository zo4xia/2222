# boardSticker

`boardSticker` owns local rendering for C canvas board stickers.

- Input: confirmed board text plus visual options.
- Output: transparent image sticker data usable by the canvas/stage layer.
- Boundary: no TTS, no timeline mutation, no AI image generation, no storage.

## Portable Plugin Contract

Use `index.ts` as the public entrypoint. Outside code should depend on:

- `resolveBoardStickerPluginState()` for the plugin-level state bundle.
- `resolveBoardTextDisplayRoute()` for the C handwriting/formula route.
- `renderBoardTextStickerImage()` for handwriting PNG generation.
- `normalizeBoardStickerVisualPatch()` and the resize/scale helpers for C visual geometry.

Do not copy math regexes, route decisions, or C geometry clamps into page components. If this becomes a standalone plugin, this directory is the portable core; React wrappers can be moved around it.

Current implementation renders black handwritten text to an offscreen browser canvas. Future renderers can add preset math symbols, SVG composition, Hanzi Writer stroke data, or AI-assisted repair behind this module without changing B timing or C canvas placement code.
