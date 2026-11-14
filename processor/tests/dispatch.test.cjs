const { dispatchActions } = require("../src/dispatch.ts");
const now = new Date("2026-11-13T00:00:00Z");
let db, tx, publish;
beforeEach(() => {
  tx = {
    zapRun: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "run",
        actionRuns: [],
        zap: {
          actions: [
            { id: "email-1", actionId: "email", Metadata: { email: "one@test.dev" } },
            { id: "email-2", actionId: "email", Metadata: { email: "two@test.dev" } },
          ],
        },
      }),
    },
    actionRun: { upsert: jest.fn() },
    zapRunOutbox: { deleteMany: jest.fn() },
  };
  db = {
    legacyJob: { updateMany: jest.fn() },
    $transaction: jest.fn((fn) => fn(tx)),
    zapRunOutbox: { findMany: jest.fn().mockResolvedValue([]) },
    actionRun: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  publish = jest.fn();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
test("backfills every legacy action with separate stable identities", async () => {
  db.zapRunOutbox.findMany.mockResolvedValue([{ id: "outbox", zapRunId: "run" }]);
  await dispatchActions(db, publish, now);
  expect(tx.actionRun.upsert).toHaveBeenCalledTimes(2);
  expect(tx.actionRun.upsert.mock.calls.map(([arg]) => arg.create.actionId)).toEqual([
    "email-1",
    "email-2",
  ]);
  expect(tx.zapRunOutbox.deleteMany).toHaveBeenCalled();
});
test("does not replace snapshots with edited workflow config", async () => {
  db.zapRunOutbox.findMany.mockResolvedValue([{ id: "outbox", zapRunId: "run" }]);
  (await tx.zapRun.findUniqueOrThrow()).actionRuns = [{ id: "snapshot" }];
  await dispatchActions(db, publish, now);
  expect(tx.actionRun.upsert).not.toHaveBeenCalled();
});
test("does not retire outbox when snapshot creation fails", async () => {
  db.zapRunOutbox.findMany.mockResolvedValue([{ id: "outbox", zapRunId: "run" }]);
  tx.actionRun.upsert.mockRejectedValue(new Error("write failed"));
  await expect(dispatchActions(db, publish, now)).rejects.toThrow("write failed");
  expect(tx.zapRunOutbox.deleteMany).not.toHaveBeenCalled();
});
test("expired worker leases require review rather than automatic resend", async () => {
  await dispatchActions(db, publish, now);
  expect(db.actionRun.updateMany.mock.calls[0][0]).toMatchObject({
    where: { status: "running", leaseUntil: { lte: now } },
    data: { status: "needs_attention", errorCode: "WORKER_LEASE_EXPIRED" },
  });
});
test("publishes one reference job for each due action", async () => {
  db.actionRun.findMany.mockResolvedValue([
    { id: "a", zapRunId: "run" },
    { id: "b", zapRunId: "run" },
  ]);
  await dispatchActions(db, publish, now);
  expect(publish.mock.calls.map(([job]) => job.actionExecutionId)).toEqual(["a", "b"]);
  expect(db.actionRun.findMany.mock.calls[0][0].where).toMatchObject({
    status: { in: ["pending", "retry"] },
    nextAttemptAt: { lte: now },
    dispatchAfter: { lte: now },
  });
});
test("another processor's lease prevents duplicate publication", async () => {
  db.actionRun.findMany.mockResolvedValue([{ id: "a", zapRunId: "run" }]);
  db.actionRun.updateMany.mockResolvedValue({ count: 0 });
  await dispatchActions(db, publish, now);
  expect(publish).not.toHaveBeenCalled();
});
test("partial publication failure retains durable work and continues siblings", async () => {
  db.actionRun.findMany.mockResolvedValue([
    { id: "a", zapRunId: "run" },
    { id: "b", zapRunId: "run" },
  ]);
  publish.mockRejectedValueOnce(new Error("Kafka unavailable"));
  await dispatchActions(db, publish, now);
  expect(publish).toHaveBeenCalledTimes(2);
  expect(
    db.actionRun.updateMany.mock.calls.find(([args]) => args.data.dispatchAfter)[0].data
      .dispatchAfter,
  ).toEqual(new Date(now.getTime() + 30000));
});

test("backfills malformed legacy config for explicit handler failure", async () => {
  db.zapRunOutbox.findMany.mockResolvedValue([{ id: "outbox", zapRunId: "run" }]);
  (await tx.zapRun.findUniqueOrThrow()).zap.actions[0].Metadata = null;
  await dispatchActions(db, publish, now);
  expect(tx.actionRun.upsert.mock.calls[0][0].create.config).toEqual({});
});

test("deleted legacy workflows do not backfill new actions", async () => {
  db.zapRunOutbox.findMany.mockResolvedValue([{ id: "old", zapRunId: "run" }]);
  const run = await tx.zapRun.findUniqueOrThrow();
  run.zap.deletedAt = now;
  await dispatchActions(db, publish, now);
  expect(tx.actionRun.upsert).not.toHaveBeenCalled();
  expect(tx.zapRunOutbox.deleteMany).toHaveBeenCalled();
  expect(db.actionRun.findMany.mock.calls[0][0].where.zapRun).toEqual({ zap: { deletedAt: null } });
});

test("cancels any queued run committed after workflow deletion", async () => {
  await dispatchActions(db, publish, now);
  expect(db.actionRun.updateMany).toHaveBeenCalledWith({
    where: { status: { in: ["pending", "retry"] }, zapRun: { zap: { deletedAt: { not: null } } } },
    data: {
      status: "cancelled",
      errorCode: "WORKFLOW_DELETED",
      claimToken: null,
      leaseUntil: null,
    },
  });
});
