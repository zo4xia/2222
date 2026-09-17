/**
 * TTS 语音合成与本地缓存服务
 * 统一封装 /api/tts/* 接口
 */

export async function synthesizeSpeech(payload, options = {}) {
  const res = await fetch("/api/tts/synthesize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "语音合成失败")
  }
  return data
}

export async function saveTtsLocal(payload) {
  const res = await fetch("/api/tts/save-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "保存本地音频失败")
  }
  return data
}
