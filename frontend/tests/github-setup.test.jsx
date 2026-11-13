import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import axios from "axios";
import { GitHubTriggerSetup } from "../components/workflow/GitHubTriggerSetup";
jest.mock("axios", () => ({ get: jest.fn(), put: jest.fn() }));
const initial = {
  configured: false,
  repository: "",
  enabled: true,
  setupSecretAvailable: false,
  webhookPath: "/hooks/github/workflow",
};
beforeEach(() => {
  localStorage.setItem("token", "unit-token");
  axios.get.mockResolvedValue({ data: initial });
  axios.put.mockResolvedValue({ data: { success: true } });
});
const show = async (data = initial, props = {}) => {
  axios.get.mockResolvedValue({ data });
  const view = render(<GitHubTriggerSetup workflowId="workflow" {...props} />);
  await screen.findByLabelText("Repository");
  return view;
};
const submit = () =>
  fireEvent.submit(screen.getByRole("button", { name: "Save GitHub trigger" }).closest("form"));
test("loads settings with authorization and requires a new secret", async () => {
  await show();
  expect(axios.get).toHaveBeenCalledWith(
    "/api/v1/zap/workflow/github-trigger",
    expect.objectContaining({ headers: { Authorization: "Bearer unit-token" } }),
  );
  expect(screen.getByLabelText("GitHub webhook secret")).toBeRequired();
  expect(screen.getByText("http://localhost/hooks/github/workflow")).toBeInTheDocument();
});
test("configured workflow preserves secret unless replaced", async () => {
  await show({ ...initial, configured: true, repository: "owner/repo" });
  expect(screen.getByLabelText("GitHub webhook secret")).not.toBeRequired();
  submit();
  await screen.findByRole("status");
  expect(axios.put).toHaveBeenCalledWith(
    expect.any(String),
    { repository: "owner/repo", enabled: true, triggerType: "github.issue_opened" },
    expect.any(Object),
  );
});
test("can import a scoped environment secret without exposing it", async () => {
  await show({ ...initial, setupSecretAvailable: true });
  expect(screen.getByLabelText("GitHub webhook secret")).not.toBeRequired();
  expect(screen.getByText(/Leave blank to import the GITHUB_SECRETS/)).toBeInTheDocument();
});
test("saves replacement secret, clears it, and refreshes the workflow", async () => {
  const onSaved = jest.fn();
  await show(initial, { onSaved });
  fireEvent.change(screen.getByLabelText("Repository"), { target: { value: "owner/repo" } });
  fireEvent.change(screen.getByLabelText("GitHub webhook secret"), {
    target: { value: "unit-webhook-secret" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  submit();
  await screen.findByRole("status");
  expect(axios.put).toHaveBeenCalledWith(
    expect.any(String),
    {
      repository: "owner/repo",
      secret: "unit-webhook-secret",
      enabled: false,
      triggerType: "github.issue_opened",
    },
    expect.any(Object),
  );
  expect(screen.getByLabelText("GitHub webhook secret")).toHaveValue("");
  expect(onSaved).toHaveBeenCalledTimes(1);
});
test("displays a public tunnel URL without sending it as server configuration", async () => {
  await show({ ...initial, configured: true, repository: "owner/repo" });
  fireEvent.change(screen.getByLabelText("Public base URL"), {
    target: { value: "https://unit.ngrok-free.dev/" },
  });
  expect(screen.getByText("https://unit.ngrok-free.dev/hooks/github/workflow")).toBeInTheDocument();
  submit();
  await screen.findByRole("status");
  expect(axios.put.mock.calls[0][1]).not.toHaveProperty("publicBase");
});
test("reports failed load and never shows a usable connection form", async () => {
  axios.get.mockRejectedValue(new Error("private provider detail"));
  render(<GitHubTriggerSetup workflowId="workflow" />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load");
  expect(screen.queryByRole("button", { name: "Save GitHub trigger" })).not.toBeInTheDocument();
});
test("reports failed save without provider details", async () => {
  await show();
  axios.put.mockRejectedValue(new Error("private provider detail"));
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
  expect(screen.queryByText(/private provider detail/)).not.toBeInTheDocument();
});
test("disables saving until the request completes", async () => {
  await show();
  let finish;
  axios.put.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  submit();
  expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
  await act(async () => finish({ data: {} }));
  expect(screen.getByRole("button", { name: "Save GitHub trigger" })).not.toBeDisabled();
});
test("ignores a load response after unmount", async () => {
  let finish;
  axios.get.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(<GitHubTriggerSetup workflowId="workflow" />);
  view.unmount();
  await act(async () => finish({ data: initial }));
  expect(view.container).toBeEmptyDOMElement();
});
test("ignores a load rejection after unmount", async () => {
  let reject;
  axios.get.mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  const view = render(<GitHubTriggerSetup workflowId="workflow" />);
  view.unmount();
  await act(async () => reject(new Error("offline")));
  expect(view.container).toBeEmptyDOMElement();
});
test("a missing login token does not expose another credential", async () => {
  localStorage.removeItem("token");
  await show();
  await waitFor(() => expect(axios.get.mock.calls[0][1].headers.Authorization).toBe("Bearer "));
});
