import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { ToastContainer } from "../components/ui/toast";
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
test("a stale save shows only a toast and preserves drafts until explicitly reloaded", async () => {
  render(
    <>
      <ToastContainer />
      <WorkflowActionsPanel workflowId="workflow" />
    </>,
  );
  await openEmail();
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "unsaved@test.dev" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  axios.put.mockRejectedValue({
    response: { data: { message: "Workflow changed. Reload before saving." } },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload before saving");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
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
  await screen.findByText(/^GitHub trigger saved\. In GitHub/);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: /1 trigger GitHub/i })).toBeInTheDocument();
});

function mockSavedGitHub() {
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
                trigger: { type: { id: "github.issue_opened" } },
                actions: [action],
                actionsRevision: 0,
              },
            },
    }),
  );
}
test.each(["github.issue_closed", "github.pull_request_opened"])(
  "changes the saved GitHub event to %s without replacing credentials",
  async (type) => {
    mockSavedGitHub();
    render(<WorkflowActionsPanel workflowId="workflow" />);
    fireEvent.click(await screen.findByRole("button", { name: /1 trigger GitHub/i }));
    expect(screen.getByLabelText("GitHub event")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("GitHub event"), { target: { value: type } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByLabelText("Repository")).toHaveValue("owner/repo");
    expect(screen.getByLabelText("GitHub webhook secret")).toHaveValue("");
    expect(screen.getByRole("note")).toHaveTextContent("not saved yet");
    fireEvent.click(screen.getByRole("button", { name: "Save GitHub trigger" }));
    await waitFor(() =>
      expect(axios.put).toHaveBeenCalledWith(
        "/api/v1/zap/workflow/github-trigger",
        { repository: "owner/repo", enabled: true, triggerType: type },
        expect.any(Object),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("note")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: /1 trigger GitHub/i })).toHaveTextContent(
      type === "github.issue_closed" ? "Issue closed" : "Pull request opened",
    );
    expect(screen.getByRole("button", { name: /2 action Email/i })).toBeInTheDocument();
  },
);
test("closing an unsaved GitHub event change restores the saved event", async () => {
  mockSavedGitHub();
  render(<WorkflowActionsPanel workflowId="workflow" />);
  fireEvent.click(await screen.findByRole("button", { name: /1 trigger GitHub/i }));
  fireEvent.change(screen.getByLabelText("GitHub event"), {
    target: { value: "github.issue_closed" },
  });
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: /1 trigger GitHub/i }));
  expect(screen.getByLabelText("GitHub event")).toHaveValue("github.issue_opened");
  expect(axios.put).not.toHaveBeenCalled();
});
