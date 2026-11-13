import { newAction } from "../lib/actions";
test("PR actions use pull request data rather than missing issue fields", () => {
  for (const type of ["email", "slack.send_message", "google_sheets.append_row"]) {
    const metadata = JSON.stringify(newAction(type, "github.pull_request_opened").actionMetadata);
    expect(metadata).toContain("{{pull_request.title}}");
    expect(metadata).not.toContain("{{issue.");
  }
});
test("closed issue messages describe closure", () => {
  expect(newAction("email", "github.issue_closed").actionMetadata.subject).toBe(
    "Issue closed: {{issue.title}}",
  );
});
