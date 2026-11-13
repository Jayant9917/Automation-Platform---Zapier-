const { generateKeyPairSync } = require("node:crypto");
const { createSlackHandler } = require("../src/actions/slack.ts");
const { createSheetsHandler } = require("../src/actions/google-sheets.ts");
const { postJson } = require("../src/actions/http.ts");
const google = {
  client_email: "service@project.iam.gserviceaccount.com",
  private_key: generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({
    type: "pkcs8",
    format: "pem",
  }),
};
const slack = { webhookUrl: "https://hooks.slack.com/services/T/B/secret" };
const context = { issue: { title: "Bug <!channel>&", number: 42 } };
const settings = {
  spreadsheetId: "sheet-id",
  range: "Sheet1!A:B",
  values: ["{{issue.title}}", "{{issue.number}}"],
};
function response(status = 200, data = { updates: { updatedRows: 1 } }) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: jest.fn().mockReturnValue(null) },
    text: jest.fn().mockResolvedValue("ok"),
    json: jest.fn().mockResolvedValue(data),
  };
}
test("Slack resolves text using a saved channel connection and blocks mention injection", async () => {
  const fetcher = jest.fn().mockResolvedValue(response());
  await createSlackHandler(fetcher).execute({ text: "New: {{issue.title}}" }, context, slack);
  expect(fetcher.mock.calls[0][0]).toBe(slack.webhookUrl);
  const options = fetcher.mock.calls[0][1];
  expect(options.redirect).toBe("manual");
  expect(options.signal).toBeDefined();
  const body = JSON.parse(options.body);
  expect(body.text).toBe("New: Bug &lt;!channel&gt;&amp;");
  expect(body.blocks[0].text).toEqual({
    type: "plain_text",
    text: "New: Bug <!channel>&",
    emoji: false,
  });
});
test("Sheets appends a RAW row with preserved numeric mappings to a fixed Google host", async () => {
  const fetcher = jest.fn().mockResolvedValue(response()),
    token = jest.fn().mockResolvedValue("unit-access-token");
  await createSheetsHandler(fetcher, token).execute(settings, context, google);
  expect(token).toHaveBeenCalledWith(google);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe(
    "https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/Sheet1!A%3AB:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
  );
  expect(options.headers.Authorization).toBe("Bearer unit-access-token");
  expect(options.redirect).toBe("manual");
  expect(JSON.parse(options.body)).toEqual({
    majorDimension: "ROWS",
    values: [["Bug <!channel>&", 42]],
  });
});
test("formula-looking text stays literal with RAW input", async () => {
  const fetcher = jest.fn().mockResolvedValue(response());
  await createSheetsHandler(fetcher, jest.fn().mockResolvedValue("token")).execute(
    { ...settings, values: ["=IMPORTXML(1)"] },
    {},
    google,
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body).values).toEqual([["=IMPORTXML(1)"]]);
});
test.each([null, {}, { text: 4 }, { text: " " }])(
  "Slack rejects invalid config before sending",
  async (value) => {
    const fetcher = jest.fn();
    await expect(createSlackHandler(fetcher).execute(value, {}, slack)).rejects.toMatchObject({
      outcome: "failed",
    });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
test("Slack refuses foreign URLs even if a stored credential is corrupted", async () => {
  const fetcher = jest.fn();
  await expect(
    createSlackHandler(fetcher).execute({ text: "Hi" }, {}, { webhookUrl: "https://evil.test" }),
  ).rejects.toMatchObject({ code: "INVALID_SLACK_CONNECTION" });
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([
  null,
  {},
  { ...settings, spreadsheetId: "https://evil.test" },
  { ...settings, range: "" },
  { ...settings, range: "{{issue.title}}" },
  { ...settings, values: [] },
  { ...settings, values: [42] },
  { ...settings, values: Array(51).fill("Hi") },
  { ...settings, range: "a".repeat(201) },
])("Sheets rejects invalid destinations and row configuration before auth", async (value) => {
  const fetcher = jest.fn(),
    token = jest.fn();
  await expect(
    createSheetsHandler(fetcher, token).execute(value, {}, google),
  ).rejects.toMatchObject({ code: "INVALID_SHEETS_CONFIG" });
  expect(token).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
test("Sheets validates the stored service account before sending", async () => {
  await expect(
    createSheetsHandler(jest.fn(), jest.fn()).execute(settings, {}, {}),
  ).rejects.toMatchObject({ code: "INVALID_GOOGLE_CONNECTION" });
});
test("Sheets does not append when token acquisition fails", async () => {
  const fetcher = jest.fn(),
    token = jest.fn().mockRejectedValue(new Error("auth failed"));
  await expect(
    createSheetsHandler(fetcher, token).execute(settings, context, google),
  ).rejects.toThrow("auth failed");
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([300, 400, 401, 403, 404])(
  "explicit rejection %s is permanent and redirects are never followed",
  async (status) => {
    await expect(
      postJson(jest.fn().mockResolvedValue(response(status)), "https://provider.test", {}),
    ).rejects.toMatchObject({ outcome: "failed", code: "PROVIDER_REJECTED" });
  },
);
test.each([500, 502, 503, 504])(
  "ambiguous write response %s is not automatically retried",
  async (status) => {
    await expect(
      postJson(jest.fn().mockResolvedValue(response(status)), "https://provider.test", {}),
    ).rejects.toMatchObject({ outcome: "needs_attention" });
  },
);
test.each([
  ["120", 120000],
  ["99999", 900000],
  ["bad", 10000],
  [null, 10000],
])("rate limiting respects bounded retry delay", async (header, delay) => {
  const reply = response(429);
  reply.headers.get.mockReturnValue(header);
  await expect(
    postJson(jest.fn().mockResolvedValue(reply), "https://provider.test", {}),
  ).rejects.toMatchObject({ outcome: "retry", retryAfterMs: delay });
});
test("network failures may already have delivered and need attention", async () => {
  await expect(
    postJson(jest.fn().mockRejectedValue(new Error("private detail")), "https://provider.test", {}),
  ).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN", outcome: "needs_attention" });
});
test.each(["unexpected", null])(
  "Slack unexpected successful response requires review",
  async (value) => {
    const reply = response();
    if (value === null) reply.text.mockRejectedValue(new Error("body lost"));
    else reply.text.mockResolvedValue(value);
    await expect(
      createSlackHandler(jest.fn().mockResolvedValue(reply)).execute({ text: "Hi" }, {}, slack),
    ).rejects.toMatchObject({ outcome: "needs_attention" });
  },
);
test.each([{}, { updates: { updatedRows: 0 } }, null])(
  "Sheets uncertain successful response is not retried",
  async (value) => {
    await expect(
      createSheetsHandler(
        jest.fn().mockResolvedValue(response(200, value)),
        jest.fn().mockResolvedValue("token"),
      ).execute(settings, context, google),
    ).rejects.toMatchObject({ outcome: "needs_attention" });
  },
);
