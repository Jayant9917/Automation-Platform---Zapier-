export function getExecutionStatus(statuses: string[]): string {
  if (statuses.length === 0) return "pending";
  if (statuses.some((status) => status === "needs_attention")) return "needs_attention";
  if (statuses.some((status) => ["pending", "running", "retry"].includes(status))) return "running";
  if (statuses.every((status) => status === "cancelled")) return "cancelled";
  if (statuses.every((status) => status === "succeeded")) return "succeeded";
  if (statuses.some((status) => status === "succeeded")) return "partially_failed";
  return "failed";
}
