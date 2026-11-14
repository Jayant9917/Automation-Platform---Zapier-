import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionListEditor } from "../components/workflow/ActionListEditor";
import { newAction } from "../lib/actions";
function Editor({ dynamic = false }) {
  const [actions, setActions] = useState([
    {
      ...newAction("email", "webhook"),
      key: "email",
      actionMetadata: dynamic
        ? { email: "me@example.com", subject: "Hello {{name}}", body: "{{message}}" }
        : { email: "me@example.com", subject: "My subject", body: "My message" },
    },
  ]);
  return (
    <>
      <ActionListEditor
        actions={actions}
        connections={[]}
        onChange={setActions}
        trigger="webhook"
        view="fields"
      />
      <output data-testid="saved">{JSON.stringify(actions[0].actionMetadata)}</output>
    </>
  );
}
test("plain email fields are single normal inputs without dropdowns", () => {
  render(<Editor />);
  expect(screen.getByLabelText("Subject")).toHaveValue("My subject");
  expect(screen.getByLabelText("Email body").tagName).toBe("TEXTAREA");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email body"), {
    target: { value: "I can write normally\nSecond line" },
  });
  expect(JSON.parse(screen.getByTestId("saved").textContent).body).toBe(
    "I can write normally\nSecond line",
  );
});
test("event data is optional and can still be inserted", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Use event data for Subject" }));
  fireEvent.change(screen.getByLabelText("Insert event field into email-subject"), {
    target: { value: "name" },
  });
  expect(screen.getByRole("button", { name: "Remove Name from Subject" })).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId("saved").textContent).subject).toBe("My subject{{name}}");
});
test("existing mappings are preserved until user chooses plain text", () => {
  render(<Editor dynamic />);
  expect(JSON.parse(screen.getByTestId("saved").textContent).body).toBe("{{message}}");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Write plain text for Email body" }));
  expect(screen.getByLabelText("Email body")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Email body"), { target: { value: "My own message" } });
  expect(JSON.parse(screen.getByTestId("saved").textContent).body).toBe("My own message");
  fireEvent.click(screen.getByRole("button", { name: "Write plain text for Subject" }));
  expect(screen.getByLabelText("Subject")).toHaveValue("Hello ");
});
