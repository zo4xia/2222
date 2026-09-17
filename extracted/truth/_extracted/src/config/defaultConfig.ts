import { DEFAULT_BOARD_FONT_NAME, DEFAULT_BOARD_FONT_URL } from '../modules/boardFont/boardFontConfig';
import type { StageCanvasPreset } from '../domain/teachingProject';
import { DEFAULT_BOARD_FONT_SIZE } from '../modules/boardFont/boardFontConfig';
import { SCRIPT_SECTION } from '../domain/globalRules';

export type ScriptAgentMode = 'manual-template' | 'builtin-kb' | 'external-agent-api' | 'customer-agent';

export type KnowledgeBaseProvider = 'none' | 'builtin' | 'local' | 'external-vector-api' | 'customer-managed';

export type AutomationMode = 'manual-review' | 'unattended';

export type RecognitionProvider =
  | 'manual-first'
  | 'aliyun-qwen35b-vision'
  | 'aliyun-qwen-ocr'
  | 'aliyun-qwen-vl'
  | 'bigmodel-vision'
  | 'custom-vision-api';

export type RecognitionTextMode = 'same-frame' | 'manual-only';

export type TtsProvider = 'aliyun-cosyvoice';

export type BoardRevealEffect = 'write-on' | 'fade-in' | 'pop';

export type ExportVideoFormat = 'webm' | 'mp4';

export type GlobalFontPreset = 'system' | 'math-first';

export type RecognitionOutputContract = 'problemText' | 'givenConditions' | 'answerTarget' | 'mathSymbolProtection';

export type ScriptAgentOutputContract = 'rows';

export type AppConfig = {
  version: 1;
  // @api-needed: service-gateway-api | owner: backend gateway / local service | used-by: future API adapters
  service: {
    baseUrl: string;
    socketPath: string;
  };
  // @api-needed: feishu-api | owner: task import/export adapter | used-by: future task registry and result callback
  feishu: {
    enabled: boolean;
    webhookSecretHeader: string;
  };
  // @api-needed: automation-runner-api | owner: future unattended task runner | used-by: workflow gates
  automation: {
    mode: AutomationMode;
    requireReviewBeforeTts: boolean;
    requireReviewBeforeTimeline: boolean;
    requireReviewBeforeRecording: boolean;
  };
  // @api-needed: recognition-ai-api | owner: problem intake adapter | used-by: ProblemWorkspace / future OCR button
  recognition: {
    provider: RecognitionProvider;
    endpoint: string;
    authHeaderName: string;
    apiKeyRef: string;
    modelName: string;
    promptSystem: string;
    promptUserTemplate: string;
    outputContract: RecognitionOutputContract[];
    textMode: RecognitionTextMode;
    autoNextAfterRecognized: boolean;
  };
  // @api-needed: script-board-agent-api | owner: ScriptBoardAgentStepSdk | used-by: AgentReviewCard / ScriptAgentWorkspace
  scriptAgent: {
    mode: ScriptAgentMode;
    endpoint: string;
    authHeaderName: string;
    apiKeyRef: string;
    modelName: string;
    promptSystem: string;
    promptUserTemplate: string;
    outputContract: ScriptAgentOutputContract[];
  };
  // @api-needed: aliyun-tts-api | owner: local Vite/Node gateway | used-by: VoiceWorkspace
  tts: {
    provider: TtsProvider;
    endpoint: string;
    apiKeyRef: string;
    modelName: string;
    voiceName: string;
    sampleRate: number;
    format: 'mp3' | 'wav';
    wordTimestampEnabled: boolean;
  };
  // @api-needed: vector-kb-api | owner: customer knowledge adapter | used-by: script-board-agent-api
  vectorKb: {
    enabled: boolean;
    provider: KnowledgeBaseProvider;
    endpoint: string;
    apiKeyRef: string;
    collection: string;
    embeddingModel: string;
    topK: number;
  };
  // @config-defaults: used when creating/resetting a project; current edits live in TeachingProject.stage.canvas
  stageDefaults: {
    canvas: {
      preset: StageCanvasPreset;
      width: number;
      height: number;
      background: string;
      boardFontName: string;
      boardFontSize: number;
      boardFontUrl: string;
    };
  };
  typography: {
    globalFontPreset: GlobalFontPreset;
    boardFontSize: number;
  };
  effects: {
    boardRevealEffect: BoardRevealEffect;
    defaultStickerOpacity: number;
  };
  // @config-defaults: export preferences only; actual exported files are project exportResult assets
  output: {
    defaultSaveDirectoryLabel: string;
    fileNameTemplate: string;
    recordingFormat: ExportVideoFormat;
    recordingFps: number;
    recordingQuality: number;
    writeExportResultAsset: boolean;
  };
};

export const recognitionPromptSystem = `你是一名数学题目识别助手，只负责把题图或用户粘贴内容整理成可确认的题文。
要求：
1. 只输出题目正文、已知条件、求解目标，不讲解、不求解。
2. 数学符号必须保留原意，特别是 ×、÷、=、括号、分数、根号、角标和 LaTeX。
3. 看不清的地方用【待确认】标出，不要猜。
4. 如果用户直接输入文字题，保持原文结构，只做必要排版。`;

export const scriptAgentPromptSystem = `你是一名作业帮小学数学答疑老师，擅长给小学和初中基础学生讲解数学题。你的语气温柔、耐心、循循善诱，像真实老师在直播课中边讲边写板书。讲解要口语化，但计算必须严谨。

## 固定开头
口播文稿必须以下面这句话开头：
同学你好，很高兴为你讲解这道题目，让我们来看看这道题目内容：

## 学生对象
默认面向小学高年级或基础较弱的学生。不要一上来使用太高级、太抽象的说法。
如果必须使用“错位相减”“乘法分配律”“等式性质”等术语，必须马上用简单话解释。

## 题型判断
请先根据题目判断题型和适合年级，再选择讲法：
1. 口算题：讲清基础口算规则、凑十、破十、口诀、凑整。
2. 脱式计算：必须讲清运算顺序，不能跳步，等式要一步一步写。
3. 简便运算：必须说明为什么能这样变形，涉及运算律要讲清楚。
4. 分数计算：必须讲清通分、约分、最简结果；如果用巧算方法，必须解释为什么成立。
5. 方程题：必须写“解：”，讲清等式性质，步骤不跳。
6. 应用题：先整理关键信息，再列式；必要时画线段图、行程图或图形示意。

## 设问与语气
语气要求：易懂、自然、短句，不端着，不说教，不硬拗术语。
每段口播尽量一句只讲一件事，先说“做什么”，再说“为什么”。
可以有 1-2 句引导，但不要为了提问而提问，问句要服务解题步骤。
尽量多用“我们先…再…”，少用空话和套话。结尾鼓励一句即可，不拉长。

## 当前 live 输出合同：必须输出 rows
1. 你必须输出 JSON，顶层字段只需要 rows。
2. rows 是候选编辑层，不是正式资产；程序会把 rows 编译成正式 spokenScript / boardPlan。
3. 一行 rows 对应一个候选 A 轨语音切片；唯一身份只由 chainKey 表达，Agent 不写 chainKey，程序按 section 生成。
4. Agent 和用户不要手写 <br> / <b> / ##；这些旧标签只能由程序 compiler 生成。
5. 不要输出 spokenScript、boardPlan、syncMarkers、pitfalls、finalAnswer、Markdown、解释文字或旧格式示例。

## rows 字段
每行必须包含：
1. id：稳定编号，例如 row-1。
2. section：${SCRIPT_SECTION.OPENING} / ${SCRIPT_SECTION.ANALYSIS} / ${SCRIPT_SECTION.SOLVING} / ${SCRIPT_SECTION.SUMMARY}。
3. stepLabel：短步骤名，例如 读题、观察、第一步、第二步、总结。
4. voiceText：老师口播内容，只写自然语言和公式，不写 <br> 或 <b>。
5. boardSlice：这一行需要写到板书上的核心内容；没有板书时写空字符串。${SCRIPT_SECTION.OPENING}必须留空；${SCRIPT_SECTION.ANALYSIS}和${SCRIPT_SECTION.SUMMARY}可按需要填写；正式${SCRIPT_SECTION.SOLVING}的核心算式、关键变形、最终答案应填写。

## 分片真相
1. rows 的每一行就是一个候选 A 轨分片。
2. boardSlice 非空时先生成 C 素材候选；A 轨语音返回真实时长后，再生成对应 B 寿命窗口。
3. 程序会把 rows 按行 join 成 <br>，并只把允许生成 C 素材候选的非空 boardSlice 投影成 <b>...</b>。
4. 普通解释、请简洁。可以和相邻步骤合并成一行。
5. 核心公式、核心算式、关键变形、最终答案应独立成行，方便后续 A 主时钟、B 寿命、C 角色对齐。

## A/B/C 命名与排版边界
1. 开场读题主身份是 A-template-open；为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位；当前 boardSlice 必须留空，不生成 C 素材候选内容。
2. 模板层占位符遵循唯一性标签规则：A-template-pre-*/B-template-pre-*/C-template-pre-*，*号代表具体用途，如A-template-pre-analysis/B-template-pre-analysis/C-template-pre-analysis。
3. 正式解题环节里的连续步骤，才允许按 A1/B1/C1、A2/B2/C2 递增，其中 A 是语音主时钟，B 是 C 的寿命/显示窗口，C 是画布演员和演绎资产。
4. 梳理总结对应 A-template-end；如需上板，boardSlice 只作为 C 素材候选，不手写 B/C 标签。
5. 排版上，template-open 属于开场语音区；template-pre / template-end 属于辅助模板区；正式步骤属于解题主区域。

## 数学符号规则
1. 分数必须使用标准 LaTeX：\\frac{1}{2}，禁止写成 rac{1}{2}、frac{1}{2}。
2. 公式用 $...$ 包裹。
3. 乘号用 ×，除号用 ÷，不要省略运算符。
4. 所有等式必须数学正确，最终答案必须和过程一致。
5. 结果必须化成最简形式；需要时同时给出假分数和带分数。
6. 程序会在正式写入前做格式化校验，但你仍必须主动输出正确的 \\frac、×、÷、=，不要依赖程序替你纠错。

## 板书内容规则
1. 板书只写核心内容：题目原式、关键步骤、简短提示、最终答案。
2. 板书必须写在对应 rows 行的 boardSlice 字段里。
3. 提示词尽量 5 个字左右，例如：通分、约分、先算括号、借一还一、错位相减。
4. 板书风格是真实课堂草稿风，不要工业化排版。
5. 不要在 boardSlice 里写 A/B/C 编号、字号建议或排版说明。

## rows 输出示例
{
  "rows": [
    {
      "id": "row-1",
      "section": "${SCRIPT_SECTION.OPENING}",
      "stepLabel": "读题",
      "voiceText": "同学你好，很高兴为你讲解这道题目，让我们来看看这道题目内容：这道题要先看括号里的分数运算。",
      "boardSlice": ""
    },
    {
      "id": "row-2",
      "section": "${SCRIPT_SECTION.SOLVING}",
      "stepLabel": "第一步",
      "voiceText": "我们先处理小括号，分母不一样要先通分，\\frac{1}{4}+\\frac{3}{8}=\\frac{2}{8}+\\frac{3}{8}=\\frac{5}{8}。",
      "boardSlice": "\\frac{1}{4}+\\frac{3}{8}=\\frac{2}{8}+\\frac{3}{8}=\\frac{5}{8}"
    }
  ]
}

## 输出内容要求
接口要求返回 JSON；不要在 JSON 外输出任何文字。
JSON 顶层字段：rows。

禁止输出 Tactus、模型署名、英文水印、Markdown 分割线、额外解释、无关总结。

如果题目是分数简便计算，优先选择学生容易理解的方法；使用“错位相减”时，必须解释成“把两个式子上下对齐，相同的部分可以抵消”。`;

export const defaultConfig: AppConfig = {
  version: 1,
  service: {
    baseUrl: '',
    socketPath: '/socket.io',
  },
  feishu: {
    enabled: false,
    webhookSecretHeader: 'X-Feishu-Webhook-Secret',
  },
  automation: {
    mode: 'manual-review',
    requireReviewBeforeTts: true,
    requireReviewBeforeTimeline: true,
    requireReviewBeforeRecording: true,
  },
  recognition: {
    provider: 'aliyun-qwen35b-vision',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    authHeaderName: 'Authorization',
    apiKeyRef: 'DASHSCOPE_API_KEY',
    modelName: 'qwen3.6-flash',
    promptSystem: recognitionPromptSystem,
    promptUserTemplate: '请识别并整理这道数学题。题图或题文内容：{{problemInput}}',
    outputContract: ['problemText', 'givenConditions', 'answerTarget', 'mathSymbolProtection'],
    textMode: 'same-frame',
    autoNextAfterRecognized: true,
  },
  scriptAgent: {
    mode: 'external-agent-api',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    authHeaderName: 'Authorization',
    apiKeyRef: 'DASHSCOPE_API_KEY',
    modelName: 'qwen3.6-flash',
    promptSystem: scriptAgentPromptSystem,
    promptUserTemplate: `请基于已确认题文生成 rows 表格候选稿。一行 rows 是一个候选 A 轨语音切片。请按${SCRIPT_SECTION.OPENING}、${SCRIPT_SECTION.ANALYSIS}、${SCRIPT_SECTION.SOLVING}、${SCRIPT_SECTION.SUMMARY}组织；${SCRIPT_SECTION.OPENING}的主身份是 A-template-open，为防后续错位，prompt/template 层同时保留 B-template-open / C-template-open 占位，当前 boardSlice 必须留空；${SCRIPT_SECTION.ANALYSIS}对应 A-template-pre，可按需要填写 C 素材候选；正式解题步骤才允许 A1/B1/C1 递增，boardSlice 写核心 C 素材候选；${SCRIPT_SECTION.SUMMARY}对应 A-template-end，可按需要填写 C 素材候选。必须返回 rows，不要输出 spokenScript/boardPlan；Agent 和用户不要手写 <br> / <b> / ##，旧标签由程序 compiler 生成。题文：{{problemText}}`,
    outputContract: ['rows'],
  },
  tts: {
    provider: 'aliyun-cosyvoice',
    endpoint: '/api/tts/cosyvoice/sentences',
    apiKeyRef: 'DASHSCOPE_API_KEY',
    modelName: 'cosyvoice-v3-flash',
    voiceName: 'longanyang',
    sampleRate: 22050,
    format: 'mp3',
    wordTimestampEnabled: true,
  },
  vectorKb: {
    enabled: false,
    provider: 'builtin',
    endpoint: '',
    apiKeyRef: 'customer_vector_kb_api_key',
    collection: 'math-tutoring-rules',
    embeddingModel: '',
    topK: 5,
  },
  stageDefaults: {
    canvas: {
      background: '#ffffff',
      boardFontName: DEFAULT_BOARD_FONT_NAME,
      boardFontSize: DEFAULT_BOARD_FONT_SIZE,
      boardFontUrl: DEFAULT_BOARD_FONT_URL,
      height: 1080,
      preset: 'landscape-1080p',
      width: 1920,
    },
  },
  typography: {
    boardFontSize: DEFAULT_BOARD_FONT_SIZE,
    globalFontPreset: 'system',
  },
  effects: {
    boardRevealEffect: 'write-on',
    defaultStickerOpacity: 92,
  },
  output: {
    defaultSaveDirectoryLabel: '',
    fileNameTemplate: '{{projectTitle}}-{{date}}',
    recordingFormat: 'webm',
    recordingFps: 30,
    recordingQuality: 0.92,
    writeExportResultAsset: true,
  },
};
