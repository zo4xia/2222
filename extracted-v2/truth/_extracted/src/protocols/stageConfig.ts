// @boundary: Protocol Kit only. No React, provider SDK, store, canvas, or whiteboard runtime imports.

export type StageLayoutSlot = {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
};

export type PerformanceStageConfig = {
  width: number;
  height: number;
  background: string;
  layoutPreset?: string;
  layoutSlots?: StageLayoutSlot[];
  boardFontFamily?: string;
  boardFontName?: string;
  boardFontSize?: number;
  boardFontUrl?: string;
  safeArea?: {
    xPercent: number;
    yPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
};

