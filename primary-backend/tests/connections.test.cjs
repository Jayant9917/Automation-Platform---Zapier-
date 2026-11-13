const { createConnectionHandlers, validateConnectionSecret } = require("../src/connections.ts");
const { decryptSecret, credentialContext } = require("../src/credentials.ts");
let db, req, res;
const key = "ab".repeat(32);
beforeEach(() => {
  db = {
    credential: {
      findMany: jest.fn().mockResolvedValue([{ id: "c", name: "Team", provider: "slack.webhook" }]),
      create: jest.fn().mockResolvedValue({ id: "c", name: "Team", provider: "slack.webhook" }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  req = {
    id: "2",
    params: {},
    body: {
      name: "Team",
      provider: "slack.webhook",
      secret: "https://hooks.slack.com/services/T/B/secret",
    },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
const handlers = () => createConnectionHandlers(db, key);
test("lists only the owner's active supported connections, never secrets", async () => {
  await handlers().list(req, res);
  const args = db.credential.findMany.mock.calls[0][0];
  expect(args.where).toEqual({
    ownerId: 2,
    revokedAt: null,
    provider: { in: ["slack.webhook", "google.service_account", "discord.webhook"] },
  });
  expect(args.select.encryptedSecret).toBeUndefined();
  expect(res.json.mock.calls[0][0].connections).toHaveLength(1);
});
test("encrypts a named connection using owner/id/provider binding", async () => {
  await handlers().save(req, res);
  const saved = db.credential.create.mock.calls[0][0].data;
  expect(JSON.parse(decryptSecret(saved.encryptedSecret, key, credentialContext(saved)))).toEqual({
    webhookUrl: req.body.secret,
  });
  expect(saved).toMatchObject({ ownerId: 2, name: "Team", provider: "slack.webhook" });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(req.body.secret);
});
test("replacement cannot change another user's credentials or change provider", async () => {
  req.params.connectionId = "existing";
  await handlers().save(req, res);
  expect(db.credential.updateMany.mock.calls[0][0].where).toEqual({
    id: "existing",
    ownerId: 2,
    provider: "slack.webhook",
    revokedAt: null,
  });
  expect(db.credential.create).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ success: true, id: "existing" });
});
test("unknown, revoked, or foreign connection cannot be replaced", async () => {
  req.params.connectionId = "foreign";
  db.credential.updateMany.mockResolvedValue({ count: 0 });
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
});
test("revokes only active supported connections owned by the caller", async () => {
  req.params.connectionId = "c";
  await handlers().revoke(req, res);
  expect(db.credential.updateMany.mock.calls[0][0]).toMatchObject({
    where: {
      id: "c",
      ownerId: 2,
      revokedAt: null,
      provider: { in: ["slack.webhook", "google.service_account", "discord.webhook"] },
    },
    data: { revokedAt: expect.any(Date) },
  });
});
test("cannot revoke a foreign or already revoked connection", async () => {
  db.credential.updateMany.mockResolvedValue({ count: 0 });
  await handlers().revoke(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
});
test.each(["list", "save", "revoke"])("authentication is required for %s", async (method) => {
  req.id = "bad";
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
test("cannot store plaintext when encryption is missing", async () => {
  await createConnectionHandlers(db).save(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(db.credential.create).not.toHaveBeenCalled();
});
test.each([
  { name: "", provider: "slack.webhook" },
  { name: "Team", provider: "github.webhook" },
  { name: "Team", provider: "slack.webhook", secret: "https://evil.test" },
  { name: "Sheets", provider: "google.service_account", secret: {} },
])("validates provider credentials without echoing them", async (body) => {
  req.body = body;
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.credential.create).not.toHaveBeenCalled();
});
test.each(["list", "save", "revoke"])(
  "provider and database errors are redacted for %s",
  async (method) => {
    db.credential.findMany.mockRejectedValue(new Error("secret"));
    db.credential.create.mockRejectedValue(new Error("secret"));
    db.credential.updateMany.mockRejectedValue(new Error("secret"));
    await handlers()[method](req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain(req.body.secret);
  },
);
test("rejects unsupported providers and parses Google credentials with the shared validator", () => {
  expect(() => validateConnectionSecret("other", {})).toThrow("INVALID_CONNECTION_PROVIDER");
  expect(() => validateConnectionSecret("google.service_account", {})).toThrow();
});

test("saves a Discord connection encrypted and validates the official host", async () => {
  req.body.provider = "discord.webhook";
  req.body.secret =
    "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123456";
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(201);
  const saved = db.credential.create.mock.calls[0][0].data;
  expect(saved.provider).toBe("discord.webhook");
  expect(
    JSON.parse(decryptSecret(saved.encryptedSecret, key, credentialContext(saved))).webhookUrl,
  ).toBe(req.body.secret);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain(req.body.secret);
});
