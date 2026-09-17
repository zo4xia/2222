// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

export type MaterialInputKind = 'text' | 'file' | 'url' | 'conversation';

export type MaterialInput = {
  id: string;
  kind: MaterialInputKind;
  title?: string;
  content?: string;
  fileName?: string;
  fileUrl?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

