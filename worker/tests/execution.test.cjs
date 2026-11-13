const { executeAction } = require("../src/execution.ts");
const { ActionError } = require("../src/actions/registry.ts");
const now = new Date("2026-11-13T00:00:00Z");
const job = { version: 1, executionId: "run", actionExecutionId: "action" };
let db, handler;
beforeEach(() => {
  db = {
    actionRun: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: "action",
        zapRunId: "run",
        type: "email",
        attempts: 1,
        config: { email: "unit@example.test", body: "Hi" },
        zapRun: { metadata: { issue: 42 }, zap: { userId: 2 } },
      }),
    },
  };
  handler = { execute: jest.fn().mockResolvedValue(undefined) };
});
const execute = () => executeAction(db, job, { email: handler }, () => now);
const saved = () => db.actionRun.updateMany.mock.calls.at(-1)[0];
test("claims before executing and saves success with the claim token", async () => {
  await execute();
  expect(db.actionRun.updateMany.mock.calls[0][0]).toMatchObject({
    where: {
      id: "action",
      zapRunId: "run",
      status: { in: ["pending", "retry"] },
      attempts: { lt: 3 },
    },
    data: { status: "running", attempts: { increment: 1 } },
  });
  expect(handler.execute).toHaveBeenCalledWith(
    { email: "unit@example.test", body: "Hi" },
    { issue: 42, execution: { id: "run", actionId: "action" } },
    undefined,
  );
  const token = db.actionRun.updateMany.mock.calls[0][0].data.claimToken;
  expect(saved()).toMatchObject({
    where: { claimToken: token },
    data: { status: "succeeded", errorCode: null },
  });
});
test("does not execute duplicate, completed, or not-yet-due jobs", async () => {
  db.actionRun.updateMany.mockResolvedValue({ count: 0 });
  await execute();
  expect(handler.execute).not.toHaveBeenCalled();
  expect(db.actionRun.findUniqueOrThrow).not.toHaveBeenCalled();
});
test.each([
  [1, 10000],
  [2, 20000],
])("schedules durable retry after attempt %s", async (attempts, delay) => {
  const run = await db.actionRun.findUniqueOrThrow();
  run.attempts = attempts;
  handler.execute.mockRejectedValue(new ActionError("UNAVAILABLE", "retry"));
  await execute();
  expect(saved().data).toMatchObject({
    status: "retry",
    nextAttemptAt: new Date(now.getTime() + delay),
  });
});
test("stops after three attempts", async () => {
  (await db.actionRun.findUniqueOrThrow()).attempts = 3;
  handler.execute.mockRejectedValue(new ActionError("UNAVAILABLE", "retry"));
  await execute();
  expect(saved().data).toMatchObject({ status: "failed", errorCode: "RETRY_LIMIT_REACHED" });
});
test.each([
  [new ActionError("BAD_CONFIG", "failed"), "failed", "BAD_CONFIG"],
  [new ActionError("UNCERTAIN", "needs_attention"), "needs_attention", "UNCERTAIN"],
  [new Error("private provider details"), "needs_attention", "ACTION_OUTCOME_UNKNOWN"],
])("persists safe failure %s", async (error, status, errorCode) => {
  handler.execute.mockRejectedValue(error);
  await execute();
  expect(saved().data).toMatchObject({ status, errorCode });
});
test("unknown action fails explicitly", async () => {
  await executeAction(db, job, {}, () => now);
  expect(saved().data).toMatchObject({ status: "failed", errorCode: "UNSUPPORTED_ACTION" });
});
test("database failure after sending propagates instead of being recorded as a send failure", async () => {
  db.actionRun.updateMany
    .mockResolvedValueOnce({ count: 1 })
    .mockRejectedValueOnce(new Error("DB unavailable"));
  await expect(execute()).rejects.toThrow("DB unavailable");
  expect(db.actionRun.updateMany).toHaveBeenCalledTimes(2);
});
test("claim failure prevents external effects", async () => {
  db.actionRun.updateMany.mockRejectedValue(new Error("offline"));
  await expect(execute()).rejects.toThrow("offline");
  expect(handler.execute).not.toHaveBeenCalled();
});
test("one failed action does not change successful sibling state", async () => {
  handler.execute.mockRejectedValueOnce(new ActionError("REJECTED", "failed"));
  await execute();
  await executeAction(db, { ...job, actionExecutionId: "sibling" }, { email: handler }, () => now);
  expect(handler.execute).toHaveBeenCalledTimes(2);
  expect(db.actionRun.updateMany.mock.calls[1][0].data.status).toBe("failed");
  expect(db.actionRun.updateMany.mock.calls[2][0].where.id).toBe("sibling");
  expect(saved().data.status).toBe("succeeded");
});

test("retry delay starts after the provider response, not before the network call", async () => {
  handler.execute.mockRejectedValue(new ActionError("TEMP", "retry"));
  const finished = new Date(now.getTime() + 60000);
  const clock = jest.fn().mockReturnValueOnce(now).mockReturnValue(finished);
  await executeAction(db, job, { email: handler }, clock);
  expect(saved().data.nextAttemptAt).toEqual(new Date(finished.getTime() + 10000));
});

const { encryptSecret, credentialContext } = require("../src/credentials.ts");
const { TemplateError } = require("../src/templates.ts");
const key = "ab".repeat(32);
async function connected() {
  const run = await db.actionRun.findUniqueOrThrow();
  run.credentialId = "connection";
  const row = { id: "connection", ownerId: 2, provider: "slack.webhook" };
  db.credential = {
    findFirst: jest.fn().mockResolvedValue({
      ...row,
      encryptedSecret: encryptSecret(
        JSON.stringify({ webhookUrl: "unit-secret" }),
        key,
        credentialContext(row),
      ),
    }),
  };
  handler.credentialProvider = "slack.webhook";
  return run;
}
test("checks connection ownership/provider/revocation again at execution time", async () => {
  await connected();
  await executeAction(db, job, { email: handler }, () => now, key);
  expect(db.credential.findFirst).toHaveBeenCalledWith({
    where: { id: "connection", ownerId: 2, provider: "slack.webhook", revokedAt: null },
  });
  expect(handler.execute.mock.calls[0][2]).toEqual({ webhookUrl: "unit-secret" });
});
test.each(["missing-key", "missing-reference", "foreign-or-revoked", "unreadable"])(
  "fails safely for %s",
  async (condition) => {
    const run = await connected();
    if (condition === "missing-reference") run.credentialId = null;
    if (condition === "foreign-or-revoked") db.credential.findFirst.mockResolvedValue(null);
    if (condition === "unreadable")
      db.credential.findFirst.mockResolvedValue({
        id: "connection",
        ownerId: 2,
        provider: "slack.webhook",
        encryptedSecret: "invalid",
      });
    await executeAction(
      db,
      job,
      { email: handler },
      () => now,
      condition === "missing-key" ? undefined : key,
    );
    expect(saved().data.status).toBe("failed");
    expect(handler.execute).not.toHaveBeenCalled();
  },
);
test("template errors are permanent configuration failures, not uncertain sends", async () => {
  handler.execute.mockRejectedValue(new TemplateError("MISSING_EVENT_FIELD"));
  await execute();
  expect(saved().data).toMatchObject({ status: "failed", errorCode: "MISSING_EVENT_FIELD" });
});
test("honors rate-limit backoff rather than retrying immediately", async () => {
  handler.execute.mockRejectedValue(new ActionError("LIMITED", "retry", 120000));
  await execute();
  expect(saved().data.nextAttemptAt).toEqual(new Date(now.getTime() + 120000));
});
test.each([null, [], "payload"])(
  "normalizes non-object context and injects stable execution IDs",
  async (metadata) => {
    (await db.actionRun.findUniqueOrThrow()).zapRun.metadata = metadata;
    await execute();
    expect(handler.execute.mock.calls[0][1]).toEqual({
      execution: { id: "run", actionId: "action" },
    });
  },
);
