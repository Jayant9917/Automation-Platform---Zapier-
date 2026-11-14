jest.mock("node:https", () => ({ request: jest.fn() }));
const { request } = require("node:https");
const { EventEmitter } = require("node:events");
const {
  createHttpHandler,
  publicAddress,
  renderJson,
  sendPublicRequest,
} = require("../src/actions/custom-http.ts");
const { parseHttpConnection } = require("../src/http-config.ts");
const credential = {
  origin: "https://api.example.com",
  headers: { Authorization: "Bearer private-token" },
};
const config = {
  method: "POST",
  url: "https://api.example.com/events",
  body: '{"title":"{{issue.title}}"}',
};
const context = { issue: { title: 'A "quoted" title' }, execution: { actionId: "action-run" } };
test.each([
  "127.0.0.1",
  "10.0.0.1",
  "172.17.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.100.100.200",
  "0.0.0.0",
  "224.0.0.1",
  "198.18.0.1",
])("blocks non-public IPv4 %s", (ip) => expect(publicAddress(ip)).toBe(false));
test("renders JSON values without allowing event text to break JSON", async () => {
  const resolve = jest.fn().mockResolvedValue(["8.8.8.8"]),
    send = jest.fn().mockResolvedValue(201);
  await createHttpHandler(resolve, send).execute(config, context, credential);
  const request = send.mock.calls[0][0];
  expect(JSON.parse(request.body)).toEqual({ title: context.issue.title });
  expect(request.address).toBe("8.8.8.8");
  expect(request.headers).toMatchObject({
    authorization: "Bearer private-token",
    "idempotency-key": "action-run",
  });
});
test("rejects DNS answers containing even one private address before sending", async () => {
  const send = jest.fn();
  await expect(
    createHttpHandler(async () => ["8.8.8.8", "127.0.0.1"], send).execute(
      config,
      context,
      credential,
    ),
  ).rejects.toMatchObject({ code: "HTTP_DESTINATION_BLOCKED" });
  expect(send).not.toHaveBeenCalled();
});
test("does not send credentials to another origin", async () => {
  const send = jest.fn();
  await expect(
    createHttpHandler(jest.fn(), send).execute(
      { ...config, url: "https://other.example/events" },
      context,
      credential,
    ),
  ).rejects.toMatchObject({ code: "HTTP_ORIGIN_MISMATCH" });
  expect(send).not.toHaveBeenCalled();
});
test.each([
  [302, "POST", "HTTP_REDIRECT_BLOCKED", "failed"],
  [503, "POST", "HTTP_OUTCOME_UNKNOWN", "needs_attention"],
  [503, "GET", "HTTP_OUTCOME_UNKNOWN", "retry"],
  [401, "POST", "PROVIDER_REJECTED", "failed"],
  [429, "GET", "PROVIDER_RATE_LIMITED", "retry"],
])("handles status %s for %s", async (status, method, code, outcome) => {
  await expect(
    createHttpHandler(
      async () => ["8.8.8.8"],
      async () => status,
    ).execute({ ...config, method }, context, credential),
  ).rejects.toMatchObject({ code, outcome });
});
test("uncertain POST delivery is not blindly retried", async () => {
  await expect(
    createHttpHandler(
      async () => ["8.8.8.8"],
      async () => {
        throw new Error("private internal details");
      },
    ).execute(config, context, credential),
  ).rejects.toMatchObject({ code: "HTTP_OUTCOME_UNKNOWN", outcome: "needs_attention" });
});
test("retains missing-field errors", async () => {
  await expect(createHttpHandler().execute(config, {}, credential)).rejects.toMatchObject({
    code: "MISSING_EVENT_FIELD",
  });
});
test.each([
  { origin: "http://example.com", headers: {} },
  { origin: "https://example.com", headers: { Host: "localhost" } },
  { origin: "https://example.com", headers: { Authorization: "bad\r\nheader" } },
])("rejects invalid connection %j", (value) => expect(() => parseHttpConnection(value)).toThrow());
test("rejects event placeholders in JSON object keys", () =>
  expect(() => renderJson({ "{{issue.title}}": "value" }, context)).toThrow());

test("transport pins DNS, validates the original TLS host and does not follow redirects", async () => {
  const response = new EventEmitter();
  response.statusCode = 302;
  const req = new EventEmitter();
  req.end = jest.fn(() => {
    response.emit("data", Buffer.from("redirect"));
    response.emit("end");
  });
  request.mockImplementation((url, options, receive) => {
    expect(url.hostname).toBe("api.example.com");
    expect(options.agent).toBe(false);
    const callback = jest.fn();
    options.lookup("api.example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "8.8.8.8", 4);
    receive(response);
    return req;
  });
  expect(
    await sendPublicRequest({
      url: new URL("https://api.example.com/events"),
      address: "8.8.8.8",
      method: "GET",
      headers: {},
      body: "",
    }),
  ).toBe(302);
  expect(request).toHaveBeenCalledTimes(1);
});
test("transport limits response size", async () => {
  const response = new EventEmitter(),
    req = new EventEmitter();
  req.destroy = (error) => req.emit("error", error);
  req.end = () => response.emit("data", Buffer.alloc(1048577));
  request.mockImplementation((_url, _options, receive) => {
    receive(response);
    return req;
  });
  await expect(
    sendPublicRequest({
      url: new URL("https://api.example.com"),
      address: "8.8.8.8",
      method: "POST",
      headers: {},
      body: "{}",
    }),
  ).rejects.toThrow("RESPONSE_TOO_LARGE");
});
test.each(["garbage", "{", undefined])(
  "rejects invalid HTTP JSON configuration %s",
  async (body) => {
    await expect(
      createHttpHandler().execute({ ...config, body }, context, credential),
    ).rejects.toMatchObject({ code: "INVALID_HTTP_CONFIG" });
  },
);
test("supports public literal IPv4 and rejects literal IPv6", async () => {
  const resolve = jest.fn(),
    send = jest.fn().mockResolvedValue(200);
  await createHttpHandler(resolve, send).execute(
    { ...config, url: "https://8.8.8.8/", method: "GET" },
    context,
    { origin: "https://8.8.8.8", headers: {} },
  );
  expect(resolve).not.toHaveBeenCalled();
  await expect(
    createHttpHandler(resolve, send).execute({ ...config, url: "https://[::1]/" }, context, {
      origin: "https://[::1]",
      headers: {},
    }),
  ).rejects.toMatchObject({ code: "HTTP_DESTINATION_BLOCKED" });
});
test("DNS failures retry without issuing any HTTP request", async () => {
  const send = jest.fn();
  await expect(
    createHttpHandler(async () => {
      throw new Error();
    }, send).execute(config, context, credential),
  ).rejects.toMatchObject({ code: "HTTP_DNS_UNAVAILABLE", outcome: "retry" });
  expect(send).not.toHaveBeenCalled();
});
