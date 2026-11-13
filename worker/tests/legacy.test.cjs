const { executeLegacyEmail } = require("../src/legacy.ts");
const { ActionError } = require("../src/actions/registry.ts");
let db, handler;
beforeEach(() => {
  db = { legacyJob: { upsert: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
  handler = { execute: jest.fn() };
});
const run = () =>
  executeLegacyEmail(db, "topic:0:1", { to: "unit@example.test", body: "Hi" }, handler);
test("uses stable receipts and the email handler for old messages", async () => {
  await run();
  expect(db.legacyJob.upsert).toHaveBeenCalledWith({
    where: { id: "topic:0:1" },
    create: { id: "topic:0:1" },
    update: {},
  });
  expect(handler.execute).toHaveBeenCalledWith({ email: "unit@example.test", body: "Hi" }, {});
  expect(db.legacyJob.updateMany.mock.calls.at(-1)[0].data.status).toBe("succeeded");
});
test("does not resend completed or already running legacy messages", async () => {
  db.legacyJob.updateMany.mockResolvedValue({ count: 0 });
  await run();
  expect(handler.execute).not.toHaveBeenCalled();
});
test.each([
  [new ActionError("BAD", "failed"), "failed"],
  [new ActionError("TEMP", "retry"), "needs_attention"],
  [new Error("secret"), "needs_attention"],
])("retains legacy failures for review", async (error, status) => {
  handler.execute.mockRejectedValue(error);
  await run();
  expect(db.legacyJob.updateMany.mock.calls.at(-1)[0].data.status).toBe(status);
});
