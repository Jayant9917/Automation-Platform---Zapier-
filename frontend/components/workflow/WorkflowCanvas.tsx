"use client";
import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { WorkflowNode } from "./WorkflowNode";
import { WorkflowConnector } from "./WorkflowConnector";
import { ActionListEditor } from "./ActionListEditor";
import { ConnectionManager, useConnections } from "./ConnectionManager";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { actionNames, githubEvents, newAction, providers } from "@/lib/actions";
import type { ActionDraft } from "@/lib/actions";

const apps = [
  {
    id: "discord.send_message",
    name: "Discord",
    event: "Send a channel message",
    image: "/discord.svg",
    description: "Post a message using your Discord connection.",
  },
  {
    id: "email",
    name: "Email",
    event: "Send an email",
    image: "/mail.svg",
    description: "Send a message to your chosen recipient.",
  },
  {
    id: "slack.send_message",
    name: "Slack",
    event: "Send a channel message",
    image: "/slack.png",
    description: "Post a message using your Slack connection.",
  },
  {
    id: "google_sheets.append_row",
    name: "Google Sheets",
    event: "Append a spreadsheet row",
    image: "/sheets.png",
    description: "Record event details in your spreadsheet.",
  },
];
const triggers = [
  {
    id: "tally.form_submitted",
    name: "Tally",
    event: "New form submission",
    image: "/tally.svg",
    description: "Start when someone submits your Tally form.",
  },
  {
    id: "github.issue_closed",
    name: "GitHub",
    event: "Issue closed",
    image: "/github.svg",
    description: "Start when an issue is closed.",
  },
  {
    id: "github.pull_request_opened",
    name: "GitHub",
    event: "Pull request opened",
    image: "/github.svg",
    description: "Start when a pull request is opened.",
  },
  {
    id: "github.issue_opened",
    name: "GitHub",
    event: "Issue opened",
    image: "/github.svg",
    description: "Start when a new issue is opened in your repository.",
  },
  {
    id: "webhook",
    name: "Webhook",
    event: "Catch a webhook",
    image: "/webhook.svg",
    description: "Start when your webhook URL receives an event.",
  },
];
type Selection = { kind: "trigger" } | { kind: "action"; key: string } | null;
type Props = {
  title: string;
  trigger: string;
  actions: ActionDraft[];
  onTriggerChange: (type: string) => void;
  onActionsChange: Dispatch<SetStateAction<ActionDraft[]>>;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  error?: string;
  message?: string;
  fixedTrigger?: boolean;
  onTriggerClosed?: () => void;
  renderTriggerSettings: (done: () => void) => ReactNode;
};
export function WorkflowCanvas({
  title,
  trigger,
  actions,
  onTriggerChange,
  onActionsChange,
  onSave,
  saving,
  saveLabel,
  error,
  message,
  fixedTrigger = false,
  onTriggerClosed,
  renderTriggerSettings,
}: Props) {
  const [selection, setSelection] = useState<Selection>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [tab, setTab] = useState("setup");
  const [search, setSearch] = useState("");
  const [choosing, setChoosing] = useState(false);
  const { connections, refresh, error: connectionError } = useConnections();
  const index =
    selection?.kind === "action" ? actions.findIndex((action) => action.key === selection.key) : -1;
  const selected = actions[index];
  const isTrigger = selection?.kind === "trigger";
  const type = isTrigger ? trigger : (selected?.availableActionId ?? "");
  const app = (isTrigger ? triggers : apps).find((item) => item.id === type);
  const provider = providers[type];
  const close = useCallback(() => {
    if (selection?.kind === "trigger") onTriggerClosed?.();
    setSelection(null);
  }, [selection, onTriggerClosed]);
  function open(value: Selection, needsApp: boolean) {
    setSelection(value);
    setTab("setup");
    setSearch("");
    setChoosing(needsApp);
  }
  function updateAction(next: ActionDraft) {
    onActionsChange((current) =>
      current.map((action) => (action.key === next.key ? next : action)),
    );
  }
  function selectApp(next: string) {
    if (isTrigger) onTriggerChange(next);
    else if (selected)
      updateAction({
        ...newAction(next, trigger),
        key: selected.key,
        ...(selected.id ? { id: selected.id } : {}),
        credentialId: providers[next] ? "" : null,
      });
    setChoosing(false);
    setTab("setup");
  }
  function addAction() {
    const action = { ...newAction("email", trigger), availableActionId: "", actionMetadata: {} };
    onActionsChange((current) => [...current, action]);
    open({ kind: "action", key: action.key }, true);
  }
  const titleText = isTrigger ? "1. Trigger" : `${index + 2}. ${app?.name ?? "Action"}`;
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-b border-neutral-200 bg-white px-4 py-3 lg:px-6">
        <div className="container-content flex items-center justify-between gap-4">
          <h1 className="text-title text-neutral-900">{title}</h1>
          <Button
            onClick={onSave}
            disabled={
              saving ||
              !trigger ||
              !actions.length ||
              actions.some((action) => !action.availableActionId)
            }
          >
            {saving ? "Saving..." : saveLabel}
          </Button>
        </div>
        {error && (
          <p role="alert" className="container-content mt-2 text-body-sm text-red-600">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="container-content mt-2 text-body-sm text-green-700">
            {message}
          </p>
        )}
      </div>
      <div className="flex-1 overflow-x-auto bg-neutral-100/80 px-4 py-14 sm:py-20">
        <div className="mx-auto flex w-fit flex-col items-center pb-12">
          <WorkflowNode
            index={1}
            type="trigger"
            label={triggers.find((item) => item.id === trigger)?.name ?? "Trigger"}
            subtitle={triggers.find((item) => item.id === trigger)?.event}
            selected={isTrigger}
            onClick={() => open({ kind: "trigger" }, !trigger)}
          />
          {actions.map((action, i) => (
            <div key={action.key} className="flex flex-col items-center">
              <WorkflowConnector />
              <WorkflowNode
                index={i + 2}
                type="action"
                label={actionNames[action.availableActionId] ?? "Action"}
                subtitle={apps.find((item) => item.id === action.availableActionId)?.event}
                selected={selection?.kind === "action" && selection.key === action.key}
                onClick={() => open({ kind: "action", key: action.key }, !action.availableActionId)}
              />
            </div>
          ))}
          <WorkflowConnector />
          <button
            type="button"
            onClick={addAction}
            disabled={actions.length >= 20}
            aria-label="Add action"
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-white text-neutral-400 transition-colors duration-fast hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600 disabled:opacity-40"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
      <Modal isOpen={!!selection} onClose={close} title={titleText} size="lg" placement="right">
        {choosing || !app ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-title-sm">Choose {isTrigger ? "a trigger" : "an action"}</h3>
              <p className="mt-1 text-body-sm text-neutral-500">
                Select the app you want to use for this step.
              </p>
            </div>
            <Input
              label="Search apps"
              placeholder="Search apps..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="space-y-2">
              {(isTrigger
                ? triggers.filter((item) =>
                    fixedTrigger
                      ? item.id === trigger
                      : !["github.issue_closed", "github.pull_request_opened"].includes(item.id),
                  )
                : apps
              )
                .filter((item) =>
                  `${item.name} ${item.event}`.toLowerCase().includes(search.toLowerCase()),
                )
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={`Choose ${item.name}`}
                    onClick={() => selectApp(item.id)}
                    className="flex w-full items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                  >
                    <Image
                      src={item.image}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-xl"
                    />
                    <span>
                      <span className="block text-body font-semibold text-neutral-900">
                        {item.name}
                      </span>
                      <span className="mt-1 block text-body-sm text-neutral-500">
                        {item.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="ml-auto text-neutral-400">
                      ?
                    </span>
                  </button>
                ))}
            </div>
            {selected && (
              <div className="border-t border-neutral-100 pt-4">
                <Button
                  variant="ghostDanger"
                  onClick={() => {
                    onActionsChange((current) =>
                      current.filter((action) => action.key !== selected.key),
                    );
                    close();
                  }}
                >
                  Remove action
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div
              role="tablist"
              aria-label="Step settings"
              className="mb-6 flex gap-1 rounded-xl bg-neutral-100 p-1"
            >
              {["setup", "configure", ...(provider ? ["connection"] : [])].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`flex-1 rounded-lg px-3 py-2 text-body-sm font-medium capitalize transition-colors ${tab === value ? "bg-white text-brand-700 shadow-soft" : "text-neutral-500 hover:text-neutral-800"}`}
                >
                  {value === "connection" ? "Connect account" : value}
                </button>
              ))}
            </div>
            {tab === "setup" && (
              <div role="tabpanel" className="space-y-5">
                <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-4">
                  <Image src={app.image} width={40} height={40} alt="" className="rounded-xl" />
                  <div>
                    <p className="font-semibold">{app.name}</p>
                    <p className="text-body-sm text-neutral-500">{app.event}</p>
                  </div>
                  {!(isTrigger && fixedTrigger) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setChoosing(true);
                        setSearch("");
                      }}
                    >
                      Change app
                    </Button>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-body-sm font-medium">
                    {isTrigger ? "Trigger event" : "Action event"}
                  </p>
                  {isTrigger && trigger.startsWith("github.") ? (
                    <select
                      aria-label="GitHub event"
                      value={trigger}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3"
                      disabled={fixedTrigger}
                      onChange={(e) => onTriggerChange(e.target.value)}
                    >
                      {githubEvents.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-body">
                      {app.event}
                    </div>
                  )}
                </div>
                {provider && selected && (
                  <>
                    <ActionListEditor
                      trigger={trigger}
                      view="connection"
                      actions={[selected]}
                      connections={connections}
                      onChange={(next) => {
                        if (next[0]) updateAction(next[0]);
                      }}
                    />
                    <Button variant="secondary" onClick={() => setTab("connection")}>
                      Connect a new account
                    </Button>
                  </>
                )}
                {connectionError && (
                  <p role="alert" className="text-body-sm text-red-600">
                    {connectionError}
                  </p>
                )}
                {type === "email" && (
                  <p className="rounded-xl bg-brand-50/60 p-3 text-body-sm text-neutral-600">
                    Email uses your current development inbox. Choose the recipient and message in
                    Configure.
                  </p>
                )}
                <div className="flex justify-end border-t border-neutral-100 pt-4">
                  <Button onClick={() => setTab("configure")}>Continue</Button>
                </div>
              </div>
            )}
            {tab === "configure" && (
              <div role="tabpanel">
                {isTrigger
                  ? renderTriggerSettings(close)
                  : selected && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          if (provider && !selected.credentialId) setTab("setup");
                          else close();
                        }}
                        className="space-y-5"
                      >
                        <p className="text-body-sm text-neutral-500">
                          Set up this action. Use Insert event field to include data from your
                          trigger.
                        </p>
                        <ActionListEditor
                          trigger={trigger}
                          view="fields"
                          actions={[selected]}
                          connections={connections}
                          onChange={(next) => {
                            if (next[0]) updateAction(next[0]);
                          }}
                        />
                        <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
                          <Button
                            variant="ghostDanger"
                            onClick={() => {
                              onActionsChange((current) =>
                                current.filter((action) => action.key !== selected.key),
                              );
                              close();
                            }}
                          >
                            Remove action
                          </Button>
                          <Button type="submit">Done</Button>
                        </div>
                      </form>
                    )}
              </div>
            )}
            {tab === "connection" && provider && selected && (
              <div role="tabpanel">
                <ConnectionManager
                  key={provider}
                  compact
                  providerFilter={provider}
                  onChanged={() => void refresh()}
                  onConnected={(id) => {
                    // A connection response must not overwrite edits made while it was saving.
                    onActionsChange((current) =>
                      current.map((action) =>
                        action.key === selected.key &&
                        providers[action.availableActionId] === provider
                          ? { ...action, credentialId: id }
                          : action,
                      ),
                    );
                    if (
                      selectionRef.current?.kind === "action" &&
                      selectionRef.current.key === selected.key
                    )
                      setTab("setup");
                  }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
