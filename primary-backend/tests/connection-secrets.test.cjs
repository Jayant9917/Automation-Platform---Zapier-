const { generateKeyPairSync } = require("node:crypto");
const { parseSlackConnection, parseGoogleConnection } = require("../src/connection-secrets.ts");
const validKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
  type: "pkcs8",
  format: "pem",
});
test("accepts only a genuine HTTPS Slack incoming-webhook destination", () => {
  expect(parseSlackConnection("https://hooks.slack.com/services/T123/B456/secret")).toEqual({
    webhookUrl: "https://hooks.slack.com/services/T123/B456/secret",
  });
  expect(
    parseSlackConnection({ webhookUrl: "https://hooks.slack.com/services/T123/B456/secret" }),
  ).toHaveProperty("webhookUrl");
});
test.each([
  null,
  42,
  "not a URL",
  "http://hooks.slack.com/services/T/B/secret",
  "https://evil.test/services/T/B/secret",
  "https://hooks.slack.com.evil.test/services/T/B/secret",
  "https://hooks.slack.com:8443/services/T/B/secret",
  "https://user@hooks.slack.com/services/T/B/secret",
  "https://hooks.slack.com/services/T/B/secret?redirect=evil",
  "https://hooks.slack.com/services/T/B/secret#secret",
  "https://hooks.slack.com/other",
])("rejects unsafe webhook destination", (value) =>
  expect(() => parseSlackConnection(value)).toThrow(),
);
test("strips untrusted Google token endpoints and keeps only email/key", () => {
  expect(
    parseGoogleConnection({
      client_email: "service@project.iam.gserviceaccount.com",
      private_key: validKey,
      token_uri: "https://evil.test",
    }),
  ).toEqual({ client_email: "service@project.iam.gserviceaccount.com", private_key: validKey });
});
test.each([
  null,
  {},
  { client_email: "user@gmail.com", private_key: validKey },
  { client_email: "service@project.iam.gserviceaccount.com", private_key: "invalid" },
  { client_email: "service@project.iam.gserviceaccount.com", private_key: "x".repeat(20001) },
])("rejects malformed Google credentials", (value) =>
  expect(() => parseGoogleConnection(value)).toThrow(),
);
test("rejects non-RSA and undersized keys", () => {
  const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }).privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  const small = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  for (const key of [ec, small])
    expect(() =>
      parseGoogleConnection({
        client_email: "service@project.iam.gserviceaccount.com",
        private_key: key,
      }),
    ).toThrow("INVALID_GOOGLE_KEY");
});
