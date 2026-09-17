/**
 * @qh-core LANE=SHARED POINT=FEEDBACK_LOADING 统一加载状态反馈组件
 */
import { computed } from 'vue'
import QhLoading from './QhLoading.vue'
import QhEmpty from './QhEmpty.vue'
import QhError from './QhError.vue'
import QhSkeleton from './QhSkeleton.vue'

export { QhLoading, QhEmpty, QhError, QhSkeleton }

// 加载模式文案
export const LOADING_MODES = {
  recognize: { title: '正在识别题目', desc: '小老师姐姐正在看题...' },
  generate: { title: '正在生成讲题', desc: '边讲边写，准备五字段表...' },
  check: { title: '正在润色口播', desc: 'Check Agent 二次确认...' },
  tts: { title: '正在合成语音', desc: '调上游 TTS...' },
  deliverable: { title: '正在生成交付物', desc: '导出 JSON + HTML...' },
  cleanup: { title: '正在清理临时文件', desc: '' },
  default: { title: '加载中', desc: '' },
}

export function useLoadingMode(mode) {
  return computed(() => LOADING_MODES[mode] || LOADING_MODES.default)
}
