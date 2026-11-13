const { ActionSchema, actionProviders } = require("../src/action-config.ts");
const id = "aa3f9700-a5e5-4af1-97bd-3496ac539e50";
test("Discord actions require an owned-connection reference and bounded template", () => {
  const input = {
    availableActionId: "discord.send_message",
    credentialId: id,
    actionMetadata: { text: "Issue: {{issue.title}}" },
  };
  expect(ActionSchema.safeParse(input).success).toBe(true);
  expect(actionProviders[input.availableActionId]).toBe("discord.webhook");
  for (const text of ["", " ", "x".repeat(2001), "{{constructor.x}}"])
    expect(ActionSchema.safeParse({ ...input, actionMetadata: { text } }).success).toBe(false);
  expect(ActionSchema.safeParse({ ...input, credentialId: null }).success).toBe(false);
});
