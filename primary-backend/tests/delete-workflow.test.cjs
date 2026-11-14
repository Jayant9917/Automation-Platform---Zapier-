const { createDeleteWorkflowHandler } = require("../src/delete-workflow.ts");
const id = "aa3f9700-a5e5-4af1-97bd-3496ac539e50";
let db, tx, req, res;
beforeEach(() => {
  tx = {
    zap: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    actionRun: { updateMany: jest.fn() },
  };
  db = { $transaction: jest.fn((fn) => fn(tx)) };
  req = { id: "2", params: { zapId: id } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
test("owner deletion marks the workflow and cancels only queued actions atomically", async () => {
  await createDeleteWorkflowHandler(db)(req, res);
  expect(tx.zap.updateMany).toHaveBeenCalledWith({
    where: { id, userId: 2, deletedAt: null },
    data: { deletedAt: expect.any(Date), actionsRevision: { increment: 1 } },
  });
  expect(tx.actionRun.updateMany).toHaveBeenCalledWith({
    where: { zapRun: { zapId: id }, status: { in: ["pending", "retry"] } },
    data: {
      status: "cancelled",
      errorCode: "WORKFLOW_DELETED",
      claimToken: null,
      leaseUntil: null,
    },
  });
  expect(res.json).toHaveBeenCalledWith({ success: true });
});
test("foreign, missing or already deleted workflow is not modified", async () => {
  tx.zap.updateMany.mockResolvedValue({ count: 0 });
  await createDeleteWorkflowHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.actionRun.updateMany).not.toHaveBeenCalled();
});
test("invalid ID and identity are rejected", async () => {
  req.id = "bad";
  await createDeleteWorkflowHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  req.id = "2";
  req.params.zapId = "bad";
  await createDeleteWorkflowHandler(db)(req, res);
  expect(res.status).toHaveBeenLastCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("database failure does not report deletion success", async () => {
  tx.actionRun.updateMany.mockRejectedValue(new Error("private"));
  await createDeleteWorkflowHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private");
});
