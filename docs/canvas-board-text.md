# Canvas board text normalization

`src/utils/canvasBoardField.js` is the single entry point for board text that is
rendered on a canvas.

Use `parseCanvasBoardField(value)` for row `board` values. It supports strings,
legacy coordinate prefixes, arrays, and `{ content }`/`{ text }` objects. It
first applies the canvas-only transport/escape rules and then delegates to the
existing mathematical `superCleanBoardField` implementation.

Do not use this entry point for speech, metadata, Markdown prose, or ordinary
page text. Those values must retain their original semantics.
