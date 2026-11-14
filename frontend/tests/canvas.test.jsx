import React, { useState } from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import { WorkflowCanvas } from "../components/workflow/WorkflowCanvas";
import { newAction } from "../lib/actions";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
function Canvas({ initial = [], fixedTrigger = false }) {
  const [actions, setActions] = useState(initial);
  const [trigger, setTrigger] = useState("webhook");
  return (
    <>
      <WorkflowCanvas
        title="Create automation"
        trigger={trigger}
        actions={actions}
        onTriggerChange={setTrigger}
        onActionsChange={setActions}
        onSave={jest.fn()}
        saving={false}
        saveLabel="Publish"
        fixedTrigger={fixedTrigger}
        renderTriggerSettings={(done) => <button onClick={done}>Done</button>}
      />
      <output data-testid="drafts">{JSON.stringify(actions)}</output>
    </>
  );
}
beforeEach(() => {
  axios.get.mockResolvedValue({ data: { connections: [] } });
  axios.post.mockResolvedValue({ data: { connection: { id: "new-connection" } } });
});
const drafts = () => JSON.parse(screen.getByTestId("drafts").textContent);
async function setup() {
  await act(async () => {
    render(<Canvas />);
  });
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
}
test("searching and selecting an app updates only the selected card", async () => {
  await setup();
  fireEvent.change(screen.getByLabelText("Search apps"), { target: { value: "Slack" } });
  expect(screen.queryByRole("button", { name: "Choose Email" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose Slack" }));
  expect(drafts()[0].availableActionId).toBe("slack.send_message");
  expect(screen.getByRole("tab", { name: "setup" })).toHaveAttribute("aria-selected", "true");
});
test("the action connects its account in the same overlay and retains mapped fields", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Choose Slack" }));
  fireEvent.click(screen.getByRole("button", { name: "Connect a new account" }));
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "My team" } });
  fireEvent.change(screen.getByLabelText("Slack webhook URL"), {
    target: { value: "https://hooks.slack.com/services/T/B/secret" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save connection" }).closest("form"));
  await waitFor(() => expect(drafts()[0].credentialId).toBe("new-connection"));
  expect(screen.getByRole("tab", { name: "setup" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(screen.getByRole("tab", { name: "configure" }));
  fireEvent.change(screen.getByLabelText("Slack message"), {
    target: { value: "{{issue.title}}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(drafts()[0].actionMetadata.text).toBe("{{issue.title}}{{name}}: {{message}}");
});
test("a required account is requested before finishing an action", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Choose Google Sheets" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Spreadsheet URL or ID"), {
    target: { value: "sheet-id" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Done" }).closest("form"));
  expect(screen.getByRole("tab", { name: "setup" })).toHaveAttribute("aria-selected", "true");
});
test("saved action IDs survive changing its app in the popup", async () => {
  await act(async () => {
    render(<Canvas initial={[{ ...newAction(), key: "old", id: "saved" }]} />);
  });
  fireEvent.click(screen.getByRole("button", { name: /2 action Email/i }));
  fireEvent.click(screen.getByRole("button", { name: "Change app" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Google Sheets" }));
  expect(drafts()[0]).toMatchObject({
    id: "saved",
    key: "old",
    availableActionId: "google_sheets.append_row",
  });
});
test("closes the overlay on Escape without dropping unsaved action fields", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Choose Email" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "keep@test.dev" } });
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /2 action Email/i }));
  fireEvent.click(screen.getByRole("tab", { name: "configure" }));
  expect(screen.getByLabelText("Recipient")).toHaveValue("keep@test.dev");
});

test("an unconfigured step can be removed directly from the app chooser", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Remove action" }));
  expect(drafts()).toHaveLength(0);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("a delayed connection response does not remove newer steps", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Choose Slack" }));
  fireEvent.click(screen.getByRole("button", { name: "Connect a new account" }));
  let finish;
  axios.post.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "Team" } });
  fireEvent.change(screen.getByLabelText("Slack webhook URL"), {
    target: { value: "https://hooks.slack.com/services/T/B/secret" },
  });
  fireEvent.submit(screen.getByRole("button", { name: "Save connection" }).closest("form"));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Email" }));
  await act(async () => finish({ data: { connection: { id: "saved-connection" } } }));
  expect(drafts()).toHaveLength(2);
  expect(drafts()[0].credentialId).toBe("saved-connection");
  expect(drafts()[1].availableActionId).toBe("email");
});
