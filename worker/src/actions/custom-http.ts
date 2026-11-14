import { resolve4 } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";
import { parseHttpUrl, parseHttpConnection } from "../http-config.js";
import { renderText, TemplateError } from "../templates.js";
import { ActionError } from "./registry.js";
import type { ActionHandler } from "./registry.js";

const blocked = new BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, prefix, "ipv4");
export function publicAddress(ip: string) {
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !blocked.check(ip, "ipv4");
}
export function renderJson(value: unknown, context: unknown, depth = 0): unknown {
  if (depth > 10) throw new ActionError("INVALID_HTTP_CONFIG", "failed");
  if (typeof value === "string") return renderText(value, context, 20000);
  if (Array.isArray(value)) return value.map((item) => renderJson(item, context, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      if (/[{}]/.test(key) || ["__proto__", "constructor", "prototype"].includes(key))
        throw new ActionError("INVALID_HTTP_CONFIG", "failed");
      result[key] = renderJson(item, context, depth + 1);
    }
    return result;
  }
  return value;
}
export type HttpInput = {
  url: URL;
  address: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};
export function sendPublicRequest(input: HttpInput): Promise<number> {
  return new Promise((resolve, reject) => {
    // DNS is pinned to a validated IPv4 address; TLS still verifies the original hostname.
    const req = request(
      input.url,
      {
        method: input.method,
        family: 4,
        agent: false,
        signal: AbortSignal.timeout(15000),
        headers: input.headers,
        lookup: (_hostname, _options, callback) => callback(null, input.address, 4),
      },
      (response) => {
        let bytes = 0;
        response.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 1048576) req.destroy(new Error("RESPONSE_TOO_LARGE"));
        });
        response.on("end", () => resolve(response.statusCode ?? 0));
        response.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end(input.body || undefined);
  });
}
export function createHttpHandler(resolve = resolve4, send = sendPublicRequest): ActionHandler {
  return {
    credentialProvider: "http.headers",
    async execute(config, context, credential) {
      const settings = config as { url?: unknown; method?: unknown; body?: unknown } | null;
      let url: URL, connection;
      try {
        url = parseHttpUrl(settings?.url);
        connection = parseHttpConnection(credential);
      } catch {
        throw new ActionError("INVALID_HTTP_CONNECTION", "failed");
      }
      if (url.origin !== connection.origin) throw new ActionError("HTTP_ORIGIN_MISMATCH", "failed");
      const method = String(settings?.method);
      if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method))
        throw new ActionError("INVALID_HTTP_CONFIG", "failed");
      let body = "";
      try {
        if (typeof settings?.body !== "string" || settings.body.length > 20000) throw new Error();
        if (method !== "GET" && settings.body.trim())
          body = JSON.stringify(renderJson(JSON.parse(settings.body), context));
      } catch (error) {
        if (error instanceof ActionError || error instanceof TemplateError) throw error;
        throw new ActionError("INVALID_HTTP_CONFIG", "failed");
      }
      if (Buffer.byteLength(body) > 65536) throw new ActionError("INVALID_HTTP_CONFIG", "failed");
      if (isIP(url.hostname.replace(/^\[|\]$/g, "")) === 6)
        throw new ActionError("HTTP_DESTINATION_BLOCKED", "failed");
      let addresses: string[];
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        addresses = await Promise.race([
          isIP(url.hostname) === 4 ? Promise.resolve([url.hostname]) : resolve(url.hostname),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error()), 5000);
          }),
        ]);
      } catch {
        throw new ActionError("HTTP_DNS_UNAVAILABLE", "retry");
      } finally {
        clearTimeout(timer);
      }
      if (!addresses.length || addresses.some((ip) => !publicAddress(ip)))
        throw new ActionError("HTTP_DESTINATION_BLOCKED", "failed");
      const execution = (context as { execution?: { actionId?: string } })?.execution;
      let status: number;
      try {
        status = await send({
          url,
          address: addresses[0]!,
          method,
          body,
          headers: {
            ...connection.headers,
            "content-type": "application/json",
            ...(execution?.actionId ? { "idempotency-key": execution.actionId } : {}),
          },
        });
      } catch {
        throw new ActionError(
          "HTTP_OUTCOME_UNKNOWN",
          method === "GET" ? "retry" : "needs_attention",
        );
      }
      if (status >= 200 && status < 300) return;
      if (status >= 300 && status < 400) throw new ActionError("HTTP_REDIRECT_BLOCKED", "failed");
      if (status >= 500)
        throw new ActionError(
          "HTTP_OUTCOME_UNKNOWN",
          method === "GET" ? "retry" : "needs_attention",
        );
      if (status === 429 && method === "GET")
        throw new ActionError("PROVIDER_RATE_LIMITED", "retry");
      throw new ActionError("PROVIDER_REJECTED", "failed");
    },
  };
}
