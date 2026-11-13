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

test("trims the broker list and retains the default topic", () => {
  expect(load().config.brokers).toEqual(["kafka:9092", "second:9093"]);
  expect(load().config.topic).toBe("zap-events");
});
test("accepts IPv6 brokers", () => {
  process.env.KAFKA_BROKERS = "[::1]:9092";
  expect(load().config.brokers).toEqual(["[::1]:9092"]);
});
test.each(["", "kafka:9092,", "kafka", "http://kafka:9092", "kafka:0", "kafka:65536"])(
  "rejects invalid brokers %s",
  (value) => {
    process.env.KAFKA_BROKERS = value;
    expect(load).toThrow(/KAFKA_BROKERS/);
  },
);
test("allows a topic override", () => {
  process.env.KAFKA_TOPIC = " unit-topic ";
  expect(load().config.topic).toBe("unit-topic");
});
test("rejects a blank topic", () => {
  process.env.KAFKA_TOPIC = " ";
  expect(load).toThrow(/KAFKA_TOPIC/);
});

test("defaults to authenticated STARTTLS email", () => {
  expect(load().config.smtp).toMatchObject({
    port: 587,
    secure: false,
    auth: true,
    requireTLS: true,
    from: "unit@example.test",
  });
  expect(load().config.groupId).toBe("main-worker");
});
test("supports implicit TLS and an explicit sender", () => {
  process.env.SMTP_PORT = "465";
  process.env.SMTP_FROM = "sender@example.test";
  expect(load().config.smtp).toMatchObject({
    port: 465,
    secure: true,
    from: "sender@example.test",
  });
});
test("supports explicit internal mail-sink settings without credentials", () => {
  process.env.SMTP_AUTH = "false";
  process.env.SMTP_REQUIRE_TLS = "false";
  process.env.SMTP_FROM = "sender@example.test";
  delete process.env.SMTP_USERNAME;
  delete process.env.SMTP_PASSWORD;
  expect(load().config.smtp).toMatchObject({
    auth: false,
    requireTLS: false,
    user: "",
    password: "",
  });
});
test.each(["SMTP_ENDPOINT", "SMTP_USERNAME", "SMTP_PASSWORD"])(
  "requires %s for normal SMTP",
  (key) => {
    delete process.env[key];
    expect(load).toThrow(key);
  },
);
test.each(["", "abc", "0", "65536"])("rejects invalid SMTP port %s", (value) => {
  process.env.SMTP_PORT = value;
  expect(load).toThrow(/SMTP_PORT/);
});
test.each(["SMTP_AUTH", "SMTP_REQUIRE_TLS"])("rejects invalid boolean %s", (key) => {
  process.env[key] = "maybe";
  expect(load).toThrow(key);
});
test("supports an explicit worker group", () => {
  process.env.KAFKA_GROUP_ID = "unit-worker";
  expect(load().config.groupId).toBe("unit-worker");
});
