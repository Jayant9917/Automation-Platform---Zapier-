import { createPrivateKey } from "node:crypto";
export function parseSlackConnection(input: unknown): { webhookUrl: string } {
  const candidate =
    typeof input === "string" ? input : (input as { webhookUrl?: unknown } | null)?.webhookUrl;
  if (typeof candidate !== "string") throw new Error("INVALID_SLACK_CONNECTION");
  const url = new URL(candidate.trim());
  if (
    url.protocol !== "https:" ||
    url.hostname !== "hooks.slack.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname)
  )
    throw new Error("INVALID_SLACK_CONNECTION");
  return { webhookUrl: url.toString() };
}
export function parseGoogleConnection(input: unknown): {
  client_email: string;
  private_key: string;
} {
  const data = input as { client_email?: unknown; private_key?: unknown } | null;
  if (
    !data ||
    typeof data.client_email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(data.client_email) ||
    typeof data.private_key !== "string" ||
    data.private_key.length > 20000
  )
    throw new Error("INVALID_GOOGLE_CONNECTION");
  const key = createPrivateKey(data.private_key);
  if (key.asymmetricKeyType !== "rsa" || (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048)
    throw new Error("INVALID_GOOGLE_KEY");
  return { client_email: data.client_email, private_key: data.private_key };
}
