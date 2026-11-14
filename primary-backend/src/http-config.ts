export function parseHttpUrl(input: unknown): URL {
  if (typeof input !== "string" || input.length > 2000 || /[{}\r\n]/.test(input))
    throw new Error("INVALID_HTTP_URL");
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new Error("INVALID_HTTP_URL");
  return url;
}
export function parseHttpConnection(input: unknown): {
  origin: string;
  headers: Record<string, string>;
} {
  const data = input as { origin?: unknown; headers?: unknown } | null;
  const url = parseHttpUrl(data?.origin);
  if (url.pathname !== "/" || url.search) throw new Error("INVALID_HTTP_CONNECTION");
  if (!data?.headers || typeof data.headers !== "object" || Array.isArray(data.headers))
    throw new Error("INVALID_HTTP_CONNECTION");
  const headers: Record<string, string> = Object.create(null);
  const entries = Object.entries(data.headers);
  if (entries.length > 20) throw new Error("INVALID_HTTP_CONNECTION");
  for (const [key, value] of entries) {
    const name = key.toLowerCase();
    if (
      !/^[a-z0-9-]{1,80}$/.test(name) ||
      [
        "host",
        "connection",
        "content-length",
        "transfer-encoding",
        "upgrade",
        "te",
        "trailer",
        "proxy-authorization",
        "proxy-connection",
        "content-type",
        "idempotency-key",
      ].includes(name) ||
      typeof value !== "string" ||
      value.length > 4000 ||
      /[^\x20-\x7e]/.test(value)
    )
      throw new Error("INVALID_HTTP_CONNECTION");
    headers[name] = value;
  }
  return { origin: url.origin, headers };
}
