// @cleanroom-component: ProblemOcrCard
// @domain: teaching-assets
// @slot: left-sider/ocr-card
// @depends: future OCR result, TeachingProject.assets(problemText)
// @route-impact: App shell only

import { Button, Typography } from 'antd';

const { Text, Title } = Typography;

export function ProblemOcrCard() {
  return (
    <section className="problem-ocr-card" aria-label="题目识别结果">
      <Button block className="problem-ocr-button" size="large" type="default">
        自动识别题目
      </Button>
      <div className="recognized-text-box">
        <Title level={5}>识别结果</Title>
        <Text>识别结果正文，如果是没有图片的题目，文本直接入这里。</Text>
        <div className="ocr-card-actions">
          <Button size="small" type="text">
            修改编辑
          </Button>
          <Button size="small" type="primary">
            下一步
          </Button>
        </div>
      </div>
    </section>
  );
}
