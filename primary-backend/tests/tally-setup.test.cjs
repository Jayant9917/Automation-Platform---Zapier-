const { createTallySetupHandlers } = require("../src/tally-setup.ts");
const { decryptSecret, credentialContext } = require("../src/credentials.ts");
const key = "ab".repeat(32);
let db, tx, req, res;
beforeEach(() => {
  tx = {
    zap: { findFirst: jest.fn().mockResolvedValue({ id: "workflow" }) },
    tallyTrigger: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
    credential: { upsert: jest.fn() },
  };
  db = { zap: tx.zap, tallyTrigger: tx.tallyTrigger, $transaction: jest.fn((fn) => fn(tx)) };
  req = {
    id: "2",
    params: { zapId: "workflow" },
    body: { formId: "Form1", secret: "unit-tally-signing-secret", enabled: true },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
const handlers = () => createTallySetupHandlers(db, key);
test("saves encrypted credentials inside the owner-scoped transaction", async () => {
  await handlers().save(req, res);
  const stored = tx.credential.upsert.mock.calls[0][0].create;
  expect(stored).toMatchObject({ ownerId: 2, provider: "tally.webhook" });
  expect(decryptSecret(stored.encryptedSecret, key, credentialContext(stored))).toBe(
    req.body.secret,
  );
  expect(tx.zap.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "workflow", userId: 2, trigger: { triggerId: "tally.form_submitted" } },
    }),
  );
  expect(res.json).toHaveBeenCalledWith({ success: true });
});
test("metadata reads never expose secrets", async () => {
  tx.tallyTrigger.findUnique.mockResolvedValue({ formId: "Form1", enabled: false });
  await handlers().get(req, res);
  expect(res.json).toHaveBeenCalledWith({
    configured: true,
    formId: "Form1",
    enabled: false,
    webhookPath: "/hooks/tally/workflow",
  });
  expect(tx.tallyTrigger.findUnique.mock.calls[0][0].select).toEqual({
    formId: true,
    enabled: true,
  });
});
test("unconfigured metadata uses safe defaults", async () => {
  await handlers().get(req, res);
  expect(res.json.mock.calls[0][0]).toMatchObject({ configured: false, formId: "", enabled: true });
});
test.each(["get", "save"])("rejects another owner in %s", async (method) => {
  tx.zap.findFirst.mockResolvedValue(null);
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(tx.credential.upsert).not.toHaveBeenCalled();
});
test.each(["get", "save"])("rejects invalid identity for %s", async (method) => {
  req.id = "bad";
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
test("new setup requires secret but replacement may retain it", async () => {
  delete req.body.secret;
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  tx.tallyTrigger.findUnique.mockResolvedValue({
    credentialId: "c",
    credential: { ownerId: 2, provider: "tally.webhook" },
  });
  await handlers().save(req, res);
  expect(tx.credential.upsert).not.toHaveBeenCalled();
  expect(tx.tallyTrigger.upsert.mock.calls[0][0].update.revision).toEqual({ increment: 1 });
});
test.each(["ownerId", "provider"])("does not modify incompatible credential %s", async (field) => {
  const credential = { ownerId: 2, provider: "tally.webhook", [field]: "wrong" };
  tx.tallyTrigger.findUnique.mockResolvedValue({ credentialId: "c", credential });
  await handlers().save(req, res);
  expect(res.status).toHaveBeenCalledWith(403);
});
test("missing encryption fails closed", async () => {
  await createTallySetupHandlers(db).save(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
test.each([{ formId: "https://tally.so/r/Form1" }, { formId: "Form1", secret: "short" }])(
  "rejects invalid settings %s",
  async (input) => {
    req.body = input;
    await handlers().save(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  },
);
test.each(["get", "save"])("handles database failure during %s", async (method) => {
  tx.zap.findFirst.mockRejectedValue(new Error("offline"));
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
