const { parseDiscordConnection } = require("../src/connection-secrets.ts");
const url = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123456";
test.each([url, { webhookUrl: url }, url.replace("/api/", "/api/v10/")])(
  "accepts an official Discord webhook %s",
  (value) => {
    expect(parseDiscordConnection(value).webhookUrl).toContain("discord.com/api/");
  },
);
test.each([
  null,
  {},
  "http://discord.com/api/webhooks/123456789012345678/token",
  url.replace("discord.com", "evil.example"),
  url.replace("discord.com", "discord.com.evil.example"),
  url + "?wait=false",
  url + "#secret",
  url.replace("https://", "https://user:pass@"),
  url.replace("discord.com", "discord.com:444"),
  url.replace("/webhooks/", "/users/"),
  url.replace("123456789012345678", "abc"),
  "https://discord.com/api/webhooks/123456789012345678/short",
])("rejects unsafe or malformed URL %s", (value) => {
  expect(() => parseDiscordConnection(value)).toThrow();
});
