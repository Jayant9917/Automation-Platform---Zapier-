const { createGitHubSetupHandlers, GitHubSetupSchema } = require("../src/github-setup.ts");
const { decryptSecret, credentialContext } = require("../src/credentials.ts");
const key = "ab".repeat(32);
let db, tx, req, res, settings;
beforeEach(() => {
  tx = {
    zap: { findFirst: jest.fn().mockResolvedValue({ id: "workflow" }), update: jest.fn() },
    githubTrigger: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    credential: { upsert: jest.fn() },
    trigger: { upsert: jest.fn().mockResolvedValue({ id: "trigger" }) },
  };
  db = { zap: tx.zap, githubTrigger: tx.githubTrigger, $transaction: jest.fn((fn) => fn(tx)) };
  req = {
    id: "2",
    params: { zapId: "workflow" },
    body: { repository: "Owner/Repo", secret: "unit-webhook-secret" },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  settings = { encryptionKey: key };
});
const handlers = () => createGitHubSetupHandlers(db, settings);
const existing = () => ({
  credentialId: "c",
  repository: "owner/repo",
  enabled: false,
  credential: { id: "c", ownerId: 2, provider: "github.webhook" },
});
test("saves encrypted credentials and converts the existing trigger atomically", async () => {
  await handlers().save(req, res);
  const stored = tx.credential.upsert.mock.calls[0][0].create;
  expect(stored).toMatchObject({ ownerId: 2, provider: "github.webhook" });
  expect(decryptSecret(stored.encryptedSecret, key, credentialContext(stored))).toBe(
    req.body.secret,
  );
  expect(tx.githubTrigger.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: {
        workflowId: "workflow",
        credentialId: stored.id,
        repository: "owner/repo",
        enabled: true,
      },
    }),
  );
  expect(tx.trigger.upsert.mock.calls[0][0].update.triggerId).toBe("github.issue_opened");
  expect(res.json).toHaveBeenCalledWith({ success: true, webhookPath: "/hooks/github/workflow" });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(req.body.secret);
});
test("keeps an existing secret when no replacement is supplied", async () => {
  tx.githubTrigger.findUnique.mockResolvedValue(existing());
  delete req.body.secret;
  req.body.enabled = false;
  await handlers().save(req, res);
  expect(tx.credential.upsert).not.toHaveBeenCalled();
  expect(tx.githubTrigger.upsert.mock.calls[0][0].update).toEqual({
    repository: "owner/repo",
    enabled: false,
    revision: { increment: 1 },
  });
});
test("replaces an existing secret without changing its owner or provider", async () => {
  tx.githubTrigger.findUnique.mockResolvedValue(existing());
  await handlers().save(req, res);
  const args = tx.credential.upsert.mock.calls[0][0];
  expect(args.where).toEqual({ id: "c" });
  expect(Object.keys(args.update)).toEqual(["encryptedSecret"]);
});
test("imports an environment secret only for its designated workflow owner", async () => {
  settings.githubSetupSecret = "private-bootstrap-secret";
  settings.githubSetupWorkflowId = "workflow";
  delete req.body.secret;
  await handlers().save(req, res);
  const stored = tx.credential.upsert.mock.calls[0][0].create;
  expect(decryptSecret(stored.encryptedSecret, key, credentialContext(stored))).toBe(
    settings.githubSetupSecret,
  );
});
test.each(["other", undefined])(
  "cannot import the environment secret into another workflow %s",
  async (id) => {
    settings.githubSetupSecret = "private-bootstrap-secret";
    settings.githubSetupWorkflowId = id;
    delete req.body.secret;
    await handlers().save(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(tx.credential.upsert).not.toHaveBeenCalled();
  },
);
test.each(["short", "x".repeat(513), undefined])(
  "rejects unusable configured secret",
  async (secret) => {
    settings.githubSetupSecret = secret;
    settings.githubSetupWorkflowId = "workflow";
    delete req.body.secret;
    await handlers().save(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  },
);
test.each(["get", "save"])("checks authentication for %s", async (method) => {
  req.id = "bad";
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each(["get", "save"])("does not access another user's workflow for %s", async (method) => {
  tx.zap.findFirst.mockResolvedValue(null);
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.credential.upsert).not.toHaveBeenCalled();
  expect(tx.zap.findFirst).toHaveBeenCalledWith({
    where: { id: "workflow", userId: 2, deletedAt: null },
    select: { id: true, trigger: { select: { triggerId: true } } },
  });
});
test("requires an encryption key when saving", async () => {
  settings.encryptionKey = undefined;
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
test.each([
  {},
  { repository: "https://github.com/owner/repo" },
  { repository: "owner/repo", secret: "short" },
  { repository: "owner/repo", enabled: "yes" },
])("rejects invalid settings %j", async (value) => {
  req.body = value;
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each(["ownerId", "provider"])("refuses a credential with incompatible %s", async (field) => {
  const saved = existing();
  saved.credential[field] = field === "ownerId" ? 3 : "slack";
  tx.githubTrigger.findUnique.mockResolvedValue(saved);
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(tx.credential.upsert).not.toHaveBeenCalled();
});
test("lists only safe connection fields", async () => {
  tx.githubTrigger.findUnique.mockResolvedValue(existing());
  await handlers().get(req, res);
  expect(res.json).toHaveBeenCalledWith({
    configured: true,
    repository: "owner/repo",
    enabled: false,
    setupSecretAvailable: false,
    webhookPath: "/hooks/github/workflow",
  });
  expect(tx.githubTrigger.findUnique).toHaveBeenCalledWith({
    where: { workflowId: "workflow" },
    select: { repository: true, enabled: true },
  });
});
test("shows setup-secret availability without returning its value", async () => {
  settings.githubSetupWorkflowId = "workflow";
  settings.githubSetupSecret = "private-bootstrap-secret";
  await handlers().get(req, res);
  expect(res.json.mock.calls[0][0]).toMatchObject({
    configured: false,
    repository: "",
    enabled: true,
    setupSecretAvailable: true,
  });
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(settings.githubSetupSecret);
});
test.each(["get", "save"])("redacts database failures for %s", async (method) => {
  if (method === "get") tx.zap.findFirst.mockRejectedValue(new Error("private detail"));
  else tx.credential.upsert.mockRejectedValue(new Error("private detail"));
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private detail");
});
test("normalizes repository whitespace while preserving secret bytes", () => {
  expect(
    GitHubSetupSchema.parse({ repository: " owner/repo ", secret: " unit-secret-secret " }),
  ).toMatchObject({ repository: "owner/repo", secret: " unit-secret-secret " });
});

test.each(["github.issue_closed", "github.pull_request_opened"])(
  "saves selected %s and preserves it on credential-only edits",
  async (triggerType) => {
    req.body.triggerType = triggerType;
    await handlers().save(req, res);
    expect(tx.trigger.upsert.mock.calls[0][0].update.triggerId).toBe(triggerType);
    tx.trigger.upsert.mockClear();
    tx.zap.findFirst.mockResolvedValue({ id: "workflow", trigger: { triggerId: triggerType } });
    delete req.body.triggerType;
    await handlers().save(req, res);
    expect(tx.trigger.upsert.mock.calls[0][0].update.triggerId).toBe(triggerType);
  },
);
