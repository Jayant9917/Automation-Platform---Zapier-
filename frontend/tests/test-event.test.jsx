import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import { TestEventPanel } from "../components/workflow/TestEventPanel";
import { WorkflowActionsPanel } from "../components/workflow/WorkflowActionsPanel";
import { newAction } from "../lib/actions";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
beforeEach(() => {
  axios.post.mockResolvedValue({ data: { success: true } });
});
function open() {
  render(<TestEventPanel workflowId="workflow" />);
  fireEvent.click(screen.getByRole("button", { name: "Send test event" }));
}
test("editable sample fields send one event for all saved actions", async () => {
  open();
  fireEvent.change(screen.getByLabelText("Field value 1"), { target: { value: "My test" } });
  fireEvent.click(screen.getByRole("button", { name: "Add field" }));
  fireEvent.change(screen.getByLabelText("Field name 4"), { target: { value: "custom" } });
  fireEvent.change(screen.getByLabelText("Field value 4"), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  await screen.findByRole("status");
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0]).toEqual([
    "/api/v1/zap/workflow/test-event",
    {
      payload: {
        name: "My test",
        email: "test@example.com",
        message: "Hello from the frontend",
        custom: "42",
      },
    },
    expect.any(Object),
  ]);
  expect(screen.getByRole("link", { name: "View Task history" })).toHaveAttribute(
    "href",
    "/history",
  );
});
test("duplicate or invalid field names do not send", () => {
  open();
  fireEvent.change(screen.getByLabelText("Field name 2"), { target: { value: "name" } });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("alert")).toHaveTextContent("different name");
  fireEvent.change(screen.getByLabelText("Field name 2"), { target: { value: "__proto__" } });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("alert")).toHaveTextContent("valid name");
  expect(axios.post).not.toHaveBeenCalled();
});
test("advanced JSON allows nested events and rejects malformed data", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Edit JSON (advanced)" }));
  fireEvent.change(screen.getByLabelText("Sample event JSON"), { target: { value: "{" } });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("alert")).toHaveTextContent("JSON syntax");
  fireEvent.change(screen.getByLabelText("Sample event JSON"), {
    target: { value: '{"issue":{"title":"Example"}}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  await screen.findByRole("status");
  expect(axios.post.mock.calls[0][1]).toEqual({ payload: { issue: { title: "Example" } } });
});
test("rejects array JSON and oversized events", () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Edit JSON (advanced)" }));
  fireEvent.change(screen.getByLabelText("Sample event JSON"), { target: { value: "[]" } });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("alert")).toHaveTextContent("JSON object");
  fireEvent.change(screen.getByLabelText("Sample event JSON"), {
    target: { value: JSON.stringify({ value: "x".repeat(65537) }) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("alert")).toHaveTextContent("64 KB");
  expect(axios.post).not.toHaveBeenCalled();
});
test("prevents repeated clicks while sending and reports uncertainty", async () => {
  let fail;
  axios.post.mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  open();
  fireEvent.click(screen.getByRole("button", { name: "Send event" }));
  expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  await act(async () => {
    fail(new Error("offline"));
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Check Task history");
  expect(axios.post).toHaveBeenCalledTimes(1);
});
test("fields can be removed and advanced view can be closed", () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Remove test field 3" }));
  expect(screen.queryByLabelText("Field value 3")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit JSON (advanced)" }));
  fireEvent.click(screen.getByRole("button", { name: "Use simple fields" }));
  expect(screen.getByLabelText("Field value 1")).toBeInTheDocument();
});
test.each([
  [false, "webhook", false],
  [true, "webhook", true],
  [true, "github.issue_opened", false],
  [true, "tally.form_submitted", false],
])("capability %s and trigger %s controls button visibility", async (enabled, trigger, visible) => {
  axios.get.mockImplementation((url) =>
    Promise.resolve(
      url.endsWith("workflow")
        ? {
            data: {
              testEventsEnabled: enabled,
              zap: {
                actions: [],
                actionsRevision: 0,
                userId: 2,
                trigger: { type: { id: trigger } },
              },
            },
          }
        : url.endsWith("github-trigger")
          ? {
              data: {
                configured: true,
                repository: "owner/repo",
                enabled: true,
                setupSecretAvailable: false,
                webhookPath: "/hooks/github/workflow",
              },
            }
          : url.endsWith("tally-trigger")
            ? { data: { configured: true, formId: "Form1", enabled: true } }
            : { data: { connections: [] } },
    ),
  );
  await act(async () => {
    render(<WorkflowActionsPanel workflowId="workflow" />);
  });
  fireEvent.click(screen.getByRole("button", { name: /1 trigger/i }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() =>
    expect(!!screen.queryByRole("button", { name: "Send test event" })).toBe(visible),
  );
});
test("generic action defaults use the sample fields", () => {
  expect(newAction("email", "webhook").actionMetadata.body).toBe("Hello from ActionHub.");
  expect(newAction("discord.send_message", "webhook").actionMetadata.text).toBe(
    "{{name}}: {{message}}",
  );
  expect(newAction("google_sheets.append_row", "webhook").actionMetadata.values).toEqual([
    "{{name}}",
    "{{email}}",
    "{{message}}",
  ]);
});

test("switching editor modes preserves flat text values and keeps nested JSON advanced", () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Edit JSON (advanced)" }));
  fireEvent.change(screen.getByLabelText("Sample event JSON"), {
    target: { value: '{"custom":"saved"}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use simple fields" }));
  expect(screen.getByLabelText("Field name 1")).toHaveValue("custom");
  expect(screen.getByLabelText("Field value 1")).toHaveValue("saved");
  fireEvent.click(screen.getByRole("button", { name: "Edit JSON (advanced)" }));
  fireEvent.change(screen.getByLabelText("Sample event JSON"), {
    target: { value: '{"issue":{"title":"Example"}}' },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use simple fields" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Use advanced JSON");
  expect(screen.getByLabelText("Sample event JSON")).toBeInTheDocument();
});
