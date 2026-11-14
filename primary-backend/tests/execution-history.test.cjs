const { createExecutionHistoryHandler } = require("../src/execution-history.ts");
let db, req, res;
beforeEach(() => {
  db = {
    zap: { findFirst: jest.fn().mockResolvedValue({ id: "zap" }) },
    zapRun: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: "run", actionRuns: [{ status: "succeeded" }, { status: "failed" }] },
        ]),
    },
  };
  req = { id: "2", params: { zapId: "zap" } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
test("scopes history to the owner and returns independent statuses", async () => {
  await createExecutionHistoryHandler(db)(req, res);
  expect(db.zap.findFirst).toHaveBeenCalledWith({
    where: { id: "zap", userId: 2, deletedAt: null },
    select: { id: true },
  });
  expect(res.json).toHaveBeenCalledWith({
    runs: [
      {
        id: "run",
        actionRuns: [{ status: "succeeded" }, { status: "failed" }],
        status: "partially_failed",
      },
    ],
  });
  const select = db.zapRun.findMany.mock.calls[0][0].select;
  expect(select.metadata).toBeUndefined();
  expect(select.actionRuns.select.config).toBeUndefined();
});
test.each([undefined, "bad", "0"])("rejects invalid user %s", async (id) => {
  req.id = id;
  await createExecutionHistoryHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(db.zapRun.findMany).not.toHaveBeenCalled();
});
test("does not expose another user's workflow", async () => {
  db.zap.findFirst.mockResolvedValue(null);
  await createExecutionHistoryHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(db.zapRun.findMany).not.toHaveBeenCalled();
});
