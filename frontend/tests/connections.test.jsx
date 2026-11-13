import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "axios";
import { ConnectionManager } from "../components/workflow/ConnectionManager";
jest.mock("axios", () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
const connection = { id: "connection", name: "Team alerts", provider: "slack.webhook" };
beforeEach(() => {
  localStorage.setItem("token", "unit-token");
  axios.get.mockResolvedValue({ data: { connections: [] } });
  axios.post.mockResolvedValue({ data: {} });
  axios.put.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
  jest.spyOn(window, "confirm").mockReturnValue(true);
});
const show = async (list = []) => {
  axios.get.mockResolvedValue({ data: { connections: list } });
  render(<ConnectionManager />);
  await waitFor(() => expect(axios.get).toHaveBeenCalled());
};
const submit = () =>
  fireEvent.submit(screen.getByRole("button", { name: "Save connection" }).closest("form"));
test("saves a user's Slack connection and clears plaintext from the form", async () => {
  const changed = jest.fn();
  render(<ConnectionManager onChanged={changed} />);
  fireEvent.change(screen.getByLabelText("Connection name"), { target: { value: "Team alerts" } });
  fireEvent.change(screen.getByLabelText("Slack webhook URL"), {
    target: { value: "https://hooks.slack.com/services/T/B/secret" },
  });
  submit();
  await screen.findByRole("status");
  expect(axios.post).toHaveBeenCalledWith(
    "/api/v1/connections",
    {
      name: "Team alerts",
      provider: "slack.webhook",
      secret: "https://hooks.slack.com/services/T/B/secret",
    },
    expect.objectContaining({ headers: { Authorization: "Bearer unit-token" } }),
  );
  expect(screen.getByLabelText("Slack webhook URL")).toHaveValue("");
  expect(changed).toHaveBeenCalled();
});
test("Google connections accept downloaded JSON instead of global env settings", async () => {
  await show();
  fireEvent.change(screen.getByLabelText("Connection provider"), {
    target: { value: "google.service_account" },
  });
  fireEvent.change(screen.getByLabelText("Connection name"), {
    target: { value: "My spreadsheet" },
  });
  fireEvent.change(screen.getByLabelText("Google service-account JSON"), {
    target: {
      value: '{"client_email":"unit@project.iam.gserviceaccount.com","private_key":"unit-key"}',
    },
  });
  submit();
  await screen.findByRole("status");
  expect(axios.post.mock.calls[0][1]).toMatchObject({
    provider: "google.service_account",
    secret: { client_email: "unit@project.iam.gserviceaccount.com", private_key: "unit-key" },
  });
});
test("invalid JSON never leaves the browser", async () => {
  await show();
  fireEvent.change(screen.getByLabelText("Connection provider"), {
    target: { value: "google.service_account" },
  });
  fireEvent.change(screen.getByLabelText("Google service-account JSON"), {
    target: { value: "private invalid json" },
  });
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("Paste valid");
  expect(axios.post).not.toHaveBeenCalled();
});
test("loads safe names, replaces only the selected connection, and supports cancelling", async () => {
  await show([connection]);
  await screen.findByText("Team alerts");
  fireEvent.click(screen.getByRole("button", { name: "Replace credentials" }));
  expect(screen.getByLabelText("Connection provider")).toBeDisabled();
  expect(screen.getByLabelText("Slack webhook URL")).toHaveValue("");
  fireEvent.click(screen.getByRole("button", { name: "Cancel replacement" }));
  expect(screen.getByLabelText("Connection provider")).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Replace credentials" }));
  fireEvent.change(screen.getByLabelText("Slack webhook URL"), {
    target: { value: "replacement" },
  });
  submit();
  await screen.findByRole("status");
  expect(axios.put).toHaveBeenCalledWith(
    "/api/v1/connections/connection",
    expect.objectContaining({ secret: "replacement" }),
    expect.any(Object),
  );
  expect(axios.post).not.toHaveBeenCalled();
});
test("revokes only after user confirmation", async () => {
  await show([connection]);
  const button = await screen.findByRole("button", { name: "Revoke" });
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(button);
  expect(axios.delete).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() =>
    expect(axios.delete).toHaveBeenCalledWith("/api/v1/connections/connection", expect.any(Object)),
  );
});
test("failed loads do not expose credentials", async () => {
  axios.get.mockRejectedValue(new Error("private detail"));
  render(<ConnectionManager />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
});
test("save errors display safe API messages", async () => {
  await show();
  axios.post.mockRejectedValue({ response: { data: { error: "Invalid credentials" } } });
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
});
test("revoke errors are visible", async () => {
  await show([connection]);
  axios.delete.mockRejectedValue(new Error("offline"));
  fireEvent.click(await screen.findByRole("button", { name: "Revoke" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not revoke");
});
