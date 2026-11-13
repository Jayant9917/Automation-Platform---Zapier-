import "dotenv/config";
import { readEncryptionKey } from "./credentials.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function port(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`Invalid port: ${name}`);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid port: ${name}`);
  }
  return value;
}

function brokers(): string[] {
  const values = required("KAFKA_BROKERS")
    .split(",")
    .map((value) => value.trim());
  if (values.some((value) => !value || !/^(\[[0-9a-fA-F:]+\]|[^\s:/,]+):\d+$/.test(value))) {
    throw new Error("Invalid host:port list: KAFKA_BROKERS");
  }
  for (const value of values) {
    const number = Number(value.slice(value.lastIndexOf(":") + 1));
    if (number < 1 || number > 65535) throw new Error("Invalid broker port: KAFKA_BROKERS");
  }
  return values;
}

function setting(name: string, fallback: string): string {
  if (process.env[name] === undefined) return fallback;
  return required(name).trim();
}

function boolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Invalid boolean: ${name}`);
}

const smtpPort = port("SMTP_PORT", 587);
const smtpAuth = boolean("SMTP_AUTH", true);
export const config = {
  databaseUrl: required("DATABASE_URL"),
  encryptionKey: readEncryptionKey(process.env.CREDENTIAL_ENCRYPTION_KEY),
  brokers: brokers(),
  topic: setting("KAFKA_TOPIC", "zap-events"),
  groupId: setting("KAFKA_GROUP_ID", "main-worker"),
  smtp: {
    host: required("SMTP_ENDPOINT").trim(),
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpAuth,
    requireTLS: boolean("SMTP_REQUIRE_TLS", true),
    user: smtpAuth ? required("SMTP_USERNAME") : "",
    password: smtpAuth ? required("SMTP_PASSWORD") : "",
    from: process.env.SMTP_FROM?.trim() || required("SMTP_USERNAME"),
  },
};
