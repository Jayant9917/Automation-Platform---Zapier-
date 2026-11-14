import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import axios from "axios";
import Page from "../app/(dashboard)/dashboard/page";
jest.mock("axios", () => ({ get: jest.fn(), delete: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
const id = "aa3f9700-a5e5-4af1-97bd-3496ac539e50";
beforeEach(() => {
  axios.get.mockResolvedValue({
    data: {
      zaps: [
        { id, userId: 2, trigger: { type: { id: "webhook", image: "/webhook.svg" } }, actions: [] },
      ],
    },
  });
  axios.delete.mockResolvedValue({ data: { success: true } });
});
async function setup() {
  await act(async () => {
    render(<Page />);
  });
  fireEvent.click(screen.getByRole("button", { name: `Delete automation ${id}` }));
}
test("requires confirmation and cancellation leaves the automation intact", async () => {
  await setup();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(axios.delete).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: `Delete automation ${id}` })).toBeInTheDocument();
});
test("confirmed deletion removes the row after server success", async () => {
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Delete automation", exact: true }));
  await screen.findByText("No automations yet");
  expect(axios.delete).toHaveBeenCalledWith(`/api/v1/zap/${id}`, expect.any(Object));
});
test("failed deletion keeps the row and shows an actionable error", async () => {
  axios.delete.mockRejectedValue(new Error("offline"));
  await setup();
  fireEvent.click(screen.getByRole("button", { name: "Delete automation", exact: true }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Could not delete"));
  expect(screen.getByRole("button", { name: `Delete automation ${id}` })).toBeInTheDocument();
});
