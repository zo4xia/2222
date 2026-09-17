const VALID_REGIONS = Object.freeze(['question', 'analysis', 'solution', 'summary'])

function requireElement(element, message) {
  if (typeof HTMLElement === 'undefined' || !(element instanceof HTMLElement)) {
    throw new Error(message)
  }
  return element
}

function hashText(value) {
  let hash = 2166136261
  for (const char of value) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function findTextMatch(root, exactText, occurrence) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let seen = 0
  let node = walker.nextNode()

  while (node) {
    const parent = node.parentElement
    const excluded = parent?.closest('svg,script,style,.katex-mathml,[data-board-mark-target]')
    if (!excluded) {
      let fromIndex = 0
      let matchIndex = node.data.indexOf(exactText, fromIndex)
      while (matchIndex >= 0) {
        seen += 1
        if (seen === occurrence) return { node, matchIndex }
        fromIndex = matchIndex + exactText.length
        matchIndex = node.data.indexOf(exactText, fromIndex)
      }
    }
    node = walker.nextNode()
  }
  return null
}

function createTextRange(match, exactText) {
  const range = document.createRange()
  range.setStart(match.node, match.matchIndex)
  range.setEnd(match.node, match.matchIndex + exactText.length)
  return range
}

function resolveAnnotationOverlay(root) {
  const canvas = requireElement(
    root.closest('[data-board-canvas]') || root.offsetParent || root.parentElement,
    '找不到标记目标所属画布',
  )
  let overlay = canvas.querySelector('[data-board-overlay="annotations"]')
  let created = false
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.dataset.boardLayer = 'L3'
    overlay.dataset.boardOverlay = 'annotations'
    overlay.setAttribute('aria-hidden', 'true')
    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '5',
      pointerEvents: 'none',
    })
    canvas.appendChild(overlay)
    created = true
  }
  return { overlay: requireElement(overlay, '标记代理层无效'), created }
}

function createReadOnlyProxy({ root, match, exactText, targetId }) {
  const range = createTextRange(match, exactText)
  const rect = range.getBoundingClientRect()
  if (!rect.width || !rect.height) throw new Error(`标记文本尚未完成布局: ${exactText}`)

  const { overlay, created } = resolveAnnotationOverlay(root)
  const overlayRect = overlay.getBoundingClientRect()
  const textStyle = getComputedStyle(match.node.parentElement || root)
  const proxy = document.createElement('span')
  proxy.dataset.boardMarkTarget = targetId
  proxy.setAttribute('aria-hidden', 'true')
  Object.assign(proxy.style, {
    position: 'absolute',
    left: `${rect.left - overlayRect.left}px`,
    top: `${rect.top - overlayRect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: 'block',
    color: 'transparent',
    fontSize: textStyle.fontSize,
    lineHeight: textStyle.lineHeight,
    pointerEvents: 'none',
  })
  proxy.getBoundingClientRect = () => range.getBoundingClientRect()
  proxy.getClientRects = () => range.getClientRects()
  overlay.appendChild(proxy)
  return { element: proxy, range, overlay, createdOverlay: created }
}

export function createTextTargetRegistry({ resolveRegion } = {}) {
  if (typeof resolveRegion !== 'function') throw new Error('文本标记目标注册器需要 resolveRegion')
  const targets = new Map()

  function register(target) {
    const region = target?.region
    const exactText = target?.exactText?.trim()
    const occurrence = Math.round(target?.occurrence ?? 1)
    if (!VALID_REGIONS.includes(region)) throw new Error(`未知标记区域: ${region || '空'}`)
    if (!exactText) throw new Error('exactText 不能为空')
    if (!Number.isFinite(occurrence) || occurrence < 1) throw new Error('occurrence 必须是正整数')

    const targetId = target.targetId || `mark-${region}-${hashText(exactText)}-${occurrence}`
    if (targets.has(targetId)) return targets.get(targetId)
    const root = requireElement(resolveRegion(region), `找不到标记区域: ${region}`)
    const match = findTextMatch(root, exactText, occurrence)
    if (!match) {
      throw new Error(`在 ${region} 区找不到第 ${occurrence} 个精确文本: ${exactText}`)
    }

    const proxy = createReadOnlyProxy({ root, match, exactText, targetId })
    const record = { targetId, region, exactText, occurrence, ...proxy }
    targets.set(targetId, record)
    return record
  }

  function resolve(target) {
    if (typeof target === 'string') return targets.get(target)?.element || null
    return register(target).element
  }

  function clear() {
    const overlays = new Set()
    targets.forEach(({ element, range, overlay, createdOverlay }) => {
      element?.remove()
      range?.detach?.()
      if (createdOverlay) overlays.add(overlay)
    })
    targets.clear()
    overlays.forEach((overlay) => {
      if (overlay && !overlay.children.length) overlay.remove()
    })
  }

  return {
    register,
    resolve,
    clear,
    list: () => [...targets.values()].map(({ element, ...record }) => record),
  }
}
