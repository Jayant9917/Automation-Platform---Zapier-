const { dispatchSchedules } = require("../src/scheduler.ts");
const { nextSchedule } = require("../src/schedule-time.ts");
const now = new Date("2026-11-14T09:05:30Z");
test("five-minute slots and daily rollover are strictly in the future", () => {
  expect(nextSchedule({ frequency: "every_5_minutes" }, now).toISOString()).toBe(
    "2026-11-14T09:10:00.000Z",
  );
  expect(nextSchedule({ frequency: "daily", hour: 9, minute: 5 }, now).toISOString()).toBe(
    "2026-11-15T09:05:00.000Z",
  );
  expect(nextSchedule({ frequency: "daily", hour: 10, minute: 0 }, now).toISOString()).toBe(
    "2026-11-14T10:00:00.000Z",
  );
});
function database(claim = 1, active = 1) {
  const timer = {
    workflowId: "workflow",
    frequency: "every_5_minutes",
    hour: 9,
    minute: 0,
    nextRunAt: new Date("2026-11-14T08:00:00Z"),
  };
  const tx = {
    zap: { updateMany: jest.fn().mockResolvedValue({ count: active }) },
    scheduleTrigger: { updateMany: jest.fn().mockResolvedValue({ count: claim }) },
    action: {
      findMany: jest.fn().mockResolvedValue([
        { id: "a", actionId: "email", Metadata: { body: "old" } },
        {
          id: "b",
          actionId: "http.request",
          Metadata: { url: "https://example.com" },
          credentialId: "private-reference",
        },
      ]),
    },
    zapRun: { create: jest.fn() },
  };
  return {
    tx,
    db: {
      scheduleTrigger: { findMany: jest.fn().mockResolvedValue([timer]) },
      $transaction: jest.fn((fn) => fn(tx)),
    },
  };
}
test("one overdue slot creates a run with every action snapshot and skips missed intervals", async () => {
  const { db, tx } = database();
  await dispatchSchedules(db, now);
  expect(tx.scheduleTrigger.updateMany.mock.calls[0][0].data.nextRunAt.toISOString()).toBe(
    "2026-11-14T09:10:00.000Z",
  );
  const data = tx.zapRun.create.mock.calls[0][0].data;
  expect(data.metadata.schedule.scheduledAt).toBe("2026-11-14T08:00:00.000Z");
  expect(data.actionRuns.create).toHaveLength(2);
  expect(data.actionRuns.create[1]).toMatchObject({
    type: "http.request",
    credentialId: "private-reference",
  });
  expect(db.scheduleTrigger.findMany.mock.calls[0][0].where).toMatchObject({
    enabled: true,
    workflow: { deletedAt: null, trigger: { triggerId: "schedule" } },
  });
});
test.each([
  [0, 1],
  [1, 0],
])("does not create a duplicate or deleted workflow run (%s,%s)", async (claim, active) => {
  const { db, tx } = database(claim, active);
  await dispatchSchedules(db, now);
  expect(tx.zapRun.create).not.toHaveBeenCalled();
});
