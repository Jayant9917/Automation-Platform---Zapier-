import axios from "axios";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn() }));
import React, { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  ScheduleFields,
  initialSchedule,
  ScheduleSetup,
} from "../components/workflow/ScheduleSetup";
import { ActionListEditor } from "../components/workflow/ActionListEditor";
import { newAction } from "../lib/actions";
function Schedule() {
  const [value, setValue] = useState(initialSchedule);
  return <ScheduleFields value={value} onChange={setValue} />;
}
test("chooses daily UTC time and pauses the schedule", () => {
  render(<Schedule />);
  fireEvent.change(screen.getByLabelText("Schedule frequency"), { target: { value: "daily" } });
  fireEvent.change(screen.getByLabelText("Daily time (UTC)"), { target: { value: "17:30" } });
  expect(screen.getByLabelText("Daily time (UTC)")).toHaveValue("17:30");
  fireEvent.click(screen.getByRole("checkbox"));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
});
test("HTTP settings expose method, fixed URL and JSON body", () => {
  const onChange = jest.fn();
  render(
    <ActionListEditor
      actions={[newAction("http.request", "schedule")]}
      connections={[]}
      onChange={onChange}
      view="fields"
      trigger="schedule"
    />,
  );
  fireEvent.change(screen.getByLabelText("HTTPS URL"), {
    target: { value: "https://example.com/events" },
  });
  expect(onChange.mock.calls[0][0][0].actionMetadata.url).toBe("https://example.com/events");
  expect(screen.getByLabelText("HTTP method")).toHaveValue("POST");
  expect(screen.getByLabelText("JSON request body")).toBeInTheDocument();
});

test("loads and saves an existing schedule without changing actions", async () => {
  axios.get.mockResolvedValue({
    data: { schedule: { ...initialSchedule, nextRunAt: "2026-11-15T09:00:00Z" } },
  });
  axios.put.mockResolvedValue({ data: { schedule: { nextRunAt: "2026-11-16T09:00:00Z" } } });
  render(<ScheduleSetup workflowId="workflow" />);
  await screen.findByLabelText("Schedule frequency");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
  await waitFor(() =>
    expect(axios.put).toHaveBeenCalledWith(
      "/api/v1/zap/workflow/schedule",
      { ...initialSchedule, enabled: false },
      expect.any(Object),
    ),
  );
});
