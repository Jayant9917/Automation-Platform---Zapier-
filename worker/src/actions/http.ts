import { ActionError } from "./registry.js";
export type Fetch = typeof fetch;
export async function postJson(
  fetcher: Fetch,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  let response;
  try {
    response = await fetcher(url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ActionError("PROVIDER_OUTCOME_UNKNOWN", "needs_attention");
  }
  if (response.status === 429) {
    const delay = Number(response.headers.get("retry-after"));
    throw new ActionError(
      "PROVIDER_RATE_LIMITED",
      "retry",
      Number.isFinite(delay) ? Math.min(900000, Math.max(10000, delay * 1000)) : 10000,
    );
  }
  if (response.status >= 500) throw new ActionError("PROVIDER_OUTCOME_UNKNOWN", "needs_attention");
  if (!response.ok) throw new ActionError("PROVIDER_REJECTED", "failed");
  return response;
}
