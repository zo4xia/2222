// @cleanroom-component: CStickerFrame
// @domain: board-sticker-rendering/frame
// @slot: center-stage/c-canvas-sticker/frame
// @depends: C visual x/y/width/fontSize/reveal state
// @io-input: frame geometry, selected/dragging state, revealProgress, children
// @io-output: pointer handlers and clipped content slot
// @boundary: C sticker frame only; does not decide handwriting vs math content rendering

import type { CSSProperties, PointerEventHandler, ReactNode } from 'react';

export function CStickerFrame({
  children,
  color,
  contentKind,
  fontSize,
  isDragging,
  isSelected,
  onPointerDown,
  onResizePointerDown,
  revealProgress,
  stackIndex,
  text,
  widthPercent,
  xPercent,
  yPercent,
}: {
  children: ReactNode;
  color: string;
  contentKind: 'handwriting' | 'formula';
  fontSize: number;
  isDragging: boolean;
  isSelected: boolean;
  onPointerDown: PointerEventHandler<HTMLButtonElement>;
  onResizePointerDown: PointerEventHandler<HTMLSpanElement>;
  revealProgress: number;
  stackIndex: number;
  text: string;
  widthPercent: number;
  xPercent: number;
  yPercent: number;
}) {
  const safeRevealProgress = clampRevealProgress(revealProgress);

  return (
    <button
      aria-label={`C 素材：${text}`}
      className={[
        'board-text-sticker',
        contentKind === 'formula' ? 'board-text-sticker--math' : '',
        isDragging ? 'is-dragging' : '',
        isSelected ? 'is-selected' : '',
      ].filter(Boolean).join(' ')}
      onPointerDown={onPointerDown}
      style={{
        color,
        left: `${xPercent}%`,
        top: `${yPercent}%`,
        '--board-font-size': `${fontSize}px`,
        width: `${widthPercent}%`,
        zIndex: 10 + stackIndex,
      } as CSSProperties}
      type="button"
    >
      <span
        className="board-text-sticker__write-ink"
        style={{ clipPath: createRevealClipPath(safeRevealProgress) }}
      >
        {children}
      </span>
      {isSelected ? (
        <span
          aria-label="调整 C 素材尺寸"
          className="board-text-sticker__resize-handle"
          onPointerDown={onResizePointerDown}
          role="slider"
        />
      ) : null}
    </button>
  );
}

function createRevealClipPath(progress: number) {
  const progressPercent = progress * 100;
  const topEdgePercent = clampPercent(progressPercent + (progress > 0 && progress < 1 ? 1.8 : 0));
  const bottomEdgePercent = clampPercent(progressPercent - (progress > 0 && progress < 1 ? 1.2 : 0));
  return `polygon(0 0, ${topEdgePercent}% 0, ${bottomEdgePercent}% 100%, 0 100%)`;
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function clampRevealProgress(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}
