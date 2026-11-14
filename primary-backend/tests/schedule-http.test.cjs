const { ScheduleSchema, createScheduleHandlers } = require("../src/schedule-setup.ts");
const { ZapCreateSchema } = require("../src/types.ts");
const { ActionSchema } = require("../src/action-config.ts");
const { validateConnectionSecret } = require("../src/connections.ts");
const connection = "aa3f9700-a5e5-4af1-97bd-3496ac539e50";
test("accepts schedule workflows and an encrypted HTTP credential reference", () => {
  expect(
    ZapCreateSchema.safeParse({
      availableTriggerId: "schedule",
      schedule: { frequency: "daily", hour: 17, minute: 30 },
      actions: [
        {
          availableActionId: "http.request",
          credentialId: connection,
          actionMetadata: {
            method: "POST",
            url: "https://example.com/events",
            body: '{"title":"{{issue.title}}"}',
          },
        },
      ],
    }).success,
  ).toBe(true);
  expect(
    validateConnectionSecret("http.headers", {
      origin: "https://example.com",
      headers: { "X-Api-Key": "private" },
    }),
  ).toEqual({ origin: "https://example.com", headers: { "x-api-key": "private" } });
});
test.each([
  { frequency: "daily", hour: 24 },
  { frequency: "daily", minute: 60 },
  { frequency: "secondly" },
])("rejects bad schedule %j", (input) =>
  expect(ScheduleSchema.safeParse(input).success).toBe(false),
);
test.each([
  "http://example.com",
  "https://user:pass@example.com",
  "https://example.com:8443",
  "https://{{name}}/api",
])("rejects unsafe URL %s", (url) =>
  expect(
    ActionSchema.safeParse({
      availableActionId: "http.request",
      credentialId: connection,
      actionMetadata: { method: "POST", url, body: "{}" },
    }).success,
  ).toBe(false),
);
test("schedule changes require ownership and a schedule trigger", async () => {
  const tx = {
    zap: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    scheduleTrigger: { update: jest.fn() },
  };
  const db = { $transaction: (fn) => fn(tx) },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createScheduleHandlers(db).save(
    { id: "2", params: { zapId: "workflow" }, body: { frequency: "daily", hour: 9, minute: 0 } },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.scheduleTrigger.update).not.toHaveBeenCalled();
  expect(tx.zap.updateMany.mock.calls[0][0].where).toMatchObject({
    userId: 2,
    deletedAt: null,
    trigger: { triggerId: "schedule" },
  });
});

test.each([true, false])("reads only an owner's schedule (exists %s)", async (exists) => {
  const db = {
      scheduleTrigger: {
        findFirst: jest.fn().mockResolvedValue(exists ? { frequency: "daily" } : null),
      },
    },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createScheduleHandlers(db).get({ id: "2", params: { zapId: "workflow" } }, res);
  expect(db.scheduleTrigger.findFirst.mock.calls[0][0].where.workflow).toEqual({
    userId: 2,
    deletedAt: null,
  });
  if (exists) expect(res.json).toHaveBeenCalledWith({ schedule: { frequency: "daily" } });
  else expect(res.status).toHaveBeenCalledWith(404);
});
test("saves timing and pause state with a fresh next-run time", async () => {
  const tx = {
    zap: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    scheduleTrigger: { update: jest.fn().mockResolvedValue({ enabled: false }) },
  };
  const db = { $transaction: (fn) => fn(tx) },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createScheduleHandlers(db).save(
    {
      id: "2",
      params: { zapId: "workflow" },
      body: { frequency: "daily", hour: 9, minute: 0, enabled: false },
    },
    res,
  );
  expect(tx.scheduleTrigger.update.mock.calls[0][0].data).toMatchObject({
    enabled: false,
    nextRunAt: expect.any(Date),
  });
  expect(res.json).toHaveBeenCalledWith({ schedule: { enabled: false } });
});
test("rejects invalid schedule settings before database access", async () => {
  const db = { $transaction: jest.fn() },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createScheduleHandlers(db).save({ body: { frequency: "every_second" } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("database failures return safe schedule errors", async () => {
  const db = {
    scheduleTrigger: { findFirst: jest.fn().mockRejectedValue(new Error("private")) },
    $transaction: jest.fn().mockRejectedValue(new Error("private")),
  };
  const req = { id: "2", params: { zapId: "workflow" }, body: { frequency: "every_5_minutes" } },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createScheduleHandlers(db).get(req, res);
  await createScheduleHandlers(db).save(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private");
});

test("publishing a schedule persists the timer in the workflow transaction", async () => {
  const { createWorkflowActionHandlers } = require("../src/workflow-actions.ts");
  const tx = {
    zap: { create: jest.fn().mockResolvedValue({ id: "workflow" }), update: jest.fn() },
    trigger: { create: jest.fn().mockResolvedValue({ id: "trigger" }) },
    scheduleTrigger: { create: jest.fn() },
  };
  const db = { $transaction: (fn) => fn(tx) },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createWorkflowActionHandlers(db).create(
    {
      id: "2",
      body: {
        availableTriggerId: "schedule",
        schedule: { frequency: "every_5_minutes" },
        actions: [
          {
            availableActionId: "email",
            actionMetadata: { email: "unit@test.dev", body: "Scheduled run" },
          },
        ],
      },
    },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(201);
  expect(tx.scheduleTrigger.create.mock.calls[0][0].data).toMatchObject({
    workflowId: "workflow",
    frequency: "every_5_minutes",
    enabled: true,
    nextRunAt: expect.any(Date),
  });
});
test("publishing a schedule without timing settings is rejected", async () => {
  const { createWorkflowActionHandlers } = require("../src/workflow-actions.ts");
  const db = { $transaction: jest.fn() },
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createWorkflowActionHandlers(db).create(
    {
      id: "2",
      body: {
        availableTriggerId: "schedule",
        actions: [
          { availableActionId: "email", actionMetadata: { email: "unit@test.dev", body: "Hi" } },
        ],
      },
    },
    res,
  );
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
