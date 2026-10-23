/* 66 号任务·抖动靶场档生成器
 * 产出一个临时测试交付 JSON（写入 repo public/，测完即删）：
 *  - 题目长句跨折行 → question 区 underline 多段生长（蛀虫1靶）
 *  - 分析板书 + board underline + rough-line（蛀虫1靶）
 *  - 两行带真 WAV data-URI（蛀虫3靶：同行刮擦 loadstart 计数 / 播放中拖动挂钟冻结）
 * 用法：node scripts/make-jitter-range.mjs
 */
import { writeFileSync } from 'node:fs';

/* --- 8kHz 8bit 单声道 WAV，lenMs 毫秒正弦（够音频钟走起来即可） --- */
function wavDataUri(lenMs, freq = 440) {
  const rate = 8000, n = Math.floor(rate * lenMs / 1000);
  const data = Buffer.alloc(n);
  for (let i = 0; i < n; i++) data[i] = 128 + Math.round(60 * Math.sin(2 * Math.PI * freq * i / rate));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + n, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
  h.write('data', 36); h.writeUInt32LE(n, 40);
  return 'data:audio/wav;base64,' + Buffer.concat([h, data]).toString('base64');
}

const doc = {
  projectCode: 'JIT-TEST-66',
  problemText: '一项工程，甲队单独修需要十天完成，乙队单独修需要十五天完成。两队一起修，多少天能修完？',
  rows: [
    {
      stage: '题目',
      speech: '我们来看这道工程问题。',
      board: { startDelay: 0, content: '' },
      actionSpec: [
        { action: { tool: 'rough-notation', action: 'underline', target: { region: 'question', exactText: '甲队单独修需要十天完成，乙队单独修需要十五天完成', occurrence: 1 }, order: 1 } },
      ],
      mp3: wavDataUri(3200),
      audioDurationMs: 3200,
    },
    {
      stage: '分析',
      speech: '我们设工作总量为单位一，先分别求出两队的效率。',
      board: { startDelay: 0, content: '工作总量 = 1\n甲的效率 = 十分之一\n乙的效率 = 十五分之一' },
      actionSpec: [
        { action: { tool: 'rough-notation', action: 'underline', target: { region: 'analysis', exactText: '甲的效率', occurrence: 1 }, order: 1 } },
        { action: { tool: 'rough-line', start: [58, 46], end: [76, 52], style: { strokeWidthId: 'emphasis' }, order: 2 } },
      ],
      mp3: wavDataUri(5200),
      audioDurationMs: 5200,
    },
    {
      stage: '解答',
      speech: '所以两队一起修，十天能修完。',
      board: { startDelay: 0, content: '1 ÷ 十分之一 = 10（天）' },
      actionSpec: [],
    },
  ],
};

writeFileSync('public/test66-jitter-range.json', JSON.stringify(doc, null, 1));
console.log('OK public/test66-jitter-range.json bytes=', JSON.stringify(doc).length);
