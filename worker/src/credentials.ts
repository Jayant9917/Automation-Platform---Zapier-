import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function readEncryptionKey(value?: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be 64 hexadecimal characters");
  return value;
}

export function encryptSecret(secret: string, key: string, context: string): string {
  if (!readEncryptionKey(key)) throw new Error("Credential encryption is not configured");
  if (!secret) throw new Error("Credential secret must not be empty");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "v1",
    nonce.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptSecret(envelope: string, key: string, context: string): string {
  try {
    if (!readEncryptionKey(key)) throw new Error();
    const parts = envelope.split(".");
    if (
      parts.length !== 4 ||
      parts[0] !== "v1" ||
      parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
    )
      throw new Error();
    const nonce = Buffer.from(parts[1]!, "base64url");
    const tag = Buffer.from(parts[3]!, "base64url");
    if (nonce.length !== 12 || tag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2]!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Credential could not be decrypted");
  }
}

// Bind ciphertext to its owner, ID, and provider so database rows cannot swap secrets.
export function credentialContext(credential: {
  id: string;
  ownerId: number;
  provider: string;
}): string {
  return `${credential.ownerId}:${credential.id}:${credential.provider}`;
}
