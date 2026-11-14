"use client";

import Image from "next/image";

import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URL, HOOKS_URL } from "@/app/config";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { apiOptions, apiMessage } from "@/lib/actions";
import { EmptyState } from "@/components/ui/EmptyState";

interface Zap {
  id: string;
  triggerId: string;
  userId: number;
  actions: {
    id: string;
    zapId: string;
    actionId: string;
    sortingOrder: number;
    type: { id: string; name: string; image: string };
  }[];
  trigger: {
    id: string;
    zapId: string;
    triggerId: string;
    type: { id: string; name: string; image: string };
  };
}

function useZaps() {
  const [loading, setLoading] = useState(true);
  const [zaps, setZaps] = useState<Zap[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers: Record<string, string> = {};
    if (token && token.trim()) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    axios
      .get(`${BACKEND_URL}/api/v1/zap`, { headers })
      .then((res) => {
        setZaps(res.data.zaps);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching zaps:", err);
        setLoading(false);
      });
  }, []);

  return { loading, zaps, setZaps };
}

export default function DashboardPage() {
  const { loading, zaps, setZaps } = useZaps();
  const [deleting, setDeleting] = useState<Zap | null>(null);
  const [busy, setBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setDeleteError("");
    try {
      await axios.delete(`${BACKEND_URL}/api/v1/zap/${deleting.id}`, apiOptions());
      setZaps((current) => current.filter((zap) => zap.id !== deleting.id));
      setDeleting(null);
    } catch (error) {
      setDeleteError(apiMessage(error, "Could not delete automation."));
    } finally {
      setBusy(false);
    }
  }
  const router = useRouter();

  return (
    <div className="container-content py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-display-sm text-neutral-900">My automations</h1>
          <p className="mt-1 text-body text-neutral-500">Manage and monitor your workflows</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => router.push("/zap/create")}>
          Create automation
        </Button>
      </div>

      {loading ? (
        <Card padding="lg">
          <TableSkeleton rows={6} cols={5} />
        </Card>
      ) : zaps.length === 0 ? (
        <EmptyState
          title="No automations yet"
          description="Create your first workflow to connect your apps and automate tasks."
          action={{
            label: "Create automation",
            onClick: () => router.push("/zap/create"),
          }}
        />
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80">
                  <th className="px-6 py-4 text-left text-body-sm font-semibold text-neutral-600">
                    Workflow
                  </th>
                  <th className="px-6 py-4 text-left text-body-sm font-semibold text-neutral-600">
                    ID
                  </th>
                  <th className="px-6 py-4 text-left text-body-sm font-semibold text-neutral-600">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-body-sm font-semibold text-neutral-600">
                    Webhook URL
                  </th>
                  <th className="px-6 py-4 text-right text-body-sm font-semibold text-neutral-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {zaps.map((z) => (
                  <tr key={z.id} className="transition-colors duration-fast hover:bg-neutral-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Image
                          width={32}
                          height={32}
                          unoptimized
                          src={z.trigger.type.image}
                          alt=""
                          className="h-8 w-8 rounded-lg object-cover border border-neutral-200"
                        />
                        {z.actions.map((x) => (
                          <Image
                            width={32}
                            height={32}
                            unoptimized
                            key={x.id}
                            src={x.type.image}
                            alt=""
                            className="h-8 w-8 rounded-lg object-cover border border-neutral-200"
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body text-neutral-700 font-mono text-body-sm">
                      {z.id.slice(0, 8)}…
                    </td>
                    <td className="px-6 py-4 text-body-sm text-neutral-500">Not recorded</td>
                    <td className="px-6 py-4 text-body-sm text-neutral-500 font-mono max-w-[200px] truncate">
                      {`${HOOKS_URL || (typeof window !== "undefined" ? window.location.origin : "")}${z.trigger.type.id === "tally.form_submitted" ? `/hooks/tally/${z.id}` : z.trigger.type.id.startsWith("github.") ? `/hooks/github/${z.id}` : `/hooks/catch/${z.userId}/${z.id}`}`}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => router.push("/zap/" + z.id)}>
                        Open
                      </Button>
                      <Button
                        variant="ghostDanger"
                        size="sm"
                        aria-label={`Delete automation ${z.id}`}
                        onClick={() => {
                          setDeleting(z);
                          setDeleteError("");
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Modal
        isOpen={!!deleting}
        onClose={() => {
          if (!busy) setDeleting(null);
        }}
        title="Delete automation?"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-body-sm text-neutral-600">
            This removes the automation and stops new events. Queued actions are cancelled;
            already-started actions may finish. Execution history and saved connections are kept.
          </p>
          <p className="break-all text-caption text-neutral-500">{deleting?.id}</p>
          {deleteError && (
            <p role="alert" className="text-red-600">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void remove()}>
              {busy ? "Deleting..." : "Delete automation"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
