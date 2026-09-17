/**
 * 车同轨、书同文 —— 全局唯一超级文本与数学规范过滤器 (Super Filter)
 * 单一真相源：所有外部提供 JSON、模型输出、画布渲染、外层单页 HTML、Markdown 导出等统一经由此过滤器处理。
 * 
 * 核心规范职责：
 * 1. 控制字符与错误转义清洗：
 *    - 修复 JSON/LLM 损伤的控制字符（\t, \b, \f 等）
 *    - 修复 LaTeX 转义损伤（如 \frac 被误转或误吃为 rac / frac）
 *    - 解码 HTML 实体（&times;, &divide;, &lt;, &gt;, &quot;, &amp; 等）
 *    - 剥离多余的反斜杠破坏、孤立 $ 等
 * 2. 算式符号与手写字模规范：
 *    - 除号书写：严禁写为易混淆的文字，在自然板书与公式中优先使用上下分数结构 \frac{a}{b}，或标准除号字符 ÷（英文符号 .-.，一横一点上一面下一面）
 *    - 乘号规范：统一写为 x 或 ×（手写字体友好常见字符）
 *    - 平方立方角标：²、³（使用常见小字号角标字符，避免生僻字或复杂符号在手写字体缺失）
 *    - 复杂符号尽量用常见字符组装（如 √x, ∠, △, ≤, ≥, ≠, ≈, °, ·）
 * 3. 换行与段落清洗：
 *    - 规范自然段落换行，避免多重多余的转义字符（如 \\n 误变为字面量）
 */

// 画布尺寸与字号唯一真源：src/services/stepHandoff.js（本文件不得再硬编码尺寸/字号）
import { CANVAS_SIZE, QUESTION_FONT_SIZE, BOARD_FONT_SIZE, HANDWRITING_FONT_STACK_CSS } from '../services/stepHandoff.js'

/**
 * 手写体缺字降级表（2026-09-17 用户拍板，唯一真源）
 * 手写字体（平方乔木体）字库覆盖不全，生僻/数学符号会渲染成豆腐块 → 一律用常见字符自己凑：
 *   × → 英文字母 x；÷ → 先降级为 /，再由 promoteFractions 升级为上下分数；
 *   ∴ / ∵ → 中文「因此 / 因为」；全角减号 − → 半角 -。
 * ⚠ 交付页 row-player.html 的 GLYPH2COMMON 是本表的镜像，改这里必须同步。
 */
export const HANDWRITE_GLYPH_DEGRADATION = [
  [/[\u00D7\u2715\u2716\u2717]/g, 'x'], // × ✕ ✖ ✗ → 英文字母 x
  [/[\u00F7\u2215]/g, '/'],             // ÷ ∕ → /（随后由分数规范升级为 \frac{}{}）
  [/\u2212/g, '-'],                     // −（U+2212 减号）→ 半角 -
  [/\u2234/g, '因此'],                   // ∴
  [/\u2235/g, '因为']                    // ∵
];

/** 手写体缺字降级：把字库覆盖不到的符号换成常见字符（只此一份，全局必经） */
export function degradeMissingGlyphs(text) {
  if (text == null) return '';
  let str = String(text);
  for (let i = 0; i < HANDWRITE_GLYPH_DEGRADATION.length; i++) {
    str = str.replace(HANDWRITE_GLYPH_DEGRADATION[i][0], HANDWRITE_GLYPH_DEGRADATION[i][1]);
  }
  return str;
}

// 常用数学与几何符号对手写字体的友好映射表
export const LATEX_TO_COMMON_UNICODE = [
  [/\\times\b/g, 'x'],
  [/\\div\b/g, '/'],
  [/\\cdot\b/g, '·'],
  // ⚠ 角标只吞 ^ 与数字/命令本身，绝不吞后续空格（否则 "x^2 + y^2" 会被连成 "x²+"）
  [/\^\s*(?:\{\s*\\circ\s*\}|\\circ)/g, '°'],
  [/\\circ\b/g, '°'],
  [/\\degree\b/g, '°'],
  // 平方与立方角标：支持 ^2, ^{2}, ^3, ^{3} 转换为标准右上角小字 ² / ³
  [/\^\s*(?:\{\s*2\s*\}|2)/g, '²'],
  [/\^\s*(?:\{\s*3\s*\}|3)/g, '³'],
  [/\\angle\b/g, '∠'],
  [/\\pm\b/g, '±'],
  [/\\perp\b/g, '⊥'],
  [/\\parallel\b/g, '∥'],
  [/\\triangle\b/g, '△'],
  [/\\therefore\b/g, '因此'],
  [/\\because\b/g, '因为'],
  [/\\le(?:q)?\b/g, '≤'],
  [/\\ge(?:q)?\b/g, '≥'],
  [/\\ne(?:q)?\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\pi\b/g, 'π'],
  [/\\infty\b/g, '∞'],
  [/\\sqrt\s*\{([^}]*)\}/g, '√$1'],
  [/\\sqrt\b/g, '√'],
  [/\\rightarrow\b/g, '→'],
  [/\\Rightarrow\b/g, '⇒'],
  [/\\to\b/g, '→']
];

/**
 * 修复 LaTeX 损坏的控制字符与常见 LLM 吞反斜杠损伤
 */
export function normalizeLatexControlChars(text) {
  if (text == null) return '';
  return String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // 控制字符损伤：统一退化为空格，绝不把 \t / \b / \f 这类转义字面落到板上
    // eslint-disable-next-line no-control-regex -- 这里就是要匹配 TAB/退格/换页等控制字符损伤
    .replace(/[\t\u0008\u000B\u000C]+/g, ' ')
    // eslint-disable-next-line no-control-regex -- 换页符 + rac 是 LLM 吞掉反斜杠的典型损伤
    .replace(/\u000c\s*rac/g, '\\frac') // 换页符+rac -> \frac
    .replace(/(^|[^\w\\])rac(?=\s*\{)/g, '$1\\frac')
    .replace(/(^|[^\w\\])frac(?=\s*\{)/g, '$1\\frac');
}

/**
 * HTML 实体解码：剥除残留实体字符，还原为可书写字面
 */
export function decodeHtmlEntities(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&times;/g, 'x')
    .replace(/&divide;/g, '/')
    .replace(/&minus;/g, '-')
    .replace(/&plusmn;/g, '±')
    .replace(/&deg;/g, '°')
    .replace(/&le;/g, '≤')
    .replace(/&ge;/g, '≥')
    .replace(/&ne;/g, '≠')
    .replace(/&middot;/g, '·')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '…')
    .replace(/&sup2;/g, '²')
    .replace(/&sup3;/g, '³')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * 转义与噪声清洗（不含符号映射）：
 * 适用于仍要走 KaTeX 渲染的题目原文 / 富文本场景，只清错误转义、控制字符、HTML 实体与标签。
 */
export function cleanTextEscapes(text, options = {}) {
  if (text == null) return '';
  let str = String(text);

  // 1. 处理控制字符与转义损伤
  str = normalizeLatexControlChars(str);

  // 2. 解码 HTML 实体
  str = decodeHtmlEntities(str);

  // 3. 处理多余的错误换行转义（例如字符串里残留字面量 '\\n' 或 '\\r\\n'）
  //    ⚠ 仅在 '\n' 后面不跟字母时才还原为真实换行，否则会打断 \neq / \not / \nabla 等 LaTeX 命令
  if (options.preserveLineBreaks !== false) {
    str = str.replace(/\\r\\n/g, '\n').replace(/\\n(?![a-zA-Z])/g, '\n');
    str = str.replace(/\n{3,}/g, '\n\n'); // 多出来的空行收束为一个自然段落空行
  }

  // 4. 去除 HTML 格式标签
  str = str.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

  return str;
}

/**
 * 超级过滤器（Super Filter）：
 * 对所有输入输出字符串进行车同轨书同文的深度规范清洗
 */
export function superCleanText(text, options = {}) {
  if (text == null) return '';
  // 1~4 步：错误转义 / 控制字符 / HTML 实体与标签清洗
  let str = cleanTextEscapes(text, options);

  // 5. 剥离 LaTeX 的 $ 与 \left / \right
  str = str.replace(/\$+/g, '');
  str = str.replace(/\\left\b|\\right\b/g, '');

  // 5.1 手写体缺字降级：× → x、÷ → /、∵ ∴ → 中文（必须在符号映射与分数升级之前）
  str = degradeMissingGlyphs(str);

  // 6. 符号映射（平方、立方、乘号、除号、角度等）
  for (let i = 0; i < LATEX_TO_COMMON_UNICODE.length; i++) {
    const [pattern, replacement] = LATEX_TO_COMMON_UNICODE[i];
    str = str.replace(pattern, replacement);
  }

  // 7. 除号与分数书写规范：a/b 一律升级为上下结构 \frac{a}{b}
  //    （禁用 7/15 这类平铺斜杠，也禁用 ÷ —— 手写体缺字，写成分数最稳）
  if (options.promoteFractions !== false) {
    str = str.replace(/(^|[^\w./\\{])([A-Za-z]|\d+)\s*\/\s*([A-Za-z]|\d+)(?=$|[^\w./])/g, '$1\\frac{$2}{$3}');
  }

  // 8. 平方立方的常见拼装字符转换（如 ^2 -> ², ^3 -> ³）
  str = str.replace(/(\w|\))\^2\b/g, '$1²').replace(/(\w|\))\^3\b/g, '$1³');

  // 9. 压缩非换行的行内多余空格
  if (options.trimLines !== false) {
    str = str.split('\n').map(line => line.replace(/[\t ]+/g, ' ').trim()).join('\n');
  }

  return str;
}

/**
 * 将板书字段（可能是字符串或数组）规范化为单行数组
 * 规则：在单个 row 组内，板书是一行一个，写完一个再写一个，是数组！
 */
export function normalizeBoardEntries(boardInput) {
  if (!boardInput) return [];
  
  // 如果本身就是数组：每个元素清洗后展开
  if (Array.isArray(boardInput)) {
    const list = [];
    for (const item of boardInput) {
      if (typeof item === 'string') {
        const cleaned = superCleanText(item);
        if (cleaned) {
          const lines = cleaned.split('\n').filter(Boolean);
          list.push(...lines);
        }
      } else if (item && typeof item === 'object') {
        const rawContent = item.content || item.text || '';
        const cleaned = superCleanText(rawContent);
        if (cleaned) {
          const lines = cleaned.split('\n').filter(Boolean);
          list.push(...lines);
        }
      }
    }
    return list;
  }

  // 如果是对象 { content: '...' }
  if (typeof boardInput === 'object') {
    const raw = boardInput.content || boardInput.text || '';
    const cleaned = superCleanText(raw);
    return cleaned ? cleaned.split('\n').filter(Boolean) : [];
  }

  // 如果是字符串
  const cleaned = superCleanText(boardInput);
  return cleaned ? cleaned.split('\n').filter(Boolean) : [];
}

/**
 * 板书字段统一归一化（车同轨·书同文入口）
 * 入参允许：字符串 / 字符串数组（一行一个）/ {content} 对象 / 上述混合
 * 出参固定：{ content: '按 \n 连接的一行一个文本', lines: ['一行', '一行', ...] }
 * 下游（contract / timing / 画布 / 单页 HTML / 导出 JSON）一律消费这个结果。
 */
export function superCleanBoardField(boardInput) {
  const lines = normalizeBoardEntries(boardInput);
  return { content: lines.join('\n'), lines };
}

/**
 * 对外交付规格批注（画布尺寸 / 比例 / 字号 / 四区区间 / 越界与手稿风格）
 * 所有对外 HTML、导出 JSON 都必须带上这份批注，保证车同轨、书同文。
 */
export function buildCanvasSpecAnnotation(overrides = {}) {
  const base = DELIVERABLE_CANVAS_SPEC_ANNOTATION;
  const { zoneAnchors, boardPlan, ...rest } = overrides || {};
  const zones = zoneAnchors || boardPlan || null;

  let stageZones = base.stageZones;
  if (zones && typeof zones === 'object') {
    stageZones = { ...base.stageZones };
    for (const key of Object.keys(base.stageZones)) {
      const z = zones[key];
      if (!z || typeof z !== 'object') continue;
      const range = z.range
        || ((Number.isFinite(z.x) || Number.isFinite(Number(z.x))) && (Number.isFinite(z.y) || Number.isFinite(Number(z.y)))
          ? {
            x: `${Number(z.x)}% ~ ${Number((Number(z.x) + Number(z.w || 0)).toFixed(2))}%`,
            y: `${Number(z.y)}% ~ ${Number((Number(z.y) + Number(z.h || 0)).toFixed(2))}%`,
          }
          : null);
      stageZones[key] = {
        ...base.stageZones[key],
        ...(z.label ? { label: z.label } : {}),
        ...(range ? { range } : {}),
      };
    }
  }

  return { ...base, ...rest, stageZones };
}

/** 把规格批注渲染成 HTML 注释，注入对外单页 HTML（画布 / 单页 HTML 必备批注） */
export function renderSpecAnnotationComment(spec = {}) {
  const s = buildCanvasSpecAnnotation(spec);
  const z = s.stageZones || {};
  const zoneText = Object.keys(z)
    .map((k) => `    ${k}（${z[k]?.label || k}）：x ≈ ${z[k]?.range?.x || '-'}，y ≈ ${z[k]?.range?.y || '-'}`)
    .join('\n');
  const t = s.typography || {};
  return [
    '<!-- ===== 交付规格批注（车同轨·书同文 · 对外统一规格批注）=====',
    `  画布尺寸：${s.canvasSize?.width} × ${s.canvasSize?.height} px（比例 ${s.canvasSize?.aspectRatio}）`,
    `  字号：题目字号 ${t.questionFontSize}px 微软雅黑；板书字号 ${t.boardFontSize}px 手写体（内容过多可按需下调，但不得低于题目字号 ${t.questionFontSize}px）`,
    '  本题 stage 标签坐标落座的区间位置参数（百分比坐标，原点左上）：',
    zoneText,
    '  排版与落笔规则：',
    ...(s.layoutPrinciples || []).map((p) => `    ${p}`),
    '  板书符号规则（手写体缺字，用常见字符凑）：',
    ...(s.symbolRules || []).map((p) => `    ${p}`),
    '===== -->',
  ].join('\n');
}

/**
 * 完整交付物规格批注元数据（与画布 1726x980、四区区间、越界自由度对齐）
 */
export const DELIVERABLE_CANVAS_SPEC_ANNOTATION = Object.freeze({
  // 画布尺寸与字号一律引用唯一真源，禁止在本文件二次硬编码
  canvasSize: {
    width: CANVAS_SIZE.width,
    height: CANVAS_SIZE.height,
    aspectRatio: `${CANVAS_SIZE.width}:${CANVAS_SIZE.height}（≈16:9）`,
  },
  typography: {
    questionFontSize: QUESTION_FONT_SIZE, // 题目字号（唯一真源 stepHandoff.js）
    boardFontSize: BOARD_FONT_SIZE,       // 板书字号（唯一真源 stepHandoff.js）
    fontFamily: {
      question: 'Microsoft YaHei, PingFang SC, sans-serif',
      // 板书字体唯一真源 = 平方乔木体（CDN 507，与交付页 row-player.html 同族，书同文）；CDN 不可用时回退系统楷体
      board: HANDWRITING_FONT_STACK_CSS
    }
  },
  stageZones: {
    question: { label: '题目区', range: { x: '6% ~ 48%', y: '12% ~ 38%' }, role: '考卷原题静态呈现与批注圈画' },
    analysis: { label: '分析区', range: { x: '6% ~ 48%', y: '42% ~ 88%' }, role: '随手草算、李永乐风格口播毛料推演' },
    solution: { label: '解答区', range: { x: '52% ~ 94%', y: '12% ~ 80%' }, role: '规范数学解答、连续算式等号对齐' },
    summary:  { label: '总结区', range: { x: '52% ~ 94%', y: '82% ~ 92%' }, role: '口诀与方法提炼' }
  },
  layoutPrinciples: [
    '1. 我们已经明确提供了四区坐标区间，不再单独提起手坐标，由渲染层按当前字体的自然段落换行与自然间距排版，无多余人为限制；（落笔起点 board.startCoord 为可选参数：给了就按它落笔，不给则自动取本 stage 区左上角 +2%/+4%，四区照样板开。）',
    '2. 在单个 row 组内，板书一行一个，写完一个再写一个，按数组顺序单手串行落笔；',
    '3. 动作与板书绝对互斥，在一维时间线上播放的事物绝对没有交集，动作定量 1~2 秒作为标点停顿；',
    `4. 特殊内容较多时，板书区间可按需自由越界，只要不出 ${CANVAS_SIZE.width}×${CANVAS_SIZE.height} 画布即可，保持达芬奇手稿的毛料草算风格，绝不死板；`,
    `5. 内容过多时板书字号可按需下调，但不得低于题目字号 ${QUESTION_FONT_SIZE}px。`
  ],
  // 手写体缺字符号规则（2026-09-17 用户拍板，唯一真源；交付页渲染侧同规则镜像）
  symbolRules: [
    '1. 只用手写体字库覆盖得到的常见字符，禁止写生僻符号（会渲染成豆腐块）；',
    '2. 乘号写英文字母 x，不写 ×；',
    '3. 除号一律写上下分数 \\frac{分子}{分母}，不写 ÷，也不写 a/b 平铺斜杠；',
    '4. 因为 / 因此写中文，不写 ∵ / ∴ 符号；减号用半角 -；平方立方写 ² ³。'
  ]
});
