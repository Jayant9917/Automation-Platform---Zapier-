export function getEmailPayload(row: unknown): { to: string; body: string } | null {
  if (!row || typeof row !== "object") return null;
  const r = row as {
    zapRun?: {
      zap?: {
        actions?: Array<{
          actionId: string;
          Metadata?: unknown;
          metadata?: unknown;
          type?: { id: string };
        }>;
      };
    };
  };
  const actions = r.zapRun?.zap?.actions ?? [];
  const emailAction = actions.find(
    (a) => a.actionId === "email" || a.type?.id === "email"
  );
  if (!emailAction) {
    console.warn("getEmailPayload: no email action. actions:", actions.length, actions.map((a) => ({ actionId: (a as any).actionId, typeId: (a as any).type?.id })));
    return null;
  }
  const meta = (emailAction as any).Metadata ?? (emailAction as any).metadata;
  if (!meta || typeof meta !== "object") {
    console.warn("getEmailPayload: email action has no Metadata. keys:", Object.keys(emailAction));
    return null;
  }
  const m = meta as { email?: string; body?: string };
  if (typeof m.email !== "string" || !m.email.trim() || typeof m.body !== "string" || !m.body.trim()) {
    console.warn("getEmailPayload: Metadata missing email/body. meta:", JSON.stringify(m));
    return null;
  }
  return { to: m.email, body: m.body };
}
