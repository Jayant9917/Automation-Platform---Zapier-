import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionListEditor } from "../components/workflow/ActionListEditor";
import { newAction } from "../lib/actions";
function Editor() {
  const [actions, setActions] = useState([
    { ...newAction("google_sheets.append_row"), key: "sheet" },
  ]);
  return (
    <>
      <ActionListEditor actions={actions} connections={[]} onChange={setActions} view="fields" />
      <output data-testid="saved">{JSON.stringify(actions[0].actionMetadata.values)}</output>
    </>
  );
}
test("shows friendly chips while preserving stored mappings and mixed text", () => {
  render(<Editor />);
  expect(
    screen.getByRole("button", { name: "Remove Issue title from Column 1" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Column 1")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Column 1"), { target: { value: "Issue: " } });
  expect(JSON.parse(screen.getByTestId("saved").textContent)[0]).toBe("Issue: {{issue.title}}");
  fireEvent.change(screen.getByLabelText("Insert event field into sheet-column-0"), {
    target: { value: "issue.number" },
  });
  expect(JSON.parse(screen.getByTestId("saved").textContent)[0]).toBe(
    "Issue: {{issue.title}}{{issue.number}}",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove Issue title from Column 1" }));
  expect(JSON.parse(screen.getByTestId("saved").textContent)[0]).toBe("Issue: {{issue.number}}");
});
