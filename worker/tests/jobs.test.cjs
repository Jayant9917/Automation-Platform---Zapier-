const { parseJob } = require("../src/jobs.ts");
test("reads reference jobs without copying extra data", () => {
  expect(
    parseJob(
      JSON.stringify({ version: 1, executionId: "r", actionExecutionId: "a", secret: "ignore" }),
    ),
  ).toEqual({ version: 1, executionId: "r", actionExecutionId: "a" });
});
test("accepts queued legacy email payloads", () => {
  expect(parseJob('{"to":"unit@example.test","body":"Hi"}')).toEqual({
    to: "unit@example.test",
    body: "Hi",
  });
});
test.each([
  "",
  "bad",
  "null",
  "42",
  "[]",
  "{}",
  '{"version":2,"to":"a","body":"b"}',
  '{"version":1,"executionId":" ","actionExecutionId":"a"}',
  '{"version":1,"executionId":"r","actionExecutionId":3}',
  '{"version":1,"executionId":"r","actionExecutionId":" "}',
  '{"to":" ","body":"Hi"}',
  '{"to":"a","body":" "}',
  '{"to":"a","body":5}',
])("rejects malformed jobs %s", (raw) => expect(() => parseJob(raw)).toThrow());
