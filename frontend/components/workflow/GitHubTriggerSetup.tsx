"use client";
import { useToastFeedback } from "@/components/ui/toast";

import { useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Connection = {
  configured: boolean;
  repository: string;
  enabled: boolean;
  setupSecretAvailable: boolean;
  webhookPath: string;
};
function requestOptions() {
  return {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
    timeout: 10000,
  };
}

export function GitHubTriggerSetup({
  workflowId,
  onSaved,
  compact = false,
  triggerType = "github.issue_opened",
}: {
  workflowId: string;
  onSaved?: () => void;
  compact?: boolean;
  triggerType?: string;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [repository, setRepository] = useState("");
  const [secret, setSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [publicBase, setPublicBase] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useToastFeedback(error, message);
  const url = `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}/github-trigger`;

  useEffect(() => {
    let active = true;
    setPublicBase(window.location.origin);
    setConnection(null);
    setError("");
    axios
      .get<Connection>(url, requestOptions())
      .then(({ data }) => {
        if (!active) return;
        setConnection(data);
        setRepository(data.repository);
        setEnabled(data.enabled);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load this workflow's GitHub connection. Check that you are logged in as its owner.",
          );
      });
    return () => {
      active = false;
    };
  }, [url]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await axios.put(
        url,
        { repository, enabled, triggerType, ...(secret ? { secret } : {}) },
        requestOptions(),
      );
      setSecret("");
      setConnection({
        configured: true,
        repository,
        enabled,
        setupSecretAvailable: false,
        webhookPath: `/hooks/github/${workflowId}`,
      });
      setMessage(
        "GitHub trigger saved. In GitHub, use this URL, select the matching Issues or Pull requests event, and enable Active. Keep Docker and ngrok running.",
      );
      onSaved?.();
    } catch {
      setError(
        "Could not save. Check owner/repository, your login, and the webhook secret (16 to 512 characters).",
      );
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <>
      {!compact && (
        <CardHeader
          title={`GitHub: ${triggerType === "github.pull_request_opened" ? "pull request opened" : triggerType === "github.issue_closed" ? "issue closed" : "issue opened"}`}
          subtitle="Connect this workflow to a repository. Each matching event runs its configured actions."
        />
      )}
      {error && (
        <p role="alert" className="mb-4 text-red-600">
          {error}
        </p>
      )}
      {!connection && !error && <p>Loading GitHub connection...</p>}
      {connection && (
        <form onSubmit={save} className="space-y-4">
          <Input
            label="Repository"
            placeholder="owner/repository"
            required
            pattern="[A-Za-z0-9-]+/[A-Za-z0-9_.-]+"
            maxLength={201}
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
          />
          <Input
            label="GitHub webhook secret"
            type="password"
            autoComplete="new-password"
            minLength={16}
            maxLength={512}
            required={!connection.configured && !connection.setupSecretAvailable}
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            hint={
              connection.configured
                ? "Leave blank to keep the saved secret. Enter a new value only when updating the matching secret in GitHub."
                : connection.setupSecretAvailable
                  ? "Leave blank to import the GITHUB_SECRETS value configured for this workflow. It will be stored encrypted."
                  : "Enter the same secret you used in the GitHub webhook settings."
            }
          />
          <label className="flex items-center gap-2 text-body-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Accept matching GitHub events
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save GitHub trigger"}
          </Button>
          <Input
            label="Public base URL"
            type="url"
            value={publicBase}
            placeholder="https://your-address.ngrok-free.dev"
            onChange={(event) => setPublicBase(event.target.value)}
            hint="Paste your ngrok HTTPS origin here to display the public webhook URL. This field does not change the server configuration."
          />
          <div className="text-body-sm">
            <p className="font-medium">GitHub payload URL</p>
            <code className="block break-all mt-1">
              {publicBase.replace(/\/+$/, "")}
              {connection.webhookPath}
            </code>
            <p className="mt-2 text-neutral-500">
              Content type: application/json. Select{" "}
              {triggerType === "github.pull_request_opened" ? "Pull requests" : "Issues"} in GitHub.
              Only the configured event starts this workflow.
            </p>
          </div>
          {message && (
            <p role="status" className="text-green-700">
              {message}
            </p>
          )}
        </form>
      )}
    </>
  );
  return compact ? <div>{content}</div> : <Card padding="lg">{content}</Card>;
}
