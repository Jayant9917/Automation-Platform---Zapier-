const { createWorkflowActionHandlers } = require("../src/workflow-actions.ts");
test.each(["create", "update"])(
  "%s identifies the invalid action and field without echoing inputs",
  async (method) => {
    const db = { $transaction: jest.fn() };
    const req = {
      id: "2",
      params: { zapId: "workflow" },
      body: {
        revision: 0,
        availableTriggerId: "webhook",
        actions: [
          {
            availableActionId: "email",
            actionMetadata: { email: "PRIVATE_BAD_ADDRESS", subject: "Hello", body: "Hi" },
          },
          {
            availableActionId: "slack.send_message",
            credentialId: null,
            actionMetadata: { text: "Hello" },
          },
        ],
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await createWorkflowActionHandlers(db)[method](req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const response = res.json.mock.calls[0][0];
    expect(response.message).toMatch(/Action 1.*Email.*Recipient/);
    expect(response.message).toMatch(/Action 2.*Slack.*Connection/);
    expect(JSON.stringify(response)).not.toContain("PRIVATE_BAD_ADDRESS");
    expect(db.$transaction).not.toHaveBeenCalled();
  },
);
