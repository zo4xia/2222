import type { TeachingAssetKind } from '../domain/teachingProject';

export type AssetTabKey = TeachingAssetKind | 'all' | 'problem' | 'scriptBoard';

export const assetTabs: Array<{ key: AssetTabKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'problem', label: '题目' },
  { key: 'scriptBoard', label: '文稿/板书' },
  { key: 'voiceAudio', label: '讲解音频' },
  { key: 'voiceTiming', label: '播放调整' },
  { key: 'exportResult', label: '交付' },
];
