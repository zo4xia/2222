import { reactive } from 'vue'

export const globalLoadingState = reactive({
  visible: false,
  text: '数据分析中...',
  subtext: '',
  count: 0,
  cancelable: true,
})

let autoDismissTimer = null

/**
 * 开启全局精致脉冲 Loading 遮罩
 * @param {string} text 主提示文案，默认 '数据分析中...'
 * @param {string} subtext 辅助说明文案，例如 '正在进行语音合成与音频对齐...'
 * @param {object} options 配置项
 */
export function showGlobalLoading(text = '数据分析中...', subtext = '', options = {}) {
  globalLoadingState.count += 1
  globalLoadingState.text = text || '数据分析中...'
  globalLoadingState.subtext = subtext || ''
  globalLoadingState.cancelable = options.cancelable !== false
  globalLoadingState.visible = true

  // 兜底超时安全保护：防止极端情况下接口无返回导致的永久遮罩死锁 (300秒)
  if (autoDismissTimer) clearTimeout(autoDismissTimer)
  autoDismissTimer = setTimeout(() => {
    if (globalLoadingState.visible) {
      hideGlobalLoading(true)
    }
  }, options.timeoutMs || 300000)
}

/**
 * 关闭全局 Loading 遮罩
 * @param {boolean} force 是否强制关闭（清空引用计数）
 */
export function hideGlobalLoading(force = false) {
  if (force) {
    globalLoadingState.count = 0
    globalLoadingState.visible = false
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
    return
  }

  globalLoadingState.count = Math.max(0, globalLoadingState.count - 1)
  if (globalLoadingState.count === 0) {
    globalLoadingState.visible = false
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer)
      autoDismissTimer = null
    }
  }
}

/**
 * 包装异步任务，自动在执行期间显示 Global Loading
 * @param {Function} asyncFn 异步执行函数
 * @param {string} text 主文案
 * @param {string} subtext 副文案
 */
export async function withGlobalLoading(asyncFn, text = '数据分析中...', subtext = '', options = {}) {
  showGlobalLoading(text, subtext, options)
  try {
    return await asyncFn()
  } finally {
    hideGlobalLoading()
  }
}
