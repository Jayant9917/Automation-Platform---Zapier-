"use client";
import { useToastFeedback } from "@/components/ui/toast";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiMessage, apiOptions } from "@/lib/actions";
import type { Connection } from "@/lib/actions";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/v1/connections`, apiOptions());
      setConnections(data.connections);
      setError("");
    } catch {
      setError("Could not load your connections. Check your login and try again.");
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { connections, refresh, error };
}
export function ConnectionManager({
  onChanged,
  onConnected,
  providerFilter,
  compact = false,
}: {
  onChanged?: () => void;
  onConnected?: (id: string) => void;
  providerFilter?: string;
  compact?: boolean;
}) {
  const { connections, refresh, error: loadError } = useConnections();
  const [editing, setEditing] = useState<string | null>(null);
  const [provider, setProvider] = useState(providerFilter ?? "slack.webhook");
  const [name, setName] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useToastFeedback(error || loadError, message);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    let value: unknown = secret.trim();
    if (provider === "google.service_account" || provider === "http.headers") {
      try {
        value = JSON.parse(secret);
      } catch {
        setError("Paste valid connection JSON.");
        return;
      }
    }
    setSaving(true);
    try {
      const url = `${BACKEND_URL}/api/v1/connections${editing ? `/${editing}` : ""}`;
      const result = editing
        ? await axios.put(url, { name, provider, secret: value }, apiOptions())
        : await axios.post(url, { name, provider, secret: value }, apiOptions());
      const connectedId = editing ?? result.data.connection?.id;
      setSecret("");
      setName("");
      setEditing(null);
      setMessage("Connection saved. Select it in your action.");
      await refresh();
      onChanged?.();
      if (connectedId) onConnected?.(connectedId);
    } catch (failure) {
      setError(apiMessage(failure, "Could not save connection."));
    } finally {
      setSaving(false);
    }
  }
  async function revoke(id: string) {
    if (
      !window.confirm(
        "Revoke this connection? Pending actions using it will fail until configured with an active connection.",
      )
    )
      return;
    setError("");
    try {
      await axios.delete(`${BACKEND_URL}/api/v1/connections/${id}`, apiOptions());
      await refresh();
      onChanged?.();
    } catch {
      setError("Could not revoke connection.");
    }
  }
  const content = (
    <>
      {!compact && (
        <CardHeader
          title="Your connections"
          subtitle="Save your own Discord/Slack channel and Google service account. Credentials are private and are not displayed again."
        />
      )}
      {compact && (
        <p className="mb-5 text-body-sm text-neutral-500">
          Choose an account below or connect a new one. Your credentials stay private.
        </p>
      )}
      {(error || loadError) && (
        <p role="alert" className="text-red-600 mb-3">
          {error || loadError}
        </p>
      )}
      <ul className="space-y-2 mb-5">
        {connections
          .filter((connection) => !providerFilter || connection.provider === providerFilter)
          .map((connection) => (
            <li
              key={connection.id}
              className="flex items-center justify-between gap-3 border-b py-2"
            >
              <span>
                {connection.name}{" "}
                <small>
                  (
                  {connection.provider === "http.headers"
                    ? "HTTP"
                    : connection.provider === "discord.webhook"
                      ? "Discord"
                      : connection.provider === "slack.webhook"
                        ? "Slack"
                        : "Google Sheets"}
                  )
                </small>
              </span>
              <div className="flex flex-wrap gap-2">
                {onConnected && (
                  <Button size="sm" variant="secondary" onClick={() => onConnected(connection.id)}>
                    Use account
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(connection.id);
                    setName(connection.name);
                    setProvider(connection.provider);
                    setSecret("");
                    setMessage("");
                  }}
                >
                  Replace credentials
                </Button>
                <Button variant="ghostDanger" onClick={() => void revoke(connection.id)}>
                  Revoke
                </Button>
              </div>
            </li>
          ))}
      </ul>
      <form onSubmit={save} className="space-y-4">
        <h3 className="font-semibold">
          {editing ? "Replace connection credentials" : "Add a connection"}
        </h3>
        <Input
          id="connection-name"
          label="Connection name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="For example: Team alerts or My issue tracker"
        />
        <label className="block">
          Provider
          <select
            aria-label="Connection provider"
            disabled={!!editing || !!providerFilter}
            className="block w-full rounded-xl border border-neutral-200 bg-white p-2.5 text-body"
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setSecret("");
            }}
          >
            <option value="http.headers">HTTP API headers</option>
            <option value="discord.webhook">Discord incoming webhook</option>
            <option value="slack.webhook">Slack incoming webhook</option>
            <option value="google.service_account">Google Sheets service account</option>
          </select>
        </label>
        <label htmlFor="connection-secret" className="block">
          {provider === "http.headers"
            ? "HTTP connection JSON"
            : provider === "discord.webhook"
              ? "Discord webhook URL"
              : provider === "slack.webhook"
                ? "Slack webhook URL"
                : "Google service-account JSON"}
        </label>
        <textarea
          id="connection-secret"
          autoComplete="off"
          spellCheck={false}
          required
          maxLength={30000}
          rows={provider === "google.service_account" ? 6 : 2}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="w-full rounded-xl border p-3"
        />
        <p className="text-body-sm text-neutral-500">
          {provider === "http.headers"
            ? 'Enter an HTTPS origin and headers object, for example {"origin":"https://api.example.com","headers":{"Authorization":"Bearer YOUR_TOKEN"}}. Use empty headers {} for a public API. Credentials are sent only to this origin.'
            : provider === "discord.webhook"
              ? "Paste the webhook URL from your Discord text channel settings → Integrations → Webhooks. This is not a bot token."
              : provider === "slack.webhook"
                ? "Use the incoming webhook URL for the channel where you want messages. This is not a Slack bot token."
                : "Paste the downloaded service-account JSON. Enable Sheets API and share your spreadsheet with its client_email as Editor. A Google API key alone is not sufficient."}
        </p>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving connection..." : "Save connection"}
        </Button>
        {editing && (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(null);
              setSecret("");
              setName("");
            }}
          >
            Cancel replacement
          </Button>
        )}
        {message && (
          <p role="status" className="text-green-700">
            {message}
          </p>
        )}
      </form>
    </>
  );
  return compact ? <div>{content}</div> : <Card padding="lg">{content}</Card>;
}
