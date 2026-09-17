/**
 * 历史资源受控清理服务
 * 统一封装 /api/cleanup 接口
 */

export async function triggerCleanup({ preserveCurrent = true, olderThanMinutes = 60 } = {}) {
  const res = await fetch("/api/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preserveCurrent, olderThanMinutes }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "执行文件清理失败")
  }
  return data
}
