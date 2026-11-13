import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ActionListEditor } from "../components/workflow/ActionListEditor";
import { newAction, actionPayload, apiMessage } from "../lib/actions";
function Editor({ initial = [{ ...newAction(), key: "first" }] }) {
  const [actions, setActions] = useState(initial);
  return (
    <>
      <ActionListEditor
        actions={actions}
        connections={[
          { id: "slack", name: "Team channel", provider: "slack.webhook" },
          { id: "google", name: "My sheet", provider: "google.service_account" },
        ]}
        onChange={setActions}
      />
      <output data-testid="data">{JSON.stringify(actionPayload(actions))}</output>
    </>
  );
}
const payload = () => JSON.parse(screen.getByTestId("data").textContent);
test("users can edit dynamic email fields and insert an event mapping", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Recipient"), { target: { value: "user@test.dev" } });
  fireEvent.click(screen.getByRole("button", { name: "Remove Issue title from Subject" }));
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Issue " } });
  fireEvent.change(screen.getByLabelText("Insert event field into first-subject"), {
    target: { value: "issue.number" },
  });
  fireEvent.change(screen.getByLabelText("Email body"), { target: { value: "{{issue.title}}" } });
  expect(payload()[0]).toMatchObject({
    availableActionId: "email",
    credentialId: null,
    actionMetadata: {
      email: "user@test.dev",
      subject: "Issue {{issue.number}}",
      body: "{{issue.title}}{{issue.title}}\n{{issue.html_url}}",
    },
  });
});
test("adds multiple actions of the same type and removes them independently", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Add action" }));
  expect(screen.getAllByRole("region")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Remove action 1" }));
  expect(payload()).toHaveLength(1);
  expect(payload()[0].availableActionId).toBe("email");
});
test("Slack selection offers only Slack connections and saves a message", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Action type 1"), {
    target: { value: "slack.send_message" },
  });
  const select = screen.getByLabelText("Connection 1");
  expect(within(select).getByText("Team channel")).toBeInTheDocument();
  expect(within(select).queryByText("My sheet")).not.toBeInTheDocument();
  fireEvent.change(select, { target: { value: "slack" } });
  fireEvent.change(screen.getByLabelText("Slack message"), {
    target: { value: "{{issue.title}}" },
  });
  expect(payload()[0]).toMatchObject({
    credentialId: "slack",
    actionMetadata: {
      text: "{{issue.title}}{{repository.full_name}}: {{issue.title}}\n{{issue.html_url}}",
    },
  });
});
test("Sheets selection supports spreadsheet, range, and ordered column mappings", () => {
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("Action type 1"), {
    target: { value: "google_sheets.append_row" },
  });
  fireEvent.change(screen.getByLabelText("Connection 1"), { target: { value: "google" } });
  fireEvent.change(screen.getByLabelText("Spreadsheet URL or ID"), {
    target: { value: "https://docs.google.com/spreadsheets/d/sheet-id/edit" },
  });
  fireEvent.change(screen.getByLabelText("Sheet range"), { target: { value: "Issues!A:F" } });
  fireEvent.change(screen.getByLabelText("Column 1"), {
    target: { value: "{{repository.full_name}}" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add column" }));
  expect(payload()[0].actionMetadata.values).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Remove column 2 from action 1" }));
  expect(payload()[0].actionMetadata.values).toHaveLength(5);
  expect(payload()[0]).toMatchObject({
    credentialId: "google",
    actionMetadata: { range: "Issues!A:F" },
  });
});
test("editing keeps stable IDs and flags unavailable connections", () => {
  render(
    <Editor
      initial={[
        {
          ...newAction("slack.send_message"),
          key: "old",
          id: "saved-action",
          credentialId: "revoked",
        },
      ]}
    />,
  );
  expect(screen.getByText("Connection unavailable")).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Action type 1"), { target: { value: "email" } });
  expect(payload()[0]).toMatchObject({
    id: "saved-action",
    availableActionId: "email",
    credentialId: null,
  });
});
test("an unsupported saved action is not silently converted", () => {
  render(
    <Editor
      initial={[{ key: "old", id: "saved", availableActionId: "other", actionMetadata: {} }]}
    />,
  );
  expect(screen.getByText("Unsupported action")).toBeInTheDocument();
  expect(payload()[0].availableActionId).toBe("other");
});
test("legacy missing subjects display the existing default", () => {
  render(
    <Editor
      initial={[
        {
          key: "legacy",
          availableActionId: "email",
          actionMetadata: { email: "a@test.dev", body: "Hi" },
        },
      ]}
    />,
  );
  expect(screen.getByLabelText("Subject")).toHaveValue("Hello from workflow");
});
test("action limit disables adding further steps", () => {
  render(
    <Editor initial={Array.from({ length: 20 }, (_, i) => ({ ...newAction(), key: `a${i}` }))} />,
  );
  expect(screen.getByRole("button", { name: "Add action" })).toBeDisabled();
});
test("API errors use safe server messages or a fallback", () => {
  expect(apiMessage({ response: { data: { message: "Reload workflow" } } }, "Fallback")).toBe(
    "Reload workflow",
  );
  expect(apiMessage({ response: { data: { error: "Invalid connection" } } }, "Fallback")).toBe(
    "Invalid connection",
  );
  expect(apiMessage(new Error("private detail"), "Fallback")).toBe("Fallback");
});
