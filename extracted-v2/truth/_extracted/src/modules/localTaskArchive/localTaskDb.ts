// @cleanroom-module: localTaskDb
// @domain: task-persistence
// @feature-branch: local-task-archive
// @io-input: TeachingProject
// @io-output: IndexedDB current task snapshot
// @boundary: local browser IndexedDB only; stores project state, not API secrets

import Dexie, { type Table } from 'dexie';
import type { TeachingProject } from '../../domain/teachingProject';
import type { LocalProjectEditRecord, LocalProjectProductManifestItem } from './localTaskArchive';

export type LocalTaskSnapshot = {
  archiveFolderName?: string;
  editRecords?: LocalProjectEditRecord[];
  id: string;
  kind: 'current' | 'saved';
  productManifest?: LocalProjectProductManifestItem[];
  project: TeachingProject;
  projectId: string;
  title: string;
  updatedAt: string;
};

class LocalTaskDb extends Dexie {
  taskSnapshots!: Table<LocalTaskSnapshot, string>;

  constructor() {
    super('cleanroom-local-task-archive');
    this.version(1).stores({
      taskSnapshots: '&id, projectId, updatedAt',
    });
  }
}

const db = new LocalTaskDb();
const currentSnapshotId = 'current' as const;

export async function loadCurrentProjectSnapshot(): Promise<LocalTaskSnapshot | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeSnapshot((await db.taskSnapshots.get(currentSnapshotId)) ?? null);
  } catch {
    return null;
  }
}

export async function loadLocalTaskSnapshot(snapshotId: string): Promise<LocalTaskSnapshot | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return normalizeSnapshot((await db.taskSnapshots.get(snapshotId)) ?? null);
  } catch {
    return null;
  }
}

export async function loadRecentTaskSnapshots(limit = 6): Promise<LocalTaskSnapshot[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const snapshots = await db.taskSnapshots.orderBy('updatedAt').reverse().toArray();
    return snapshots.filter((snapshot) => snapshot.kind === 'saved').slice(0, limit);
  } catch {
    return [];
  }
}

export async function saveCurrentProjectSnapshot(project: TeachingProject): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  await db.taskSnapshots.put({
    id: currentSnapshotId,
    kind: 'current',
    project: sanitizeProjectForSnapshot(project),
    projectId: project.id,
    title: project.title,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveNamedProjectSnapshot(
  project: TeachingProject,
  archiveFolderName: string,
  metadata?: {
    editRecords?: LocalProjectEditRecord[];
    productManifest?: LocalProjectProductManifestItem[];
  },
): Promise<LocalTaskSnapshot> {
  const snapshot: LocalTaskSnapshot = {
    archiveFolderName,
    editRecords: metadata?.editRecords,
    id: `saved-${Date.now()}`,
    kind: 'saved',
    productManifest: metadata?.productManifest,
    project: sanitizeProjectForSnapshot(project),
    projectId: project.id,
    title: project.title,
    updatedAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    await db.taskSnapshots.put(snapshot);
  }

  return snapshot;
}

function sanitizeProjectForSnapshot(project: TeachingProject): TeachingProject {
  return {
    ...project,
    assets: project.assets.map((asset) =>
      asset.sourceRef?.startsWith('blob:')
        ? {
            ...asset,
            sourceRef: undefined,
          }
        : asset,
    ),
    timeline: {
      ...project.timeline,
      clips: project.timeline.clips.filter((clip) => !isSeedDemoBoardClip(clip)),
    },
  };
}

function normalizeSnapshot(snapshot: LocalTaskSnapshot | null): LocalTaskSnapshot | null {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    project: sanitizeProjectForSnapshot(snapshot.project),
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
