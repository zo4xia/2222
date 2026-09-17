// @cleanroom-component: ProblemUploadPreview
// @domain: teaching-assets
// @slot: left-sider/problem-import
// @depends: TeachingProject.assets(problemImage/boardLayout), importProblemImage action
// ID: cleanroom-assets-problem-import-001
// 💾 数据: problemImage.sourceRef + boardLayout.summary
// 🔌 事件: beforeUpload -> onImportProblemImage
// 🎨 状态: no image / has image / C material candidate overlay
// @io-input: asset, boardSummary, hasConfirmedBoard, onImportProblemImage
// @io-output: onImportProblemImage(file)
// @route: App shell / left sider / assets problem tab
// @fields: TeachingProject.assets(kind=problemImage), TeachingProject.assets(kind=boardLayout).summary
// @boundary: image import and preview only; does not edit problemText, scriptText, boardLayout, timeline

import { InboxOutlined } from '@ant-design/icons';
import { Tag, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';
import type { TeachingAsset } from '../domain/teachingProject';
import { MathText } from './MathText';

const { Dragger } = Upload;

export function ProblemUploadPreview({
  asset,
  boardSummary,
  hasConfirmedBoard,
  onImportProblemImage,
}: {
  asset: TeachingAsset | undefined;
  boardSummary: string | undefined;
  hasConfirmedBoard: boolean;
  onImportProblemImage: (file: File) => void;
}) {
  return (
    <Dragger
      accept="image/*"
      beforeUpload={(file: RcFile) => {
        onImportProblemImage(file);
        return false;
      }}
      className={asset?.sourceRef ? 'problem-image-uploader has-image' : 'problem-image-uploader'}
      maxCount={1}
      showUploadList={false}
    >
      {asset?.sourceRef ? (
        <div className="upload-preview-frame">
          <img alt={asset.title} src={asset.sourceRef} />
          <Tag className="upload-preview-badge" color="blue">
            预览图
          </Tag>
          {hasConfirmedBoard ? (
            <div className="board-confirm-overlay">
              <Tag color="green">C素材候选已生成</Tag>
              <MathText className="board-confirm-overlay-text">{boardSummary}</MathText>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">上传/拖入题目图片</p>
          <p className="ant-upload-hint">未接 API 时，先用本地题图跑通画布和素材流。</p>
        </>
      )}
    </Dragger>
  );
}
