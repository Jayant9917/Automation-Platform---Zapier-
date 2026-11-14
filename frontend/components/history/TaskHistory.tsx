"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { BACKEND_URL } from "@/app/config";
import { apiOptions, apiMessage, actionNames } from "@/lib/actions";
import { statusLabels, errorExplanation } from "@/lib/history";
import type { Run, WorkflowOption } from "@/lib/history";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
const emptyFilters = { workflowId: "", status: "", from: "", to: "" };
function Status({ value }: { value: string }) {
  const color =
    value === "succeeded"
      ? "bg-green-50 text-green-700"
      : value === "failed" || value === "partially_failed"
        ? "bg-red-50 text-red-700"
        : value === "needs_attention"
          ? "bg-amber-50 text-amber-800"
          : "bg-brand-50 text-brand-700";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-caption font-medium ${color}`}>
      {statusLabels[value] ?? "Unknown"}
    </span>
  );
}
function Time({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}
export function TaskHistory() {
  const [draft, setDraft] = useState(emptyFilters),
    [filters, setFilters] = useState(emptyFilters);
  const [runs, setRuns] = useState<Run[]>([]),
    [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [validation, setValidation] = useState("");
  const [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<Run | null>(null),
    [detailError, setDetailError] = useState(""),
    [detailLoading, setDetailLoading] = useState(false);
  const listRequest = useRef(0),
    detailRequest = useRef(0);
  const [liveError, setLiveError] = useState(false);
  const live = useRef({ runs, detail, selected, loading, detailLoading });
  live.current = { runs, detail, selected, loading, detailLoading };
  const mergeRun = useCallback(
    (updated: Run) => {
      setRuns((current) =>
        current.flatMap((run) =>
          run.id !== updated.id
            ? [run]
            : filters.status && updated.status !== filters.status
              ? []
              : [updated],
        ),
      );
    },
    [filters.status],
  );
  const load = useCallback(
    async (cursor?: string) => {
      const request = ++listRequest.current;
      setLoading(true);
      setError("");
      setLiveError(false);
      if (!cursor) {
        setRuns([]);
        setNextCursor(null);
      }
      const params: Record<string, string> = {};
      if (filters.workflowId) params.workflowId = filters.workflowId;
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = new Date(`${filters.from}T00:00:00`).toISOString();
      if (filters.to) params.to = new Date(`${filters.to}T23:59:59.999`).toISOString();
      if (cursor) params.cursor = cursor;
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/v1/runs`, { ...apiOptions(), params });
        if (request !== listRequest.current) return;
        setRuns((current) =>
          cursor
            ? [
                ...current,
                ...data.runs.filter((run: Run) => !current.some((item) => item.id === run.id)),
              ]
            : data.runs,
        );
        setWorkflows(data.workflows);
        setNextCursor(data.nextCursor);
      } catch (failure) {
        if (request === listRequest.current)
          setError(apiMessage(failure, "Could not load task history."));
      } finally {
        if (request === listRequest.current) setLoading(false);
      }
    },
    [filters],
  );
  const cancelList = useCallback(() => {
    listRequest.current++;
  }, []);
  useEffect(() => {
    void load();
    return cancelList;
  }, [load, cancelList]);
  const loadDetail = useCallback(
    async (id: string) => {
      const request = ++detailRequest.current;
      setDetailLoading(true);
      setDetailError("");
      setDetail(null);
      try {
        const { data } = await axios.get(
          `${BACKEND_URL}/api/v1/runs/${encodeURIComponent(id)}`,
          apiOptions(),
        );
        if (request === detailRequest.current) {
          setDetail(data.run);
          mergeRun(data.run);
        }
      } catch (failure) {
        if (request === detailRequest.current)
          setDetailError(apiMessage(failure, "Could not load run details."));
      } finally {
        if (request === detailRequest.current) setDetailLoading(false);
      }
    },
    [mergeRun],
  );
  const cancelDetail = useCallback(() => {
    detailRequest.current++;
  }, []);
  useEffect(() => {
    if (selected) void loadDetail(selected);
    return cancelDetail;
  }, [selected, loadDetail, cancelDetail]);
  useEffect(() => {
    let stopped = false,
      busy = false,
      position = 0;
    const active = (run: Run) =>
      run.actionRuns.some((action) => ["pending", "running", "retry"].includes(action.status));
    async function refreshActive() {
      const state = live.current;
      if (
        stopped ||
        busy ||
        document.visibilityState === "hidden" ||
        state.loading ||
        state.detailLoading
      )
        return;
      const ids = state.runs.filter(active).map((run) => run.id);
      const selectedId =
        state.detail && state.selected === state.detail.id && active(state.detail)
          ? state.detail.id
          : null;
      const start = ids.length ? position % ids.length : 0;
      const batch = Array.from(
        new Set([...(selectedId ? [selectedId] : []), ...ids.slice(start), ...ids.slice(0, start)]),
      ).slice(0, 5);
      if (!batch.length) return;
      position += selectedId ? 4 : 5;
      busy = true;
      const listVersion = listRequest.current,
        detailVersion = detailRequest.current;
      const results = await Promise.allSettled(
        batch.map((id) =>
          axios.get(`${BACKEND_URL}/api/v1/runs/${encodeURIComponent(id)}`, apiOptions()),
        ),
      );
      busy = false;
      if (stopped || listVersion !== listRequest.current || detailVersion !== detailRequest.current)
        return;
      setLiveError(results.some((result) => result.status === "rejected"));
      for (const result of results)
        if (result.status === "fulfilled") {
          const updated = result.value.data.run as Run;
          mergeRun(updated);
          setDetail((current) => (current?.id === updated.id ? updated : current));
        }
    }
    const timer = window.setInterval(() => void refreshActive(), 3000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshActive();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mergeRun]);
  function apply(event: React.FormEvent) {
    event.preventDefault();
    setValidation("");
    if (
      (draft.from && Number.isNaN(Date.parse(draft.from))) ||
      (draft.to && Number.isNaN(Date.parse(draft.to))) ||
      (draft.from && draft.to && draft.from > draft.to)
    ) {
      setValidation("Choose a valid date range with the start before the end.");
      return;
    }
    setFilters({ ...draft });
  }
  return (
    <div className="container-content py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-sm text-neutral-900">Task history</h1>
          <p className="mt-1 text-body text-neutral-500">
            See what happened when your automations ran.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          Refresh history
        </Button>
      </div>
      <form
        onSubmit={apply}
        className="mb-6 grid items-end gap-4 rounded-2xl border border-neutral-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="text-body-sm font-medium text-neutral-700">
          Workflow
          <select
            aria-label="Workflow"
            className="mt-1.5 block w-full rounded-xl border border-neutral-200 bg-white p-2.5 text-body"
            value={draft.workflowId}
            onChange={(e) => setDraft({ ...draft, workflowId: e.target.value })}
          >
            <option value="">All workflows</option>
            {workflows.map((workflow) => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.trigger?.type.name ?? "Workflow"} � {workflow.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-body-sm font-medium text-neutral-700">
          Status
          <select
            aria-label="Status"
            className="mt-1.5 block w-full rounded-xl border border-neutral-200 bg-white p-2.5 text-body"
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="">All statuses</option>
            {Object.entries(statusLabels)
              .filter(([status]) => status !== "retry")
              .map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <Input
          label="From date"
          type="date"
          value={draft.from}
          onChange={(e) => setDraft({ ...draft, from: e.target.value })}
        />
        <Input
          label="To date"
          type="date"
          value={draft.to}
          onChange={(e) => setDraft({ ...draft, to: e.target.value })}
        />
        <div className="flex gap-2">
          <Button type="submit">Apply filters</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(emptyFilters);
              setFilters({ ...emptyFilters });
              setValidation("");
            }}
          >
            Clear
          </Button>
        </div>
      </form>
      {liveError && (
        <p role="status" className="mb-4 text-body-sm text-amber-800">
          Live updates are temporarily unavailable. Showing the last known status.
        </p>
      )}
      {validation && (
        <p role="alert" className="mb-4 text-red-600">
          {validation}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}{" "}
          <Button variant="ghost" onClick={() => void load()}>
            Retry history
          </Button>
        </div>
      )}
      {loading && (
        <p role="status" className="mb-4 text-body-sm text-neutral-500">
          Loading history...
        </p>
      )}
      {!loading && !error && runs.length === 0 && (
        <EmptyState
          title={Object.values(filters).some(Boolean) ? "No matching runs" : "No runs yet"}
          description={
            Object.values(filters).some(Boolean)
              ? "Try a different workflow, status or date range."
              : "When an automation runs, its history will appear here."
          }
        />
      )}
      {runs.length > 0 && (
        <div
          className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-soft"
          aria-busy={loading}
        >
          <table className="w-full text-left text-body-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-600">
              <tr>
                {["Workflow", "Created", "Status", "Actions", "Details"].map((heading) => (
                  <th key={heading} scope="col" className="px-5 py-4 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-4">
                    <p className="font-medium text-neutral-900">
                      {run.zap.trigger?.type.name ?? "Workflow"}
                    </p>
                    <p className="mt-1 text-caption text-neutral-500">
                      {run.zapId.slice(0, 8)} � Run {run.id.slice(0, 8)}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <Time value={run.createdAt} />
                  </td>
                  <td className="px-5 py-4">
                    <Status value={run.status} />
                  </td>
                  <td className="px-5 py-4">
                    <p>
                      {run.actionRuns.filter((action) => action.status === "succeeded").length} /{" "}
                      {run.actionRuns.length} succeeded
                    </p>
                    <p className="mt-1 text-caption text-neutral-500">
                      {run.actionRuns
                        .map((action) => actionNames[action.type] ?? "Action")
                        .join(", ") || "No action records"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`View run ${run.id}`}
                      onClick={() => setSelected(run.id)}
                    >
                      View details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && !error && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" disabled={loading} onClick={() => void load(nextCursor)}>
            Load more
          </Button>
        </div>
      )}
      <p className="mt-4 text-caption text-neutral-500">
        Times use your browser&apos;s time zone. Active runs update automatically every few seconds.
      </p>
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Execution details"
        size="lg"
        placement="right"
      >
        {detailLoading && <p role="status">Loading run details...</p>}
        {detailError && (
          <div role="alert" className="space-y-3 text-red-600">
            <p>{detailError}</p>
            <Button variant="secondary" onClick={() => selected && void loadDetail(selected)}>
              Retry details
            </Button>
          </div>
        )}
        {detail && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-title-sm">{detail.zap.trigger?.type.name ?? "Workflow"}</h3>
                <Status value={detail.status} />
              </div>
              <p className="break-all text-caption text-neutral-500">Run {detail.id}</p>
              <p className="text-body-sm">
                Created: <Time value={detail.createdAt} />
              </p>
              <div className="flex items-center gap-3">
                {detail.zap.deletedAt ? (
                  <span className="text-body-sm text-neutral-500">Automation deleted</span>
                ) : (
                  <Link
                    href={`/zap/${detail.zapId}`}
                    className="text-body-sm font-medium text-brand-600 hover:underline"
                  >
                    Open workflow
                  </Link>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={detailLoading}
                  onClick={() => void loadDetail(detail.id)}
                >
                  Refresh details
                </Button>
              </div>
            </div>
            {detail.status === "needs_attention" && (
              <p className="rounded-xl bg-amber-50 p-4 text-body-sm text-amber-900">
                A destination may have received an action even though confirmation failed. Check it
                before sending again.
              </p>
            )}
            {detail.actionRuns.length === 0 && (
              <p className="rounded-xl bg-neutral-50 p-4 text-body-sm text-neutral-600">
                No action-level records are available for this run. Older runs may predate action
                tracking.
              </p>
            )}
            {detail.actionRuns.map((action, index) => (
              <section
                key={action.id}
                className="space-y-3 rounded-xl border border-neutral-200 p-4"
                aria-label={`Action ${index + 1}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold">
                    {index + 1}. {actionNames[action.type] ?? action.type}
                  </h4>
                  <Status value={action.status} />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-body-sm">
                  <div>
                    <dt className="text-neutral-500">Attempts</dt>
                    <dd>{action.attempts}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Last updated</dt>
                    <dd>
                      <Time value={action.updatedAt} />
                    </dd>
                  </div>
                  {action.status === "retry" && (
                    <div className="col-span-2">
                      <dt className="text-neutral-500">Next retry</dt>
                      <dd>
                        <Time value={action.nextAttemptAt} />
                      </dd>
                    </div>
                  )}
                </dl>
                {action.errorCode && (
                  <div className="rounded-lg bg-neutral-50 p-3 text-body-sm">
                    <p>{errorExplanation(action.errorCode)}</p>
                    <p className="mt-2 break-all text-caption text-neutral-500">
                      Code: {action.errorCode}
                    </p>
                  </div>
                )}
                <p className="break-all text-caption text-neutral-400">
                  Action execution: {action.id}
                </p>
              </section>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
