const { createWebhookHandler } = require("../src/handler.ts");
let tx, database, req, res;
beforeEach(() => {
  tx = {
    zap: {
      findFirst: jest.fn().mockResolvedValue({
        actions: [
          { id: "a", actionId: "email", Metadata: { email: "one@test.dev", body: "Hi" } },
          { id: "b", actionId: "email", Metadata: { email: "two@test.dev", body: "Hi" } },
        ],
      }),
    },
    zapRun: { create: jest.fn().mockResolvedValue({ id: "unit-run" }) },
    zapRunOutbox: { create: jest.fn().mockResolvedValue({ id: "unit-outbox" }) },
  };
  database = { $transaction: jest.fn((callback) => callback(tx)) };
  req = { params: { userId: "2", zapId: "unit-zap" }, body: { message: "Unit input" } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  jest.spyOn(console, "error").mockImplementation(() => {});
});
test("creates the run and its outbox through the same transaction callback", async () => {
  await createWebhookHandler(database)(req, res);
  expect(database.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.zapRun.create).toHaveBeenCalledWith({
    data: {
      zapId: "unit-zap",
      metadata: req.body,
      actionRuns: {
        create: [
          {
            actionId: "a",
            type: "email",
            credentialId: null,
            config: { email: "one@test.dev", body: "Hi" },
          },
          {
            actionId: "b",
            type: "email",
            credentialId: null,
            config: { email: "two@test.dev", body: "Hi" },
          },
        ],
      },
    },
  });
  expect(tx.zapRunOutbox.create).toHaveBeenCalledWith({ data: { zapRunId: "unit-run" } });
  expect(tx.zapRun.create.mock.invocationCallOrder[0]).toBeLessThan(
    tx.zapRunOutbox.create.mock.invocationCallOrder[0],
  );
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
  database.$transaction.mockImplementation(
    () =>
      new Promise((resolve) => {
        commit = resolve;
      }),
  );
  const pending = createWebhookHandler(database)(req, res);
  expect(res.json).not.toHaveBeenCalled();
  commit(true);
  await pending;
  expect(res.status).toHaveBeenCalledWith(200);
});

test.each([null, { actions: [] }])(
  "rejects missing workflow or empty actions",
  async (workflow) => {
    tx.zap.findFirst.mockResolvedValue(workflow);
    await createWebhookHandler(database)(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(tx.zapRun.create).not.toHaveBeenCalled();
  },
);
test("checks workflow against the user in the webhook URL", async () => {
  await createWebhookHandler(database)(req, res);
  expect(tx.zap.findFirst).toHaveBeenCalledWith({
    where: { id: "unit-zap", userId: 2, deletedAt: null },
    include: { actions: true, githubTrigger: true, trigger: true },
  });
});

test("snapshots invalid legacy metadata safely instead of blocking sibling creation", async () => {
  tx.zap.findFirst.mockResolvedValue({ actions: [{ id: "a", actionId: "email", Metadata: null }] });
  await createWebhookHandler(database)(req, res);
  expect(tx.zapRun.create.mock.calls[0][0].data.actionRuns.create).toEqual([
    { actionId: "a", type: "email", credentialId: null, config: {} },
  ]);
});

test.each([
  { githubTrigger: { enabled: true } },
  { githubTrigger: { enabled: false } },
  { trigger: { triggerId: "github.issue_opened" } },
])("GitHub workflows cannot bypass signatures %j", async (flags) => {
  tx.zap.findFirst.mockResolvedValue({ actions: [{ id: "a" }], ...flags });
  await createWebhookHandler(database)(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.zapRun.create).not.toHaveBeenCalled();
});

test("Tally workflows cannot bypass signatures through generic catch", async () => {
  const prisma = {
    $transaction: jest.fn(async (fn) =>
      fn({
        zap: {
          findFirst: jest.fn().mockResolvedValue({
            actions: [{ id: "a" }],
            trigger: { triggerId: "tally.form_submitted" },
          }),
        },
      }),
    ),
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await createWebhookHandler(prisma)({ params: { userId: "2", zapId: "workflow" }, body: {} }, res);
  expect(res.status).toHaveBeenCalledWith(404);
});

test("a schedule cannot be fired through the generic webhook endpoint", async () => {
  tx.zap.findFirst.mockResolvedValue({
    actions: [{ id: "a", actionId: "email", Metadata: {} }],
    trigger: { triggerId: "schedule" },
  });
  await createWebhookHandler(database)(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.zapRun.create).not.toHaveBeenCalled();
});
