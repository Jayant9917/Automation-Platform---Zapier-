const { createHmac } = require("node:crypto");
const { createGitHubHandler, verifyGitHubSignature } = require("../src/github.ts");
const { encryptSecret, credentialContext } = require("../src/credentials.ts");
const key = "ab".repeat(32),
  secret = "unit-github-secret";
const delivery = "6e0c161b-b1f1-4ccb-97d2-5187eb2dcc31";
const issue = {
  action: "opened",
  repository: { full_name: "owner/repo" },
  issue: { title: "Issue", number: 42, html_url: "https://github.com/owner/repo/issues/42" },
};
let db, tx, req, res, connection;
function body(value) {
  req.body = Buffer.from(typeof value === "string" ? value : JSON.stringify(value));
  req.headers["x-hub-signature-256"] =
    "sha256=" + createHmac("sha256", secret).update(req.body).digest("hex");
}
beforeEach(() => {
  const credential = { id: "c", ownerId: 2, provider: "github.webhook" };
  connection = {
    workflowId: "workflow",
    revision: 1,
    enabled: true,
    repository: "owner/repo",
    workflow: { userId: 2, trigger: { triggerId: "github.issue_opened" } },
    credential: {
      ...credential,
      encryptedSecret: encryptSecret(secret, key, credentialContext(credential)),
    },
  };
  tx = {
    githubTrigger: {
      findFirst: jest.fn().mockResolvedValue({
        workflow: {
          actions: [
            { id: "a", actionId: "email", Metadata: { email: "one@test.dev", body: "Hi" } },
            { id: "b", actionId: "email", Metadata: null },
          ],
        },
      }),
    },
    zapRun: { create: jest.fn().mockResolvedValue({ id: "run" }) },
    githubDelivery: { create: jest.fn() },
    zapRunOutbox: { create: jest.fn() },
  };
  db = {
    githubTrigger: { findUnique: jest.fn().mockResolvedValue(connection) },
    githubDelivery: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  req = {
    params: { workflowId: "workflow" },
    headers: {
      "content-type": "application/json",
      "x-github-event": "issues",
      "x-github-delivery": delivery,
    },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  body(issue);
  jest.spyOn(console, "error").mockImplementation(() => {});
});
const handle = () => createGitHubHandler(db, key)(req, res);
test("accepts signed issue events and saves all work atomically", async () => {
  await handle();
  expect(db.$transaction).toHaveBeenCalledTimes(1);
  expect(tx.zapRun.create).toHaveBeenCalledWith({
    data: {
      zapId: "workflow",
      metadata: issue,
      actionRuns: {
        create: [
          {
            actionId: "a",
            type: "email",
            credentialId: null,
            config: { email: "one@test.dev", body: "Hi" },
          },
          { actionId: "b", type: "email", credentialId: null, config: {} },
        ],
      },
    },
  });
  expect(tx.githubDelivery.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      workflowId: "workflow",
      deliveryId: delivery,
      zapRunId: "run",
    }),
  });
  expect(tx.zapRunOutbox.create).toHaveBeenCalledWith({ data: { zapRunId: "run" } });
  expect(res.status).toHaveBeenCalledWith(202);
  expect(res.json).toHaveBeenCalledWith({ success: true });
});
test("verifies exact Unicode body bytes rather than reserialized JSON", () => {
  const raw = Buffer.from('{ "title": "\u2603" }');
  const signature = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  expect(verifyGitHubSignature(raw, signature, secret)).toBe(true);
  expect(
    verifyGitHubSignature(
      Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),
      signature,
      secret,
    ),
  ).toBe(false);
});
test.each([undefined, [], "sha1=bad", "sha256=" + "g".repeat(64), "sha256=" + "0".repeat(64)])(
  "rejects invalid signature %s",
  async (signature) => {
    req.headers["x-hub-signature-256"] = signature;
    await handle();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
test("rejects parsed instead of raw bodies", async () => {
  req.body = issue;
  await handle();
  expect(res.status).toHaveBeenCalledWith(401);
});
test.each([null, { enabled: false }])(
  "does not process missing/disabled triggers",
  async (value) => {
    db.githubTrigger.findUnique.mockResolvedValue(value);
    await handle();
    expect(res.status).toHaveBeenCalledWith(404);
  },
);
test("requires configured encryption", async () => {
  await createGitHubHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(db.githubTrigger.findUnique).not.toHaveBeenCalled();
});
test.each(["ownerId", "provider"])("rejects incompatible credential %s", async (field) => {
  connection.credential[field] = field === "ownerId" ? 3 : "slack";
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("decryption failure does not leak encrypted data", async () => {
  connection.credential.encryptedSecret = "private-broken-record";
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private-broken-record");
});
test.each(["bad", "null", "[]", "42"])("rejects signed malformed JSON %s", async (value) => {
  body(value);
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each([
  ["x-github-event", undefined],
  ["x-github-event", []],
  ["x-github-delivery", undefined],
  ["x-github-delivery", "bad"],
])("requires valid headers %s", async (header, value) => {
  req.headers[header] = value;
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each([{ full_name: "other/repo" }, {}, null])(
  "ignores different/missing repositories",
  async (repository) => {
    body({ ...issue, repository });
    await handle();
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ignored: true }));
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
test("repository matching is case insensitive", async () => {
  body({ ...issue, repository: { full_name: "Owner/Repo" } });
  await handle();
  expect(tx.zapRun.create).toHaveBeenCalled();
});
test("ping succeeds without creating any workflow runs", async () => {
  req.headers["x-github-event"] = "ping";
  await handle();
  expect(res.status).toHaveBeenCalledWith(200);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each([
  ["push", "opened"],
  ["issues", "closed"],
])("ignores unsupported events/actions", async (event, action) => {
  req.headers["x-github-event"] = event;
  body({ ...issue, action });
  await handle();
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each([
  undefined,
  { title: 42, number: 1 },
  { title: "a", number: 0 },
  { title: "a", number: 1 },
  { title: "a", number: 1, html_url: 42 },
])("rejects malformed issues", async (value) => {
  body({ ...issue, issue: value });
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each([true, false])("recognizes existing receipt and conflicting replay %s", async (same) => {
  const hash = require("node:crypto").createHash("sha256").update(req.body).digest("hex");
  db.githubDelivery.findUnique.mockResolvedValue({ payloadHash: same ? hash : "different" });
  await handle();
  expect(res.status).toHaveBeenCalledWith(same ? 200 : 409);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each([null, { workflow: { actions: [] } }])(
  "configuration changes/empty workflow create no runs",
  async (value) => {
    tx.githubTrigger.findFirst.mockResolvedValue(value);
    await handle();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(tx.zapRun.create).not.toHaveBeenCalled();
  },
);
test("database/outbox failure does not acknowledge success", async () => {
  tx.zapRunOutbox.create.mockRejectedValue(new Error("private database detail"));
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private database detail");
});
test.each([true, false])("concurrent duplicate is acknowledged after rollback %s", async (same) => {
  const hash = require("node:crypto").createHash("sha256").update(req.body).digest("hex");
  db.githubDelivery.findUnique
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ payloadHash: same ? hash : "other" });
  db.$transaction.mockRejectedValue({ code: "P2002" });
  await handle();
  expect(res.status).toHaveBeenCalledWith(same ? 200 : 409);
});
test("an unrelated unique failure is not falsely called a duplicate", async () => {
  db.$transaction.mockRejectedValue({ code: "P2002" });
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
});

test.each([undefined, "application/x-www-form-urlencoded", "text/plain", []])(
  "explains unsupported content type instead of reporting a bad signature %s",
  async (type) => {
    req.headers["content-type"] = type;
    await handle();
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith({
      error: "Set GitHub webhook Content type to application/json",
    });
    expect(db.githubTrigger.findUnique).not.toHaveBeenCalled();
  },
);
test("accepts JSON charset parameters", async () => {
  req.headers["content-type"] = "application/json; charset=utf-8";
  await handle();
  expect(res.status).toHaveBeenCalledWith(202);
});

test.each([
  ["github.issue_closed", "issues", "closed", "issue"],
  ["github.pull_request_opened", "pull_request", "opened", "pull_request"],
])("accepts only matching signed events for %s", async (type, event, action, field) => {
  connection.workflow.trigger.triggerId = type;
  req.headers["x-github-event"] = event;
  const payload = { action, repository: issue.repository, [field]: issue.issue };
  body(payload);
  await handle();
  expect(res.status).toHaveBeenCalledWith(202);
  expect(tx.zapRun.create.mock.calls[0][0].data.metadata).toEqual(payload);
  expect(tx.githubTrigger.findFirst.mock.calls[0][0].where.workflow.trigger.triggerId).toBe(type);
  db.$transaction.mockClear();
  body({ ...payload, action: action === "closed" ? "opened" : "closed" });
  await handle();
  expect(db.$transaction).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenLastCalledWith({ ignored: true });
});
test("a pull request trigger rejects issue payloads and invalid PR numbers", async () => {
  connection.workflow.trigger.triggerId = "github.pull_request_opened";
  await handle();
  expect(db.$transaction).not.toHaveBeenCalled();
  req.headers["x-github-event"] = "pull_request";
  body({
    action: "opened",
    repository: issue.repository,
    pull_request: { ...issue.issue, number: 0 },
  });
  await handle();
  expect(res.status).toHaveBeenLastCalledWith(400);
});
