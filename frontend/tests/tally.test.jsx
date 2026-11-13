import { ActionListEditor } from "../components/workflow/ActionListEditor";
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import Page from "../app/(dashboard)/zap/create/page";
import { TallyTriggerSetup } from "../components/workflow/TallyTriggerSetup";
import { newAction } from "../lib/actions";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
beforeEach(() => {
  axios.get.mockResolvedValue({ data: { connections: [] } });
  axios.post.mockResolvedValue({ data: { zapId: "workflow" } });
});
test("publishes a Tally workflow through the original popup layout", async () => {
  await act(async () => {
    render(<Page />);
  });
  fireEvent.click(screen.getByRole("button", { name: /1 trigger Trigger/i }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Tally" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Tally form ID"), {
    target: { value: "Form1" },
  });
  fireEvent.change(screen.getByLabelText("Tally signing secret"), {
    target: { value: "unit-tally-signing-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Email" }));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(axios.post).toHaveBeenCalled());
  expect(axios.post.mock.calls[0][1]).toMatchObject({
    availableTriggerId: "tally.form_submitted",
    tally: { formId: "Form1", secret: "unit-tally-signing-secret" },
    actions: [{ actionMetadata: expect.objectContaining({ email: "{{tally.email}}" }) }],
  });
});
test("saved Tally settings preserve secrets and display the public webhook URL", async () => {
  axios.get.mockResolvedValue({
    data: { formId: "Form1", enabled: true, configured: true },
  });
  axios.put.mockResolvedValue({ data: { success: true } });
  await act(async () => {
    render(<TallyTriggerSetup workflowId="workflow" />);
  });
  expect(screen.getByLabelText("Tally signing secret")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Public base URL"), {
    target: { value: "https://example.ngrok-free.dev" },
  });
  expect(
    screen.getByText("https://example.ngrok-free.dev/hooks/tally/workflow"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save Tally trigger" }));
  await screen.findByRole("status");
  expect(axios.put.mock.calls[0][1]).toEqual({
    formId: "Form1",
    enabled: true,
  });
});
test("Tally defaults do not reference GitHub data", () => {
  for (const type of ["email", "slack.send_message", "google_sheets.append_row"])
    expect(JSON.stringify(newAction(type, "tally.form_submitted").actionMetadata)).not.toContain(
      "issue.",
    );
});

test("Tally choices do not offer GitHub issue fields", async () => {
  render(
    <ActionListEditor
      actions={[newAction("google_sheets.append_row", "tally.form_submitted")]}
      connections={[]}
      onChange={jest.fn()}
      trigger="tally.form_submitted"
    />,
  );
  const options = screen.getAllByRole("option").map((option) => option.textContent);
  expect(options).toContain("Name");
  expect(options).not.toContain("Issue title");
});
test("Tally load and save errors are shown without exposing credentials", async () => {
  axios.get.mockRejectedValueOnce(new Error("private"));
  const { unmount } = render(<TallyTriggerSetup workflowId="workflow" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  unmount();
  axios.get.mockResolvedValue({
    data: { formId: "Form1", configured: false, enabled: true },
  });
  axios.put.mockRejectedValue(new Error("private"));
  await act(async () => {
    render(<TallyTriggerSetup workflowId="workflow" />);
  });
  fireEvent.change(screen.getByLabelText("Tally signing secret"), {
    target: { value: "unit-tally-signing-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save Tally trigger" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(axios.put.mock.calls[0][1].secret).toBe("unit-tally-signing-secret");
});
