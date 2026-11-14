import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ToastContainer, toast } from "../components/ui/toast";
import { apiMessage } from "../lib/actions";

afterEach(() => jest.useRealTimers());
test("notifications can be dismissed, pause on hover, and expire", () => {
  jest.useFakeTimers();
  render(<ToastContainer />);
  act(() => toast.error("Action 2: choose a Slack connection."));
  const notification = screen.getByRole("alert");
  fireEvent.mouseEnter(notification);
  act(() => jest.advanceTimersByTime(20000));
  expect(notification).toBeInTheDocument();
  fireEvent.mouseLeave(notification);
  act(() => jest.advanceTimersByTime(12000));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  act(() => toast.success("Actions saved."));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
test("shows at most three notifications and renders text safely", () => {
  render(<ToastContainer />);
  act(() => {
    for (const text of ["first", "second", "third", "<script>secret</script>"]) toast.error(text);
  });
  expect(screen.getAllByRole("alert")).toHaveLength(3);
  expect(screen.queryByText("first")).not.toBeInTheDocument();
  expect(screen.getByText("<script>secret</script>")).toBeInTheDocument();
});
test.each([
  [{ code: "ERR_NETWORK" }, /Docker/],
  [{ code: "ECONNABORTED" }, /timed out/],
  [{ response: { status: 401 } }, /Sign in/],
  [
    { response: { status: 503, data: { message: "private internal error" } } },
    /temporarily unavailable/,
  ],
  [{ response: { status: 400, data: { message: "Action 2: Connection required" } } }, /Action 2/],
])("explains API failure %j", (error, expected) => {
  expect(apiMessage(error, "Try again")).toMatch(expected);
});
