const { createHmac, createHash } = require("node:crypto");
const { createTallyHandler, verifyTallySignature, normalizeTally } = require("../src/tally.ts");
const { encryptSecret, credentialContext } = require("../src/credentials.ts");
const key = "ab".repeat(32),
  secret = "unit-tally-signing-secret";
let db, tx, req, res, connection, payload;
function sign() {
  req.body = Buffer.from(JSON.stringify(payload));
  req.headers["tally-signature"] = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("base64");
}
beforeEach(() => {
  const credential = { id: "cred", ownerId: 2, provider: "tally.webhook" };
  connection = {
    enabled: true,
    formId: "Form1",
    revision: 1,
    workflow: { userId: 2, trigger: { triggerId: "tally.form_submitted" } },
    credential: {
      ...credential,
      encryptedSecret: encryptSecret(secret, key, credentialContext(credential)),
    },
  };
  tx = {
    tallyTrigger: {
      findFirst: jest.fn().mockResolvedValue({
        workflow: {
          actions: [
            { id: "a", actionId: "email", Metadata: { body: "Hello" }, credentialId: null },
          ],
        },
      }),
    },
    zapRun: { create: jest.fn().mockResolvedValue({ id: "run" }) },
    tallyDelivery: { create: jest.fn() },
    zapRunOutbox: { create: jest.fn() },
  };
  db = {
    tallyTrigger: { findUnique: jest.fn().mockResolvedValue(connection) },
    tallyDelivery: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  req = { params: { workflowId: "workflow" }, headers: { "content-type": "application/json" } };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  payload = {
    eventId: "event",
    eventType: "FORM_RESPONSE",
    data: {
      formId: "Form1",
      submissionId: "submission",
      formName: "Contact",
      fields: [
        { key: "question_name", label: "Name", value: "Jay" },
        { key: "question_email", label: "Email", value: "jay@example.com" },
        { key: "question_message", label: "Message", value: "Hi" },
      ],
    },
  };
  sign();
  jest.spyOn(console, "error").mockImplementation(() => {});
});
const handle = () => createTallyHandler(db, key)(req, res);
test("signed submissions snapshot actions and atomically record receipt and outbox", async () => {
  await handle();
  expect(res.status).toHaveBeenCalledWith(202);
  expect(tx.zapRun.create.mock.calls[0][0].data.metadata.tally).toMatchObject({
    name: "Jay",
    email: "jay@example.com",
    message: "Hi",
  });
  expect(tx.zapRun.create.mock.calls[0][0].data.actionRuns.create[0]).toMatchObject({
    actionId: "a",
    type: "email",
  });
  expect(tx.tallyDelivery.create.mock.calls[0][0].data.deliveryId).toBe("submission");
  expect(tx.zapRunOutbox.create).toHaveBeenCalledWith({ data: { zapRunId: "run" } });
});
test.each([undefined, [], "bad", "a".repeat(43) + "="])(
  "rejects invalid signature %s",
  async (signature) => {
    req.headers["tally-signature"] = signature;
    await handle();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
test("canonical JSON signature matches Tally documentation even if transport has whitespace", async () => {
  req.body = Buffer.from(JSON.stringify(payload, null, 2));
  await handle();
  expect(res.status).toHaveBeenCalledWith(202);
  expect(verifyTallySignature(payload, req.headers["tally-signature"], "wrong-secret")).toBe(false);
});
test.each(["form", "event"])("ignores unrelated %s", async (kind) => {
  if (kind === "form") payload.data.formId = "Other";
  else payload.eventType = "OTHER";
  sign();
  await handle();
  expect(res.status).toHaveBeenCalledWith(202);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test.each([false, null])("disabled or missing configuration is rejected %s", async (enabled) => {
  if (enabled === null) db.tallyTrigger.findUnique.mockResolvedValue(null);
  else connection.enabled = false;
  await handle();
  expect(res.status).toHaveBeenCalledWith(404);
});
test.each(["ownerId", "provider"])("rejects incompatible credential %s", async (field) => {
  connection.credential[field] = "wrong";
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("missing encryption key fails closed", async () => {
  await createTallyHandler(db)(req, res);
  expect(res.status).toHaveBeenCalledWith(503);
});
test("malformed or parsed body is rejected", async () => {
  req.body = Buffer.from("{");
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
  req.body = payload;
  await handle();
  expect(res.status).toHaveBeenLastCalledWith(400);
});
test.each([null, [], "text"])("rejects non-object payload %s", async (invalid) => {
  payload = invalid;
  sign();
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
test("requires JSON content type", async () => {
  req.headers["content-type"] = "text/plain";
  await handle();
  expect(res.status).toHaveBeenCalledWith(415);
});
test.each(["eventId", "submissionId", "fields"])("validates submission %s", async (field) => {
  if (field === "eventId") payload.eventId = "";
  else payload.data[field] = null;
  sign();
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
test.each([true, false])("duplicate submission hash matches: %s", async (same) => {
  db.tallyDelivery.findUnique.mockResolvedValue({
    payloadHash: same
      ? createHash("sha256").update(JSON.stringify(payload.data)).digest("hex")
      : "other",
  });
  await handle();
  expect(res.status).toHaveBeenCalledWith(same ? 200 : 409);
  expect(db.$transaction).not.toHaveBeenCalled();
});
test("concurrent duplicate creation uses the durable receipt", async () => {
  const hash = createHash("sha256").update(JSON.stringify(payload.data)).digest("hex");
  db.$transaction.mockRejectedValue({ code: "P2002" });
  db.tallyDelivery.findUnique
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ payloadHash: hash });
  await handle();
  expect(res.status).toHaveBeenCalledWith(200);
});
test("changed configuration and failed transactions are not acknowledged", async () => {
  tx.tallyTrigger.findFirst.mockResolvedValue(null);
  await handle();
  expect(res.status).toHaveBeenCalledWith(409);
  db.$transaction.mockRejectedValue(new Error("offline"));
  await handle();
  expect(res.status).toHaveBeenLastCalledWith(503);
});
test("normalization preserves scalars, translates choices, and blocks dangerous keys", () => {
  payload.data.fields.push(
    { key: "question_choice", value: ["id"], options: [{ id: "id", text: "Support" }] },
    { key: "__proto__", label: "Name", value: "attack" },
    { key: "question_object", value: { bad: true } },
  );
  const result = normalizeTally(payload).tally;
  expect(result.name).toBe("Jay");
  expect(result.answers.question_choice).toBe("Support");
  expect(Object.hasOwn(result.answers, "__proto__")).toBe(false);
  expect(result.answers.question_object).toBeUndefined();
});
test("duplicate labels are not silently mapped and duplicate keys are rejected", async () => {
  payload.data.fields.push({ key: "second", label: "Name", value: "Other" });
  expect(normalizeTally(payload).tally.name).toBeNull();
  payload.data.fields.push(payload.data.fields[0]);
  sign();
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
});
