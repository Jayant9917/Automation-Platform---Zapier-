"use client";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TaskHistoryPage() {
  return (
    <div className="container-content py-8">
      <div className="mb-8">
        <h1 className="text-display-sm text-neutral-900">Task history</h1>
        <p className="mt-1 text-body text-neutral-500">
          View run history and logs for your automations
        </p>
      </div>

      <EmptyState
        title="No runs yet"
        description="When your automations run, their history will appear here."
      />
    </div>
  );
}
