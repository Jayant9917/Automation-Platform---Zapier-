export type RunAction = {
  id: string;
  actionId: string;
  type: string;
  status: string;
  attempts: number;
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
};
export type Run = {
  id: string;
  zapId: string;
  createdAt: string;
  status: string;
  actionRuns: RunAction[];
  zap: { deletedAt?: string | null; trigger: { type: { name: string } } | null };
};
export type WorkflowOption = { id: string; trigger: { type: { name: string } } | null };
export const statusLabels: Record<string, string> = {
  cancelled: "Cancelled",
  pending: "Pending",
  running: "In progress",
  retry: "Retry scheduled",
  succeeded: "Succeeded",
  failed: "Failed",
  partially_failed: "Partially failed",
  needs_attention: "Needs attention",
};
export function errorExplanation(code: string | null): string {
  if (!code) return "";
  const messages: Record<string, string> = {
    HTTP_DESTINATION_BLOCKED:
      "This address resolves to a private or reserved network. Use a public HTTPS API.",
    HTTP_ORIGIN_MISMATCH:
      "The API URL must match the HTTPS origin saved in the selected HTTP connection.",
    HTTP_REDIRECT_BLOCKED: "The API returned a redirect. Use its final HTTPS endpoint directly.",
    HTTP_DNS_UNAVAILABLE: "The API hostname could not be resolved. A retry is scheduled.",
    WORKFLOW_DELETED: "This queued action was cancelled because its automation was deleted.",
    CONNECTION_REQUIRED:
      "Choose a connection for this action and check the application encryption settings.",
    CONNECTION_NOT_AVAILABLE:
      "The saved connection is unavailable, revoked, or does not belong to this workflow owner. Choose an active connection.",
    CONNECTION_UNREADABLE:
      "The saved connection could not be decrypted. Check the server encryption key or replace the connection.",
    MISSING_EVENT_FIELD:
      "A selected field is missing from this event. Check the field mappings for your trigger.",
    INVALID_EVENT_FIELD:
      "A selected field contains an unsupported value. Choose a text, number or boolean field.",
    INVALID_TEMPLATE: "A field mapping is invalid. Edit the action and choose the field again.",
    RESOLVED_VALUE_TOO_LONG:
      "The resulting message or value exceeds this action's size limit. Shorten the content.",
    PROVIDER_REJECTED:
      "The destination rejected the request. Check its credentials, permissions and destination settings.",
    PROVIDER_RATE_LIMITED:
      "The destination is limiting requests. A retry is scheduled unless the attempt limit has been reached.",
    RETRY_LIMIT_REACHED:
      "The action reached its retry limit. Check the destination before triggering another run.",
    UNSUPPORTED_ACTION: "This action type is not supported by the running worker.",
  };
  if (messages[code]) return messages[code];
  if (code.includes("OUTCOME_UNKNOWN") || code.includes("LEASE"))
    return "Delivery could not be confirmed. Check the destination before sending again; the action may already have succeeded.";
  if (code.startsWith("INVALID_") && code.endsWith("_CONNECTION"))
    return "The saved connection is invalid. Replace its credentials in Settings.";
  if (code.startsWith("INVALID_"))
    return "The action configuration is invalid. Review its fields and destination settings.";
  return "This action could not complete. Review its configuration and destination before triggering another run.";
}
