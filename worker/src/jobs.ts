// Kafka carries references, not credentials or mutable workflow configuration.
export type ActionJob = { version: 1; executionId: string; actionExecutionId: string };
export type LegacyEmail = { to: string; body: string };

export function parseJob(raw: string): ActionJob | LegacyEmail {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("INVALID_JOB");
  const job = value as Record<string, unknown>;
  if (
    job.version === 1 &&
    typeof job.executionId === "string" &&
    job.executionId.trim() &&
    typeof job.actionExecutionId === "string" &&
    job.actionExecutionId.trim()
  ) {
    return { version: 1, executionId: job.executionId, actionExecutionId: job.actionExecutionId };
  }
  // Keep already queued email messages readable during the rollout.
  if (
    !("version" in job) &&
    typeof job.to === "string" &&
    job.to.trim() &&
    typeof job.body === "string" &&
    job.body.trim()
  ) {
    return { to: job.to, body: job.body };
  }
  throw new Error("INVALID_JOB");
}
