// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

export type ScriptRow = {
  id: string;
  section?: string;
  stepLabel?: string;
  voiceText: string;
  boardSlice?: string;
  metadata?: Record<string, unknown>;
};

export type ScriptRowDraft = {
  rows: ScriptRow[];
};

