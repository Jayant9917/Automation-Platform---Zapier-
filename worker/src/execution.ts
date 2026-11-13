import { TemplateError } from "./templates.js";
import { credentialContext, decryptSecret } from "./credentials.js";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "./generated/prisma/client.js";
import { ActionError, getHandler } from "./actions/registry.js";
import type { ActionHandler } from "./actions/registry.js";
import type { ActionJob } from "./jobs.js";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 120_000; // Longer than the bounded SMTP network timeouts.
type Database = Pick<PrismaClient, "actionRun" | "credential">;

// Kafka duplicates are normal. Only the worker holding the database claim may execute.
export async function executeAction(
  db: Database,
  job: ActionJob,
  registry: Record<string, ActionHandler>,
  clock = () => new Date(),
  encryptionKey?: string,
) {
  const now = clock();
  const claimToken = randomUUID();
  const claim = await db.actionRun.updateMany({
    where: {
      id: job.actionExecutionId,
      zapRunId: job.executionId,
      status: { in: ["pending", "retry"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: "running",
      claimToken,
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      attempts: { increment: 1 },
      errorCode: null,
    },
  });
  if (claim.count === 0) return; // Already claimed, completed, or not due yet.

  const run = await db.actionRun.findUniqueOrThrow({
    where: { id: job.actionExecutionId },
    include: { zapRun: { include: { zap: { select: { userId: true } } } } },
  });
  let status = "succeeded";
  let errorCode: string | null = null;
  let nextAttemptAt = now;
  try {
    const handler = getHandler(registry, run.type);
    let secret: unknown;
    if (handler.credentialProvider) {
      if (!run.credentialId || !encryptionKey)
        throw new ActionError("CONNECTION_REQUIRED", "failed");
      const credential = await db.credential.findFirst({
        where: {
          id: run.credentialId,
          ownerId: run.zapRun.zap.userId,
          provider: handler.credentialProvider,
          revokedAt: null,
        },
      });
      if (!credential) throw new ActionError("CONNECTION_NOT_AVAILABLE", "failed");
      try {
        secret = JSON.parse(
          decryptSecret(credential.encryptedSecret, encryptionKey, credentialContext(credential)),
        );
      } catch {
        throw new ActionError("CONNECTION_UNREADABLE", "failed");
      }
    }
    const metadata = run.zapRun.metadata;
    const context = {
      ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
      execution: { id: run.zapRunId, actionId: run.id },
    };
    await handler.execute(run.config, context, secret);
  } catch (error) {
    const failure =
      error instanceof TemplateError
        ? new ActionError(error.code, "failed")
        : error instanceof ActionError
          ? error
          : new ActionError("ACTION_OUTCOME_UNKNOWN", "needs_attention");
    status = failure.outcome;
    errorCode = failure.code;
    if (status === "retry") {
      if (run.attempts >= MAX_ATTEMPTS) {
        status = "failed";
        errorCode = "RETRY_LIMIT_REACHED";
      } else {
        nextAttemptAt = new Date(
          clock().getTime() +
            Math.max(10_000 * 2 ** (run.attempts - 1), Math.min(900_000, failure.retryAfterMs)),
        );
      }
    }
  }
  // Never catch this write as an action error: failed persistence must propagate to Kafka.
  await db.actionRun.updateMany({
    where: { id: run.id, status: "running", claimToken },
    data: {
      status,
      errorCode,
      nextAttemptAt,
      dispatchAfter: nextAttemptAt,
      claimToken: null,
      leaseUntil: null,
    },
  });
}
