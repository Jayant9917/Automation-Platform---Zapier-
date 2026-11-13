"use client";
import { useParams } from "next/navigation";
import { WorkflowActionsPanel } from "@/components/workflow/WorkflowActionsPanel";
export default function WorkflowBuilderPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  return <WorkflowActionsPanel workflowId={id} />;
}
