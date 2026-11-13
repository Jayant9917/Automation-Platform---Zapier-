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
afterEach(() => { process.env = originalEnv; });

test("accepts a PostgreSQL URL", () => {
  expect(load().config.databaseUrl).toBe(process.env.DATABASE_URL);
});
test.each([undefined, "", "   ", "https://wrong.test/db", "postgresql://postgres/"])("rejects invalid database URL %s", value => {
  if (value === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = value;
  expect(load).toThrow(/DATABASE_URL/);
});
test("accepts postgres URL scheme", () => {
  process.env.DATABASE_URL = "postgres://unit:unit@postgres:5432/unit";
  expect(load().config.databaseUrl).toBe(process.env.DATABASE_URL);
});

test("trims the broker list and retains the default topic", () => {
  expect(load().config.brokers).toEqual(["kafka:9092", "second:9093"]);
  expect(load().config.topic).toBe("zap-events");
});
test("accepts IPv6 brokers", () => {
  process.env.KAFKA_BROKERS = "[::1]:9092";
  expect(load().config.brokers).toEqual(["[::1]:9092"]);
});
test.each(["", "kafka:9092,", "kafka", "http://kafka:9092", "kafka:0", "kafka:65536"])("rejects invalid brokers %s", value => {
  process.env.KAFKA_BROKERS = value;
  expect(load).toThrow(/KAFKA_BROKERS/);
});
test("allows a topic override", () => {
  process.env.KAFKA_TOPIC = " unit-topic ";
  expect(load().config.topic).toBe("unit-topic");
});
test("rejects a blank topic", () => {
  process.env.KAFKA_TOPIC = " ";
  expect(load).toThrow(/KAFKA_TOPIC/);
});
