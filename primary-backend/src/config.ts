import "dotenv/config";

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

function databaseUrl(): string {
  const value = required("DATABASE_URL");
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
  } catch {
    throw new Error("Invalid PostgreSQL URL: DATABASE_URL");
  }
  return value;
}

export const config = { databaseUrl: databaseUrl(), port: port("PORT", 3000) };
export const JWT_PASSWORD = required("JWT_PASSWORD");
