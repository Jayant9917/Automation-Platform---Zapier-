"use client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { actionNames, eventFields, fieldLabels, newAction, providers } from "@/lib/actions";
import type { ActionDraft, Connection } from "@/lib/actions";

function TemplateField({
  label,
  id,
  value,
  onChange,
  multiline = false,
  limit = 40000,
  fields = eventFields,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  limit?: number;
  fields?: string[];
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-body-sm font-medium">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 focus-within:border-brand-400">
        {value.split(/(\{\{[^{}]+\}\})/g).map((part, index, parts) => {
          const match = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(part);
          if (match)
            return (
              <span
                key={index}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-1 text-body-sm font-medium text-brand-700"
              >
                {fieldLabels[match[1]] ?? match[1]}
                <button
                  type="button"
                  aria-label={`Remove ${fieldLabels[match[1]] ?? match[1]} from ${label}`}
                  onClick={() => onChange(parts.filter((_, i) => i !== index).join(""))}
                  className="rounded px-1 hover:bg-brand-100"
                >
                  ×
                </button>
              </span>
            );
          const props = {
            id: index === 0 ? id : undefined,
            "aria-label": index === 0 ? label : `Text after field ${index} in ${label}`,
            value: part,
            maxLength: Math.max(0, limit - value.length + part.length),
            placeholder: parts.length === 1 ? "Type text or choose a field below" : "Add text...",
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange(parts.map((text, i) => (i === index ? event.target.value : text)).join("")),
            className:
              "min-w-[100px] flex-1 border-0 bg-transparent p-1 text-body outline-none focus:ring-0",
          };
          return multiline ? (
            <textarea key={index} {...props} rows={2} />
          ) : (
            <input key={index} {...props} />
          );
        })}
      </div>{" "}
      <select
        aria-label={`Insert event field into ${id}`}
        className="max-w-full rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-1.5 text-caption font-medium text-brand-700 focus:border-brand-400"
        value=""
        onChange={(e) => {
          if (e.target.value) onChange(value + `{{${e.target.value}}}`);
        }}
      >
        <option value="">Choose a field...</option>
        {fields.map((field) => (
          <option key={field} value={field}>
            {fieldLabels[field] ?? field}
          </option>
        ))}
      </select>
    </div>
  );
}
export function ActionListEditor({
  actions,
  connections,
  onChange,
  view = "full",
  trigger,
}: {
  view?: "full" | "fields" | "connection";
  trigger?: string;
  actions: ActionDraft[];
  connections: Connection[];
  onChange: (value: ActionDraft[]) => void;
}) {
  const fields = eventFields.filter((field) => {
    if (!trigger || trigger === "webhook") return true;
    if (field.startsWith("execution.")) return true;
    if (trigger === "tally.form_submitted") return field.startsWith("tally.");
    if (field.startsWith("tally.")) return false;
    return trigger === "github.pull_request_opened"
      ? !field.startsWith("issue.")
      : !field.startsWith("pull_request.");
  });
  function patch(index: number, changes: Partial<ActionDraft>) {
    onChange(actions.map((action, i) => (i === index ? { ...action, ...changes } : action)));
  }
  return (
    <div className="space-y-5">
      {view === "full" && (
        <p className="text-body-sm text-neutral-500">
          Every selected action uses the same event. Actions run independently. Missing fields fail
          only the affected action. Insert fields to make content dynamic.
        </p>
      )}
      {actions.map((action, index) => {
        const id = action.key;
        const text = (key: string) =>
          typeof action.actionMetadata[key] === "string"
            ? (action.actionMetadata[key] as string)
            : "";
        const metadata = (key: string, value: unknown) =>
          patch(index, { actionMetadata: { ...action.actionMetadata, [key]: value } });
        const values = Array.isArray(action.actionMetadata.values)
          ? (action.actionMetadata.values as string[])
          : [];
        const choices = connections.filter(
          (item) => item.provider === providers[action.availableActionId],
        );
        return (
          <section
            key={id}
            className={
              view === "full" ? "rounded-xl border border-neutral-200 p-4 space-y-4" : "space-y-5"
            }
            aria-label={`Action ${index + 1}`}
          >
            {view === "full" && (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-semibold">Action {index + 1}</h3>
                  <Button
                    variant="ghostDanger"
                    aria-label={`Remove action ${index + 1}`}
                    onClick={() => onChange(actions.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
                <label className="block">
                  Action type
                  <select
                    aria-label={`Action type ${index + 1}`}
                    className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-body focus:border-brand-400"
                    value={action.availableActionId}
                    onChange={(e) =>
                      patch(index, {
                        ...newAction(e.target.value),
                        key: action.key,
                        ...(action.id ? { id: action.id } : {}),
                        credentialId: providers[e.target.value] ? "" : null,
                      })
                    }
                  >
                    {!actionNames[action.availableActionId] && (
                      <option value={action.availableActionId}>Unsupported action</option>
                    )}
                    {Object.entries(actionNames).map(([type, name]) => (
                      <option key={type} value={type}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {view !== "fields" && providers[action.availableActionId] && (
              <div>
                <label>
                  Connection
                  <select
                    aria-label={`Connection ${index + 1}`}
                    required
                    className="mt-1 block w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-body focus:border-brand-400"
                    value={action.credentialId ?? ""}
                    onChange={(e) => patch(index, { credentialId: e.target.value })}
                  >
                    <option value="">Choose your connection</option>
                    {action.credentialId && !choices.some((c) => c.id === action.credentialId) && (
                      <option value={action.credentialId} disabled>
                        Connection unavailable
                      </option>
                    )}
                    {choices.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-body-sm text-neutral-500">
                  Create a named connection below, or manage it in Settings.
                </p>
              </div>
            )}
            {view !== "connection" && action.availableActionId === "email" && (
              <>
                <TemplateField
                  fields={fields}
                  label="Recipient"
                  id={`${id}-email`}
                  value={text("email")}
                  onChange={(v) => metadata("email", v)}
                  limit={320}
                />
                <TemplateField
                  fields={fields}
                  label="Subject"
                  id={`${id}-subject`}
                  value={
                    typeof action.actionMetadata.subject === "string"
                      ? text("subject")
                      : "Hello from workflow"
                  }
                  onChange={(v) => metadata("subject", v)}
                  limit={200}
                />
                <TemplateField
                  fields={fields}
                  label="Email body"
                  id={`${id}-body`}
                  value={text("body")}
                  onChange={(v) => metadata("body", v)}
                  multiline
                  limit={20000}
                />
              </>
            )}
            {view !== "connection" &&
              (action.availableActionId === "slack.send_message" ||
                action.availableActionId === "discord.send_message") && (
                <TemplateField
                  fields={fields}
                  label={
                    action.availableActionId === "discord.send_message"
                      ? "Discord message"
                      : "Slack message"
                  }
                  id={`${id}-text`}
                  value={text("text")}
                  onChange={(v) => metadata("text", v)}
                  multiline
                  limit={action.availableActionId === "discord.send_message" ? 2000 : 3000}
                />
              )}
            {view !== "connection" && action.availableActionId === "google_sheets.append_row" && (
              <>
                <Input
                  id={`${id}-sheet`}
                  label="Spreadsheet URL or ID"
                  required
                  value={text("spreadsheetId")}
                  onChange={(e) => metadata("spreadsheetId", e.target.value)}
                />
                <Input
                  id={`${id}-range`}
                  label="Sheet range"
                  required
                  maxLength={200}
                  value={text("range")}
                  onChange={(e) => metadata("range", e.target.value)}
                  hint="For example: Sheet1!A:E. Share the spreadsheet with your service-account email as Editor."
                />
                <p className="text-body-sm">
                  One value per column, in the order shown. Event text is written as data, not
                  spreadsheet formulas.
                </p>
                {values.map((value, column) => (
                  <div key={column} className="border-l-2 pl-3 space-y-2">
                    <TemplateField
                      fields={fields}
                      label={`Column ${column + 1}`}
                      id={`${id}-column-${column}`}
                      value={value}
                      onChange={(v) =>
                        metadata(
                          "values",
                          values.map((item, i) => (i === column ? v : item)),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      disabled={values.length === 1}
                      aria-label={`Remove column ${column + 1} from action ${index + 1}`}
                      onClick={() =>
                        metadata(
                          "values",
                          values.filter((_, i) => i !== column),
                        )
                      }
                    >
                      Remove column
                    </Button>
                  </div>
                ))}
                <Button
                  variant="secondary"
                  disabled={values.length >= 50}
                  onClick={() => metadata("values", [...values, ""])}
                >
                  Add column
                </Button>
              </>
            )}
          </section>
        );
      })}
      {view === "full" && (
        <Button
          variant="secondary"
          disabled={actions.length >= 20}
          onClick={() => onChange([...actions, newAction()])}
        >
          Add action
        </Button>
      )}
    </div>
  );
}
