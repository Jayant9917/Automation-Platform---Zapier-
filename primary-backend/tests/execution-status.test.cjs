const { getExecutionStatus } = require("../src/execution-status.ts");
test.each([
  [[], "pending"],
  [["pending"], "running"],
  [["running", "failed"], "running"],
  [["retry", "succeeded"], "running"],
  [["succeeded", "succeeded"], "succeeded"],
  [["succeeded", "failed"], "partially_failed"],
  [["failed", "failed"], "failed"],
  [["needs_attention", "succeeded"], "needs_attention"],
])("derives workflow summary from %j", (statuses, expected) =>
  expect(getExecutionStatus(statuses)).toBe(expected),
);
