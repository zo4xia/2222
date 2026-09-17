const STORAGE_KEY = 'qinghuabu.live-board-preview'

export function loadLiveBoardPreview() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function saveLiveBoardPreview(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function isLiveBoardPreviewUpdate(event) {
  return event.key === STORAGE_KEY && event.storageArea === localStorage
}
