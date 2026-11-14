"use client";
import { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiOptions, apiMessage } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
const initialFields = [
  { key: "name", value: "ActionHub test" },
  { key: "email", value: "test@example.com" },
  { key: "message", value: "Hello from the frontend" },
];
export function TestEventPanel({
  workflowId,
  disabled = false,
}: {
  workflowId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [advanced, setAdvanced] = useState(false);
  const [fields, setFields] = useState(initialFields),
    [json, setJson] = useState(
      JSON.stringify(
        { name: "ActionHub test", email: "test@example.com", message: "Hello from the frontend" },
        null,
        2,
      ),
    );
  const [sending, setSending] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  function sample() {
    if (advanced) {
      const value = JSON.parse(json);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error("Use a JSON object for the sample event.");
      return value;
    }
    const value: Record<string, string> = Object.create(null);
    for (const field of fields) {
      const key = field.key.trim();
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
        ["__proto__", "constructor", "prototype"].includes(key)
      )
        throw new Error("Give each field a valid name using letters, numbers and underscores.");
      if (Object.hasOwn(value, key)) throw new Error("Each field needs a different name.");
      value[key] = field.value;
    }
    return value;
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSent(false);
    let payload;
    try {
      payload = sample();
      if (new Blob([JSON.stringify(payload)]).size > 65536)
        throw new Error("Keep the sample event smaller than 64 KB.");
    } catch (error) {
      setError(error instanceof SyntaxError ? "Check your JSON syntax." : (error as Error).message);
      return;
    }
    setSending(true);
    try {
      await axios.post(
        `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}/test-event`,
        { payload },
        apiOptions(),
      );
      setSent(true);
    } catch (failure) {
      setError(
        apiMessage(
          failure,
          "Delivery could not be confirmed. Check Task history before sending again.",
        ),
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="space-y-4 border-t border-neutral-200 pt-4">
      {!open ? (
        <Button variant="secondary" disabled={disabled} onClick={() => setOpen(true)}>
          Send test event
        </Button>
      ) : (
        <form
          onSubmit={send}
          className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/30 p-4"
        >
          <div>
            <h3 className="font-semibold">Development test event</h3>
            <p className="mt-1 text-body-sm text-neutral-600">
              Runs all saved actions using this sample data. Slack, Sheets and Discord actions use
              their real connected destinations; email uses the configured email transport. Save
              action changes first.
            </p>
          </div>
          <fieldset disabled={sending || disabled} className="space-y-3">
            {!advanced ? (
              fields.map((field, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <Input
                    label={`Field name ${index + 1}`}
                    value={field.key}
                    required
                    onChange={(e) =>
                      setFields(
                        fields.map((item, i) =>
                          i === index ? { ...item, key: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    label={`Field value ${index + 1}`}
                    value={field.value}
                    onChange={(e) =>
                      setFields(
                        fields.map((item, i) =>
                          i === index ? { ...item, value: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove test field ${index + 1}`}
                    onClick={() => setFields(fields.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))
            ) : (
              <label className="block text-body-sm font-medium">
                Sample event JSON
                <textarea
                  aria-label="Sample event JSON"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  rows={8}
                  required
                  className="mt-2 block w-full rounded-xl border border-neutral-200 bg-white p-3 font-mono text-body-sm"
                />
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {!advanced && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={fields.length >= 30}
                  onClick={() => setFields([...fields, { key: "", value: "" }])}
                >
                  Add field
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError("");
                  if (!advanced) {
                    try {
                      setJson(JSON.stringify(sample(), null, 2));
                    } catch (error) {
                      setError((error as Error).message);
                      return;
                    }
                  }
                  if (advanced) {
                    try {
                      const values = Object.entries(sample());
                      if (
                        values.length > 30 ||
                        values.some(
                          ([key, value]) =>
                            typeof value !== "string" ||
                            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
                            ["__proto__", "constructor", "prototype"].includes(key),
                        )
                      )
                        throw new Error(
                          "Use advanced JSON for nested values, non-text values or special field names.",
                        );
                      setFields(values.map(([key, value]) => ({ key, value: value as string })));
                    } catch (error) {
                      setError(
                        error instanceof SyntaxError
                          ? "Check your JSON syntax."
                          : (error as Error).message,
                      );
                      return;
                    }
                  }
                  setAdvanced(!advanced);
                }}
              >
                {advanced ? "Use simple fields" : "Edit JSON (advanced)"}
              </Button>
            </div>
            <Button type="submit">{sending ? "Sending..." : "Send event"}</Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-body-sm text-red-600">
              {error}
            </p>
          )}
          {sent && (
            <p role="status" className="text-body-sm text-green-700">
              Test event accepted. Actions run in the background.{" "}
              <Link href="/history" className="underline">
                View Task history
              </Link>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
