import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import Page from "../app/(dashboard)/zap/create/page";
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
beforeEach(() => {
  axios.get.mockResolvedValue({ data: { connections: [] } });
  axios.post.mockResolvedValue({ data: { zapId: "created-workflow" } });
});
async function chooseTrigger(name = "Webhook") {
  fireEvent.click(screen.getByRole("button", { name: /1 trigger Trigger/i }));
  fireEvent.click(screen.getByRole("button", { name: `Choose ${name}` }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  if (name === "GitHub") {
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "owner/repo" } });
    fireEvent.change(screen.getByLabelText("GitHub webhook secret"), {
      target: { value: "unit-webhook-secret" },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}
function emailAction() {
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Email" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "unit@test.dev" } });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
}
test("starts with the original trigger canvas and no inline configuration forms", async () => {
  await act(async () => {
    render(<Page />);
  });
  expect(screen.getByRole("button", { name: /1 trigger Trigger/i })).toBeInTheDocument();
  expect(screen.queryByLabelText("Recipient")).not.toBeInTheDocument();
  expect(screen.queryByText("Your connections")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
});
test("publishes configured actions from the header and opens the saved workflow", async () => {
  await act(async () => {
    render(<Page />);
  });
  await chooseTrigger();
  emailAction();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/zap/created-workflow"));
  expect(axios.post).toHaveBeenCalledWith(
    "/api/v1/zap",
    expect.objectContaining({
      availableTriggerId: "webhook",
      actions: [expect.objectContaining({ availableActionId: "email", credentialId: null })],
    }),
    expect.any(Object),
  );
});
test("collects GitHub repository and secret inside the trigger popup before publishing", async () => {
  await act(async () => {
    render(<Page />);
  });
  await chooseTrigger("GitHub");
  emailAction();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(mockPush).toHaveBeenCalled());
  expect(axios.post.mock.calls[0][1]).toMatchObject({
    availableTriggerId: "github.issue_opened",
    github: { repository: "owner/repo", secret: "unit-webhook-secret", enabled: true },
  });
});
test("failed publishing preserves action configuration for correction", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "Choose your own connection" } } });
  await act(async () => {
    render(<Page />);
  });
  await chooseTrigger();
  emailAction();
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choose your own connection");
  fireEvent.click(screen.getByRole("button", { name: /2 action Email/i }));
  fireEvent.click(screen.getByRole("tab", { name: "configure" }));
  expect(screen.getByLabelText("Recipient")).toHaveValue("unit@test.dev");
});

test.each(["github.issue_closed", "github.pull_request_opened"])(
  "publishes the selected GitHub event %s",
  async (triggerType) => {
    await act(async () => {
      render(<Page />);
    });
    fireEvent.click(screen.getByRole("button", { name: /1 trigger Trigger/i }));
    fireEvent.click(screen.getByRole("button", { name: "Choose GitHub" }));
    fireEvent.change(screen.getByLabelText("GitHub event"), { target: { value: triggerType } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "owner/repo" } });
    fireEvent.change(screen.getByLabelText("GitHub webhook secret"), {
      target: { value: "unit-webhook-secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    emailAction();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(axios.post).toHaveBeenCalled());
    expect(axios.post.mock.calls[0][1].availableTriggerId).toBe(triggerType);
    const subject = axios.post.mock.calls[0][1].actions[0].actionMetadata.subject;
    expect(subject).toContain(
      triggerType === "github.issue_closed" ? "Issue closed" : "{{pull_request.title}}",
    );
  },
);
