/**
 * 知识点智能修缮服务
 * 统一封装 /api/knowledge/refine 接口
 */

export async function refineKnowledgePoint(payload) {
  const res = await fetch("/api/knowledge/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "知识点修缮失败")
  }
  return data
}
