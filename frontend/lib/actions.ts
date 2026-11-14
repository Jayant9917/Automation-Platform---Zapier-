export type Connection = { id: string; name: string; provider: string };
export type ActionDraft = {
  key: string;
  id?: string;
  availableActionId: string;
  credentialId?: string | null;
  actionMetadata: Record<string, unknown>;
};
export const actionNames: Record<string, string> = {
  "http.request": "HTTP request",
  "discord.send_message": "Discord message",
  email: "Email",
  "slack.send_message": "Slack message",
  "google_sheets.append_row": "Google Sheets row",
};
export const providers: Record<string, string> = {
  "http.request": "http.headers",
  "discord.send_message": "discord.webhook",
  "slack.send_message": "slack.webhook",
  "google_sheets.append_row": "google.service_account",
};
export const eventFields = [
  "schedule.scheduledAt",
  "schedule.firedAt",
  "schedule.frequency",
  "schedule.timezone",
  "name",
  "email",
  "message",
  "tally.name",
  "tally.email",
  "tally.message",
  "tally.formName",
  "tally.submissionId",
  "issue.title",
  "issue.number",
  "issue.html_url",
  "issue.body",
  "issue.user.login",
  "repository.full_name",
  "sender.login",
  "pull_request.title",
  "pull_request.number",
  "pull_request.html_url",
  "pull_request.body",
  "pull_request.user.login",
  "pull_request.head.ref",
  "pull_request.base.ref",
  "execution.id",
  "execution.actionId",
];
export const fieldLabels: Record<string, string> = {
  "schedule.scheduledAt": "Scheduled time",
  "schedule.firedAt": "Started time",
  "schedule.frequency": "Schedule frequency",
  "schedule.timezone": "Time zone",
  name: "Name",
  email: "Email",
  message: "Message",
  "tally.name": "Name",
  "tally.email": "Email",
  "tally.message": "Message",
  "tally.formName": "Form name",
  "tally.submissionId": "Submission ID",
  "issue.title": "Issue title",
  "issue.number": "Issue number",
  "issue.html_url": "Issue link",
  "issue.body": "Issue description",
  "issue.user.login": "Issue author",
  "repository.full_name": "Repository name",
  "sender.login": "Person who triggered the event",
  "pull_request.title": "Pull request title",
  "pull_request.number": "Pull request number",
  "pull_request.html_url": "Pull request link",
  "pull_request.body": "Pull request description",
  "pull_request.user.login": "Pull request author",
  "pull_request.head.ref": "Source branch",
  "pull_request.base.ref": "Target branch",
  "execution.id": "Workflow run ID",
  "execution.actionId": "Action run ID",
};
export const githubEvents = [
  { id: "github.issue_opened", name: "Issue opened" },
  { id: "github.issue_closed", name: "Issue closed" },
  { id: "github.pull_request_opened", name: "Pull request opened" },
];
let nextKey = 0;
export function newAction(type = "email", trigger = "github.issue_opened"): ActionDraft {
  const draft: ActionDraft = {
    key: `draft-${++nextKey}`,
    availableActionId: type,
    ...(providers[type] ? { credentialId: "" } : {}),
    actionMetadata:
      type === "email"
        ? {
            email: "",
            subject: "New issue: {{issue.title}}",
            body: "{{issue.title}}\n{{issue.html_url}}",
          }
        : type === "slack.send_message" || type === "discord.send_message"
          ? { text: "New issue in {{repository.full_name}}: {{issue.title}}\n{{issue.html_url}}" }
          : {
              spreadsheetId: "",
              range: "Sheet1!A:E",
              values: [
                "{{issue.title}}",
                "{{repository.full_name}}",
                "{{issue.number}}",
                "{{issue.html_url}}",
                "{{execution.actionId}}",
              ],
            },
  };
  if (trigger === "github.pull_request_opened") {
    draft.actionMetadata = JSON.parse(
      JSON.stringify(draft.actionMetadata)
        .replaceAll("issue.", "pull_request.")
        .replaceAll("New issue", "New pull request"),
    );
  }
  if (trigger === "github.issue_closed") {
    draft.actionMetadata = JSON.parse(
      JSON.stringify(draft.actionMetadata).replaceAll("New issue", "Issue closed"),
    );
  }
  if (trigger === "tally.form_submitted") {
    draft.actionMetadata =
      type === "email"
        ? {
            email: "{{tally.email}}",
            subject: "Thanks for contacting us",
            body: "Hello {{tally.name}},\nWe received your message: {{tally.message}}",
          }
        : type === "slack.send_message" || type === "discord.send_message"
          ? { text: "New submission from {{tally.name}} ({{tally.email}}): {{tally.message}}" }
          : {
              spreadsheetId: "",
              range: "Sheet1!A:E",
              values: [
                "{{tally.name}}",
                "{{tally.email}}",
                "{{tally.message}}",
                "{{tally.formName}}",
                "{{tally.submissionId}}",
              ],
            };
  }
  if (trigger === "webhook") {
    draft.actionMetadata =
      type === "email"
        ? { email: "", subject: "Message from ActionHub", body: "Hello from ActionHub." }
        : type === "slack.send_message" || type === "discord.send_message"
          ? { text: "{{name}}: {{message}}" }
          : {
              spreadsheetId: "",
              range: "Sheet1!A:C",
              values: ["{{name}}", "{{email}}", "{{message}}"],
            };
  }
  if (trigger === "schedule")
    draft.actionMetadata =
      type === "email"
        ? {
            email: "",
            subject: "Scheduled notification",
            body: "Scheduled run: {{schedule.scheduledAt}}",
          }
        : type === "slack.send_message" || type === "discord.send_message"
          ? { text: "Scheduled run: {{schedule.scheduledAt}}" }
          : {
              spreadsheetId: "",
              range: "Sheet1!A:B",
              values: ["{{schedule.scheduledAt}}", "{{execution.id}}"],
            };
  if (type === "http.request")
    draft.actionMetadata = { method: "POST", url: "", body: '{"message":"Hello from ActionHub"}' };
  return draft;
}
export function actionPayload(actions: ActionDraft[]) {
  return actions.map(({ id, availableActionId, credentialId, actionMetadata }) => ({
    ...(id ? { id } : {}),
    availableActionId,
    credentialId: providers[availableActionId] ? credentialId : null,
    actionMetadata,
  }));
}
export function apiOptions() {
  return {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
    timeout: 15000,
  };
}
export function apiMessage(error: unknown, fallback: string): string {
  const failure = error as { code?: string; response?: { status?: number } } | null;
  if (failure?.code === "ECONNABORTED" || failure?.code === "ETIMEDOUT")
    return "The request timed out. Check whether your changes were saved before trying again.";
  if (failure?.code === "ERR_NETWORK")
    return "Cannot reach ActionHub. Check your connection and that Docker is running, then try again.";
  if (failure?.response?.status === 401)
    return "Your login has expired. Sign in again before saving.";
  if ((failure?.response?.status ?? 0) >= 500)
    return "ActionHub is temporarily unavailable. Your changes could not be confirmed. Please try again shortly.";
  const data = (error as { response?: { data?: { message?: unknown; error?: unknown } } } | null)
    ?.response?.data;
  const message = data?.message ?? data?.error;
  return typeof message === "string" ? message : fallback;
}
