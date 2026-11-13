import React, { useState } from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import { WorkflowCanvas } from "../components/workflow/WorkflowCanvas";
import { actionPayload } from "../lib/actions";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
function Canvas() {
  const [actions, setActions] = useState([]);
  return (
    <>
      <WorkflowCanvas
        title="Create automation"
        trigger="github.issue_opened"
        actions={actions}
        onTriggerChange={jest.fn()}
        onActionsChange={setActions}
        onSave={jest.fn()}
        saving={false}
        saveLabel="Publish"
        renderTriggerSettings={() => null}
      />
      <output data-testid="saved">{JSON.stringify(actionPayload(actions))}</output>
    </>
  );
}
test("users add their own Discord channel and dynamic message in the popup", async () => {
  axios.get.mockResolvedValue({ data: { connections: [] } });
  axios.post.mockResolvedValue({ data: { connection: { id: "discord-connection" } } });
  await act(async () => {
    render(<Canvas />);
  });
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Discord" }));
  fireEvent.click(screen.getByRole("button", { name: "Connect a new account" }));
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "My Discord" } });
  fireEvent.change(screen.getByLabelText("Discord webhook URL"), {
    target: {
      value:
        "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_123456",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save connection" }));
  await waitFor(() =>
    expect(JSON.parse(screen.getByTestId("saved").textContent)[0].credentialId).toBe(
      "discord-connection",
    ),
  );
  expect(axios.post.mock.calls[0][1].provider).toBe("discord.webhook");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Discord message")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Remove Issue title from Discord message" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(JSON.parse(screen.getByTestId("saved").textContent)[0]).toMatchObject({
    availableActionId: "discord.send_message",
    credentialId: "discord-connection",
  });
});
