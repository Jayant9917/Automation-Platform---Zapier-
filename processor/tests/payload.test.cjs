const { getEmailPayload } = require("../src/payload.ts");
const row = (actions) => ({ zapRun: { zap: { actions } } });
beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
test("extracts a configured email", () => {
  expect(
    getEmailPayload(
      row([{ actionId: "email", Metadata: { email: "unit@example.test", body: "Hello" } }]),
    ),
  ).toEqual({ to: "unit@example.test", body: "Hello" });
});
test("supports the existing lowercase metadata/type fallback", () => {
  expect(
    getEmailPayload(
      row([{ type: { id: "email" }, metadata: { email: "unit@example.test", body: "Hello" } }]),
    ),
  ).toEqual({ to: "unit@example.test", body: "Hello" });
});
test.each([
  null,
  undefined,
  42,
  {},
  { zapRun: {} },
  { zapRun: { zap: {} } },
  row([]),
  row([{ actionId: "send-sol" }]),
])("returns no email for unrelated/missing input %s", (input) => {
  expect(getEmailPayload(input)).toBeNull();
});
test.each([
  undefined,
  "invalid",
  {},
  { email: "unit@example.test" },
  { body: "Hello" },
  { email: 4, body: "Hello" },
  { email: "unit@example.test", body: 4 },
  { email: "   ", body: "Hello" },
  { email: "unit@example.test", body: " " },
])("rejects unusable metadata %s", (metadata) => {
  expect(getEmailPayload(row([{ actionId: "email", Metadata: metadata }]))).toBeNull();
});
test("retains current single-email selection behavior", () => {
  expect(
    getEmailPayload(
      row([
        { actionId: "other" },
        { actionId: "email", Metadata: { email: "first@example.test", body: "First" } },
        { actionId: "email", Metadata: { email: "second@example.test", body: "Second" } },
      ]),
    ),
  ).toEqual({ to: "first@example.test", body: "First" });
});
