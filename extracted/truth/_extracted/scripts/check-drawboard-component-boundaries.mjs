import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const readProjectFile = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const stagePreviewText = readProjectFile('src', 'components', 'StagePreview.tsx');
const drawboardStageText = readProjectFile('src', 'components', 'DrawboardStage.tsx');
const canvasRecordingSurfaceText = readProjectFile('src', 'components', 'CanvasRecordingSurface.tsx');
const autoHandwritingLayerText = readProjectFile('src', 'components', 'AutoHandwritingLayer.tsx');
const drawboardTypesText = readProjectFile('src', 'components', 'drawboardStageTypes.ts');
const drawCoursewareStageFrameText = readProjectFile('src', 'modules', 'canvasStage', 'drawCoursewareStageFrame.ts');

const assertIncludes = (text, expected, message) => {
  if (!text.includes(expected)) {
    throw new Error(message);
  }
};

const assertNotIncludes = (text, forbidden, message) => {
  if (text.includes(forbidden)) {
    throw new Error(message);
  }
};

const assertMatches = (text, pattern, message) => {
  if (!pattern.test(text)) {
    throw new Error(message);
  }
};

assertIncludes(
  stagePreviewText,
  "import { DrawboardStage } from './DrawboardStage'",
  'StagePreview must compose the drawboard house through DrawboardStage.',
);
assertIncludes(
  stagePreviewText,
  "import { AutoHandwritingLayer } from './AutoHandwritingLayer'",
  'StagePreview must compose C1 automatic board writing through AutoHandwritingLayer.',
);
assertIncludes(stagePreviewText, '<DrawboardStage', 'StagePreview must render DrawboardStage.');
assertIncludes(stagePreviewText, '<AutoHandwritingLayer', 'StagePreview must render AutoHandwritingLayer.');
assertMatches(
  stagePreviewText,
  /<StageRecorderControl\b[^>]*targetRef=\{stageCanvasRef\}[^>]*\/>/,
  'StageRecorderControl must still record the stage canvas ref.',
);

for (const forbiddenStagePreviewImport of [
  "from '../modules/boardReveal'",
  "from '../modules/boardSticker'",
  "from './BoardTextSticker'",
]) {
  assertNotIncludes(
    stagePreviewText,
    forbiddenStagePreviewImport,
    `StagePreview must not directly own C1 sticker internals: ${forbiddenStagePreviewImport}`,
  );
}

assertIncludes(
  drawboardStageText,
  '@boundary: layout/recording house only; does not own A audio, B timing, or C1/C2 internals',
  'DrawboardStage must carry the drawboard house boundary marker.',
);
assertIncludes(drawboardStageText, 'stageRef: RefObject<HTMLDivElement | null>', 'DrawboardStage must receive the recordable ref.');
assertIncludes(drawboardStageText, '{children}', 'DrawboardStage must expose a layer slot for C1/C2 actors.');
assertIncludes(
  drawboardStageText,
  "import { CanvasRecordingSurface } from './CanvasRecordingSurface'",
  'DrawboardStage must mount the Canvas recording foundation.',
);
assertMatches(
  drawboardStageText,
  /<CanvasRecordingSurface\b[^>]*canvas=\{canvas\}[^>]*\/>[\s\S]*\{children\}/,
  'CanvasRecordingSurface must stay below C1/C2 layer slots so it is a foundation, not an overlay controller.',
);
assertMatches(
  drawboardStageText,
  /<div\b[^>]*ref=\{stageRef\}[\s\S]*<GoldenFingerCanvasLayer\b[\s\S]*<\/div>\s*<BoardStageToolOverlay\b/,
  'BoardStageToolOverlay must stay outside the stageRef recording canvas while GoldenFingerCanvasLayer remains recordable.',
);

for (const forbiddenDrawboardImport of [
  'BoardTextSticker',
  '../modules/boardReveal',
  '../modules/boardSticker',
  'timeline-factory',
  'useTeachingEditorStore',
  'VoiceWorkspace',
  'cosyvoice',
  'Tts',
  'TTS',
]) {
  assertNotIncludes(
    drawboardStageText,
    forbiddenDrawboardImport,
    `DrawboardStage must stay a layout/recording house, not own actor or timing internals: ${forbiddenDrawboardImport}`,
  );
}

assertIncludes(
  autoHandwritingLayerText,
  '@boundary: C1 automatic board actor only; B timing and A audio stay outside this component',
  'AutoHandwritingLayer must carry the C1 actor boundary marker.',
);
assertIncludes(
  autoHandwritingLayerText,
  "import { getBoardRevealProgress } from '../modules/boardReveal'",
  'AutoHandwritingLayer must consume the reveal progress helper for C1 playback.',
);
assertIncludes(
  autoHandwritingLayerText,
  "import { BoardTextSticker } from './BoardTextSticker'",
  'AutoHandwritingLayer must own BoardTextSticker rendering.',
);
assertIncludes(
  autoHandwritingLayerText,
  'visibleBoardClips',
  'AutoHandwritingLayer must own visible board clip projection for C1.',
);
assertIncludes(
  autoHandwritingLayerText,
  'onUpdateBoardClip',
  'AutoHandwritingLayer must expose C visual edits through the caller callback.',
);

for (const forbiddenAutoLayerImport of [
  'timeline-factory',
  'VoiceWorkspace',
  'StageRecorderControl',
  'useTeachingEditorStore',
  'cosyvoice',
  'voiceAudio',
  'Tts',
  'TTS',
]) {
  assertNotIncludes(
    autoHandwritingLayerText,
    forbiddenAutoLayerImport,
    `AutoHandwritingLayer must not own A audio, TTS, store, or timeline factory internals: ${forbiddenAutoLayerImport}`,
  );
}

assertIncludes(
  canvasRecordingSurfaceText,
  '@boundary: Canvas recording surface only; does not own A audio, B timing, C1/C2 actors, or editor state',
  'CanvasRecordingSurface must carry the canvas recording boundary marker.',
);
assertIncludes(
  canvasRecordingSurfaceText,
  "import { drawCoursewareStageFrame } from '../modules/canvasStage/drawCoursewareStageFrame'",
  'CanvasRecordingSurface must delegate drawing to the canvasStage renderer module.',
);
assertIncludes(
  canvasRecordingSurfaceText,
  'data-canvas-recording-surface="foundation"',
  'CanvasRecordingSurface must expose a stable foundation marker for future recorder wiring.',
);

for (const forbiddenCanvasSurfaceDependency of [
  'timeline-factory',
  'VoiceWorkspace',
  'StageRecorderControl',
  'useTeachingEditorStore',
  'BoardTextSticker',
  'getBoardRevealProgress',
  'cosyvoice',
  'voiceAudio',
  'TimelineClip',
  'Tts',
  'TTS',
]) {
  assertNotIncludes(
    canvasRecordingSurfaceText,
    forbiddenCanvasSurfaceDependency,
    `CanvasRecordingSurface must remain the render surface, not own A/B/C internals: ${forbiddenCanvasSurfaceDependency}`,
  );
}

assertIncludes(
  drawCoursewareStageFrameText,
  '@boundary: render-only canvas foundation; does not read or mutate A audio, B timeline, C clips, or store',
  'drawCoursewareStageFrame must carry the render-only canvas boundary marker.',
);
assertIncludes(
  drawCoursewareStageFrameText,
  'context.fillRect(0, 0, canvas.width, canvas.height)',
  'drawCoursewareStageFrame must paint the canvas foundation from StageCanvasConfig dimensions.',
);

for (const forbiddenCanvasRendererDependency of [
  'timeline-factory',
  'VoiceWorkspace',
  'StageRecorderControl',
  'useTeachingEditorStore',
  'BoardTextSticker',
  'getBoardRevealProgress',
  'cosyvoice',
  'voiceAudio',
  'TimelineClip',
  'Tts',
  'TTS',
]) {
  assertNotIncludes(
    drawCoursewareStageFrameText,
    forbiddenCanvasRendererDependency,
    `drawCoursewareStageFrame must remain a pure renderer foundation: ${forbiddenCanvasRendererDependency}`,
  );
}

assertMatches(
  drawboardTypesText,
  /export\s+type\s+BoardClipPatch\s*=\s*Partial\s*<\s*Pick\s*<\s*TimelineClip\s*,[\s\S]*'fontSize'[\s\S]*'widthPercent'[\s\S]*'xPercent'[\s\S]*'yPercent'[\s\S]*>\s*>/,
  'drawboardStageTypes must keep the shared C visual patch contract.',
);

for (const forbiddenBoardClipPatchField of ['startMs', 'endMs', 'revealStartMs', 'revealEndMs', 'sourceStartMs', 'sourceEndMs']) {
  assertNotIncludes(
    drawboardTypesText,
    forbiddenBoardClipPatchField,
    `BoardClipPatch must not open A/B timing fields to C visual edits: ${forbiddenBoardClipPatchField}`,
  );
}

const freeAnnotationLayerPath = join(root, 'src', 'components', 'FreeAnnotationLayer.tsx');
if (existsSync(freeAnnotationLayerPath)) {
  const freeAnnotationLayerText = readFileSync(freeAnnotationLayerPath, 'utf8');
  for (const forbiddenFreeLayerDependency of [
    'timeline-factory',
    'useTeachingEditorStore',
    'applyBoardEventsToTeachingTimeline',
    'voiceTiming',
    'voiceAudio',
    'onUpdateBoardClip',
    'TimelineClip',
  ]) {
    assertNotIncludes(
      freeAnnotationLayerText,
      forbiddenFreeLayerDependency,
      `FreeAnnotationLayer must stay C2 manual annotation and must not write A/B/C timeline truth: ${forbiddenFreeLayerDependency}`,
    );
  }
}

console.log('[drawboard-component-boundaries] passed');
