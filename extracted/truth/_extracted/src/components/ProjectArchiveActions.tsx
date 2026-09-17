// @cleanroom-component: ProjectArchiveActions
// @domain: local-project-archive
// @slot: app-header-command-bar
// @depends: localTaskArchive callbacks, recent LocalTaskSnapshot[]
// @io-input: recentTaskSnapshots, save/import/restore/refresh callbacks
// @io-output: user-triggered local archive operations
// @boundary: project management only; no workflow step switching, no TTS, no timeline mutation

import { FolderAddOutlined, FolderOpenOutlined, HistoryOutlined, ImportOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Flex, message, Modal, Space, Tag, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import type { LocalTaskArchiveResult, LocalTaskImportResult } from '../modules/localTaskArchive/localTaskArchive';
import type { LocalTaskSnapshot } from '../modules/localTaskArchive/localTaskDb';

const { Text } = Typography;

export function ProjectArchiveActions({
  defaultSaveDirectoryLabel,
  onImportLocalTaskArchive,
  onRefreshLocalTaskSnapshots,
  onRestoreLocalTaskSnapshot,
  onSaveLocalTaskArchive,
  onSetDefaultSaveDirectory,
  recentTaskSnapshots,
}: {
  defaultSaveDirectoryLabel: string;
  onImportLocalTaskArchive: () => Promise<LocalTaskImportResult>;
  onRefreshLocalTaskSnapshots: () => Promise<void>;
  onRestoreLocalTaskSnapshot: (snapshotId: string) => Promise<boolean>;
  onSaveLocalTaskArchive: () => Promise<LocalTaskArchiveResult>;
  onSetDefaultSaveDirectory: () => Promise<{ directoryName: string }>;
  recentTaskSnapshots: LocalTaskSnapshot[];
}) {
  const [messageApi, contextHolder] = message.useMessage();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isImportingLocalArchive, setIsImportingLocalArchive] = useState(false);
  const [isSavingLocalArchive, setIsSavingLocalArchive] = useState(false);
  const [isSettingDefaultDirectory, setIsSettingDefaultDirectory] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState('');

  const handleSaveLocalTaskArchive = async () => {
    setIsSavingLocalArchive(true);
    try {
      const result = await onSaveLocalTaskArchive();
      const audioText = result.audioTotalCount
        ? `，音频 ${result.audioSavedCount}/${result.audioTotalCount} 个已写入`
        : '，当前暂无音频文件';
      const defaultText = result.usedDefaultDirectory ? `默认目录 ${result.rootDirectoryName}` : `已记住默认目录 ${result.rootDirectoryName}`;
      messageApi.success(`已保存到任务文件夹 ${result.folderName}：${result.jsonFileCount} 个 JSON${audioText}，${defaultText}。`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingLocalArchive(false);
    }
  };

  const handleSetDefaultSaveDirectory = async () => {
    setIsSettingDefaultDirectory(true);
    try {
      const result = await onSetDefaultSaveDirectory();
      messageApi.success(`已设置默认保存目录：${result.directoryName}。`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSettingDefaultDirectory(false);
    }
  };

  const handleImportLocalTaskArchive = async () => {
    setIsImportingLocalArchive(true);
    try {
      const result = await onImportLocalTaskArchive();
      const audioText = result.audioTotalCount
        ? `，音频 ${result.audioRestoredCount}/${result.audioTotalCount} 个已恢复`
        : '，当前暂无本地音频';
      messageApi.success(`已导入 ${result.folderName}：${result.archivePackage.editRecords.length} 条编辑记录，${result.archivePackage.productManifest.length} 项产物清单${audioText}。`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImportingLocalArchive(false);
    }
  };

  const handleRestoreLocalTaskSnapshot = async (snapshotId: string) => {
    setRestoringSnapshotId(snapshotId);
    try {
      const restored = await onRestoreLocalTaskSnapshot(snapshotId);
      if (restored) {
        messageApi.success('已恢复最近任务。');
        setHistoryOpen(false);
      } else {
        messageApi.warning('没有找到这个任务快照。');
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : String(error));
    } finally {
      setRestoringSnapshotId('');
    }
  };

  return (
    <>
      {contextHolder}
      <Space className="project-archive-actions" size={6} wrap>
        <Tooltip title={defaultSaveDirectoryLabel ? `当前默认目录：${defaultSaveDirectoryLabel}` : '选择一次后，保存目录会默认写入这里'}>
          <Button icon={<FolderAddOutlined />} loading={isSettingDefaultDirectory} onClick={() => void handleSetDefaultSaveDirectory()}>
            设置默认目录
          </Button>
        </Tooltip>
        {defaultSaveDirectoryLabel ? <Tag color="green">默认：{defaultSaveDirectoryLabel}</Tag> : null}
        <Button icon={<FolderOpenOutlined />} loading={isSavingLocalArchive} onClick={() => void handleSaveLocalTaskArchive()}>
          保存目录
        </Button>
        <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)}>
          历史工程
        </Button>
        <Button icon={<ImportOutlined />} loading={isImportingLocalArchive} onClick={() => void handleImportLocalTaskArchive()}>
          导入 project.json
        </Button>
      </Space>

      <Modal
        footer={null}
        onCancel={() => setHistoryOpen(false)}
        open={historyOpen}
        title="历史工程"
        width={520}
      >
        <div className="project-history-panel">
          <Flex align="center" justify="space-between" gap={8}>
            <Text type="secondary">暂无可恢复任务。</Text>
            <Button icon={<ReloadOutlined />} onClick={() => void onRefreshLocalTaskSnapshots()} size="small">
              刷新
            </Button>
          </Flex>
          {recentTaskSnapshots.length ? (
            <div className="project-history-list">
              {recentTaskSnapshots.map((snapshot) => (
                <Button
                  block
                  className="project-history-item"
                  key={snapshot.id}
                  loading={restoringSnapshotId === snapshot.id}
                  onClick={() => void handleRestoreLocalTaskSnapshot(snapshot.id)}
                >
                  <span>{snapshot.archiveFolderName || snapshot.title}</span>
                  <small>
                    {snapshot.editRecords?.length ? `${snapshot.editRecords.length} 条记录 · ` : ''}
                    {formatSnapshotTime(snapshot.updatedAt)}
                  </small>
                </Button>
              ))}
            </div>
          ) : (
            <div className="project-history-empty">
              <HistoryOutlined />
              <Text type="secondary">暂无历史工程</Text>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

function formatSnapshotTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}
