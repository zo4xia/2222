// @cleanroom-component: CStickerStandalonePage
// @domain: standalone-prototype
// @slot: full-page
// @depends: BoardTextSticker
// @route-impact: standalone=c-sticker

import { Button, Input, Select, Slider, Space, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { BoardTextSticker } from '../components/BoardTextSticker';

const { Text, Title } = Typography;

const FONT_OPTIONS = [
  { label: '平方乔木体', value: '"Xiaxia Qiaomu Board", "KaiTi", "STKaiti", serif' },
  { label: '陈雨洛雁体', value: '"ChenYuluoyan Board", "KaiTi", "STKaiti", serif' },
  { label: '楷体后备', value: '"KaiTi", "STKaiti", serif' },
];

const SAMPLE_TEXTS = [
  '25×4=100\n1200÷100=12',
  'A: 已知 y=2x+1\nB: 求 x=3 时 y 的值',
  '勾股定理：a^2+b^2=c^2',
];

const SAMPLE_FORMULA = 'f(x)=x^2+2x+1';

export function CStickerStandalonePage() {
  const [text, setText] = useState(SAMPLE_TEXTS[0]);
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [fontSize, setFontSize] = useState(46);
  const [widthPercent, setWidthPercent] = useState(48);
  const [xPercent, setXPercent] = useState(50);
  const [yPercent, setYPercent] = useState(52);
  const [revealProgress, setRevealProgress] = useState(1);
  const [color, setColor] = useState('#171717');

  const fontLoadKey = useMemo(() => `standalone-${fontFamily}-${fontSize}`, [fontFamily, fontSize]);
  const asNumber = (value: number | [number, number]) => (Array.isArray(value) ? value[0] : value);

  return (
    <div className="c-standalone-page">
      <header className="c-standalone-page__header">
        <Title level={4}>C 单体预览</Title>
        <Text type="secondary">仅验证 C 贴片渲染与可调参数，不进入主链。</Text>
      </header>

      <section className="c-standalone-page__controls">
        <Space size={12} wrap>
          <Button onClick={() => setText(SAMPLE_TEXTS[0])}>示例 1</Button>
          <Button onClick={() => setText(SAMPLE_TEXTS[1])}>示例 2</Button>
          <Button onClick={() => setText(SAMPLE_TEXTS[2])}>示例 3</Button>
          <Button onClick={() => setText(SAMPLE_FORMULA)}>公式路由</Button>
        </Space>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 5 }}
          onChange={(event) => setText(event.target.value)}
          placeholder="输入要验证的 C 文本"
          value={text}
        />
        <div className="c-standalone-grid">
          <label>
            字体
            <Select
              onChange={(value) => setFontFamily(value)}
              options={FONT_OPTIONS}
              style={{ width: 260 }}
              value={fontFamily}
            />
          </label>
          <label>
            颜色
            <Input onChange={(event) => setColor(event.target.value)} value={color} />
          </label>
          <label>
            字号 {fontSize}
            <Slider max={96} min={18} onChange={(value) => setFontSize(asNumber(value))} value={fontSize} />
          </label>
          <label>
            宽度% {widthPercent}
            <Slider max={88} min={20} onChange={(value) => setWidthPercent(asNumber(value))} value={widthPercent} />
          </label>
          <label>
            X% {xPercent}
            <Slider max={90} min={10} onChange={(value) => setXPercent(asNumber(value))} value={xPercent} />
          </label>
          <label>
            Y% {yPercent}
            <Slider max={88} min={12} onChange={(value) => setYPercent(asNumber(value))} value={yPercent} />
          </label>
          <label>
            显隐进度 {revealProgress.toFixed(2)}
            <Slider max={1} min={0} onChange={(value) => setRevealProgress(asNumber(value))} step={0.01} value={revealProgress} />
          </label>
        </div>
      </section>

      <section className="stage-canvas c-standalone-canvas">
        <BoardTextSticker
          color={color}
          fontFamily={fontFamily}
          fontLoadKey={fontLoadKey}
          fontSize={fontSize}
          isDragging={false}
          isSelected={true}
          onPointerDown={() => undefined}
          onResizePointerDown={() => undefined}
          revealProgress={revealProgress}
          stackIndex={0}
          text={text}
          widthPercent={widthPercent}
          xPercent={xPercent}
          yPercent={yPercent}
        />
      </section>
    </div>
  );
}
