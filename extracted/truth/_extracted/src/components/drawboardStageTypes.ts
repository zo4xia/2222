import type { TimelineClip } from '../domain/teachingProject';

export type BoardClipPatch = Partial<Pick<TimelineClip, 'color' | 'fontSize' | 'widthPercent' | 'xPercent' | 'yPercent'>>;

export type StageRecordingCanvases = {
  base: HTMLCanvasElement;
  content: HTMLCanvasElement | null;
  overlay: HTMLCanvasElement;
};

/** 金手指工具模式：
 *  off      - 选择模式（不拦截事件，穿透给 C 层）
 *  pen      - 画笔（持续绘制）
 *  eraser   - 橡皮擦
 *  highlight - 划重点（半透明宽笔刷）
 *  circle   - 圈圈（两点→椭圆，单次放置）
 *  cross    - 叉叉（两点→X 标记，单次放置）
 */
export type BoardStageToolMode = 'off' | 'pen' | 'eraser' | 'highlight' | 'circle' | 'cross';
