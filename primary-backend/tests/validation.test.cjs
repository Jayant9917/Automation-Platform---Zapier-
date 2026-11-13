const { SignupSchema, SigninSchema, ZapCreateSchema } = require("../src/types.ts");
test("accepts a valid signup", () => {
  expect(
    SignupSchema.safeParse({ username: "user@example.test", password: "secret123", name: "User" })
      .success,
  ).toBe(true);
});
test.each([
  { username: "invalid", password: "secret123", name: "User" },
  { username: "user@example.test", password: "short", name: "User" },
  { username: "user@example.test", password: "secret123" },
])("rejects invalid signup %s", (input) => {
  expect(SignupSchema.safeParse(input).success).toBe(false);
});
test("requires credentials when signing in", () => {
  expect(
    SigninSchema.safeParse({ username: "user@example.test", password: "secret123" }).success,
  ).toBe(true);
  expect(SigninSchema.safeParse({ username: "user@example.test" }).success).toBe(false);
});
test("accepts a workflow with action metadata", () => {
  expect(
    ZapCreateSchema.safeParse({
      availableTriggerId: "webhook",
      actions: [
        {
          availableActionId: "email",
          actionMetadata: { email: "user@example.test", body: "Hello" },
        },
      ],
    }).success,
  ).toBe(true);
});
test.each([
  { actions: [] },
  { availableTriggerId: "webhook", actions: [{ availableActionId: "email" }] },
  { availableTriggerId: "webhook", actions: "email" },
])("rejects malformed workflow structure %s", (input) => {
  expect(ZapCreateSchema.safeParse(input).success).toBe(false);
});
