const { getHandler, ActionError } = require("../src/actions/registry.ts");
const { createEmailHandler } = require("../src/actions/email.ts");
test("registry selects a handler and refuses inherited properties", () => {
  const email = { execute: jest.fn() };
  expect(getHandler({ email }, "email")).toBe(email);
  for (const type of ["slack", "toString", "__proto__"]) {
    expect(() => getHandler({ email }, type)).toThrow("UNSUPPORTED_ACTION");
  }
});
test("email handler preserves recipient and body", async () => {
  const send = jest.fn();
  await createEmailHandler(send).execute({ email: "unit@example.test", body: "Hello" }, {});
  expect(send).toHaveBeenCalledWith("unit@example.test", "Hello");
});
test.each([
  null,
  {},
  { email: "bad", body: "Hello" },
  { email: "unit@example.test", body: " " },
  { email: "a@example.test,b@example.test", body: "Hi" },
  { email: "a@example.test", body: 3 },
])("rejects invalid settings before sending %j", async (config) => {
  const send = jest.fn();
  await expect(createEmailHandler(send).execute(config, {})).rejects.toMatchObject({
    outcome: "failed",
  });
  expect(send).not.toHaveBeenCalled();
});
test.each([
  [{ responseCode: 421 }, "retry"],
  [{ code: "ECONNREFUSED" }, "retry"],
  [{ code: "EDNS" }, "retry"],
  [{ code: "EAUTH" }, "failed"],
  [{ responseCode: 550 }, "failed"],
  [{ code: "ETIMEDOUT" }, "needs_attention"],
  [{ code: "ECONNRESET" }, "needs_attention"],
  [null, "needs_attention"],
])("classifies SMTP failures without leaking provider details %j", async (error, outcome) => {
  const send = jest.fn().mockRejectedValue(error);
  await expect(
    createEmailHandler(send).execute({ email: "unit@example.test", body: "Hi" }, {}),
  ).rejects.toMatchObject({ outcome });
});
test("failure is a normal Error with a safe code", () => {
  expect(new ActionError("SAFE", "failed")).toBeInstanceOf(Error);
});

test("email interpolates recipient, subject, and body before SMTP", async () => {
  const send = jest.fn();
  await createEmailHandler(send).execute(
    {
      email: "{{recipient.email}}",
      subject: "Issue: {{issue.title}}",
      body: "#{{issue.number}} {{issue.html_url}}",
    },
    {
      recipient: { email: "unit@test.dev" },
      issue: { title: "Bug", number: 42, html_url: "https://github.com/owner/repo/issues/42" },
    },
  );
  expect(send).toHaveBeenCalledWith(
    "unit@test.dev",
    "#42 https://github.com/owner/repo/issues/42",
    "Issue: Bug",
  );
});
test.each([
  { subject: 42 },
  { subject: " " },
  { subject: "Hi\nBcc: attack" },
  { email: "{{issue.title}}" },
])("rendered headers are validated", async (change) => {
  const send = jest.fn();
  await expect(
    createEmailHandler(send).execute(
      { email: "unit@test.dev", body: "Hi", ...change },
      { issue: { title: "not an email" } },
    ),
  ).rejects.toMatchObject({ outcome: "failed" });
  expect(send).not.toHaveBeenCalled();
});
