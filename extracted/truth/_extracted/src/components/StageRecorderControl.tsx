// @cleanroom-component: StageRecorderControl
// @domain: delivery-recording
// @slot: StagePreview.extra
// @io-input: recordingCanvases(base+overlay) or targetRef(DOM element)
// @io-output: browser display recording file download
// @boundary: record/download controls only; does not drive timeline playback or convert formats
// @recording-strategy: 优先使用 canvas 合成录制（captureStream），次选屏幕录制（getDisplayMedia）

import { DownloadOutlined, StopOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography } from 'antd';
import { useEffect } from 'react';
import { useCanvasRecorder } from '../modules/stageRecorder/useCanvasRecorder';
import type { StageRecordingCanvases } from './drawboardStageTypes';

const { Text } = Typography;

export function StageRecorderControl({
  onRecordingActiveChange,
  recordingCanvases,
}: {
  onRecordingActiveChange?: (isRecording: boolean) => void;
  recordingCanvases?: StageRecordingCanvases | null;
}) {
  const { downloadRecording, error, recordingFile, startRecording, status, stopRecording } = useCanvasRecorder();
  const isRecording = status === 'recording';

  useEffect(() => {
    onRecordingActiveChange?.(isRecording);
  }, [isRecording, onRecordingActiveChange]);

  /** canvas 合成录制 */
  const handleStart = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    if (recordingCanvases) {
      void startRecording(recordingCanvases.base, recordingCanvases.content, recordingCanvases.overlay);
    }
  };

  const canRecord = !!recordingCanvases;

  return (
    <Space className="stage-recorder-control" size={8}>
      <Tooltip title={canRecord ? '录制舞台画布合成视频' : '缺少录制画布，请刷新页面'}>
        <Button
          danger={isRecording}
          disabled={!canRecord}
          icon={isRecording ? <StopOutlined /> : <VideoCameraOutlined />}
          onClick={handleStart}
          size="small"
          type={isRecording ? 'primary' : 'default'}
        >
          {isRecording ? '停止' : '录制'}
        </Button>
      </Tooltip>
      {recordingFile ? (
        <Button icon={<DownloadOutlined />} onClick={downloadRecording} size="small" type="primary">
          下载{recordingFile.extension.toUpperCase()}
        </Button>
      ) : null}
      {error ? (
        <Text className="stage-recorder-error" type="danger">
          {error}
        </Text>
      ) : null}
    </Space>
  );
}
