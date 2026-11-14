import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import axios from "axios";
import { TaskHistory } from "../components/history/TaskHistory";
import { errorExplanation } from "../lib/history";
jest.mock("axios", () => ({ get: jest.fn() }));
const runId = "aa3f9700-a5e5-4af1-97bd-3496ac539e50",
  workflowId = "bb3f9700-a5e5-4af1-97bd-3496ac539e50";
const action = {
  id: "action-1",
  actionId: "configured-action",
  type: "discord.send_message",
  status: "needs_attention",
  attempts: 1,
  errorCode: "DISCORD_OUTCOME_UNKNOWN",
  createdAt: "2026-11-14T08:00:00.000Z",
  updatedAt: "2026-11-14T08:00:15.000Z",
  nextAttemptAt: "2026-11-14T08:00:00.000Z",
};
const run = {
  id: runId,
  zapId: workflowId,
  createdAt: "2026-11-14T08:00:00.000Z",
  status: "needs_attention",
  zap: { trigger: { type: { name: "GitHub: issue opened" } } },
  actionRuns: [action],
};
const page = (runs = [run], nextCursor = null) => ({
  data: { runs, nextCursor, workflows: [{ id: workflowId, trigger: run.zap.trigger }] },
});
beforeEach(() => {
  axios.get.mockImplementation((url) =>
    Promise.resolve(url.endsWith(runId) ? { data: { run } } : page()),
  );
});
async function setup() {
  await act(async () => {
    render(<TaskHistory />);
  });
}
test("shows safe history and independent action details in the existing overlay", async () => {
  await setup();
  expect(screen.getByRole("heading", { name: "Task history" })).toBeInTheDocument();
  expect(screen.getByText("Discord message")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: `View run ${runId}` }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("1. Discord message");
  expect(
    within(dialog).getByText("Delivery could not be confirmed.", { exact: false }),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("1", { exact: true })).toBeInTheDocument();
  expect(within(dialog).getByRole("link", { name: "Open workflow" })).toHaveAttribute(
    "href",
    `/zap/${workflowId}`,
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("applies workflow/status/date filters on the API and clears them", async () => {
  await setup();
  fireEvent.change(screen.getByLabelText("Workflow"), { target: { value: workflowId } });
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "failed" } });
  fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-11-01" } });
  fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-11-14" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
  expect(axios.get.mock.calls[1][1].params).toMatchObject({
    workflowId,
    status: "failed",
    from: new Date("2026-11-01T00:00:00").toISOString(),
    to: new Date("2026-11-14T23:59:59.999").toISOString(),
  });
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(3));
  expect(axios.get.mock.calls[2][1].params).toEqual({});
});
test("validates inverted dates without a request", async () => {
  await setup();
  fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-11-15" } });
  fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-11-14" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  expect(screen.getByRole("alert")).toHaveTextContent("valid date range");
  expect(axios.get).toHaveBeenCalledTimes(1);
});
test("loads more without duplicating runs and refresh resets pagination", async () => {
  axios.get
    .mockResolvedValueOnce(page([run], "next-page"))
    .mockResolvedValueOnce(page([run, { ...run, id: "second" }]))
    .mockResolvedValue(page([run]));
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByRole("button", { name: "View run second" });
  expect(screen.getAllByRole("button", { name: /View run/ })).toHaveLength(2);
  expect(axios.get.mock.calls[1][1].params.cursor).toBe("next-page");
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "View run second" })).not.toBeInTheDocument(),
  );
});
test("distinguishes no runs from no filter matches", async () => {
  axios.get.mockResolvedValue(page([]));
  await setup();
  expect(screen.getByText("No runs yet")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "failed" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByText("No matching runs");
});
test("list failure is visible and retry recovers", async () => {
  axios.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page());
  await setup();
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load task history");
  fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
  await screen.findByRole("button", { name: `View run ${runId}` });
});
test("detail errors can be retried and retry schedule is displayed", async () => {
  await setup();
  axios.get.mockRejectedValueOnce({ response: { data: { message: "Run not found" } } });
  fireEvent.click(screen.getByRole("button", { name: `View run ${runId}` }));
  await screen.findByText("Run not found");
  axios.get.mockResolvedValue({
    data: {
      run: {
        ...run,
        status: "running",
        actionRuns: [{ ...action, status: "retry", errorCode: "PROVIDER_RATE_LIMITED" }],
      },
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Retry details" }));
  await screen.findByText("Next retry");
  expect(screen.getByText("Retry scheduled")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh details" }));
  await screen.findByText("Next retry");
});
test("older runs show an honest lack of action records", async () => {
  axios.get.mockImplementation((url) =>
    Promise.resolve(
      url.endsWith(runId)
        ? { data: { run: { ...run, status: "pending", actionRuns: [] } } }
        : page(),
    ),
  );
  await setup();
  fireEvent.click(screen.getByRole("button", { name: `View run ${runId}` }));
  await screen.findByText(/Older runs may predate/);
});
test("ignores a slow stale filter response", async () => {
  await setup();
  let finish;
  axios.get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue(page([]));
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "failed" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByText("No matching runs");
  await act(async () => {
    finish(page());
  });
  expect(screen.getByText("No matching runs")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: `View run ${runId}` })).not.toBeInTheDocument();
});
test.each([
  "CONNECTION_REQUIRED",
  "CONNECTION_NOT_AVAILABLE",
  "CONNECTION_UNREADABLE",
  "MISSING_EVENT_FIELD",
  "INVALID_EVENT_FIELD",
  "INVALID_TEMPLATE",
  "RESOLVED_VALUE_TOO_LONG",
  "PROVIDER_REJECTED",
  "PROVIDER_RATE_LIMITED",
  "RETRY_LIMIT_REACHED",
  "UNSUPPORTED_ACTION",
  "INVALID_DISCORD_CONNECTION",
  "INVALID_EMAIL_CONFIG",
  "LEASE_EXPIRED",
  "UNKNOWN_ERROR",
])("explains %s without exposing payloads", (code) => {
  expect(errorExplanation(code).length).toBeGreaterThan(20);
});
test("no error has no explanation", () => {
  expect(errorExplanation(null)).toBe("");
});
