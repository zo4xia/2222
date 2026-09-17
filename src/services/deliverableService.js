/**
 * 交付物离线包与规范服务
 * 统一封装 /api/deliverable/* 接口
 */

export async function fetchDeliverableApiSpec() {
  const res = await fetch("/api/deliverable/api-spec")
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "获取交付物接口规范失败")
  }
  return data
}

export async function fetchDeliverableDocMarkdown() {
  const res = await fetch("/deliverable/DELIVERABLE_API_SPEC.md")
  if (!res.ok) throw new Error("加载交付物 Markdown 文档失败")
  return await res.text()
}

export async function saveDeliverablePackage(payload) {
  const res = await fetch("/api/deliverable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "生成交付物失败")
  }
  return data
}

export async function listDeliverableHistory() {
  const res = await fetch("/api/deliverable")
  const data = await res.json().catch(() => ({}))
  return data?.deliverables || []
}
