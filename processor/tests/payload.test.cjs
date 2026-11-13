const { createActionJob } = require("../src/payload.ts");
test("publishes immutable references rather than provider-specific data", () => {
  expect(
    createActionJob({ id: "action", zapRunId: "run", config: { password: "secret" } }),
  ).toEqual({ version: 1, executionId: "run", actionExecutionId: "action" });
});
