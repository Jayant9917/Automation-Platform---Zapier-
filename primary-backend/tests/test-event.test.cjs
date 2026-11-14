const { createTestEventHandler } = require("../src/test-event.ts");
let db, req, res, fetcher;
beforeEach(() => {
  db = {
    zap: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: "workflow", actions: [{ id: "a" }, { id: "b" }] }),
    },
  };
  req = {
    id: "2",
    params: { zapId: "workflow" },
    body: { payload: { name: "Test", message: "Hello" } },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  fetcher = jest
    .fn()
    .mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success: true }) });
});
const handle = (enabled = true) => createTestEventHandler(db, enabled, fetcher)(req, res);
test("disabled route returns 404 without touching database or hooks", async () => {
  await handle(false);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(db.zap.findFirst).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([undefined, "bad", "0", "1.5"])("requires a valid owner %s", async (id) => {
  req.id = id;
  await handle();
  expect(res.status).toHaveBeenCalledWith(403);
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([
  {},
  { payload: [] },
  { payload: null },
  { payload: "text" },
  { payload: { text: "x".repeat(65537) } },
])("rejects invalid or oversized sample %s", async (body) => {
  req.body = body;
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fetcher).not.toHaveBeenCalled();
});
test("owner check restricts test events to generic webhook workflows", async () => {
  await handle();
  expect(db.zap.findFirst).toHaveBeenCalledWith({
    where: { id: "workflow", userId: 2, trigger: { triggerId: "webhook" } },
    select: { id: true, actions: { select: { id: true } } },
  });
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toBe("http://hooks:3002/hooks/catch/2/workflow");
  expect(JSON.parse(options.body)).toEqual(req.body.payload);
  expect(options.redirect).toBe("manual");
  expect(options.signal).toBeDefined();
  expect(res.status).toHaveBeenCalledWith(202);
});
test("foreign, missing or provider workflows are not forwarded", async () => {
  db.zap.findFirst.mockResolvedValue(null);
  await handle();
  expect(res.status).toHaveBeenCalledWith(404);
  expect(fetcher).not.toHaveBeenCalled();
});
test("requires at least one saved action", async () => {
  db.zap.findFirst.mockResolvedValue({ id: "workflow", actions: [] });
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fetcher).not.toHaveBeenCalled();
});
test("does not accept browser-provided URLs", async () => {
  req.body.url = "https://evil.example";
  await handle();
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fetcher).not.toHaveBeenCalled();
});
test("forwards to hooks once and never loops over individual actions", async () => {
  await handle();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
test("hook rejection is reported safely", async () => {
  fetcher.mockResolvedValue({ ok: false });
  await handle();
  expect(res.status).toHaveBeenCalledWith(502);
});
test.each([false, null])(
  "unconfirmed response %s warns against duplicate sending",
  async (success) => {
    fetcher.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ success }) });
    await handle();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].message).toContain("Task history");
  },
);
test("network ambiguity is not retried automatically", async () => {
  fetcher.mockRejectedValue(new Error("secret-url"));
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("secret-url");
});
test("database failure does not forward", async () => {
  db.zap.findFirst.mockRejectedValue(new Error("offline"));
  await handle();
  expect(res.status).toHaveBeenCalledWith(503);
  expect(fetcher).not.toHaveBeenCalled();
});
