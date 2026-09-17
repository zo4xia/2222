// @cleanroom-module: stageRecorder/useCanvasRecorder
// @domain: delivery-recording
// @io-input: baseCanvas(底图), contentCanvas(C板书内容层), overlayCanvas(金手指标注层)
// @io-output: downloadable MP4/WebM recording blob
// @boundary: true canvas-frame composition recording; no screen capture, no getDisplayMedia
// @rationale: getDisplayMedia records screen area, not canvas frames.
//   This module composites base + C content + overlay → hidden canvas → captureStream(30fps) → MediaRecorder → blob.

import { useRef, useState } from 'react';
import { getActiveVoiceAudioElement } from '../audioPlayback/activeVoiceAudioElement';

type RecordingStatus = 'idle' | 'recording' | 'ready' | 'error';

type RecordingFile = {
  blob: Blob;
  extension: 'mp4' | 'webm';
  fileName: string;
  mimeType: string;
  url: string;
};

export function useCanvasRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const compositionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState('');
  const [recordingFile, setRecordingFile] = useState<RecordingFile | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');

  const stopAnimationLoop = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  /** 开始 canvas 合成录制 */
  const startRecording = async (
    baseCanvas: HTMLCanvasElement | null,
    contentCanvas: HTMLCanvasElement | null,
    overlayCanvas: HTMLCanvasElement | null,
  ) => {
    if (status === 'recording') {
      return;
    }

    if (!baseCanvas) {
      setError('缺少录制画布。');
      setStatus('error');
      return;
    }

    if (recordingFile) {
      URL.revokeObjectURL(recordingFile.url);
    }
    setError('');
    setRecordingFile(null);
    chunksRef.current = [];

    const width = baseCanvas.width || 1280;
    const height = baseCanvas.height || 720;

    // 创建合成画布（隐藏，不插入 DOM）
    const compositionCanvas = document.createElement('canvas');
    compositionCanvas.width = width;
    compositionCanvas.height = height;
    compositionCanvasRef.current = compositionCanvas;

    // 快照缓冲区：将金手指覆盖层先拷贝到独立 canvas 再合成，
    // 降低录制帧读到半笔（clearRect 后、draw 未完成）的风险窗口。
    // 注意：drawImage(source) 是单次原子读取，但 source canvas 可能正在被
    // 另一个 rAF 回调修改。快照缓冲区将读取操作收敛为单次 copy，减少撕裂概率。
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = width;
    snapshotCanvas.height = height;
    const snapshotCtx = snapshotCanvas.getContext('2d');

    const mimeType = pickRecordingMimeType();
    try {
      // captureStream 创建实时视频流——每帧绘制到 compositionCanvas 自动推送帧
      const stream = compositionCanvas.captureStream(30);
      appendActiveVoiceAudioTracks(stream);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const startedAt = new Date();

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        stopAnimationLoop();
        const resolvedMimeType = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: resolvedMimeType });
        const extension = resolvedMimeType.includes('mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(blob);
        setRecordingFile({
          blob,
          extension,
          fileName: `stage-recording-${formatStamp(startedAt)}.${extension}`,
          mimeType: resolvedMimeType,
          url,
        });
        setStatus('ready');
      });

      recorder.addEventListener('error', () => {
        stopAnimationLoop();
        setError('录制编码失败。');
        setStatus('error');
      });

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // 每秒一个 dataavailable 事件
      setStatus('recording');

      // 启动逐帧合成循环
      const composeFrame = () => {
        if (mediaRecorderRef.current?.state !== 'recording') {
          return;
        }

        const ctx = compositionCanvas.getContext('2d');
        if (!ctx) {
          return;
        }

        // 清空 → 绘制底图 → 绘制 C 板书 → 绘制金手指覆盖层（通过快照缓冲）
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(baseCanvas, 0, 0, width, height);
        if (contentCanvas && contentCanvas.width > 0 && contentCanvas.height > 0) {
          ctx.drawImage(contentCanvas, 0, 0, width, height);
        }

        if (overlayCanvas && overlayCanvas.width > 0 && overlayCanvas.height > 0 && snapshotCtx) {
          // 先快照到独立缓冲区，再从缓冲区合成，降低读到半笔撕裂帧的风险
          snapshotCtx.drawImage(overlayCanvas, 0, 0);
          ctx.drawImage(snapshotCanvas, 0, 0, width, height);
        }

        animationFrameRef.current = requestAnimationFrame(composeFrame);
      };

      animationFrameRef.current = requestAnimationFrame(composeFrame);
    } catch (caughtError) {
      stopAnimationLoop();
      setError(caughtError instanceof Error ? caughtError.message : '录制启动失败。');
      setStatus('error');
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      stopAnimationLoop();
      return;
    }

    recorder.stop();
    mediaRecorderRef.current = null;
  };

  const downloadRecording = () => {
    if (!recordingFile) {
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = recordingFile.url;
    anchor.download = recordingFile.fileName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  };

  return {
    downloadRecording,
    error,
    recordingFile,
    startRecording,
    status,
    stopRecording,
  };
}

function appendActiveVoiceAudioTracks(videoStream: MediaStream) {
  const audio = getActiveVoiceAudioElement();
  const captureStream = audio ? readMediaElementCaptureStream(audio) : null;
  if (!captureStream || typeof videoStream.addTrack !== 'function') {
    return;
  }

  for (const track of captureStream().getAudioTracks()) {
    videoStream.addTrack(track);
  }
}

function readMediaElementCaptureStream(audio: HTMLAudioElement): (() => MediaStream) | null {
  const candidate = audio as HTMLAudioElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const captureStream = candidate.captureStream ?? candidate.mozCaptureStream;
  return captureStream ? captureStream.bind(audio) : null;
}

function pickRecordingMimeType() {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function formatStamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}
