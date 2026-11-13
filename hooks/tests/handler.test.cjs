const { createWebhookHandler } = require("../src/handler.ts");
let tx, database, req, res;
beforeEach(() => {
  tx = {
    zapRun: { create: jest.fn().mockResolvedValue({ id: "unit-run" }) },
    zapRunOutbox: { create: jest.fn().mockResolvedValue({ id: "unit-outbox" }) },
  };
  database = { $transaction: jest.fn(callback => callback(tx)) };
  req = { params: { userId: "2", zapId: "unit-zap" }, body: { message: "Unit input" } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  jest.spyOn(console, "error").mockImplementation(() => {});
});
test("creates the run and its outbox through the same transaction callback", async () => {
  await createWebhookHandler(database)(req, res);
  expect(database.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.zapRun.create).toHaveBeenCalledWith({ data: { zapId: "unit-zap", metadata: req.body } });
  expect(tx.zapRunOutbox.create).toHaveBeenCalledWith({ data: { zapRunId: "unit-run" } });
  expect(tx.zapRun.create.mock.invocationCallOrder[0]).toBeLessThan(tx.zapRunOutbox.create.mock.invocationCallOrder[0]);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(res.json).toHaveBeenCalledWith({ success: true });
});
test("does not create an outbox when run creation fails", async () => {
  tx.zapRun.create.mockRejectedValue(new Error("database unavailable"));
  await createWebhookHandler(database)(req, res);
  expect(tx.zapRunOutbox.create).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
});
test("returns failure when the transaction rejects an outbox write", async () => {
  tx.zapRunOutbox.create.mockRejectedValue(new Error("outbox failure"));
  await createWebhookHandler(database)(req, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).not.toHaveBeenCalledWith({ success: true });
});
test("does not respond success before the transaction resolves", async () => {
  let commit;
  database.$transaction.mockImplementation(() => new Promise(resolve => { commit = resolve; }));
  const pending = createWebhookHandler(database)(req, res);
  expect(res.json).not.toHaveBeenCalled();
  commit();
  await pending;
  expect(res.status).toHaveBeenCalledWith(200);
});
