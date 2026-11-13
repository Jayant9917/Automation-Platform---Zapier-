// Run inside a container on the Compose network; uses disposable development records.
import assert from "node:assert/strict";
const base = "http://proxy";
const email = `docker-smoke-${Date.now()}@example.test`;
const password = "development-smoke-only";
async function request(path, body, token) {
  const response = await fetch(`${base}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.ok, true, `${path} returned ${response.status}`);
  return response.json();
}
await request("/api/v1/user/signup", { username: email, password, name: "Docker smoke" });
const { token } = await request("/api/v1/user/signin", { username: email, password });
assert.ok(token);
const triggers = await request("/api/v1/trigger/available");
assert.ok(triggers.availableTriggers.some((item) => item.id === "webhook"));
const actions = await request("/api/v1/action/available");
assert.ok(actions.availableActions.some((item) => item.id === "email"));
const { zapId } = await request(
  "/api/v1/zap",
  {
    availableTriggerId: "webhook",
    actions: [
      {
        availableActionId: "email",
        actionMetadata: { email, body: "Docker workflow smoke passed" },
      },
    ],
  },
  token,
);
const { zaps } = await request("/api/v1/zap", undefined, token);
const zap = zaps.find((item) => item.id === zapId);
assert.ok(zap);
await request(`/hooks/catch/${zap.userId}/${zapId}`, { source: "docker-smoke" });
let delivered = false;
for (let attempt = 0; attempt < 30; attempt++) {
  const result = await fetch("http://mailpit:8025/api/v1/messages").then((response) =>
    response.json(),
  );
  delivered = result.messages.some((message) =>
    message.To.some((recipient) => recipient.Address === email),
  );
  if (delivered) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.equal(delivered, true, "Email was not captured by Mailpit within 30 seconds");
console.log(
  "PASS: Docker gateway, signup/signin, seeded catalog, workflow creation, webhook, PostgreSQL/outbox, Kafka, worker, and captured email.",
);
