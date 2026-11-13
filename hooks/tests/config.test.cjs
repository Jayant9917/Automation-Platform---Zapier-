jest.mock("dotenv/config", () => ({}));
const originalEnv = process.env;
const load = () => require("../src/config.ts");
beforeEach(() => {
  jest.resetModules();
  process.env = {
    DATABASE_URL: "postgresql://unit:unit@postgres:5432/unit",
    JWT_PASSWORD: "unit-test-secret",
    KAFKA_BROKERS: "kafka:9092, second:9093",
    SMTP_ENDPOINT: "smtp.test",
    SMTP_USERNAME: "unit@example.test",
    SMTP_PASSWORD: "unit-test-password",
  };
});
afterEach(() => {
  process.env = originalEnv;
});

test("accepts a PostgreSQL URL", () => {
  expect(load().config.databaseUrl).toBe(process.env.DATABASE_URL);
});
test.each([undefined, "", "   ", "https://wrong.test/db", "postgresql://postgres/"])(
  "rejects invalid database URL %s",
  (value) => {
    if (value === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = value;
    expect(load).toThrow(/DATABASE_URL/);
  },
);
test("accepts postgres URL scheme", () => {
  process.env.DATABASE_URL = "postgres://unit:unit@postgres:5432/unit";
  expect(load().config.databaseUrl).toBe(process.env.DATABASE_URL);
});

test("uses default port 3002", () => {
  expect(load().config.port).toBe(3002);
});
test("accepts an explicit port", () => {
  process.env.PORT = "4100";
  expect(load().config.port).toBe(4100);
});
test.each(["", "abc", "0", "65536", "1.5", "-1"])("rejects invalid port %s", (value) => {
  process.env.PORT = value;
  expect(load).toThrow(/PORT/);
});

test("validates credential encryption keys at startup", () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = "invalid";
  expect(load).toThrow(/CREDENTIAL_ENCRYPTION_KEY/);
  process.env.CREDENTIAL_ENCRYPTION_KEY = "ab".repeat(32);
  expect(load().config.encryptionKey).toBe(process.env.CREDENTIAL_ENCRYPTION_KEY);
});
