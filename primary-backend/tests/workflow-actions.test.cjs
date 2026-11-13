const { createWorkflowActionHandlers } = require("../src/workflow-actions.ts");
const id = "003f9700-a5e5-4af1-97bd-3496ac539e50",
  connection = "aa3f9700-a5e5-4af1-97bd-3496ac539e50";
const email = {
  availableActionId: "email",
  actionMetadata: { email: "unit@test.dev", body: "{{issue.title}}" },
};
let db, tx, req, res;
beforeEach(() => {
  tx = {
    credential: { findFirst: jest.fn().mockResolvedValue({ id: connection }) },
    zap: {
      create: jest.fn().mockResolvedValue({ id: "workflow" }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ id: "workflow" }),
    },
    trigger: { create: jest.fn().mockResolvedValue({ id: "trigger" }) },
    action: {
      findMany: jest.fn().mockResolvedValue([{ id }]),
      deleteMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };
  db = { $transaction: jest.fn((fn) => fn(tx)) };
  req = {
    id: "2",
    params: { zapId: "workflow" },
    body: { availableTriggerId: "github.issue_opened", actions: [email], revision: 0 },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
const handlers = () => createWorkflowActionHandlers(db);
test("creates a workflow with multiple independently configured actions", async () => {
  req.body.actions = [
    email,
    {
      availableActionId: "slack.send_message",
      credentialId: connection,
      actionMetadata: { text: "{{issue.title}}" },
    },
  ];
  await handlers().create(req, res);
  expect(tx.credential.findFirst).toHaveBeenCalledWith({
    where: { id: connection, ownerId: 2, provider: "slack.webhook", revokedAt: null },
    select: { id: true },
  });
  const actions = tx.zap.create.mock.calls[0][0].data.actions.create;
  expect(actions).toHaveLength(2);
  expect(actions[0]).toMatchObject({ credentialId: null, sortingOrder: 0 });
  expect(actions[1]).toMatchObject({ credentialId: connection, sortingOrder: 1 });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith({ zapId: "workflow" });
});
test.each(["create", "update"])(
  "rejects foreign, revoked, or wrong-provider connections for %s",
  async (method) => {
    tx.credential.findFirst.mockResolvedValue(null);
    req.body.actions = [
      {
        availableActionId: "slack.send_message",
        credentialId: connection,
        actionMetadata: { text: "Hi" },
      },
    ];
    await handlers()[method](req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(tx.zap.create).not.toHaveBeenCalled();
    expect(tx.action.deleteMany).not.toHaveBeenCalled();
  },
);
test("preserves existing action IDs, removes omitted actions and adds new ones", async () => {
  req.body.actions = [{ ...email, id }, email];
  await handlers().update(req, res);
  expect(tx.zap.updateMany).toHaveBeenCalledWith({
    where: { id: "workflow", userId: 2, actionsRevision: 0 },
    data: { actionsRevision: { increment: 1 } },
  });
  expect(tx.action.deleteMany).toHaveBeenCalledWith({
    where: { zapId: "workflow", id: { notIn: [id] } },
  });
  expect(tx.action.update).toHaveBeenCalledWith({
    where: { id },
    data: expect.objectContaining({ sortingOrder: 0 }),
  });
  expect(tx.action.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ zapId: "workflow", sortingOrder: 1 }),
  });
  expect(res.json).toHaveBeenCalledWith({ success: true, revision: 1 });
});
test("rejects IDs belonging to another workflow", async () => {
  tx.action.findMany.mockResolvedValue([]);
  req.body.actions = [{ ...email, id }];
  await handlers().update(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(tx.action.deleteMany).not.toHaveBeenCalled();
});
test("rejects duplicate action IDs", async () => {
  req.body.actions = [
    { ...email, id },
    { ...email, id },
  ];
  await handlers().update(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each([
  [true, 409],
  [false, 404],
])("stale or foreign workflows do not mutate actions", async (owned, status) => {
  tx.zap.updateMany.mockResolvedValue({ count: 0 });
  tx.zap.findFirst.mockResolvedValue(owned ? { id: "workflow" } : null);
  await handlers().update(req, res);
  expect(res.status).toHaveBeenCalledWith(status);
  expect(tx.action.deleteMany).not.toHaveBeenCalled();
});
test.each(["create", "update"])("requires login for %s", async (method) => {
  req.id = "bad";
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each(["create", "update"])("rejects empty and invalid actions for %s", async (method) => {
  req.body.actions = [];
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("does not accept existing IDs when creating a new workflow", async () => {
  req.body.actions = [{ ...email, id }];
  await handlers().create(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each(["create", "update"])("redacts transaction failures for %s", async (method) => {
  db.$transaction.mockRejectedValue(new Error("private database details"));
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private database details");
});

test("new GitHub trigger credentials are encrypted and saved in the workflow transaction", async () => {
  const { decryptSecret, credentialContext } = require("../src/credentials.ts");
  const key = "ab".repeat(32);
  tx.credential.create = jest.fn();
  tx.githubTrigger = { create: jest.fn() };
  req.body.github = { repository: "Owner/Repo", secret: "unit-webhook-secret", enabled: true };
  await createWorkflowActionHandlers(db, key).create(req, res);
  const stored = tx.credential.create.mock.calls[0][0].data;
  expect(decryptSecret(stored.encryptedSecret, key, credentialContext(stored))).toBe(
    "unit-webhook-secret",
  );
  expect(tx.githubTrigger.create).toHaveBeenCalledWith({
    data: {
      workflowId: "workflow",
      credentialId: stored.id,
      repository: "owner/repo",
      enabled: true,
    },
  });
  expect(res.status).toHaveBeenCalledWith(201);
});
test("trigger setup failure never returns a successful workflow creation", async () => {
  tx.credential.create = jest.fn().mockRejectedValue(new Error("database failure"));
  req.body.github = { repository: "owner/repo", secret: "unit-webhook-secret" };
  await createWorkflowActionHandlers(db, "ab".repeat(32)).create(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
test.each(["missing-secret", "wrong-trigger", "missing-key"])(
  "invalid inline trigger setup is rejected before creation %s",
  async (condition) => {
    req.body.github = { repository: "owner/repo", secret: "unit-webhook-secret" };
    if (condition === "missing-secret") delete req.body.github.secret;
    if (condition === "wrong-trigger") req.body.availableTriggerId = "webhook";
    await createWorkflowActionHandlers(
      db,
      condition === "missing-key" ? undefined : "ab".repeat(32),
    ).create(req, res);
    expect(res.status).toHaveBeenCalledWith(condition === "missing-key" ? 503 : 400);
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);

test("publishes Tally with encrypted signing credentials atomically", async () => {
  req.body.availableTriggerId = "tally.form_submitted";
  req.body.tally = { formId: "Form1", secret: "unit-tally-signing-secret" };
  tx.credential.create = jest.fn();
  tx.tallyTrigger = { create: jest.fn() };
  await createWorkflowActionHandlers(db, "ab".repeat(32)).create(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(tx.tallyTrigger.create.mock.calls[0][0].data).toMatchObject({
    formId: "Form1",
    workflowId: "workflow",
  });
  expect(tx.credential.create.mock.calls[0][0].data.encryptedSecret).not.toContain(
    req.body.tally.secret,
  );
});
test.each(["missing", "wrong-trigger", "no-key"])(
  "rejects invalid Tally publish %s",
  async (kind) => {
    req.body.availableTriggerId = kind === "wrong-trigger" ? "webhook" : "tally.form_submitted";
    if (kind !== "missing")
      req.body.tally = { formId: "Form1", secret: "unit-tally-signing-secret" };
    await createWorkflowActionHandlers(db, kind === "no-key" ? undefined : "ab".repeat(32)).create(
      req,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(kind === "no-key" ? 503 : 400);
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
