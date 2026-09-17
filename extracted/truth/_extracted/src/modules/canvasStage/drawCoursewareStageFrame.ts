// @cleanroom-module: drawCoursewareStageFrame
// @domain: canvas-recording-stage
// @depends: StageCanvasConfig width/height/background
// @io-input: CanvasRenderingContext2D, StageCanvasConfig, problem text summary
// @io-output: painted canvas recording foundation frame
// @boundary: render-only canvas foundation; does not read or mutate A audio, B timeline, C clips, or store

import type { StageCanvasConfig } from '../../domain/teachingProject';

export function drawCoursewareStageFrame(
  context: CanvasRenderingContext2D,
  canvas: StageCanvasConfig,
  problemSummary = '',
) {
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = canvas.background || '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawCoursewareFrameChrome(context, canvas);
  drawProblemSummary(context, canvas, problemSummary);
  context.restore();
}

function drawCoursewareFrameChrome(context: CanvasRenderingContext2D, canvas: StageCanvasConfig) {
  const labelWidth = canvas.width * 0.041;
  const labelHeight = canvas.height * 0.026;
  const labelTop = canvas.height * 0.024;

  context.strokeStyle = 'rgba(85, 207, 231, 0.22)';
  context.lineWidth = Math.max(4, canvas.width * 0.0042);
  context.strokeRect(context.lineWidth / 2, context.lineWidth / 2, canvas.width - context.lineWidth, canvas.height - context.lineWidth);

  drawLabel(context, {
    height: labelHeight,
    text: '题目',
    width: labelWidth,
    x: canvas.width * 0.017,
    y: labelTop,
  });
  drawLabel(context, {
    height: labelHeight,
    text: '解答',
    width: labelWidth,
    x: canvas.width * 0.5 - labelWidth / 2,
    y: labelTop,
  });
}

function drawLabel(
  context: CanvasRenderingContext2D,
  rect: { height: number; text: string; width: number; x: number; y: number },
) {
  context.fillStyle = '#55cfe7';
  roundedRect(context, rect.x, rect.y, rect.width, rect.height, Math.max(4, rect.height * 0.28));
  context.fill();

  context.fillStyle = '#ffffff';
  context.font = `700 ${Math.max(14, rect.height * 0.48)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(rect.text, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

function drawProblemSummary(context: CanvasRenderingContext2D, canvas: StageCanvasConfig, problemSummary: string) {
  const text = problemSummary.trim();
  if (!text) {
    return;
  }

  const fontSize = Math.max(18, canvas.height * 0.014);
  const lineHeight = fontSize * 1.46;
  const maxWidth = Math.min(canvas.width * 0.44, 520 * (canvas.width / 1120));

  context.fillStyle = '#243247';
  context.font = `600 ${fontSize}px sans-serif`;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  const lines = wrapCanvasText(context, text, maxWidth, 4);

  const left = canvas.width * 0.027;
  const top = canvas.height * 0.072;
  for (let index = 0; index < lines.length; index += 1) {
    context.fillText(lines[index], left, top + index * lineHeight);
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const normalizedText = text.replace(/\s+/g, ' ');
  const result: string[] = [];
  let current = '';

  for (const char of normalizedText) {
    const next = current + char;
    if (current && context.measureText(next).width > maxWidth) {
      result.push(current);
      current = char.trimStart();
      if (result.length >= maxLines) {
        break;
      }
      continue;
    }
    current = next;
  }

  if (result.length < maxLines && current) {
    result.push(current);
  }

  if (result.length === maxLines && context.measureText(result[maxLines - 1]).width > maxWidth * 0.94) {
    result[maxLines - 1] = `${result[maxLines - 1].slice(0, -1)}...`;
  }

  return result;
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, resolvedRadius);
  context.arcTo(x + width, y + height, x, y + height, resolvedRadius);
  context.arcTo(x, y + height, x, y, resolvedRadius);
  context.arcTo(x, y, x + width, y, resolvedRadius);
  context.closePath();
}
