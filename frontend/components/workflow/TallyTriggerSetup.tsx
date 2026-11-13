"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiOptions, apiMessage } from "@/lib/actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
export type TallyDraft = { formId: string; secret: string; enabled: boolean };
export function TallyFields({
  value,
  onChange,
  needsSecret = true,
}: {
  value: TallyDraft;
  onChange: (value: TallyDraft) => void;
  needsSecret?: boolean;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Tally form ID"
        placeholder="For example: VwbNEw"
        required
        pattern="[A-Za-z0-9_-]+"
        maxLength={100}
        value={value.formId}
        onChange={(e) => onChange({ ...value, formId: e.target.value })}
        hint="The ID at the end of your published tally.so/r/ form link."
      />
      <Input
        label="Tally signing secret"
        type="password"
        autoComplete="new-password"
        required={needsSecret}
        minLength={16}
        maxLength={512}
        value={value.secret}
        onChange={(e) => onChange({ ...value, secret: e.target.value })}
        hint={
          needsSecret
            ? "Use the same signing secret in Tally webhook settings (at least 16 characters)."
            : "Leave blank to keep your saved secret."
        }
      />
      <label className="flex items-center gap-2 text-body-sm">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        Accept form submissions
      </label>
      <p className="text-body-sm text-neutral-500">
        For the ready-made Name, Email and Message fields, give your form questions those exact
        labels. Other questions can be mapped using their Tally field key.
      </p>
    </div>
  );
}
export function TallyTriggerSetup({ workflowId }: { workflowId: string }) {
  const [draft, setDraft] = useState<TallyDraft>({ formId: "", secret: "", enabled: true });
  const [loaded, setLoaded] = useState(false),
    [configured, setConfigured] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [origin, setOrigin] = useState("");
  const url = `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}/tally-trigger`;
  useEffect(() => {
    let active = true;
    setOrigin(window.location.origin);
    axios
      .get(url, apiOptions())
      .then(({ data }) => {
        if (active) {
          setDraft({ formId: data.formId, enabled: data.enabled, secret: "" });
          setConfigured(data.configured);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setError("Could not load your Tally settings.");
      });
    return () => {
      active = false;
    };
  }, [url]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axios.put(
        url,
        {
          formId: draft.formId,
          enabled: draft.enabled,
          ...(draft.secret ? { secret: draft.secret } : {}),
        },
        apiOptions(),
      );
      setDraft({ ...draft, secret: "" });
      setConfigured(true);
      setMessage("Tally settings saved.");
    } catch (error) {
      setError(apiMessage(error, "Could not save Tally settings."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {!loaded && !error && <p>Loading Tally settings...</p>}
      {loaded && (
        <form onSubmit={save} className="space-y-4">
          <TallyFields value={draft} onChange={setDraft} needsSecret={!configured} />
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Tally trigger"}
          </Button>
        </form>
      )}
      <Input
        label="Public base URL"
        type="url"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        hint="Paste your ngrok HTTPS origin to display the URL below."
      />
      <div>
        <p className="text-body-sm font-medium">Tally webhook URL</p>
        <code className="block break-all mt-1 text-body-sm">
          {origin.replace(/\/+$/, "")}/hooks/tally/{workflowId}
        </code>
      </div>
      <p className="text-body-sm text-neutral-500">
        In your published Tally form: Integrations ? Webhooks ? Connect. Paste this URL and set the
        matching signing secret.
      </p>
      {message && (
        <p role="status" className="text-green-700">
          {message}
        </p>
      )}
    </div>
  );
}
