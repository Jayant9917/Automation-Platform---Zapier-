import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required environment variable: ${name}`);
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

function brokers(): string[] {
  const values = required("KAFKA_BROKERS").split(",").map(value => value.trim());
  if (values.some(value => !value || !/^(\[[0-9a-fA-F:]+\]|[^\s:/,]+):\d+$/.test(value))) {
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

export const config = {
  databaseUrl: databaseUrl(), brokers: brokers(), topic: setting("KAFKA_TOPIC", "zap-events"),
};
