/**
 * 治愈系手账 "biu" 小气泡交互动效
 * 监听用户在按钮、小纸条、卡片等交互元素上的点击
 * 在点击位置弹出软萌的 "biu~" 小气泡与柔和微粒子
 */

const CUTE_COLORS = [
  { bg: 'rgba(246, 201, 95, 0.75)', border: '#f6c95f' },  // 蜜糖黄
  { bg: 'rgba(255, 143, 163, 0.75)', border: '#ff8fa3' }, // 软桃粉
  { bg: 'rgba(110, 231, 183, 0.75)', border: '#6ee7b7' }, // 薄荷绿
  { bg: 'rgba(125, 211, 252, 0.75)', border: '#7dd3fc' }, // 晴空蓝
  { bg: 'rgba(216, 180, 254, 0.75)', border: '#d8b4fe' }, // 薰衣草
]

const BIU_TEXTS = ['biu~ ✨', 'biu~ 🫧', '啵~ 💖', 'biu~ 🌸', 'biu~ 🍃', '好嘞~ ✨']

let stageElement = null

function getStage() {
  if (!stageElement && typeof document !== 'undefined') {
    stageElement = document.createElement('div')
    stageElement.id = 'biu-bubble-stage'
    stageElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 999999;
      overflow: hidden;
    `
    document.body.appendChild(stageElement)
  }
  return stageElement
}

/**
 * 在坐标 (x, y) 处触发一次 biu 小气泡绽放
 */
export function triggerBiuBubble(x, y, customText = null) {
  const stage = getStage()
  if (!stage) return

  const text = customText || BIU_TEXTS[Math.floor(Math.random() * BIU_TEXTS.length)]

  // 1. 创建浮起的小文字气泡
  const textBubble = document.createElement('div')
  textBubble.className = 'biu-popup-pill'
  textBubble.textContent = text
  textBubble.style.left = `${x}px`
  textBubble.style.top = `${y}px`
  stage.appendChild(textBubble)

  // 2. 创建 4~6 个软糯肥皂小气泡
  const bubbleCount = 4 + Math.floor(Math.random() * 3)
  for (let i = 0; i < bubbleCount; i++) {
    const bubble = document.createElement('div')
    bubble.className = 'biu-soap-bubble'
    const color = CUTE_COLORS[Math.floor(Math.random() * CUTE_COLORS.length)]
    const size = 10 + Math.floor(Math.random() * 12)
    
    // 随机散射角度与距离
    const angle = (Math.PI * 2 * i) / bubbleCount + (Math.random() - 0.5) * 0.5
    const distance = 20 + Math.random() * 26
    const dx = Math.cos(angle) * distance
    const dy = Math.sin(angle) * distance - 22 // 略微向上漂浮

    bubble.style.width = `${size}px`
    bubble.style.height = `${size}px`
    bubble.style.left = `${x - size / 2}px`
    bubble.style.top = `${y - size / 2}px`
    bubble.style.setProperty('--dx', `${dx}px`)
    bubble.style.setProperty('--dy', `${dy}px`)
    bubble.style.background = color.bg
    bubble.style.borderColor = color.border

    stage.appendChild(bubble)

    setTimeout(() => {
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble)
    }, 700)
  }

  // 自动清理文字气泡
  setTimeout(() => {
    if (textBubble.parentNode) textBubble.parentNode.removeChild(textBubble)
  }, 750)
}

/**
 * 全局挂载点击监听
 */
export function initBiuBubbleListener() {
  if (typeof window === 'undefined') return

  window.addEventListener('click', (e) => {
    // 检查是否点击在按钮或可交互的手账元素上
    const target = e.target
    if (!target || typeof target.closest !== 'function') return

    const interactiveEl = target.closest(
      'button, .ant-btn, .btn-cute-action, .btn-cute-query-knowledge, .btn-cute-confirm-next, ' +
      '.knowledge-paper-slip, .timeline-row-block, .ant-switch, .ant-upload, .ant-tag, ' +
      '.qh-brand, .ant-radio-button-wrapper, .ant-modal-close, .btn-remove-photo'
    )

    if (interactiveEl) {
      // 获取点击坐标
      const x = e.clientX
      const y = e.clientY
      triggerBiuBubble(x, y)
    }
  }, { passive: true })
}
