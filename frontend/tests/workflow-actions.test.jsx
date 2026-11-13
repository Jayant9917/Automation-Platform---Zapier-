import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { WorkflowActionsPanel } from "../components/workflow/WorkflowActionsPanel";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn(), post: jest.fn(), delete: jest.fn() }));
const action = {
  id: "action",
  actionId: "email",
  credentialId: null,
  Metadata: { email: "unit@test.dev", body: "Hi" },
};
beforeEach(() => {
  axios.get.mockImplementation((url) =>
    Promise.resolve({
      data: url.includes("/connections")
        ? { connections: [] }
        : url.includes("github-trigger")
          ? {
              configured: true,
              repository: "owner/repo",
              enabled: true,
              setupSecretAvailable: false,
              webhookPath: "/hooks/github/workflow",
            }
          : {
              zap: {
                userId: 2,
                trigger: { type: { id: "webhook" } },
                actions: [action],
                actionsRevision: 0,
              },
            },
    }),
  );
  axios.put.mockResolvedValue({ data: { revision: 1 } });
});
async function openEmail() {
  fireEvent.click(await screen.findByRole("button", { name: /2 action Email/i }));
  fireEvent.click(screen.getByRole("tab", { name: "configure" }));
}
test("edits an existing action in the popup and saves stable IDs with its revision", async () => {
  const saved = jest.fn();
  render(<WorkflowActionsPanel workflowId="workflow" onSaved={saved} />);
  await openEmail();
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "other@test.dev" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/Actions saved/);
  expect(axios.put).toHaveBeenCalledWith(
    "/api/v1/zap/workflow/actions",
    {
      revision: 0,
      actions: [
        {
          id: "action",
          availableActionId: "email",
          credentialId: null,
          actionMetadata: { email: "other@test.dev", body: "Hi" },
        },
      ],
    },
    expect.any(Object),
  );
  expect(saved).toHaveBeenCalled();
});
test("a stale save preserves drafts until the user explicitly reloads", async () => {
  render(<WorkflowActionsPanel workflowId="workflow" />);
  await openEmail();
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "unsaved@test.dev" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  axios.put.mockRejectedValue({
    response: { data: { message: "Workflow changed. Reload before saving." } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload before saving");
  await openEmail();
  expect(screen.getByLabelText("Recipient")).toHaveValue("unsaved@test.dev");
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Reload saved actions" }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));
  await openEmail();
  expect(screen.getByLabelText("Recipient")).toHaveValue("unit@test.dev");
});
test("does not show editable workflow data for another owner", async () => {
  axios.get.mockResolvedValue({ data: { connections: [], zap: null } });
  render(<WorkflowActionsPanel workflowId="foreign" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load workflow");
  expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
});
test("removing an action updates the canvas and disables saving an empty workflow", async () => {
  render(<WorkflowActionsPanel workflowId="workflow" />);
  await openEmail();
  fireEvent.click(screen.getByRole("button", { name: "Remove action" }));
  expect(screen.queryByRole("button", { name: /2 action Email/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
test("the trigger opens its own overlay and supports upgrading a generic webhook to GitHub", async () => {
  render(<WorkflowActionsPanel workflowId="workflow" />);
  fireEvent.click(await screen.findByRole("button", { name: /1 trigger Webhook/i }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("http://localhost/hooks/catch/2/workflow")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "setup" }));
  fireEvent.click(screen.getByRole("button", { name: "Change app" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose GitHub" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByLabelText("Repository")).toHaveValue("owner/repo");
  fireEvent.click(screen.getByRole("button", { name: "Save GitHub trigger" }));
  await screen.findByRole("status");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: /1 trigger GitHub/i })).toBeInTheDocument();
});
