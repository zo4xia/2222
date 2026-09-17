// @cleanroom-module: boardControlResponsibilities
// @domain: A/B/C board control layers
// @boundary: Single read-only responsibility index for UI and guard scripts; no runtime timing or rendering logic.
// ****xiaxia** ID 不对，为什么不对应？明明有命名规范
//



export type BoardControlResponsibility = {
  id: string;
  component: string;
  purpose: string;
  owns: string;
  notOwns: string;
  effect: string;
  fields: string[];
  frontend: string;
  uniqueness: string;
};

export const boardControlResponsibilities: BoardControlResponsibility[] = [
  {
    id: 'abc-a-playhead-clock',
    component: 'A 主时钟',
    purpose: '驱动声音时间轴、舞台预览和 reveal 进度。',
    owns: 'playheadMs 的当前播放位置。',
    notOwns: '不改 C 站位、字体、书写速度；不接受 B/C 反写。',
    effect: 'C 是否显示、C 写到哪里，都按主时钟读取。',
    fields: ['playheadMs'],
    frontend: 'TeachingTimeline / 播放轴',
    uniqueness: '主时钟唯一。',
  },
  {
    id: 'abc-a-source-anchor',
    component: 'A source 锚点',
    purpose: '保存语音切片给板书的原始时间区间。',
    owns: 'sourceStartMs/sourceEndMs 的初始写入和保留。',
    notOwns: '不跟随 B 拖长；不被 C 视觉修缮反写。',
    effect: 'C 动态书写窗口只能落在 A source 内。',
    fields: ['sourceStartMs', 'sourceEndMs'],
    frontend: '无直接控件',
    uniqueness: '初始来源唯一：mapBoardEventsToTimelineClips()。',
  },
  {
    id: 'abc-b-display-window',
    component: 'B 显示窗口',
    purpose: 'B 寿命控制 C 何时上台、下台和静态留场。',
    owns: 'startMs/endMs 的显示存活窗口。',
    notOwns: '不代表 C 书写开始/结束；不改 A source；不管字体。',
    effect: 'B 决定 C 何时上台、留场、退场；A source 只决定动态书写落在哪段时间里。若 B 超过 A 尾巴，C 只静态留场。drawSpeed 只改书写快慢，不由 B 寿命隐式改写。',
    fields: ['startMs', 'endMs'],
    frontend: 'VoiceTrack / 时间轴 B 寿命控件',
    uniqueness: '可拖动 B clip 或在时间轴主控精调；规则模块唯一：normalizeBoardDisplayWindow()。',
  },
  {
    id: 'abc-c-reveal-window',
    component: 'C 动态独舞窗口',
    purpose: '把 A source 与 B display 压成 C 真正可动态书写的区间。',
    owns: 'revealStartMs/revealEndMs 的归一化结果。',
    notOwns: '不决定 B 是否可见；不改 C 字体、位置、大小。',
    effect: 'revealStartMs/revealEndMs 是 A source 与 B 寿命归一化后的动态书写窗口缓存；它不决定 C 是否留场。B 尾巴超出 A 时，C 只静态留场；书写快慢仍由 drawSpeed 控制。',
    fields: ['revealStartMs', 'revealEndMs'],
    frontend: '无直接控件，由 StagePreview 消费',
    uniqueness: '规则唯一：normalizeBoardRevealWindow()。',
  },
  {
    id: 'abc-c-draw-feel',
    component: 'C 书写速度',
    purpose: '调同一 reveal 窗口内的书写进度曲线。',
    owns: 'drawSpeed 的 clamp 与 reveal progress 曲线。',
    notOwns: '不改 startMs/endMs；不改 revealStartMs/revealEndMs；不改 A。',
    effect: '只改变 reveal 快慢，不改变声音和 B 寿命窗口。',
    fields: ['drawSpeed'],
    frontend: 'BoardClipInspector / C 书写速度',
    uniqueness: 'UI 输入基本唯一，消费函数唯一：getBoardRevealProgress()。',
  },
  {
    id: 'abc-c-position-size',
    component: 'C 站位 / 换行盒 / 字号',
    purpose: '控制 C 素材在画布上的位置、换行宽度和单素材字号。',
    owns: 'xPercent/yPercent/widthPercent/fontSize 的归一化。',
    notOwns: '不改 B 显示时间；不改 A；当前不拥有真正 transform scale 字段。',
    effect: 'Stage 拖动改站位；换行盒改 widthPercent；字号改 fontSize；联动控件同步 widthPercent + fontSize，不拉伸手写图像。',
    fields: ['xPercent', 'yPercent', 'widthPercent', 'fontSize', '字号 / 宽度联动'],
    frontend: 'BoardClipInspector / StagePreview 拖动与大小调整',
    uniqueness: '编辑入口不唯一，视觉规则唯一：normalizeBoardStickerVisualPatch()。',
  },
  {
    id: 'abc-c-current-font',
    component: '当前工程 C 字体',
    purpose: '控制当前打开工程的 C 素材默认字体、字号和在线字体 CSS。',
    owns: 'project.stage.canvas.boardFontName/boardFontFamily/boardFontSize/boardFontUrl。',
    notOwns: '不控制新工程默认值；不控制全局界面字体；不控制画布纸张尺寸和背景；不强制 KaTeX 字形手写化。',
    effect: '影响 Stage CSS 变量和普通文字 canvas 渲染。',
    fields: ['boardFontName', 'boardFontFamily', 'boardFontSize', 'boardFontUrl'],
    frontend: 'CurrentProjectBoardFontInspector / 当前工程 C 默认字体',
    uniqueness: '当前工程入口唯一：CurrentProjectBoardFontInspector -> updateStageCanvas()。',
  },
  {
    id: 'abc-c-default-font',
    component: '新工程默认 C 字体',
    purpose: '设置以后新建或 seed 工程的默认 C 素材字体。',
    owns: 'stageDefaults.canvas.* 的保存与归一。',
    notOwns: '不直接改变当前打开工程。',
    effect: '只影响后续项目初始化，不应让用户误以为立即生效。',
    fields: ['stageDefaults.canvas.boardFontName', 'stageDefaults.canvas.boardFontSize', 'stageDefaults.canvas.boardFontUrl'],
    frontend: 'AppSettingsDrawer / 新工程默认值',
    uniqueness: '默认入口唯一，但不同于当前工程入口。',
  },
  {
    id: 'abc-c-formula-renderer',
    component: 'C 数学/公式展示',
    purpose: '把被识别为数学的文本交给 FormulaText/KaTeX 展示。',
    owns: 'hasBoardMath/tokenizeBoardText/katex 的展示链。',
    notOwns: '不抢 C 手写字体已经支持的数字、英文字母和基础符号；不改源文本；不改 A/B timing。',
    effect: '分数、根号、上下标、复杂公式优先保证结构正确；普通数字算式和 y=2x+1 这类线性式继续用 C 手写字体。',
    fields: ['hasBoardMath', 'tokenizeBoardText', 'katex'],
    frontend: 'BoardTextSticker -> BoardMathStickerContent -> FormulaText',
    uniqueness: '数学展示链唯一，但符号风格仍需单独复核。',
  },
  {
    id: 'abc-c-marker-symbol-gap',
    component: 'C 特殊标记 / 符号缺口',
    purpose: '记录当前还没有真正实现的圈画、箭头、下划线、标记层。',
    owns: '只负责说明缺口，避免把占位当真相。',
    notOwns: 'marker 轨道、math-symbol-factory 占位、Raphael 参考都不是现役 C 标记渲染器。',
    effect: '特殊符号不能混进字体或 B/C 时间问题里处理。',
    fields: ['marker', 'math-symbol-factory'],
    frontend: '暂无 C marker 控件',
    uniqueness: '未实现；不能作为现役控制层宣传。',
  },
  {
    id: 'abc-global-font-preset-gap',
    component: '界面字体策略',
    purpose: '记录 globalFontPreset 与 C 素材字体的边界。',
    owns: 'typography.globalFontPreset 的配置保存。',
    notOwns: '当前未看到它消费到 StagePreview、BoardTextSticker 或 C canvas 渲染。',
    effect: '页面必须写清“不控制 C 素材”，否则就是第二套假字体入口。',
    fields: ['typography.globalFontPreset'],
    frontend: 'AppSettingsDrawer / 界面字体策略',
    uniqueness: '配置项存在，但不是 C 素材生效入口。',
  },
];

export const criticalBoardControlResponsibilityIds = boardControlResponsibilities.map((row) => row.id);
