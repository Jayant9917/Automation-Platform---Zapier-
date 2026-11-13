const { ActionSchema, ActionsSchema, spreadsheetId } = require("../src/action-config.ts");
const connection = "003f9700-a5e5-4af1-97bd-3496ac539e50";
const email = {
  availableActionId: "email",
  actionMetadata: { email: "unit@test.dev", body: "{{issue.title}}" },
};
test("preserves old email settings and supplies a default subject", () =>
  expect(ActionSchema.parse(email).actionMetadata.subject).toBe("Hello from workflow"));
test("accepts dynamic recipients and supported provider connections", () => {
  expect(
    ActionSchema.safeParse({
      ...email,
      actionMetadata: { email: "{{recipient.email}}", body: "Hi", subject: "{{issue.title}}" },
    }).success,
  ).toBe(true);
  expect(
    ActionSchema.safeParse({
      availableActionId: "slack.send_message",
      credentialId: connection,
      actionMetadata: { text: "{{issue.title}}" },
    }).success,
  ).toBe(true);
  expect(
    ActionSchema.parse({
      availableActionId: "google_sheets.append_row",
      credentialId: connection,
      actionMetadata: {
        spreadsheetId: "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=0",
        range: "Sheet1!A:B",
        values: ["{{issue.number}}", ""],
      },
    }).actionMetadata.spreadsheetId,
  ).toBe("sheet-id");
});
test.each(["sheet-id", "https://docs.google.com/spreadsheets/d/sheet-id/edit"])(
  "normalizes a spreadsheet selection",
  (value) => expect(spreadsheetId(value)).toBe("sheet-id"),
);
test.each([
  "bad url",
  "https://evil.test/spreadsheets/d/sheet-id/edit",
  "http://docs.google.com/spreadsheets/d/sheet-id",
  "https://user@docs.google.com/spreadsheets/d/sheet-id",
  "https://docs.google.com/other",
])("rejects foreign spreadsheet URL", (value) =>
  expect(() => spreadsheetId(value)).toThrow("INVALID_SPREADSHEET"),
);
test.each([
  { ...email, actionMetadata: { email: "bad", body: "Hi" } },
  { ...email, actionMetadata: { email: "unit@test.dev", body: " ", subject: "Hi" } },
  { ...email, actionMetadata: { email: "unit@test.dev", body: "{{constructor}}" } },
  { ...email, actionMetadata: { email: "unit@test.dev", body: "Hi", subject: "Hi\nBcc: other" } },
  { ...email, credentialId: connection },
  { ...email, actionMetadata: { ...email.actionMetadata, webhookUrl: "secret" } },
  { availableActionId: "slack.send_message", actionMetadata: { text: "Hi" } },
  {
    availableActionId: "google_sheets.append_row",
    credentialId: connection,
    actionMetadata: { spreadsheetId: "https://evil.test", range: "Sheet1!A:B", values: ["Hi"] },
  },
  {
    availableActionId: "google_sheets.append_row",
    credentialId: connection,
    actionMetadata: { spreadsheetId: "sheet-id", range: "{{issue.title}}", values: [] },
  },
])("rejects invalid or secret-bearing action configuration", (value) =>
  expect(ActionSchema.safeParse(value).success).toBe(false),
);
test("enforces workflow action count", () => {
  expect(ActionsSchema.safeParse([]).success).toBe(false);
  expect(ActionsSchema.safeParse(Array(21).fill(email)).success).toBe(false);
});
