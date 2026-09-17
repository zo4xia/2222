import { reactive } from "vue"

export function isChatCompletionsEndpoint(endpoint = "") {
  return /^https?:\/\/.+\/chat\/completions\/?$/i.test(String(endpoint).trim())
}

export function parseApiKeys(apiKeyInput) {
  if (!apiKeyInput) return []
  return String(apiKeyInput)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
}

/**
 * 通用响应式 API 配置单例工厂
 * 提供 localStorage 持久化、reactive 实例、快照导出、就绪检查和跨页面同步
 */
export function createApiConfigStore(options = {}) {
  const {
    storageKey,
    defaultConfig = {},
    eventName = null,
  } = options

  const defaultValues = Object.freeze({
    endpoint: defaultConfig.endpoint || "",
    apiKey: defaultConfig.apiKey || "",
    model: defaultConfig.model || "",
  })

  function readStorage() {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") return null
      return {
        endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : "",
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model : "",
      }
    } catch {
      return null
    }
  }

  function sanitize(value = {}) {
    const stored = readStorage() || {}
    const endpoint = String(value?.endpoint || stored.endpoint || defaultValues.endpoint).trim()
    if (defaultValues.endpoint && !isChatCompletionsEndpoint(endpoint)) {
      return { ...defaultValues }
    }
    return {
      endpoint,
      apiKey: String(value?.apiKey || stored.apiKey || defaultValues.apiKey).trim(),
      model: String(value?.model || stored.model || defaultValues.model).trim(),
    }
  }

  const config = reactive(sanitize())

  function getSnapshot() {
    return {
      endpoint: String(config.endpoint || "").trim(),
      apiKey: String(config.apiKey || "").trim(),
      model: String(config.model || "").trim(),
    }
  }

  function saveConfig(next = null) {
    if (next && typeof next === "object") {
      if (typeof next.endpoint === "string") config.endpoint = next.endpoint
      if (typeof next.apiKey === "string") config.apiKey = next.apiKey
      if (typeof next.model === "string") config.model = next.model
    }
    const snapshot = getSnapshot()
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot))
    } catch {
      // 忽略存储失败
    }
    if (eventName && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventName, { detail: snapshot }))
    }
    return snapshot
  }

  function loadConfig() {
    const fresh = sanitize()
    config.endpoint = fresh.endpoint
    config.apiKey = fresh.apiKey
    config.model = fresh.model
    return getSnapshot()
  }

  function clearConfig({ keepEndpoint = true, keepModel = true } = {}) {
    config.apiKey = ""
    if (!keepEndpoint) config.endpoint = ""
    if (!keepModel) config.model = ""
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // 忽略
    }
    if (eventName && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventName, { detail: getSnapshot() }))
    }
  }

  function isReady() {
    const snap = getSnapshot()
    const keys = parseApiKeys(snap.apiKey)
    return Boolean(keys.length > 0 && isChatCompletionsEndpoint(snap.endpoint) && snap.model)
  }

  function subscribe(handler) {
    if (typeof window === "undefined") return () => {}
    const onStorage = (event) => {
      if (event.key === storageKey) {
        loadConfig()
        handler?.(getSnapshot())
      }
    }
    const onCustom = (event) => {
      handler?.(event?.detail || getSnapshot())
    }
    window.addEventListener("storage", onStorage)
    if (eventName) {
      window.addEventListener(eventName, onCustom)
    }
    return () => {
      window.removeEventListener("storage", onStorage)
      if (eventName) {
        window.removeEventListener(eventName, onCustom)
      }
    }
  }

  return {
    config,
    getSnapshot,
    saveConfig,
    loadConfig,
    clearConfig,
    isReady,
    parseApiKeys,
    subscribe,
    DEFAULT_CONFIG: defaultValues,
  }
}
