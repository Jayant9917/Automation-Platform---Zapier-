"use client";
import { toast, useToastFeedback } from "@/components/ui/toast";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiOptions, apiMessage, actionPayload } from "@/lib/actions";
import type { ActionDraft } from "@/lib/actions";
import { ScheduleSetup } from "./ScheduleSetup";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { TallyTriggerSetup } from "./TallyTriggerSetup";
import { GitHubTriggerSetup } from "./GitHubTriggerSetup";
import { TestEventPanel } from "./TestEventPanel";
import { Button } from "@/components/ui/Button";
export function WorkflowActionsPanel({
  workflowId,
  onSaved,
}: {
  workflowId: string;
  onSaved?: () => void;
}) {
  const [actions, setActions] = useState<ActionDraft[]>([]);
  const [revision, setRevision] = useState(0);
  const [trigger, setTrigger] = useState("webhook");
  const [persistedTrigger, setPersistedTrigger] = useState("webhook");
  const [owner, setOwner] = useState("");
  const [origin, setOrigin] = useState("");
  const [testEventsEnabled, setTestEventsEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useToastFeedback(error);
  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}`,
        apiOptions(),
      );
      if (!data.zap) throw new Error();
      setActions(
        data.zap.actions.map(
          (action: {
            id: string;
            actionId: string;
            credentialId: string | null;
            Metadata: Record<string, unknown>;
          }) => ({
            id: action.id,
            key: action.id,
            availableActionId: action.actionId,
            credentialId: action.credentialId,
            actionMetadata: action.Metadata,
          }),
        ),
      );
      const savedTrigger = data.zap.trigger?.type.id ?? "webhook";
      setTrigger(savedTrigger);
      setPersistedTrigger(savedTrigger);
      setOwner(String(data.zap.userId));
      setRevision(data.zap.actionsRevision);
      setTestEventsEnabled(data.testEventsEnabled === true);
      setLoaded(true);
      setError("");
    } catch {
      setError("Could not load workflow actions. Check that you are logged in as its owner.");
    }
  }, [workflowId]);
  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);
  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await axios.put(
        `${BACKEND_URL}/api/v1/zap/${encodeURIComponent(workflowId)}/actions`,
        { actions: actionPayload(actions), revision },
        apiOptions(),
      );
      setRevision(data.revision);
      await load();
      setMessage("Actions saved. Changes apply to future events.");
      toast.success("Actions saved. Changes apply to future events.");
      onSaved?.();
    } catch (failure) {
      setError(apiMessage(failure, "Could not save actions."));
    } finally {
      setSaving(false);
    }
  }
  if (!loaded)
    return (
      <div className="container-content py-8">
        {error ? (
          <>
            <p role="alert">{error}</p>
            <Button onClick={() => void load()}>Reload saved actions</Button>
          </>
        ) : (
          <p>Loading workflow...</p>
        )}
      </div>
    );
  return (
    <div>
      <WorkflowCanvas
        title="Workflow"
        savedWorkflow
        trigger={trigger}
        actions={actions}
        onTriggerChange={setTrigger}
        onActionsChange={setActions}
        onSave={() => void save()}
        saving={saving}
        saveLabel="Save changes"
        message={message}
        fixedTrigger={
          persistedTrigger.startsWith("github.") ||
          persistedTrigger === "tally.form_submitted" ||
          persistedTrigger === "schedule"
        }
        onTriggerClosed={() => setTrigger(persistedTrigger)}
        renderTriggerSettings={(done) =>
          trigger === "schedule" ? (
            <ScheduleSetup workflowId={workflowId} />
          ) : trigger === "tally.form_submitted" ? (
            <TallyTriggerSetup workflowId={workflowId} />
          ) : trigger.startsWith("github.") ? (
            <div className="space-y-5">
              {trigger !== persistedTrigger && (
                <p
                  role="note"
                  className="rounded-xl border border-brand-100 bg-brand-50 p-3 text-body-sm text-neutral-700"
                >
                  This event change is not saved yet. Click Save GitHub trigger below to apply it.
                  Your actions and webhook URL stay the same.
                </p>
              )}
              {trigger === "github.pull_request_opened" && (
                <p className="text-body-sm text-neutral-500">
                  For pull requests, use Pull request fields in your actions instead of Issue
                  fields. Existing messages and mappings are kept.
                </p>
              )}
              <GitHubTriggerSetup
                compact
                triggerType={trigger}
                workflowId={workflowId}
                onSaved={() => {
                  setMessage("GitHub trigger saved. Changes apply to future events.");
                  setPersistedTrigger(trigger);
                  setTrigger(trigger);
                  onSaved?.();
                }}
              />
              <div className="flex justify-end border-t border-neutral-200 pt-4">
                <Button variant="secondary" onClick={done}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-body-sm text-neutral-500">
                Send JSON events to this webhook URL to start your workflow.
              </p>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 break-all font-mono text-body-sm">
                {origin}/hooks/catch/{owner}/{workflowId}
              </div>
              {testEventsEnabled && persistedTrigger === "webhook" && (
                <TestEventPanel workflowId={workflowId} disabled={saving} />
              )}
              <div className="flex justify-end border-t border-neutral-200 pt-4">
                <Button onClick={done}>Done</Button>
              </div>
            </div>
          )
        }
      />
      {error && (
        <div className="fixed bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-xl border border-neutral-200 bg-white p-2 shadow-soft-md">
          <Button
            variant="ghost"
            onClick={() => {
              setMessage("");
              void load();
            }}
          >
            Reload saved actions
          </Button>
        </div>
      )}
    </div>
  );
}
