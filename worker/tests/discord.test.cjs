const { createDiscordHandler } = require("../src/actions/discord.ts");
const credential = {
  webhookUrl:
    "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123456",
};
const config = { text: "New: {{issue.title}}" },
  context = { issue: { title: "Fix @everyone <@123456789012345678>" } };
function response(status = 200, body = { id: "234567890123456789" }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => "2" },
    json: jest.fn().mockResolvedValue(body),
  };
}
test("sends dynamic content with mentions disabled and waits for confirmation", async () => {
  const fetcher = jest.fn().mockResolvedValue(response());
  await createDiscordHandler(fetcher).execute(config, context, credential);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe(credential.webhookUrl + "?wait=true");
  expect(options.redirect).toBe("manual");
  expect(options.signal).toBeDefined();
  expect(JSON.parse(options.body)).toEqual({
    content: "New: " + context.issue.title,
    allowed_mentions: { parse: [] },
    flags: 4,
  });
  expect(createDiscordHandler(fetcher).credentialProvider).toBe("discord.webhook");
});
test.each([null, {}, { text: 4 }, { text: " " }])(
  "invalid config is not sent %s",
  async (value) => {
    const fetcher = jest.fn();
    await expect(
      createDiscordHandler(fetcher).execute(value, {}, credential),
    ).rejects.toMatchObject({ outcome: "failed" });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
test("invalid credentials are not sent", async () => {
  const fetcher = jest.fn();
  await expect(
    createDiscordHandler(fetcher).execute(config, context, "https://evil.example"),
  ).rejects.toMatchObject({ code: "INVALID_DISCORD_CONNECTION" });
  expect(fetcher).not.toHaveBeenCalled();
});
test("resolved text length is bounded", async () => {
  const fetcher = jest.fn();
  await expect(
    createDiscordHandler(fetcher).execute(
      config,
      { issue: { title: "x".repeat(2000) } },
      credential,
    ),
  ).rejects.toMatchObject({ code: "RESOLVED_VALUE_TOO_LONG" });
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([
  [429, "retry"],
  [401, "failed"],
  [404, "failed"],
  [302, "failed"],
  [500, "needs_attention"],
])("maps response %s to %s", async (status, outcome) => {
  const fetcher = jest.fn().mockResolvedValue(response(status));
  await expect(
    createDiscordHandler(fetcher).execute(config, context, credential),
  ).rejects.toMatchObject({ outcome });
});
test("network ambiguity is not blindly retried", async () => {
  await expect(
    createDiscordHandler(jest.fn().mockRejectedValue(new Error("timeout"))).execute(
      config,
      context,
      credential,
    ),
  ).rejects.toMatchObject({ outcome: "needs_attention" });
});
test.each([null, {}, { id: 42 }, { id: "bad" }])(
  "missing message confirmation needs attention %s",
  async (body) => {
    await expect(
      createDiscordHandler(jest.fn().mockResolvedValue(response(200, body))).execute(
        config,
        context,
        credential,
      ),
    ).rejects.toMatchObject({ code: "DISCORD_OUTCOME_UNKNOWN" });
  },
);
test("invalid JSON confirmation needs attention", async () => {
  const result = response();
  result.json.mockRejectedValue(new Error());
  await expect(
    createDiscordHandler(jest.fn().mockResolvedValue(result)).execute(config, context, credential),
  ).rejects.toMatchObject({ outcome: "needs_attention" });
});
