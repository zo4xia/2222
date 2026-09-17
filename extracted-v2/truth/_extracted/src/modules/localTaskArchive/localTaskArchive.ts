// @cleanroom-module: localTaskArchive
// @domain: task-persistence
// @feature-branch: local-task-archive
// @io-input: TeachingProject
// @io-output: user-selected local folder files
// @boundary: browser File System Access API only; no silent disk writes and no API keys

import type { TeachingAsset, TeachingAssetKind, TeachingProject, TimelineClip } from '../../domain/teachingProject';

type LocalFileWritable = {
  close: () => Promise<void>;
  write: (data: Blob | string) => Promise<void>;
};

type LocalFileHandle = {
  createWritable: () => Promise<LocalFileWritable>;
  getFile: () => Promise<File>;
};

type LocalDirectoryHandle = {
  name?: string;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<LocalDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<LocalFileHandle>;
  queryPermission?: (descriptor?: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<LocalDirectoryHandle>;
};

export type LocalTaskArchiveResult = {
  audioSavedCount: number;
  audioTotalCount: number;
  archivePackage: LocalProjectArchivePackage;
  folderName: string;
  jsonFileCount: number;
  rootDirectoryName: string;
  usedDefaultDirectory: boolean;
};

export type LocalProjectEditRecord = {
  detail: string;
  id: string;
  kind: 'project' | 'asset' | 'timeline' | 'archive';
  title: string;
  updatedAt: string;
};

export type LocalProjectProductManifestItem = {
  fileName: string;
  kind: 'project' | 'script' | 'board' | 'tts-result' | 'audio' | 'timeline' | 'recording';
  required: boolean;
  status: 'planned' | 'ready' | 'missing';
  title: string;
};

export type LocalProjectArchivePackage = {
  editRecords: LocalProjectEditRecord[];
  productManifest: LocalProjectProductManifestItem[];
  project: TeachingProject;
  savedAt: string;
  schema: 'cleanroom-local-task-archive-v2';
};

export type LocalTaskImportResult = {
  audioRestoredCount: number;
  audioTotalCount: number;
  archivePackage: LocalProjectArchivePackage;
  folderName: string;
  project: TeachingProject;
};

const defaultDirectoryDbName = 'cleanroom-local-task-directory';
const defaultDirectoryStoreName = 'handles';
const defaultDirectoryHandleId = 'default-save-directory';
let cachedDefaultDirectoryHandle: LocalDirectoryHandle | null = null;

export async function saveProjectToLocalTaskFolder(project: TeachingProject): Promise<LocalTaskArchiveResult> {
  const { rootDirectory, usedDefaultDirectory } = await resolveSaveRootDirectory();
  const { folderName, taskDirectory } = await createIncrementalTaskDirectory(rootDirectory, project);
  const archive = createTaskArchive(project);

  await writeJsonFile(taskDirectory, 'project.json', archive.project);
  await writeJsonFile(taskDirectory, 'oral-script.json', archive.oralScript);
  await writeJsonFile(taskDirectory, 'board.json', archive.board);
  await writeJsonFile(taskDirectory, 'timeline.json', archive.timeline);
  await writeJsonFile(taskDirectory, 'aliyun-tts-results.json', archive.aliyunTtsResults);
  await writeJsonFile(taskDirectory, 'voice-timing.json', archive.voiceTiming);
  await writeJsonFile(taskDirectory, 'voice-audio-index.json', archive.voiceAudioIndex);

  let audioSavedCount = 0;
  for (const [index, audioUrl] of archive.voiceAudioIndex.audioUrls.entries()) {
    const saved = await tryWriteAudioFile(taskDirectory, audioUrl, index + 1);
    if (saved) {
      audioSavedCount += 1;
    }
  }

  return {
    audioSavedCount,
    audioTotalCount: archive.voiceAudioIndex.audioUrls.length,
    archivePackage: archive.project,
    folderName,
    jsonFileCount: 7,
    rootDirectoryName: rootDirectory.name || '已授权目录',
    usedDefaultDirectory,
  };
}

export async function selectDefaultLocalTaskFolder(): Promise<{ directoryName: string }> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持选择本地文件夹，请使用新版 Chrome / Edge。');
  }

  const rootDirectory = await picker();
  cachedDefaultDirectoryHandle = rootDirectory;
  await persistDefaultDirectoryHandle(rootDirectory);
  return {
    directoryName: rootDirectory.name || '已授权目录',
  };
}

export async function importProjectFromLocalTaskFolder(): Promise<LocalTaskImportResult> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持选择本地文件夹，请使用新版 Chrome / Edge。');
  }

  const taskDirectory = await picker();
  const projectFile = await taskDirectory.getFileHandle('project.json');
  const rawProject = await (await projectFile.getFile()).text();
  const archivePackage = normalizeArchivePackage(JSON.parse(rawProject));
  const restoredAudio = await hydrateImportedProjectAudio(taskDirectory, archivePackage.project);

  return {
    audioRestoredCount: restoredAudio.audioRestoredCount,
    audioTotalCount: restoredAudio.audioTotalCount,
    archivePackage: {
      ...archivePackage,
      project: restoredAudio.project,
    },
    folderName: taskDirectory.name || archivePackage.project.title || archivePackage.project.id,
    project: restoredAudio.project,
  };
}

function createTaskArchive(project: TeachingProject) {
  const now = new Date().toISOString();
  const problemText = findAsset(project.assets, 'problemText');
  const scriptText = findAsset(project.assets, 'scriptText');
  const boardLayout = findAsset(project.assets, 'boardLayout');
  const voiceTiming = findAsset(project.assets, 'voiceTiming');
  const audioClips = project.timeline.clips.filter((clip) => clip.kind === 'audio');
  const boardClips = project.timeline.clips.filter((clip) => clip.kind === 'board');
  const audioUrls = collectAudioUrls(project.assets, audioClips);
  const sanitizedProject = sanitizeProjectForArchive(project);
  const productManifest = createProductManifest(project, audioUrls);
  const editRecords = createEditRecords(project, now);

  return {
    aliyunTtsResults: {
      audioUrls,
      projectId: project.id,
      savedAt: now,
      timingJson: voiceTiming?.sourceRef ?? '',
      timingSummary: voiceTiming?.summary ?? '',
      voiceAudioSummary: findAsset(project.assets, 'voiceAudio')?.summary ?? '',
    },
    board: {
      boardClips,
      boardPlan: boardLayout?.summary ?? '',
      projectId: project.id,
      savedAt: now,
    },
    oralScript: {
      problemText: problemText?.summary ?? '',
      projectId: project.id,
      savedAt: now,
      spokenScript: scriptText?.summary ?? '',
    },
    project: {
      editRecords,
      productManifest,
      project: sanitizedProject,
      savedAt: now,
      schema: 'cleanroom-local-task-archive-v2' as const,
    },
    timeline: {
      projectId: project.id,
      savedAt: now,
      timeline: project.timeline,
    },
    voiceAudioIndex: {
      audioClips,
      audioUrls,
      expectedLocalAudioFiles: audioUrls.map((audioUrl, index) => ({
        fileName: `audio-${String(index + 1).padStart(3, '0')}.${inferAudioExtension(audioUrl, '')}`,
        sourceUrl: audioUrl,
      })),
      projectId: project.id,
      savedAt: now,
    },
    voiceTiming: {
      projectId: project.id,
      savedAt: now,
      timingJson: voiceTiming?.sourceRef ?? '',
      timingSummary: voiceTiming?.summary ?? '',
    },
  };
}

function collectAudioUrls(assets: TeachingAsset[], audioClips: TimelineClip[]) {
  const fromAsset = findAsset(assets, 'voiceAudio')?.sourceRef?.split(/\r?\n/) ?? [];
  const fromClips = audioClips.map((clip) => clip.sourceRef ?? '');
  return Array.from(new Set([...fromAsset, ...fromClips].map((url) => url.trim()).filter(Boolean)));
}

function findAsset(assets: TeachingAsset[], kind: TeachingAsset['kind']) {
  return assets.find((asset) => asset.kind === kind);
}

function updateArchiveAsset(assets: TeachingAsset[], kind: TeachingAsset['kind'], patch: Partial<TeachingAsset>) {
  return assets.map((asset) =>
    asset.kind === kind
      ? {
          ...asset,
          ...patch,
        }
      : asset,
  );
}

function sanitizeProjectForArchive(project: TeachingProject): TeachingProject {
  return {
    ...project,
    assets: project.assets.map((asset) =>
      asset.sourceRef?.startsWith('blob:')
        ? {
            ...asset,
            sourceRef: undefined,
            summary: `${asset.summary}\n本地浏览器 blob 预览地址刷新后会失效，已从归档 JSON 中移除。`.trim(),
          }
        : asset,
    ),
  };
}

function createEditRecords(project: TeachingProject, savedAt: string): LocalProjectEditRecord[] {
  const records: LocalProjectEditRecord[] = [
    {
      detail: `工程创建时间：${project.createdAt}`,
      id: 'edit-project-created',
      kind: 'project',
      title: '工程创建',
      updatedAt: project.createdAt,
    },
  ];

  for (const asset of project.assets) {
    if (asset.status === 'missing' && !asset.summary.trim()) {
      continue;
    }

    records.push({
      detail: asset.summary,
      id: `edit-asset-${asset.kind}`,
      kind: 'asset',
      title: `${formatAssetKind(asset.kind)}：${asset.status}`,
      updatedAt: savedAt,
    });
  }

  records.push({
    detail: `时间轴 ${project.timeline.clips.length} 个片段，时长 ${project.timeline.durationMs}ms。`,
    id: 'edit-timeline-current',
    kind: 'timeline',
    title: '时间轴当前状态',
    updatedAt: savedAt,
  });
  records.push({
    detail: '已写入本地任务文件夹 project.json，作为导入恢复和变动记录入口。',
    id: 'edit-archive-project-json',
    kind: 'archive',
    title: '本地归档',
    updatedAt: savedAt,
  });

  return records;
}

function createProductManifest(project: TeachingProject, audioUrls: string[]): LocalProjectProductManifestItem[] {
  const scriptAsset = findAsset(project.assets, 'scriptText');
  const boardAsset = findAsset(project.assets, 'boardLayout');
  const voiceTimingAsset = findAsset(project.assets, 'voiceTiming');
  const exportAsset = findAsset(project.assets, 'exportResult');

  return [
    {
      fileName: 'project.json',
      kind: 'project',
      required: true,
      status: 'ready',
      title: '工程真相与变动记录',
    },
    {
      fileName: 'oral-script.json',
      kind: 'script',
      required: true,
      status: scriptAsset?.summary.trim() ? 'ready' : 'missing',
      title: '广播/口播稿 JSON',
    },
    {
      fileName: 'board.json',
      kind: 'board',
      required: true,
      status: boardAsset?.summary.trim() ? 'ready' : 'missing',
      title: '板书 JSON',
    },
    {
      fileName: 'aliyun-tts-results.json',
      kind: 'tts-result',
      required: true,
      status: voiceTimingAsset?.sourceRef?.trim() || audioUrls.length ? 'ready' : 'missing',
      title: '阿里云语音返回与时序 JSON',
    },
    {
      fileName: 'audio-001.mp3',
      kind: 'audio',
      required: true,
      status: audioUrls.length ? 'ready' : 'missing',
      title: 'MP3 语音文件',
    },
    {
      fileName: 'timeline.json',
      kind: 'timeline',
      required: true,
      status: project.timeline.clips.length ? 'ready' : 'missing',
      title: '时间轴 JSON',
    },
    {
      fileName: exportAsset?.sourceRef || 'recording-001.mp4',
      kind: 'recording',
      required: false,
      status: exportAsset?.status === 'ready' || exportAsset?.status === 'done' ? 'ready' : 'planned',
      title: '录屏自动保存 MP4',
    },
  ];
}

function normalizeArchivePackage(value: unknown): LocalProjectArchivePackage {
  if (!value || typeof value !== 'object') {
    throw new Error('project.json 格式不正确。');
  }

  const packageValue = value as Partial<LocalProjectArchivePackage> & { project?: unknown; schema?: string };
  const project = normalizeProject(packageValue.project);
  return {
    editRecords: Array.isArray(packageValue.editRecords) ? packageValue.editRecords.filter(isEditRecord) : [],
    productManifest: Array.isArray(packageValue.productManifest) ? packageValue.productManifest.filter(isProductManifestItem) : [],
    project,
    savedAt: typeof packageValue.savedAt === 'string' ? packageValue.savedAt : new Date().toISOString(),
    schema: 'cleanroom-local-task-archive-v2',
  };
}

function normalizeProject(value: unknown): TeachingProject {
  if (!value || typeof value !== 'object') {
    throw new Error('project.json 缺少 project 工程内容。');
  }

  const project = value as Partial<TeachingProject>;
  if (typeof project.id !== 'string' || typeof project.title !== 'string' || !Array.isArray(project.assets) || !project.timeline) {
    throw new Error('project.json 中的工程内容不完整。');
  }

  return stripSeedDemoBoardClips(project as TeachingProject);
}

function isEditRecord(value: unknown): value is LocalProjectEditRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<LocalProjectEditRecord>;
  return typeof record.id === 'string' && typeof record.title === 'string' && typeof record.updatedAt === 'string';
}

function isProductManifestItem(value: unknown): value is LocalProjectProductManifestItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<LocalProjectProductManifestItem>;
  return typeof item.fileName === 'string' && typeof item.title === 'string' && typeof item.status === 'string';
}

function formatAssetKind(kind: TeachingAssetKind) {
  const labels: Record<TeachingAssetKind, string> = {
    boardLayout: '板书',
    exportResult: '录屏交付',
    problemImage: '题图',
    problemText: '题文',
    scriptText: '口播稿',
    voiceAudio: '语音音频',
    voiceTiming: '语音时序',
  };
  return labels[kind];
}

function stripSeedDemoBoardClips(project: TeachingProject): TeachingProject {
  return {
    ...project,
    timeline: {
      ...project.timeline,
      clips: project.timeline.clips.filter((clip) => !isSeedDemoBoardClip(clip)),
    },
  };
}

function isSeedDemoBoardClip(clip: TeachingProject['timeline']['clips'][number]) {
  return (
    clip.trackId === 'track-board' &&
    clip.kind === 'board' &&
    ((clip.id === 'clip-board-1' && clip.label === '25×4=100') ||
      (clip.id === 'clip-board-2' && clip.label === '1200÷100=12'))
  );
}

async function resolveSaveRootDirectory(): Promise<{ rootDirectory: LocalDirectoryHandle; usedDefaultDirectory: boolean }> {
  const defaultDirectory = await readDefaultDirectoryHandle();
  if (defaultDirectory && (await ensureDirectoryPermission(defaultDirectory))) {
    return {
      rootDirectory: defaultDirectory,
      usedDefaultDirectory: true,
    };
  }

  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error('当前浏览器不支持选择本地文件夹，请使用新版 Chrome / Edge 或先用 IndexedDB 自动保存。');
  }

  const rootDirectory = await picker();
  cachedDefaultDirectoryHandle = rootDirectory;
  await persistDefaultDirectoryHandle(rootDirectory);
  return {
    rootDirectory,
    usedDefaultDirectory: false,
  };
}

async function ensureDirectoryPermission(directory: LocalDirectoryHandle) {
  if (!directory.queryPermission || !directory.requestPermission) {
    return true;
  }

  try {
    const queryState = await directory.queryPermission({ mode: 'readwrite' });
    if (queryState === 'granted') {
      return true;
    }
    const requestState = await directory.requestPermission({ mode: 'readwrite' });
    return requestState === 'granted';
  } catch {
    return false;
  }
}

async function hydrateImportedProjectAudio(
  taskDirectory: LocalDirectoryHandle,
  project: TeachingProject,
): Promise<{ audioRestoredCount: number; audioTotalCount: number; project: TeachingProject }> {
  const audioClips = project.timeline.clips
    .filter((clip) => clip.kind === 'audio')
    .sort((left, right) => left.startMs - right.startMs);
  if (!audioClips.length || typeof URL === 'undefined') {
    return {
      audioRestoredCount: 0,
      audioTotalCount: audioClips.length,
      project,
    };
  }

  const localAudioUrls: string[] = [];
  for (let index = 0; index < audioClips.length; index += 1) {
    const file = await readLocalAudioFile(taskDirectory, index + 1);
    if (!file) {
      continue;
    }
    localAudioUrls[index] = URL.createObjectURL(file);
  }

  if (!localAudioUrls.some(Boolean)) {
    return {
      audioRestoredCount: 0,
      audioTotalCount: audioClips.length,
      project,
    };
  }

  let audioIndex = 0;
  const clips = project.timeline.clips.map((clip) => {
    if (clip.kind !== 'audio') {
      return clip;
    }
    const localAudioUrl = localAudioUrls[audioIndex];
    audioIndex += 1;
    return localAudioUrl
      ? {
          ...clip,
          sourceRef: localAudioUrl,
        }
      : clip;
  });
  const restoredAudioUrls = localAudioUrls.filter(Boolean);

  return {
    audioRestoredCount: restoredAudioUrls.length,
    audioTotalCount: audioClips.length,
    project: {
      ...project,
      assets: updateArchiveAsset(project.assets, 'voiceAudio', {
        sourceRef: restoredAudioUrls.join('\n'),
        status: restoredAudioUrls.length ? 'ready' : findAsset(project.assets, 'voiceAudio')?.status,
        summary: restoredAudioUrls.length
          ? `已从本地任务文件夹恢复 ${restoredAudioUrls.length} 段 A 轨音频，可用于当前会话播放。`
          : findAsset(project.assets, 'voiceAudio')?.summary,
      }),
      timeline: {
        ...project.timeline,
        clips,
      },
    },
  };
}

async function readLocalAudioFile(taskDirectory: LocalDirectoryHandle, index: number): Promise<File | null> {
  const audioIndex = String(index).padStart(3, '0');
  for (const extension of ['mp3', 'wav', 'ogg']) {
    try {
      const fileHandle = await taskDirectory.getFileHandle(`audio-${audioIndex}.${extension}`);
      return await fileHandle.getFile();
    } catch {
      // Try the next supported archive extension.
    }
  }
  return null;
}

async function persistDefaultDirectoryHandle(directory: LocalDirectoryHandle): Promise<void> {
  cachedDefaultDirectoryHandle = directory;
  if (typeof indexedDB === 'undefined') {
    return;
  }

  try {
    const db = await openDefaultDirectoryDb();
    await transactDefaultDirectoryStore(db, 'readwrite', (store) => store.put(directory, defaultDirectoryHandleId));
    db.close();
  } catch {
    // Some test doubles cannot be structured-cloned. Keep the current-session handle above.
  }
}

async function readDefaultDirectoryHandle(): Promise<LocalDirectoryHandle | null> {
  if (cachedDefaultDirectoryHandle) {
    return cachedDefaultDirectoryHandle;
  }

  if (typeof indexedDB === 'undefined') {
    return null;
  }

  try {
    const db = await openDefaultDirectoryDb();
    const handle = await transactDefaultDirectoryStore(db, 'readonly', (store) => store.get(defaultDirectoryHandleId));
    db.close();
    return isLocalDirectoryHandle(handle) ? handle : null;
  } catch {
    return null;
  }
}

function isLocalDirectoryHandle(value: unknown): value is LocalDirectoryHandle {
  return Boolean(value && typeof value === 'object' && typeof (value as LocalDirectoryHandle).getDirectoryHandle === 'function');
}

function openDefaultDirectoryDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(defaultDirectoryDbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(defaultDirectoryStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactDefaultDirectoryStore<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(defaultDirectoryStoreName, mode);
    const request = run(transaction.objectStore(defaultDirectoryStoreName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function createIncrementalTaskDirectory(rootDirectory: LocalDirectoryHandle, project: TeachingProject) {
  const baseName = createTaskFolderBaseName(project);
  for (let index = 1; index <= 999; index += 1) {
    const folderName = `${baseName}-${String(index).padStart(3, '0')}`;
    if (await directoryExists(rootDirectory, folderName)) {
      continue;
    }

    return {
      folderName,
      taskDirectory: await rootDirectory.getDirectoryHandle(folderName, { create: true }),
    };
  }

  throw new Error('当前工程文件夹下同名任务子文件夹已超过 999 个，请换一个保存位置。');
}

async function directoryExists(rootDirectory: LocalDirectoryHandle, folderName: string) {
  try {
    await rootDirectory.getDirectoryHandle(folderName);
    return true;
  } catch {
    return false;
  }
}

function createTaskFolderBaseName(project: TeachingProject) {
  const taskLabel = project.task.taskId || formatTaskStamp(project.createdAt);
  const titleLabel = project.title || project.id;
  return sanitizePathPart(`${taskLabel}-${titleLabel}`);
}

function formatTaskStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatTaskStamp(new Date().toISOString());
  }

  const pad = (input: number) => String(input).padStart(2, '0');
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

function sanitizePathPart(value: string) {
  const normalized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-');
  return normalized.slice(0, 80) || 'cleanroom-task';
}

async function writeJsonFile(directory: LocalDirectoryHandle, fileName: string, value: unknown) {
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(value, null, 2));
  await writable.close();
}

async function tryWriteAudioFile(directory: LocalDirectoryHandle, audioUrl: string, index: number) {
  try {
    const response = await fetch(audioUrl);
    if (!response.ok) {
      return false;
    }

    const audioBlob = await response.blob();
    const extension = inferAudioExtension(audioUrl, audioBlob.type);
    const fileHandle = await directory.getFileHandle(`audio-${String(index).padStart(3, '0')}.${extension}`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(audioBlob);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

function inferAudioExtension(audioUrl: string, mimeType: string) {
  const urlExtension = audioUrl.split('?')[0]?.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  if (urlExtension) {
    return urlExtension.toLowerCase();
  }
  if (mimeType.includes('mpeg')) {
    return 'mp3';
  }
  if (mimeType.includes('wav')) {
    return 'wav';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  return 'mp3';
}
