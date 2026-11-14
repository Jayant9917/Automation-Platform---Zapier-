import type { ZodError } from "zod";

const actions: Record<string, string> = {
  email: "Email",
  "http.request": "HTTP request",
  "slack.send_message": "Slack",
  "discord.send_message": "Discord",
  "google_sheets.append_row": "Google Sheets",
};
const fields: Record<string, string> = {
  url: "HTTPS URL",
  method: "HTTP method",
  frequency: "Schedule frequency",
  hour: "UTC hour",
  minute: "UTC minute",
  email: "Recipient",
  subject: "Subject",
  body: "Email body",
  text: "Message",
  spreadsheetId: "Spreadsheet ID or URL",
  range: "Sheet range",
  values: "Columns",
  credentialId: "Connection",
  revision: "Workflow version",
  repository: "Repository",
  secret: "Webhook secret",
  formId: "Form ID",
  availableTriggerId: "Trigger",
};

// Return only known labels and validation rules, never submitted values or credentials.
export function validationFeedback(error: ZodError, body: unknown) {
  const input = body as { actions?: { availableActionId?: string }[] } | null;
  const errors = error.issues.slice(0, 8).map((issue) => {
    const index =
      issue.path[0] === "actions" && typeof issue.path[1] === "number" ? issue.path[1] : undefined;
    const action = index === undefined ? undefined : input?.actions?.[index];
    const prefix =
      index === undefined
        ? ""
        : `Action ${index + 1} — ${actions[action?.availableActionId ?? ""] ?? "Action"}: `;
    const key = String(issue.path.at(-1));
    const field =
      typeof issue.path.at(-1) === "number" && issue.path.includes("values")
        ? `Column ${Number(issue.path.at(-1)) + 1}`
        : (fields[key] ?? (issue.path.includes("actions") ? "Actions" : "Settings"));
    let help = "check this field and its event fields.";
    if (key === "credentialId") help = "choose a saved, active connection in Setup.";
    else if (key === "revision")
      help = "reload the workflow before saving. Your current edits have not been saved.";
    else if (key === "email")
      help = "enter one valid email address or insert an email event field.";
    else if (key === "spreadsheetId") help = "paste a Google Sheets URL or spreadsheet ID.";
    else if (key === "range") help = "enter a range such as Sheet1!A:E.";
    else if (issue.code === "too_big")
      help = `use no more than ${issue.maximum} ${issue.type === "array" ? "items" : "characters"}.`;
    else if (issue.code === "too_small")
      help = `enter at least ${issue.minimum} ${issue.type === "array" ? "items" : "characters"}.`;
    else if (issue.code === "invalid_type")
      help = "this field is required and must have the expected format.";
    else if (issue.code === "unrecognized_keys")
      help = "remove unsupported fields or reload the workflow.";
    else if (key === "subject") help = "enter a subject on one line and check its event fields.";
    return `${prefix}${field}: ${help}`;
  });
  return { message: errors.join("\n"), errors };
}
