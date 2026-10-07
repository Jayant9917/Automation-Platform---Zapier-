"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { WorkflowNode } from "@/components/workflow/WorkflowNode";
import { WorkflowConnector } from "@/components/workflow/WorkflowConnector";

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <div className="container-content py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-body-sm font-medium text-neutral-500 hover:text-neutral-700"
          >
            ← Automations
          </Link>
          <h1 className="mt-2 text-display-sm text-neutral-900">
            Workflow
          </h1>
          <p className="mt-1 text-body text-neutral-500">
            ID: <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-body-sm">{id}</code>
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>

      <Card padding="lg">
        <p className="text-body-sm text-neutral-500 mb-6">
          View and edit this workflow. Trigger and actions are shown below.
        </p>
        <div className="flex flex-col items-center gap-0 py-8">
          <WorkflowNode
            index={1}
            label="Webhook"
            type="trigger"
            onClick={() => {}}
          />
          <WorkflowConnector />
          <WorkflowNode
            index={2}
            label="Action"
            type="action"
            onClick={() => {}}
          />
        </div>
      </Card>
    </div>
  );
}
