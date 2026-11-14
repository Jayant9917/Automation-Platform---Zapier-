const { createRunHistoryHandlers, runStatusFilter } = require("../src/run-history.ts");
const { getExecutionStatus } = require("../src/execution-status.ts");
const id = "aa3f9700-a5e5-4af1-97bd-3496ac539e50",
  workflowId = "bb3f9700-a5e5-4af1-97bd-3496ac539e50";
let db, req, res;
const run = () => ({
  id,
  zapId: workflowId,
  createdAt: new Date("2026-11-14T08:00:00.000Z"),
  zap: { trigger: { type: { name: "GitHub: issue opened" } } },
  actionRuns: [
    { id: "a", status: "succeeded" },
    { id: "b", status: "failed" },
  ],
});
beforeEach(() => {
  db = {
    zap: { findMany: jest.fn().mockResolvedValue([{ id: workflowId }]) },
    zapRun: {
      findMany: jest.fn().mockResolvedValue([run()]),
      findFirst: jest.fn().mockResolvedValue(run()),
    },
  };
  req = { id: "2", params: { runId: id }, query: {} };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
});
const handlers = () => createRunHistoryHandlers(db);
test("history is bounded, owner-scoped and selects only safe metadata", async () => {
  await handlers().list(req, res);
  const query = db.zapRun.findMany.mock.calls[0][0];
  expect(query.where.AND).toContainEqual({ zap: { userId: 2 } });
  expect(query.take).toBe(26);
  expect(query.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  expect(query.select.metadata).toBeUndefined();
  expect(query.select.actionRuns.select.config).toBeUndefined();
  expect(query.select.actionRuns.select.credentialId).toBeUndefined();
  expect(db.zap.findMany.mock.calls[0][0].where).toEqual({ userId: 2, deletedAt: null });
  expect(res.json.mock.calls[0][0]).toMatchObject({
    runs: [{ status: "partially_failed" }],
    nextCursor: null,
  });
});
test("workflow, status and dates filter before pagination", async () => {
  req.query = {
    workflowId,
    status: "failed",
    from: "2026-11-01T00:00:00.000Z",
    to: "2026-11-14T23:59:59.999Z",
  };
  await handlers().list(req, res);
  const filters = db.zapRun.findMany.mock.calls[0][0].where.AND;
  expect(filters).toContainEqual({ zapId: workflowId });
  expect(filters).toContainEqual(runStatusFilter("failed"));
  expect(filters).toContainEqual({ createdAt: { gte: new Date(req.query.from) } });
  expect(filters).toContainEqual({ createdAt: { lte: new Date(req.query.to) } });
});
test("next page uses a stable timestamp and ID cursor", async () => {
  db.zapRun.findMany.mockResolvedValue(Array.from({ length: 26 }, () => run()));
  await handlers().list(req, res);
  const result = res.json.mock.calls[0][0];
  expect(result.runs).toHaveLength(25);
  expect(result.nextCursor).toBeTruthy();
  req.query.cursor = result.nextCursor;
  await handlers().list(req, res);
  expect(db.zapRun.findMany.mock.calls[1][0].where.AND).toContainEqual({
    OR: [{ createdAt: { lt: run().createdAt } }, { createdAt: run().createdAt, id: { lt: id } }],
  });
});
test("empty history has no next cursor", async () => {
  db.zapRun.findMany.mockResolvedValue([]);
  await handlers().list(req, res);
  expect(res.json.mock.calls[0][0].runs).toEqual([]);
  expect(res.json.mock.calls[0][0].nextCursor).toBeNull();
});
test.each([undefined, "bad", "0", "1.5"])(
  "rejects invalid owner %s for both reads",
  async (owner) => {
    req.id = owner;
    await handlers().list(req, res);
    await handlers().detail(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(db.zapRun.findMany).not.toHaveBeenCalled();
    expect(db.zapRun.findFirst).not.toHaveBeenCalled();
  },
);
test.each([
  { status: "invalid" },
  { workflowId: "bad" },
  { from: "not-a-date" },
  { status: ["failed"] },
  { cursor: "bad" },
  { cursor: Buffer.from(JSON.stringify({ id: "bad", createdAt: "bad" })).toString("base64url") },
  { from: "2026-11-15T00:00:00Z", to: "2026-11-14T00:00:00Z" },
])("rejects invalid filters %s", async (query) => {
  req.query = query;
  await handlers().list(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.zapRun.findMany).not.toHaveBeenCalled();
});
test("detail selects one run only through its workflow owner", async () => {
  await handlers().detail(req, res);
  const query = db.zapRun.findFirst.mock.calls[0][0];
  expect(query.where).toEqual({ id, zap: { userId: 2 } });
  expect(query.select.metadata).toBeUndefined();
  expect(query.select.actionRuns.select.errorCode).toBe(true);
  expect(res.json.mock.calls[0][0].run.status).toBe("partially_failed");
});
test("foreign or missing run cannot be read", async () => {
  db.zapRun.findFirst.mockResolvedValue(null);
  await handlers().detail(req, res);
  expect(res.status).toHaveBeenCalledWith(404);
});
test("invalid run ID is rejected before a query", async () => {
  req.params.runId = "bad";
  await handlers().detail(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(db.zapRun.findFirst).not.toHaveBeenCalled();
});
test.each(["list", "detail"])("database failure returns a safe error for %s", async (method) => {
  db.zapRun.findMany.mockRejectedValue(new Error("private connection"));
  db.zapRun.findFirst.mockRejectedValue(new Error("private connection"));
  await handlers()[method](req, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(JSON.stringify(res.json.mock.calls)).not.toContain("private connection");
});
// Evaluate the relation predicates against sample action statuses without a real database.
function matches(filter, statuses) {
  if (filter.AND) return filter.AND.every((part) => matches(part, statuses));
  const relation = filter.actionRuns;
  const predicate = (status) => {
    const condition = (relation.some ?? relation.none ?? relation.every).status;
    return condition === undefined
      ? true
      : typeof condition === "string"
        ? status === condition
        : condition.in
          ? condition.in.includes(status)
          : status !== condition.not;
  };
  return relation.some
    ? statuses.some(predicate)
    : relation.none
      ? !statuses.some(predicate)
      : statuses.every(predicate);
}
test.each(
  [
    [],
    ["pending"],
    ["retry", "failed"],
    ["running", "needs_attention"],
    ["succeeded", "needs_attention"],
    ["succeeded"],
    ["succeeded", "failed"],
    ["failed"],
    ["failed", "failed"],
    ["cancelled"],
    ["cancelled", "succeeded"],
    ["cancelled", "failed"],
  ].map((states) => [states]),
)("status filter agrees with business status for %s", (states) => {
  const expected = getExecutionStatus(states);
  for (const status of [
    "cancelled",
    "pending",
    "running",
    "succeeded",
    "failed",
    "partially_failed",
    "needs_attention",
  ])
    expect(matches(runStatusFilter(status), states)).toBe(status === expected);
});
