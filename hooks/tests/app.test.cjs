const mockApp = { post: jest.fn(), use: jest.fn(), get: jest.fn() };
const mockExpress = jest.fn(() => mockApp);
mockExpress.raw = jest.fn(() => "raw-parser");
mockExpress.json = jest.fn(() => "json-parser");
jest.mock("express", () => mockExpress);
jest.mock("../src/github.ts", () => ({ createGitHubHandler: jest.fn(() => "github-handler") }));
jest.mock("../src/handler.ts", () => ({ createWebhookHandler: jest.fn(() => "generic-handler") }));
jest.mock("../src/tally.ts", () => ({ createTallyHandler: jest.fn(() => "tally-handler") }));
const { createHooksApp } = require("../src/app.ts");
test("mounts raw GitHub parsing before the generic JSON parser", () => {
  const result = createHooksApp({});
  expect(result).toBe(mockApp);
  expect(mockExpress.raw).toHaveBeenCalledWith({
    type: "application/json",
    limit: "1mb",
    inflate: false,
  });
  expect(mockApp.post.mock.calls[0]).toEqual([
    "/hooks/github/:workflowId",
    "raw-parser",
    "github-handler",
  ]);
  expect(mockApp.post.mock.invocationCallOrder[0]).toBeLessThan(
    mockApp.use.mock.invocationCallOrder[0],
  );
  expect(mockApp.post.mock.calls[1]).toEqual([
    "/hooks/tally/:workflowId",
    "raw-parser",
    "tally-handler",
  ]);
  expect(mockApp.post.mock.calls[2]).toEqual(["/hooks/catch/:userId/:zapId", "generic-handler"]);
});
test.each([true, false])("health reports database readiness %s", async (available) => {
  const prisma = {
    $queryRaw: available
      ? jest.fn().mockResolvedValue([])
      : jest.fn().mockRejectedValue(new Error("offline")),
  };
  createHooksApp(prisma, "ab".repeat(32));
  const handler = mockApp.get.mock.calls[0][1];
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await handler({}, res);
  expect(res.json).toHaveBeenCalledWith({ status: available ? "ok" : "unavailable" });
  if (!available) expect(res.status).toHaveBeenCalledWith(503);
});
