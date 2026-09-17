import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const outDir = join(root, '.tmp-board-boundaries-check');
const checkFile = join(outDir, 'check.mjs');
const stylesText = readFileSync(join(root, 'src', 'styles.css'), 'utf8');
const appText = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');
const assetTabsText = readFileSync(join(root, 'src', 'config', 'assetTabs.ts'), 'utf8');
const formulaTextComponentText = readFileSync(join(root, 'src', 'components', 'FormulaText.tsx'), 'utf8');
const mathTextComponentText = readFileSync(join(root, 'src', 'components', 'MathText.tsx'), 'utf8');
const assetListText = readFileSync(join(root, 'src', 'components', 'AssetList.tsx'), 'utf8');
const autoHandwritingLayerText = readFileSync(join(root, 'src', 'components', 'AutoHandwritingLayer.tsx'), 'utf8');
const boardMathStickerContentText = readFileSync(join(root, 'src', 'components', 'BoardMathStickerContent.tsx'), 'utf8');
const boardHandwritingStickerContentText = readFileSync(join(root, 'src', 'components', 'BoardHandwritingStickerContent.tsx'), 'utf8');
const cStickerFrameText = readFileSync(join(root, 'src', 'components', 'CStickerFrame.tsx'), 'utf8');
const floatingToolDockText = readFileSync(join(root, 'src', 'components', 'FloatingToolDock.tsx'), 'utf8');
const boardTextStickerText = readFileSync(join(root, 'src', 'components', 'BoardTextSticker.tsx'), 'utf8');
const mathBoardText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'mathBoardText.ts'), 'utf8');
const boardTextDisplayRouteText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'boardTextDisplayRoute.ts'), 'utf8');
const boardStickerPluginContractText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'boardStickerPluginContract.ts'), 'utf8');
const boardStickerGeometryText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'boardStickerGeometry.ts'), 'utf8');
const boardRevealConfigText = readFileSync(join(root, 'src', 'modules', 'boardReveal', 'boardRevealConfig.ts'), 'utf8');
const boardStickerIndexText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'index.ts'), 'utf8');
const boardStickerReadmeText = readFileSync(join(root, 'src', 'modules', 'boardSticker', 'README.md'), 'utf8');
const boardClipInspectorText = readFileSync(join(root, 'src', 'components', 'BoardClipInspector.tsx'), 'utf8');
const teachingTimelineText = readFileSync(join(root, 'src', 'components', 'TeachingTimeline.tsx'), 'utf8');
const timelineTrackRowText = readFileSync(join(root, 'src', 'components', 'TimelineTrackRow.tsx'), 'utf8');
const teachingProjectText = readFileSync(join(root, 'src', 'domain', 'teachingProject.ts'), 'utf8');
const boardClipInspectorSectionsText = readFileSync(
  join(root, 'src', 'components', 'boardClipInspector', 'BoardClipInspectorSections.tsx'),
  'utf8',
);
const boardClipInspectorContractText = readFileSync(
  join(root, 'src', 'components', 'boardClipInspector', 'boardClipInspectorContract.ts'),
  'utf8',
);
const boardClipInspectorControlText = `${boardClipInspectorText}\n${boardClipInspectorSectionsText}\n${boardClipInspectorContractText}`;
const canvasInspectorText = readFileSync(join(root, 'src', 'components', 'CanvasInspector.tsx'), 'utf8');
const currentProjectBoardFontInspectorText = readFileSync(join(root, 'src', 'components', 'CurrentProjectBoardFontInspector.tsx'), 'utf8');
const boardControlResponsibilitiesText = readFileSync(join(root, 'src', 'modules', 'boardControlLayers', 'boardControlResponsibilities.ts'), 'utf8');
const boardControlResponsibilitiesPanelText = readFileSync(join(root, 'src', 'components', 'BoardControlResponsibilitiesPanel.tsx'), 'utf8');
const appSettingsDrawerText = readFileSync(join(root, 'src', 'components', 'AppSettingsDrawer.tsx'), 'utf8');
const boardTypographyFieldsText = readFileSync(join(root, 'src', 'components', 'BoardTypographyFields.tsx'), 'utf8');
const voiceTrackAudioText = readFileSync(join(root, 'src', 'modules', 'audioPlayback', 'useVoiceTrackAudio.ts'), 'utf8');
const voiceAudioSeekText = readFileSync(join(root, 'src', 'modules', 'audioPlayback', 'voiceAudioSeek.ts'), 'utf8');
const voicePlaybackStartText = readFileSync(join(root, 'src', 'modules', 'audioPlayback', 'voicePlaybackStart.ts'), 'utf8');
const scriptSegmentWorkbenchText = readFileSync(join(root, 'src', 'modules', 'scriptSegments', 'ScriptSegmentWorkbench.tsx'), 'utf8');
const scriptSegmentPreviewText = readFileSync(join(root, 'src', 'modules', 'scriptSegments', 'ScriptSegmentPreview.tsx'), 'utf8');
const scriptAgentTableEditorText = readFileSync(join(root, 'src', 'modules', 'scriptAgentTable', 'ScriptAgentTableEditor.tsx'), 'utf8');
const assetWorkflowFlowText = readFileSync(join(root, 'src', 'workflow', 'assetWorkflowFlow.tsx'), 'utf8');
const createAssetWorkflowStepsText = readFileSync(join(root, 'src', 'workflow', 'createAssetWorkflowSteps.tsx'), 'utf8');
const problemUploadPreviewText = readFileSync(join(root, 'src', 'components', 'ProblemUploadPreview.tsx'), 'utf8');
const scriptBoardSummaryStepText = readFileSync(join(root, 'src', 'components', 'ScriptBoardSummaryStep.tsx'), 'utf8');
const scriptBoardAgentPromptText = readFileSync(join(root, 'src', 'agent', 'scriptBoardAgentPrompt.ts'), 'utf8');
const activeVisibleBcUiText = [
  appText,
  assetTabsText,
  stylesText,
  autoHandwritingLayerText,
  boardClipInspectorText,
  appSettingsDrawerText,
  currentProjectBoardFontInspectorText,
  cStickerFrameText,
  floatingToolDockText,
  scriptAgentTableEditorText,
  scriptSegmentWorkbenchText,
  scriptSegmentPreviewText,
  problemUploadPreviewText,
  scriptBoardSummaryStepText,
  assetWorkflowFlowText,
  createAssetWorkflowStepsText,
  boardControlResponsibilitiesText,
].join('\n');
const timelineBcFrontendText = [
  teachingTimelineText,
  timelineTrackRowText,
  teachingProjectText,
  assetTabsText,
  assetWorkflowFlowText,
  createAssetWorkflowStepsText,
  stylesText,
].join('\n');

if (stylesText.includes('grid-template-columns: 64px minmax(0, 1fr);')) {
  throw new Error('B board lane labels must not consume timeline coordinate width.');
}

if (stylesText.includes('border: 18px solid #55cfe7') || stylesText.includes('border-radius: 0;')) {
  throw new Error('Courseware stage edge must stay thin, pale, and rounded instead of a heavy iframe-like border.');
}

if (
  !stylesText.includes('.stage-canvas--courseware') ||
  (!stylesText.includes('border: 1px solid rgba(126, 151, 186, 0.16);') &&
    !stylesText.includes('border: 8px solid rgba(85, 207, 231, 0.22);')) ||
  !stylesText.includes('border-radius: 18px;')
) {
  throw new Error('Courseware stage edge must keep the pale rounded strip contract.');
}

if (!stylesText.includes('transition: clip-path 90ms linear') || !stylesText.includes('prefers-reduced-motion: reduce')) {
  throw new Error('C reveal ink must smooth clip-path updates while respecting reduced motion.');
}

if (
  !boardTextStickerText.includes('style={{ clipPath: createRevealClipPath(safeRevealProgress) }}') ||
  !boardTextStickerText.includes('function createRevealClipPath') ||
  !boardTextStickerText.includes('polygon(0 0')
) {
  if (
    !cStickerFrameText.includes('style={{ clipPath: createRevealClipPath(safeRevealProgress) }}') ||
    !cStickerFrameText.includes('function createRevealClipPath') ||
    !cStickerFrameText.includes('polygon(0 0')
  ) {
    throw new Error('CStickerFrame C reveal must keep the non-ruler clip boundary helper.');
  }
}

if (
  !boardTextStickerText.includes('resolveBoardTextDisplayRoute(text)') ||
  boardTextStickerText.includes('const shouldRenderMath = hasBoardMath(text)')
) {
  throw new Error('BoardTextSticker must use the C display route, not hasBoardMath directly.');
}

if (
  !boardTextDisplayRouteText.includes('@boundary: single C display route only') ||
  !boardTextDisplayRouteText.includes('Components ask this router instead of branching on hasBoardMath directly.') ||
  !boardTextDisplayRouteText.includes('stripSimpleBoardMathDelimiters') ||
  !boardTextDisplayRouteText.includes("kind: 'handwriting'") ||
  !boardTextDisplayRouteText.includes("kind: 'formula'")
) {
  throw new Error('C board text display route must keep handwriting/formula boundary separate from A/TTS.');
}

if (
  !boardStickerPluginContractText.includes('@cleanroom-module: boardStickerPluginContract') ||
  !boardStickerPluginContractText.includes('@boundary: public plugin contract only; no React, no DOM, no A audio, no B timing, no storage') ||
  !boardStickerPluginContractText.includes("BOARD_STICKER_PLUGIN_ID = 'board-sticker-c-canvas'") ||
  !boardStickerPluginContractText.includes('resolveBoardStickerPluginState') ||
  !boardStickerIndexText.includes('resolveBoardStickerPluginState') ||
  !boardStickerReadmeText.includes('Portable Plugin Contract')
) {
  throw new Error('boardSticker must expose a portable plugin contract through its module entrypoint.');
}

if (!formulaTextComponentText.includes('@cleanroom-component: FormulaText')) {
  throw new Error('FormulaText must be the shared display-only formula component block.');
}

if (
  !mathBoardText.includes('@xiaxia-c-font-boundary') ||
  !mathBoardText.includes('Keep font-supported linear text like "y=2x+1" in handwriting')
) {
  throw new Error('mathBoardText must keep the C font support boundary annotation.');
}

if (!mathTextComponentText.includes("from './FormulaText'")) {
  throw new Error('MathText must remain a compatibility wrapper around FormulaText.');
}

if (!assetListText.includes("import { MathText }") || assetListText.includes('<Text type="secondary">{asset.summary}</Text>')) {
  throw new Error('AssetList summary is display-only and must render through MathText.');
}

if (!boardMathStickerContentText.includes('classNamePrefix="board-text-sticker"') || !boardMathStickerContentText.includes('rootClassName=""')) {
  throw new Error('Board math stickers must reuse FormulaText with board-sticker scoped classes without nesting the sticker root class.');
}

if (
  !boardTextStickerText.includes("import { CStickerFrame } from './CStickerFrame'") ||
  !boardTextStickerText.includes("import { BoardHandwritingStickerContent } from './BoardHandwritingStickerContent'") ||
  !boardTextStickerText.includes("import { BoardMathStickerContent } from './BoardMathStickerContent'")
) {
  throw new Error('BoardTextSticker must compose CStickerFrame plus separate handwriting/math content renderers.');
}

if (
  boardTextStickerText.includes('useState<BoardTextStickerImage') ||
  boardTextStickerText.includes('renderBoardTextStickerImage(') ||
  boardTextStickerText.includes('<button') ||
  boardTextStickerText.includes('createRevealClipPath')
) {
  throw new Error('BoardTextSticker must not re-own frame geometry or handwriting image state after renderer split.');
}

if (
  !cStickerFrameText.includes('@cleanroom-component: CStickerFrame') ||
  !cStickerFrameText.includes('@boundary: C sticker frame only') ||
  cStickerFrameText.includes('renderBoardTextStickerImage') ||
  cStickerFrameText.includes('FormulaText')
) {
  throw new Error('CStickerFrame must own only sticker frame geometry/reveal, not content rendering.');
}

if (
  !boardHandwritingStickerContentText.includes('@cleanroom-component: BoardHandwritingStickerContent') ||
  !boardHandwritingStickerContentText.includes('renderBoardTextStickerImage') ||
  boardHandwritingStickerContentText.includes('FormulaText') ||
  boardHandwritingStickerContentText.includes('widthPercent') ||
  boardHandwritingStickerContentText.includes('revealProgress')
) {
  throw new Error('BoardHandwritingStickerContent must own handwriting image rendering without frame geometry or math rendering.');
}

if (
  !stylesText.includes('.board-text-sticker__image') ||
  !stylesText.includes('width: auto;') ||
  stylesText.includes('.board-text-sticker__image {\n  display: block;\n  width: 100%;')
) {
  throw new Error('Handwriting sticker PNG must not be stretched to the C frame width; widthPercent is a frame/wrap box, not image scale.');
}

if (!scriptSegmentWorkbenchText.includes("import { FormulaText }") || scriptSegmentWorkbenchText.includes('<p>{segment.text}</p>')) {
  throw new Error('ScriptSegmentWorkbench display text must use FormulaText, not raw segment.text.');
}

if (scriptSegmentWorkbenchText.includes('B{markerIndex + 1} {markerText}')) {
  throw new Error('ScriptSegmentWorkbench board marker display must use FormulaText, not raw markerText.');
}

if (
  !scriptSegmentPreviewText.includes("import { FormulaText }") ||
  scriptSegmentPreviewText.includes('<p className="script-segment-preview__text">{segment.text}</p>') ||
  scriptSegmentPreviewText.includes('>{markerText}</Tag>')
) {
  throw new Error('ScriptSegmentPreview display text and marker text must use FormulaText.');
}

for (const forbiddenBoardClipLabel of [
  'title="素材控制"',
  '<Text strong>开始 ms</Text>',
  '<Text strong>结束 ms</Text>',
  '<Text strong>x 位置</Text>',
  '<Text strong>y 位置</Text>',
  '<Text strong>速度</Text>',
]) {
  if (boardClipInspectorControlText.includes(forbiddenBoardClipLabel)) {
    throw new Error(`BoardClipInspector must use B/C business labels, not old label: ${forbiddenBoardClipLabel}`);
  }
}

for (const requiredBoardClipLabel of [
  '选中 C 角色内容',
  '显示内容',
  'C 外观',
  'C 站位',
  'C 演绎',
  '当前素材内容',
  '当前素材映射关联',
  '横向位置',
  '纵向位置',
  '字号 / 宽度联动',
  '换行宽度',
  'C 字号',
  'C 书写速度',
  '字体颜色',
  '沿用画布墨色',
  '走画布变量',
  '只影响 C 在 A source ∩ B display 内的 reveal 快慢；不改 A 语音，不改 B 寿命。',
  'B 只管上台、下台和静态留场；C 书写快慢在“C 演绎”里单独调整，不反写 A/B。',
  '联动缩放：字号和换行宽度同时变化，不拉伸手写图像。',
]) {
  if (!boardClipInspectorControlText.includes(requiredBoardClipLabel)) {
    throw new Error(`BoardClipInspector missing B/C business label: ${requiredBoardClipLabel}`);
  }
}

for (const requiredBoardClipAnchor of [
  'bc-c-content-panel-001',
  'bc-c-binding-hint-panel-001',
  'bc-c-skin-panel-001',
  'bc-c-position-size-panel-001',
  'bc-c-canvas-position-panel-001',
  'bc-c-draw-feel-panel-001',
  'bc-c-font-gap-panel-001',
  'bc-light-group-content-001',
  'bc-light-group-skin-001',
  'bc-light-group-position-001',
  'bc-light-group-performance-001',
]) {
  if (!boardClipInspectorControlText.includes(requiredBoardClipAnchor)) {
    throw new Error(`BoardClipInspector missing B/C anchor: ${requiredBoardClipAnchor}`);
  }
}

for (const forbiddenBoardClipUiCopy of [
  '选中板书片段',
  '请选择一个 B 板书片段',
  '选择 B 板书贴片后',
  'B 显示时间、C 内容、C 站位',
]) {
  if (boardClipInspectorText.includes(forbiddenBoardClipUiCopy)) {
    throw new Error(`BoardClipInspector must not show old B-only UI copy: ${forbiddenBoardClipUiCopy}`);
  }
}

for (const requiredBoardClipUiCopy of [
  '选中 C 角色内容',
  '选择 C 角色后',
  'B 寿命请在时间轴调整',
]) {
  if (!boardClipInspectorText.includes(requiredBoardClipUiCopy)) {
    throw new Error(`BoardClipInspector missing C role UI copy: ${requiredBoardClipUiCopy}`);
  }
}

for (const requiredBcCandidateAnnotation of [
  '@xiaxia-c-candidate-copy: boardSlice markers are C material candidates before A audio and B lifetime generation.',
  '@xiaxia-c-candidate-copy: boardSlice markers are C material candidates, not a B/C timeline track.',
  '@xiaxia-c-candidate-copy: allowed boardSlice is the editable C material candidate; compiler projects only allowed chainKey rows.',
]) {
  if (!activeVisibleBcUiText.includes(requiredBcCandidateAnnotation)) {
    throw new Error(`Active C candidate copy must carry a nearby truth annotation: ${requiredBcCandidateAnnotation}`);
  }
}

for (const forbiddenInspectorTimingToken of [
  'BoardDisplayWindowSection',
  'bc-b-display-window-panel-001',
  'bc-light-group-display-001',
]) {
  if (boardClipInspectorControlText.includes(forbiddenInspectorTimingToken)) {
    throw new Error(`BoardClipInspector must not own editable B timing after timeline split: ${forbiddenInspectorTimingToken}`);
  }
}

for (const requiredTimelineBDirectorToken of [
  'voice-track-b-timing',
  'voice-track-b-timing-controls',
  'B 寿命',
  '显示开始 ms',
  '显示结束 ms',
  '右侧只编辑 C 素材属性',
  '超过 A 后只静态留场',
]) {
  if (!teachingTimelineText.includes(requiredTimelineBDirectorToken)) {
    throw new Error(`TeachingTimeline missing B director control token: ${requiredTimelineBDirectorToken}`);
  }
}

for (const forbiddenTimelineBTrackCopy of [
  'B/C 轨',
  'B-C轨',
  'B/C {laneIndex + 1}',
  'B 指挥 / C 素材轨',
  'B指挥时序',
  "note: 'B轨'",
  '等待按非空 B/C 素材和 A 轨 timing/json 生成真实 B 指挥片段',
  'B/C 素材',
  '个可生成 B/C 素材',
  '含 B/C',
  'timeline-b-director-controls',
  'B 指挥片段',
]) {
  if (timelineBcFrontendText.includes(forbiddenTimelineBTrackCopy)) {
    throw new Error(`B timeline frontend must not mix B/C track ownership copy: ${forbiddenTimelineBTrackCopy}`);
  }
}

for (const requiredTimelineBTrackCopy of [
  'B 寿命轨',
  '等待按 C 素材候选和 A 轨时序生成 B 寿命。',
  '语音时序',
  "note: '时间轴'",
  '生成 B 寿命后自动出现图层',
]) {
  if (!timelineBcFrontendText.includes(requiredTimelineBTrackCopy)) {
    throw new Error(`B timeline frontend missing ownership copy: ${requiredTimelineBTrackCopy}`);
  }
}

for (const requiredTimelineBDirectorStyle of [
  '.voice-track-b-timing',
  'grid-template-columns: 126px minmax(0, 1fr);',
  '.voice-track-b-timing-meta',
  '.voice-track-b-timing-controls .ant-input-number',
]) {
  if (!stylesText.includes(requiredTimelineBDirectorStyle)) {
    throw new Error(`TeachingTimeline B director controls missing style: ${requiredTimelineBDirectorStyle}`);
  }
}

if (stylesText.includes('grid-template-columns: minmax(220px, 0.7fr) minmax(360px, 1fr);')) {
  throw new Error('TeachingTimeline B director controls must align to the timeline track grid, not use a separate proportional grid.');
}

for (const forbiddenActiveBcUiCopy of [
  '选中板书片段',
  '请选择一个 B 板书片段',
  '选择 B 板书贴片后',
  '整张画布都是板书贴片区',
  '缩放板书贴片',
  'B 板书贴片',
  '板书贴片、图章、标记',
  '文稿板书',
  '时序/B轨',
  '时序/B-C轨',
  'B 板书按时序',
  '真实 B 贴片',
  'B贴片',
  '默认 C 板书字体',
  '不控制 C 板书',
  '当前工程 C 板书字体 / 画布变量',
  '新工程默认 C 板书',
  '默认板书出现方式',
  'C 板书字体',
  'TTS Provider',
  '连续文稿 + 板书',
  '文稿 + 板书',
  '生成连续讲解和板书',
  '正式文稿、板书',
  '板书已确认',
  '板书文本',
  '等待 Agent 生成配套板书',
  'rows 文稿 + template B/C 素材',
  '默认贴图透明度',
  '动效/贴图',
  'B/C 素材',
  '个可生成 B/C 素材',
  '含 B/C',
  'B1控制条大于A1语音长度时',
  'B1短于A1时，C1动作速度越快',
  'B 指挥片段控制 C 素材',
]) {
  if (activeVisibleBcUiText.includes(forbiddenActiveBcUiCopy)) {
    throw new Error(`Active B/C UI must not show old board-sticker wording: ${forbiddenActiveBcUiCopy}`);
  }
}

for (const requiredActiveBcUiCopy of [
  '文稿/C素材候选',
  '语音时序',
  '整张画布都是 C 素材演绎区',
  'C 素材：',
  '调整 C 素材尺寸',
  'C 素材、图章、标记',
  'C 素材候选',
  '控制 C 素材在画布上的位置、换行宽度和单素材字号',
  '界面字体策略（不控制 C 素材）',
  '新工程默认 C 素材',
  '默认 C 素材出现方式',
  'rows 文稿 + C素材候选',
  'A 轨语音 Provider',
  'A 轨语音网关',
  'A 轨音频格式',
  'A 轨字级时间戳',
  '预留配置：保存但不参与当前 Agent 请求',
  'C 素材默认',
  'C 素材动效',
  '预留 C 素材透明度',
  'C素材候选已生成',
  '文稿 + C素材候选',
  '等待 Agent 生成 C 素材候选',
  'B 寿命控制 C 何时上台、下台和静态留场',
  'C 书写速度由 C 书写速度控制，不由 B 寿命隐式改写',
]) {
  if (!activeVisibleBcUiText.includes(requiredActiveBcUiCopy)) {
    throw new Error(`Active B/C UI missing synchronized wording: ${requiredActiveBcUiCopy}`);
  }
}

if (!boardRevealConfigText.includes('export const DEFAULT_BOARD_DRAW_SPEED = 2.9')) {
  throw new Error('C default drawSpeed must have exactly one current numeric truth: DEFAULT_BOARD_DRAW_SPEED = 2.9.');
}

if (
  !boardStickerGeometryText.includes("import { DEFAULT_BOARD_DRAW_SPEED } from '../boardReveal/boardRevealConfig'") ||
  !boardStickerGeometryText.includes('value ?? DEFAULT_BOARD_DRAW_SPEED') ||
  boardStickerGeometryText.includes('value ?? 1')
) {
  throw new Error('C drawSpeed fallback must read DEFAULT_BOARD_DRAW_SPEED and must not reintroduce fallback 1.');
}

if (
  !stylesText.includes('.golden-finger-canvas-layer') ||
  !stylesText.includes('height: 100%;') ||
  !stylesText.includes('width: 100%;') ||
  !stylesText.includes('touch-action: none;')
) {
  throw new Error('GoldenFinger canvas layer must explicitly cover the whole stage canvas and own touch drawing.');
}

for (const forbiddenScriptAgentPromptCopy of [
  '输出讲解文稿 + 配套板书',
  '配套板书内容',
]) {
  if (scriptBoardAgentPromptText.includes(forbiddenScriptAgentPromptCopy)) {
    throw new Error(`Script agent prompt must not use old board package copy: ${forbiddenScriptAgentPromptCopy}`);
  }
}

for (const requiredScriptAgentPromptCopy of [
  '输出讲解文稿 + C素材候选',
  'C 素材候选（课堂板书内容）',
]) {
  if (!scriptBoardAgentPromptText.includes(requiredScriptAgentPromptCopy)) {
    throw new Error(`Script agent prompt missing C material candidate copy: ${requiredScriptAgentPromptCopy}`);
  }
}

if (
  !boardClipInspectorText.includes('<BoardClipContentSection clipId={selectedBoardClip.id}') ||
  !boardClipInspectorText.includes('const activeDraft = selectedBoardClip && draft?.clipId === selectedBoardClip.id ? draft : initialDraft;') ||
  !boardClipInspectorText.includes('if (clipId !== selectedBoardClip?.id)') ||
  !boardClipInspectorSectionsText.includes('clipId: string') ||
  !boardClipInspectorSectionsText.includes('setIsEditing(false);') ||
  !boardClipInspectorSectionsText.includes('}, [clipId]);')
) {
  throw new Error('BoardClipInspector draft/edit state must stay keyed to the selected C material.');
}

for (const forbiddenCanvasInspectorLabel of [
  '当前工程 C板书字体 / 画布',
  '当前工程 C 板书字体 / 画布变量',
  'C 舞台输出比例',
  'labelPrefix="C 板书"',
  '当前工程唯一的 C 板书字体入口',
]) {
  if (canvasInspectorText.includes(forbiddenCanvasInspectorLabel)) {
    throw new Error(`CanvasInspector must not mix canvas/global defaults with selected C material wording: ${forbiddenCanvasInspectorLabel}`);
  }
}

for (const requiredCanvasInspectorLabel of [
  '舞台输出比例',
  '画布变量 / 录屏舞台',
  '这里只设置录屏舞台的纸张比例、输出尺寸和背景色',
]) {
  if (!canvasInspectorText.includes(requiredCanvasInspectorLabel)) {
    throw new Error(`CanvasInspector missing canvas-only label: ${requiredCanvasInspectorLabel}`);
  }
}

if (!currentProjectBoardFontInspectorText.includes('字体地址可填 HTTPS 在线字体 CSS')) {
  throw new Error('CurrentProjectBoardFontInspector must keep current-project C online font support visible.');
}

if (
  !appSettingsDrawerText.includes('这里是新工程默认值，不是当前工程字体入口') ||
  !appSettingsDrawerText.includes('界面字体策略（不控制 C 素材）') ||
  !appSettingsDrawerText.includes('当前 C 素材字体在“C 默认字体 / 当前工程”调整') ||
  !appSettingsDrawerText.includes('在线字体请填 HTTPS 字体 CSS')
) {
  throw new Error('AppSettingsDrawer must separate new-project defaults from current C board font controls.');
}

if (!boardTypographyFieldsText.includes('可填 HTTPS 字体 CSS')) {
  throw new Error('BoardTypographyFields must make HTTPS online font CSS support visible.');
}

if (
  !voiceTrackAudioText.includes("import { prepareVoiceAudioSeek } from './voiceAudioSeek'") ||
  !voiceTrackAudioText.includes('await prepareVoiceAudioSeek')
) {
  throw new Error('useVoiceTrackAudio must prepare source metadata before seeking and playing A audio.');
}

if (
  !voiceAudioSeekText.includes('@cleanroom-module: voiceAudioSeek') ||
  !voiceAudioSeekText.includes('loadedmetadata') ||
  !voiceAudioSeekText.includes('normalizeVoiceAudioSeekSeconds')
) {
  throw new Error('voiceAudioSeek must own A audio metadata-before-seek behavior.');
}

if (
  !voiceTrackAudioText.includes("import { resolveVoicePlaybackStart } from './voicePlaybackStart'") ||
  !voiceTrackAudioText.includes('lastAudioDrivenPlayheadRef') ||
  !voicePlaybackStartText.includes('@cleanroom-module: voicePlaybackStart') ||
  !voicePlaybackStartText.includes('return null')
) {
  throw new Error('A audio playback must resolve start positions without looping from B/C tail back to the first voice clip.');
}

if (
  teachingTimelineText.includes('if (isPlaying)') &&
  teachingTimelineText.includes('setIsPlaying(false);') &&
  teachingTimelineText.includes('handlePlayheadChange')
) {
  throw new Error('A timeline slider must not stop playback while scrubbing the playhead.');
}

if (
  !boardControlResponsibilitiesText.includes('@cleanroom-module: boardControlResponsibilities') ||
  !boardControlResponsibilitiesPanelText.includes("from '../modules/boardControlLayers/boardControlResponsibilities'") ||
  !boardControlResponsibilitiesText.includes('VoiceTrack / 时间轴 B 寿命控件') ||
  boardControlResponsibilitiesText.includes('时间轴 B clip / 右侧 B 显示时间')
) {
  throw new Error('A/B/C control responsibility UI must render from the single boardControlResponsibilities source.');
}

if (
  !boardClipInspectorText.includes("import { normalizeBoardRevealWindow } from '../modules/boardReveal'") ||
  !boardClipInspectorText.includes('previewRevealWindow') ||
  !boardClipInspectorText.includes('displayStartMs: activeDraft.startMs') ||
  !boardClipInspectorText.includes('displayEndMs: activeDraft.endMs')
) {
  throw new Error('BoardClipInspector mapping hint must preview C reveal from the current B display draft.');
}

if (
  boardClipInspectorText.includes("Pick<TimelineClip, 'label' | 'startMs'") ||
  boardClipInspectorText.includes("Pick<TimelineClip, 'label' | 'xPercent'") ||
  boardClipInspectorText.includes('export type { BoardClipInspectorPatch }') ||
  boardClipInspectorText.includes('const { clipId, ...patch } = activeDraft') ||
  !boardClipInspectorText.includes('@xiaxia-inspector-boundary: C material panel reads B timing for mapping, but only writes C material fields.') ||
  !boardClipInspectorText.includes('createBoardClipInspectorPatch(activeDraft)') ||
  !boardClipInspectorContractText.includes('export type BoardClipInspectorPatch = Partial<') ||
  !boardClipInspectorContractText.includes("Pick<TimelineClip, 'label' | 'xPercent' | 'yPercent' | 'widthPercent' | 'fontSize' | 'drawSpeed'>") ||
  !boardClipInspectorContractText.includes('export function createBoardClipInspectorPatch(draft: BoardClipInspectorDraft): BoardClipInspectorPatch') ||
  !boardClipInspectorContractText.includes('drawSpeed: draft.drawSpeed') ||
  !boardClipInspectorContractText.includes('fontSize: draft.fontSize') ||
  !boardClipInspectorContractText.includes('label: draft.label') ||
  !boardClipInspectorContractText.includes('widthPercent: draft.widthPercent') ||
  !boardClipInspectorContractText.includes('xPercent: draft.xPercent') ||
  !boardClipInspectorContractText.includes('yPercent: draft.yPercent')
) {
  throw new Error('BoardClipInspector confirm must write only C material fields; B timing belongs to TeachingTimeline.');
}

if (
  boardClipInspectorText.includes("from '../modules/boardTiming'") ||
  boardClipInspectorText.includes("from '../modules/boardSticker'") ||
  boardClipInspectorSectionsText.includes('export type BoardClipInspectorWritableDraft') ||
  boardClipInspectorSectionsText.includes('export type BoardClipInspectorDraft') ||
  !boardClipInspectorText.includes("from './boardClipInspector/boardClipInspectorContract'") ||
  !boardClipInspectorSectionsText.includes("from './boardClipInspectorContract'")
) {
  throw new Error('BoardClipInspector contract logic must stay sealed in boardClipInspectorContract.ts.');
}

for (const requiredControlResponsibilityId of [
  'abc-a-playhead-clock',
  'abc-a-source-anchor',
  'abc-b-display-window',
  'abc-c-reveal-window',
  'abc-c-draw-feel',
  'abc-c-position-size',
  'abc-c-current-font',
  'abc-c-default-font',
  'abc-c-formula-renderer',
  'abc-c-marker-symbol-gap',
  'abc-global-font-preset-gap',
]) {
  if (!boardControlResponsibilitiesText.includes(requiredControlResponsibilityId)) {
    throw new Error(`boardControlResponsibilities missing control row: ${requiredControlResponsibilityId}`);
  }
}

for (const requiredControlField of [
  'playheadMs',
  'sourceStartMs',
  'sourceEndMs',
  'startMs',
  'endMs',
  'revealStartMs',
  'revealEndMs',
  'drawSpeed',
  'xPercent',
  'yPercent',
  'widthPercent',
  'fontSize',
  '字号 / 宽度联动',
  'boardFontUrl',
  'hasBoardMath',
  'math-symbol-factory',
  'typography.globalFontPreset',
]) {
  if (!boardControlResponsibilitiesText.includes(requiredControlField)) {
    throw new Error(`boardControlResponsibilities missing control field: ${requiredControlField}`);
  }
}

for (const requiredCanvasLabel of ['白板规格', '背景画布颜色']) {
  if (!canvasInspectorText.includes(requiredCanvasLabel)) {
    throw new Error(`CanvasInspector missing canvas business label: ${requiredCanvasLabel}`);
  }
}

for (const forbiddenCanvasTypographyToken of [
  'BoardTypographyControlledFields',
  '全局板书默认',
  '画布变量 / 全局板书默认样式',
]) {
  if (canvasInspectorText.includes(forbiddenCanvasTypographyToken)) {
    throw new Error(`CanvasInspector must stay stage/paper only, not C typography: ${forbiddenCanvasTypographyToken}`);
  }
}

for (const requiredCurrentProjectCFontToken of [
  '@cleanroom-component: CurrentProjectBoardFontInspector',
  'C 默认字体 / 当前工程',
  'C 默认',
  'project.stage.canvas.boardFontName/boardFontFamily/boardFontSize/boardFontUrl',
  'CurrentProjectBoardFontInspector / 当前工程 C 默认字体',
  'C 素材字体的边界',
  '不控制 C 素材',
]) {
  if (!`${currentProjectBoardFontInspectorText}\n${boardControlResponsibilitiesText}`.includes(requiredCurrentProjectCFontToken)) {
    throw new Error(`Current project C font boundary missing token: ${requiredCurrentProjectCFontToken}`);
  }
}

mkdirSync(outDir, { recursive: true });

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', 'false', '--outDir', outDir], {
  cwd: root,
  stdio: 'inherit',
});

const emittedStickerGeometryPath = join(outDir, 'modules', 'boardSticker', 'boardStickerGeometry.js');
writeFileSync(
  emittedStickerGeometryPath,
  readFileSync(emittedStickerGeometryPath, 'utf8')
    .replace("../boardFont/boardFontConfig", "../boardFont/boardFontConfig.js")
    .replace("../boardReveal/boardRevealConfig", "../boardReveal/boardRevealConfig.js"),
);

const emittedBoardTextDisplayRoutePath = join(outDir, 'modules', 'boardSticker', 'boardTextDisplayRoute.js');
writeFileSync(
  emittedBoardTextDisplayRoutePath,
  readFileSync(emittedBoardTextDisplayRoutePath, 'utf8').replace("./mathBoardText", "./mathBoardText.js"),
);

const emittedBoardStickerPluginContractPath = join(outDir, 'modules', 'boardSticker', 'boardStickerPluginContract.js');
writeFileSync(
  emittedBoardStickerPluginContractPath,
  readFileSync(emittedBoardStickerPluginContractPath, 'utf8')
    .replace("./boardTextDisplayRoute", "./boardTextDisplayRoute.js")
    .replace("./boardStickerGeometry", "./boardStickerGeometry.js"),
);

const emittedVoicePlaybackStartPath = join(outDir, 'modules', 'audioPlayback', 'voicePlaybackStart.js');
writeFileSync(
  emittedVoicePlaybackStartPath,
  readFileSync(emittedVoicePlaybackStartPath, 'utf8').replace("../timeline/timelineWindow", "../timeline/timelineWindow.js"),
);

const emittedBoardRevealProgressPath = join(outDir, 'modules', 'boardReveal', 'getBoardRevealProgress.js');
writeFileSync(
  emittedBoardRevealProgressPath,
  readFileSync(emittedBoardRevealProgressPath, 'utf8').replace("./boardRevealConfig", "./boardRevealConfig.js"),
);

writeFileSync(
  checkFile,
    `import { normalizeBoardFontUrl } from './modules/boardFont/boardFontConfig.js';\n` +
    `import { getBoardRevealProgress } from './modules/boardReveal/getBoardRevealProgress.js';\n` +
    `import { normalizeBoardRevealWindow } from './modules/boardReveal/normalizeBoardRevealWindow.js';\n` +
    `import { createBoardDisplayTimingDragPatch, normalizeBoardDisplayWindow } from './modules/boardTiming/boardDisplayTiming.js';\n` +
    `import { resolveBoardStickerPluginState } from './modules/boardSticker/boardStickerPluginContract.js';\n` +
    `import { resolveBoardTextDisplayRoute } from './modules/boardSticker/boardTextDisplayRoute.js';\n` +
    `import { hasBoardMath, isBoardTextSupportedByHandwritingFont, tokenizeBoardText } from './modules/boardSticker/mathBoardText.js';\n` +
    `import { createBoardStickerUniformResizePatch, createBoardStickerUniformScalePatch, normalizeBoardStickerVisualPatch } from './modules/boardSticker/boardStickerGeometry.js';\n\n` +
    `import { normalizeVoiceAudioSeekSeconds } from './modules/audioPlayback/voiceAudioSeek.js';\n\n` +
    `import { resolveVoicePlaybackStart } from './modules/audioPlayback/voicePlaybackStart.js';\n\n` +
    `const sameSource = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 1200, displayEndMs: 3600,\n` +
    `  previousDisplayStartMs: 1200, previousDisplayEndMs: 3600,\n` +
    `  previousRevealStartMs: 1200, previousRevealEndMs: 3600,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: {},\n` +
    `});\n` +
    `if (sameSource.revealStartMs !== 1200 || sameSource.revealEndMs !== 3600) throw new Error('initial reveal must stay aligned to A source');\n` +
    `const extendedB = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 1200, displayEndMs: 6200,\n` +
    `  previousDisplayStartMs: 1200, previousDisplayEndMs: 3600,\n` +
    `  previousRevealStartMs: 1200, previousRevealEndMs: 3600,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: { endMs: 6200 },\n` +
    `});\n` +
    `if (extendedB.revealStartMs !== 1200 || extendedB.revealEndMs !== 3600) throw new Error('B tail beyond A must not stretch C reveal speed');\n` +
    `const movedBInsideA = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 2000, displayEndMs: 5000,\n` +
    `  previousDisplayStartMs: 1200, previousDisplayEndMs: 3600,\n` +
    `  previousRevealStartMs: 1200, previousRevealEndMs: 3600,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: { startMs: 2000, endMs: 5000 },\n` +
    `});\n` +
    `if (movedBInsideA.revealStartMs !== 2000 || movedBInsideA.revealEndMs !== 3600) throw new Error('C dynamic window must be A source intersect B display');\n` +
    `const afterSourceB = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 4200, displayEndMs: 6200,\n` +
    `  previousDisplayStartMs: 1200, previousDisplayEndMs: 3600,\n` +
    `  previousRevealStartMs: 1200, previousRevealEndMs: 3600,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: { startMs: 4200, endMs: 6200 },\n` +
    `});\n` +
    `if (afterSourceB.revealStartMs !== 4200 || afterSourceB.revealEndMs !== 4200) throw new Error('B fully after A must keep C completed/static, not animate inside old A source');\n` +
    `if (getBoardRevealProgress({ playheadMs: 4200, revealStartMs: afterSourceB.revealStartMs, revealEndMs: afterSourceB.revealEndMs }) !== 1) throw new Error('zero-duration completed reveal must be complete at B start');\n` +
    `const beforeSourceB = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 100, displayEndMs: 900,\n` +
    `  previousDisplayStartMs: 1200, previousDisplayEndMs: 3600,\n` +
    `  previousRevealStartMs: 1200, previousRevealEndMs: 3600,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: { startMs: 100, endMs: 900 },\n` +
    `});\n` +
    `if (beforeSourceB.revealStartMs !== 900 || beforeSourceB.revealEndMs !== 900) throw new Error('B fully before A must not animate inside old A source');\n` +
    `if (getBoardRevealProgress({ playheadMs: 500, revealStartMs: beforeSourceB.revealStartMs, revealEndMs: beforeSourceB.revealEndMs }) !== 0) throw new Error('zero-duration pending reveal must stay unwritten before its anchor');\n` +
    `const manualReveal = normalizeBoardRevealWindow({\n` +
    `  displayStartMs: 2000, displayEndMs: 3200,\n` +
    `  previousDisplayStartMs: 2000, previousDisplayEndMs: 3200,\n` +
    `  previousRevealStartMs: 2000, previousRevealEndMs: 3200,\n` +
    `  sourceStartMs: 1200, sourceEndMs: 3600,\n` +
    `  patch: { revealStartMs: 1000, revealEndMs: 5000 },\n` +
    `});\n` +
    `if (manualReveal.revealStartMs !== 2000 || manualReveal.revealEndMs !== 3200) throw new Error('manual C reveal window must clamp to A source intersect B display');\n` +
    `const defaultMidpointProgress = getBoardRevealProgress({ playheadMs: 2400, revealStartMs: 1200, revealEndMs: 3600 });\n` +
    `const earlyDefaultProgress = getBoardRevealProgress({ playheadMs: 1800, revealStartMs: 1200, revealEndMs: 3600 });\n` +
    `if (!(earlyDefaultProgress > 0.7 && earlyDefaultProgress < 1 && defaultMidpointProgress === 1)) throw new Error('default C reveal must be fast enough for handwriting-first playback');\n` +
    `const fastProgress = getBoardRevealProgress({ playheadMs: 2400, revealStartMs: 1200, revealEndMs: 3600, drawSpeed: 2 });\n` +
    `const slowProgress = getBoardRevealProgress({ playheadMs: 2400, revealStartMs: 1200, revealEndMs: 3600, drawSpeed: 0.5 });\n` +
    `if (!(fastProgress > 0.85 && fastProgress <= 1)) throw new Error('drawSpeed above 1 must make C reveal visibly faster inside the same A/B window');\n` +
    `if (!(slowProgress > 0 && slowProgress < 0.2)) throw new Error('drawSpeed below 1 must make C reveal visibly slower inside the same A/B window');\n` +
    `const displayWindow = normalizeBoardDisplayWindow({ startMs: -500, endMs: -100 });\n` +
    `if (displayWindow.startMs !== 0 || displayWindow.endMs !== 100) throw new Error('B display window must clamp to valid survival interval');\n` +
    `const dragPatch = createBoardDisplayTimingDragPatch({ currentClientX: 150, durationMs: 1000, laneWidth: 100, mode: 'range', originEndMs: 400, originStartMs: 200, pointerX: 100 });\n` +
    `if (dragPatch.startMs !== 700 || dragPatch.endMs !== 900) throw new Error('B drag patch must preserve clip width for range move');\n` +
    `const visualPatch = normalizeBoardStickerVisualPatch({ drawSpeed: 9, fontSize: 200, widthPercent: 200, xPercent: -10, yPercent: 120 });\n` +
    `if (visualPatch.drawSpeed !== 4 || visualPatch.fontSize !== 96 || visualPatch.widthPercent !== 90 || visualPatch.xPercent !== 0 || visualPatch.yPercent !== 100) throw new Error('C visual patch must clamp in boardSticker module');\n` +
    `const defaultVisualPatch = normalizeBoardStickerVisualPatch({});\n` +
    `if (defaultVisualPatch.xPercent !== 50 || defaultVisualPatch.yPercent !== 56 || defaultVisualPatch.widthPercent !== 34) throw new Error('C visual defaults must stay in boardSticker module');\n` +
    `const resizePatch = createBoardStickerUniformResizePatch({ areaWidth: 1000, currentClientX: 600, fallbackFontSize: 40, originClientX: 500, originFontSize: 40, originWidthPercent: 40 });\n` +
    `if (resizePatch.widthPercent !== 50 || resizePatch.fontSize !== 50) throw new Error('C resize must scale width and fontSize together');\n` +
    `const scalePatch = createBoardStickerUniformScalePatch({ fallbackFontSize: 40, originFontSize: 40, originWidthPercent: 40, scalePercent: 150 });\n` +
    `if (scalePatch.widthPercent !== 60 || scalePatch.fontSize !== 60) throw new Error('C overall scale must derive width and fontSize together');\n` +
    `const minScalePatch = createBoardStickerUniformScalePatch({ fallbackFontSize: 40, originFontSize: 40, originWidthPercent: 40, scalePercent: 1 });\n` +
    `if (minScalePatch.widthPercent !== 8 || minScalePatch.fontSize !== 12) throw new Error('C overall scale must clamp through boardSticker rules');\n` +
    `if (normalizeVoiceAudioSeekSeconds(2500) !== 2.5) throw new Error('A audio seek must convert playhead offset to seconds');\n` +
    `if (normalizeVoiceAudioSeekSeconds(-500) !== 0) throw new Error('A audio seek must clamp negative offsets to zero');\n` +
    `const voiceStartInside = resolveVoicePlaybackStart(2500, [{ id: 'a1', kind: 'audio', label: 'A1', startMs: 1000, endMs: 4000, trackId: 'track-voice', sourceRef: 'voice.mp3' }]);\n` +
    `if (!voiceStartInside || voiceStartInside.offsetMs !== 1500 || voiceStartInside.playheadMs !== 2500) throw new Error('A playback must resume from the dragged playhead inside the active voice clip');\n` +
    `const voiceStartGap = resolveVoicePlaybackStart(4500, [{ id: 'a1', kind: 'audio', label: 'A1', startMs: 1000, endMs: 4000, trackId: 'track-voice', sourceRef: 'voice-1.mp3' }, { id: 'a2', kind: 'audio', label: 'A2', startMs: 6000, endMs: 8000, trackId: 'track-voice', sourceRef: 'voice-2.mp3' }]);\n` +
    `if (!voiceStartGap || voiceStartGap.clip.id !== 'a2' || voiceStartGap.offsetMs !== 0 || voiceStartGap.playheadMs !== 6000) throw new Error('A playback from a voice gap must advance to the next A clip, not restart from the first clip');\n` +
    `const voiceStartAfterTail = resolveVoicePlaybackStart(9000, [{ id: 'a1', kind: 'audio', label: 'A1', startMs: 1000, endMs: 4000, trackId: 'track-voice', sourceRef: 'voice.mp3' }]);\n` +
    `if (voiceStartAfterTail !== null) throw new Error('A playback after the final voice tail must not restart from the first clip');\n` +
    `if (normalizeBoardFontUrl('') !== '') throw new Error('empty board font URL must not fall back to external stylesheet');\n` +
    `if (normalizeBoardFontUrl('not-a-url') !== '') throw new Error('invalid board font URL must not fall back to external stylesheet');\n` +
    `if (hasBoardMath('25×4=100') || hasBoardMath('1200÷100=12')) throw new Error('plain numeric arithmetic must stay in C handwriting font, not KaTeX');\n` +
    `if (!isBoardTextSupportedByHandwritingFont('y=2x+1')) throw new Error('C handwriting font must support linear letter-number expressions');\n` +
    `if (!isBoardTextSupportedByHandwritingFont('a+b=5') || !isBoardTextSupportedByHandwritingFont('x=12')) throw new Error('C handwriting font must support simple letters, digits, and operators');\n` +
    `if (!isBoardTextSupportedByHandwritingFont('f(x)=x^2+1')) throw new Error('linear function expressions must stay available to C handwriting font route');\n` +
    `const plainArithmeticTokens = tokenizeBoardText('25×4=100')[0];\n` +
    `if (plainArithmeticTokens.length !== 1 || plainArithmeticTokens[0].kind !== 'text') throw new Error('plain numeric arithmetic must tokenize as handwriting text');\n` +
    `if (!hasBoardMath('$25×4=100$')) throw new Error('explicit simple arithmetic still needs the display tokenizer to strip speech-protection delimiters');\n` +
    `if (!hasBoardMath('函数 f(x)=x^2+1')) throw new Error('function expressions may be math-detected before C route chooses handwriting');\n` +
    `if (hasBoardMath('函数 y=2x+1')) throw new Error('linear expressions supported by the C font must stay in C handwriting');\n` +
    `if (!hasBoardMath('\\\\sin x+\\\\cos x=1')) throw new Error('LaTeX function commands must render as board math');\n` +
    `const explicitTokens = tokenizeBoardText('$25×4=100$')[0];\n` +
    `if (explicitTokens.length !== 1 || explicitTokens[0].kind !== 'text' || explicitTokens[0].text !== '25×4=100') throw new Error('explicit simple arithmetic must strip speech-protection delimiters and stay in C handwriting text');\n` +
    `const explicitFormulaTokens = tokenizeBoardText('$\\\\frac{1}{2}+\\\\frac{1}{3}$')[0];\n` +
    `if (explicitFormulaTokens.length !== 1 || explicitFormulaTokens[0].kind !== 'math' || !explicitFormulaTokens[0].latex.includes('\\\\frac')) throw new Error('explicit complex formulas must still render as math');\n` +
    `const speechProtectedArithmeticRoute = resolveBoardTextDisplayRoute('$25×4=100$');\n` +
    `if (speechProtectedArithmeticRoute.kind !== 'handwriting' || speechProtectedArithmeticRoute.text !== '25×4=100') throw new Error('A speech-protected simple arithmetic must render through C handwriting route without dollar delimiters');\n` +
    `const speechProtectedFormulaRoute = resolveBoardTextDisplayRoute('$\\\\frac{1}{2}+\\\\frac{1}{3}$');\n` +
    `if (speechProtectedFormulaRoute.kind !== 'formula') throw new Error('A speech-protected complex formula must still render through C formula route');\n` +
    `const parenTokens = tokenizeBoardText('\\\\(= \\\\frac{5}{8}\\\\)')[0];\n` +
    `if (parenTokens.length !== 1 || parenTokens[0].kind !== 'math' || parenTokens[0].latex !== '= \\\\frac{5}{8}') throw new Error('explicit paren math must strip delimiters into one math token');\n` +
    `const bracketTokens = tokenizeBoardText('解：\\\\[f(x)=x^2+1\\\\]')[0];\n` +
    `if (!bracketTokens.some((token) => token.kind === 'text' && token.text.includes('解')) || !bracketTokens.some((token) => token.kind === 'text' && token.text.includes('f(x)'))) throw new Error('explicit bracket linear function must keep text and strip math delimiters for C handwriting');\n` +
    `const mixedTokens = tokenizeBoardText('函数 f(x)=x^2+1')[0];\n` +
    `if (mixedTokens.length !== 1 || mixedTokens[0].kind !== 'text' || !mixedTokens[0].text.includes('函数 f(x)')) throw new Error('mixed font-supported function text must stay as one C handwriting text token');\n` +
    `const numericFunctionRoute = resolveBoardTextDisplayRoute('函数 y=2x+1');\n` +
    `if (numericFunctionRoute.kind !== 'handwriting') throw new Error('C font-supported numeric function text must stay in handwriting route');\n` +
    `if (numericFunctionRoute.text !== '函数 y=2x+1') throw new Error('C font-supported numeric function text must stay unchanged in handwriting route');\n` +
    `const linearExpressionRoute = resolveBoardTextDisplayRoute('y=2x+1');\n` +
    `if (linearExpressionRoute.kind !== 'handwriting' || linearExpressionRoute.text !== 'y=2x+1') throw new Error('plain linear expressions must stay in C handwriting route');\n` +
    `const speechProtectedLinearRoute = resolveBoardTextDisplayRoute('$y=2x+1$');\n` +
    `if (speechProtectedLinearRoute.kind !== 'handwriting' || speechProtectedLinearRoute.text !== 'y=2x+1') throw new Error('speech-protected linear expressions must strip delimiters and stay in C handwriting route');\n` +
    `const letterArithmeticRoute = resolveBoardTextDisplayRoute('a+b=5');\n` +
    `if (letterArithmeticRoute.kind !== 'handwriting' || letterArithmeticRoute.text !== 'a+b=5') throw new Error('simple letter arithmetic must stay in C handwriting route');\n` +
    `const structuralFormulaRoute = resolveBoardTextDisplayRoute('函数 f(x)=x^2+1');\n` +
    `if (structuralFormulaRoute.kind !== 'handwriting') throw new Error('font-supported function expressions must use the C handwriting route');\n` +
    `const pluginState = resolveBoardStickerPluginState({ text: '$y=2x+1$', visual: { fontSize: 999, widthPercent: 999, xPercent: -20 } });\n` +
    `if (pluginState.pluginId !== 'board-sticker-c-canvas') throw new Error('portable boardSticker plugin id must stay stable');\n` +
    `if (pluginState.displayRoute.kind !== 'handwriting' || pluginState.displayRoute.text !== 'y=2x+1') throw new Error('portable boardSticker plugin state must expose the centralized display route');\n` +
    `if (pluginState.visual.fontSize !== 96 || pluginState.visual.widthPercent !== 90 || pluginState.visual.xPercent !== 0) throw new Error('portable boardSticker plugin state must expose normalized C visual geometry');\n` +
    `console.log('[board-boundaries] passed');\n`,
);

execFileSync(join(root, 'runtime', 'node', 'node.exe'), [checkFile], {
  cwd: outDir,
  stdio: 'inherit',
});

rmSync(outDir, { force: true, recursive: true });
