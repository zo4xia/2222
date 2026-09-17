// @cleanroom-component: ProblemImportCard
// @domain: teaching-assets
// @slot: left-sider/import-card
// @depends: importProblemImage action
// @route-impact: App shell only

import { InboxOutlined } from '@ant-design/icons';
import { Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';

const { Dragger } = Upload;

export function ProblemImportCard({ onImportProblemImage }: { onImportProblemImage: (file: File) => void }) {
  return (
    <Dragger
      accept="image/*"
      beforeUpload={(file: RcFile) => {
        onImportProblemImage(file);
        return false;
      }}
      className="problem-image-uploader"
      maxCount={1}
      showUploadList={false}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">上传/拖入题目图片</p>
      <p className="ant-upload-hint">未接 API 时，先用本地题图跑通画布和素材流。</p>
    </Dragger>
  );
}
