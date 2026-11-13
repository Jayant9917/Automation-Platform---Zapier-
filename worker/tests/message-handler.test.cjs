jest.mock("../src/execution.ts", () => ({ executeAction: jest.fn() }));
jest.mock("../src/legacy.ts", () => ({ executeLegacyEmail: jest.fn() }));
const { executeAction } = require("../src/execution.ts");
const { executeLegacyEmail } = require("../src/legacy.ts");
const { handleMessage } = require("../src/message-handler.ts");
let commit;
beforeEach(() => {
  commit = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
const input = (raw) => ({
  topic: "events",
  partition: 1,
  message: { value: raw === null ? null : Buffer.from(raw), offset: "9007199254740993" },
});
test("commits a precise 64-bit next offset only after execution", async () => {
  await handleMessage(
    {},
    {},
    input('{"version":1,"executionId":"r","actionExecutionId":"a"}'),
    commit,
  );
  expect(executeAction).toHaveBeenCalled();
  expect(commit).toHaveBeenCalledWith([
    { topic: "events", partition: 1, offset: "9007199254740994" },
  ]);
});
test.each([null, "bad", "{}"])("poison message does not block a partition %s", async (raw) => {
  await handleMessage({}, {}, input(raw), commit);
  expect(executeAction).not.toHaveBeenCalled();
  expect(commit).toHaveBeenCalled();
});
test("old email uses stable coordinates", async () => {
  await handleMessage({}, { email: {} }, input('{"to":"a@test.dev","body":"Hi"}'), commit);
  expect(executeLegacyEmail).toHaveBeenCalledWith(
    {},
    "legacy:events:1:9007199254740993",
    { to: "a@test.dev", body: "Hi" },
    {},
  );
});
test("does not commit when persistence fails", async () => {
  executeAction.mockRejectedValueOnce(new Error("offline"));
  await expect(
    handleMessage({}, {}, input('{"version":1,"executionId":"r","actionExecutionId":"a"}'), commit),
  ).rejects.toThrow("offline");
  expect(commit).not.toHaveBeenCalled();
});
