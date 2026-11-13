import type { PrismaClient } from "./generated/prisma/client.js";
import type { LegacyEmail } from "./jobs.js";
import { ActionError } from "./actions/registry.js";
import type { ActionHandler } from "./actions/registry.js";

// Old messages have no workflow ID. Kafka coordinates give them a stable receipt instead.
export async function executeLegacyEmail(
  db: Pick<PrismaClient, "legacyJob">,
  id: string,
  job: LegacyEmail,
  handler: ActionHandler,
  now = new Date(),
) {
  await db.legacyJob.upsert({ where: { id }, create: { id }, update: {} });
  await db.legacyJob.updateMany({
    where: { id, status: "running", leaseUntil: { lte: now } },
    data: { status: "needs_attention", errorCode: "WORKER_LEASE_EXPIRED", leaseUntil: null },
  });
  const claim = await db.legacyJob.updateMany({
    where: { id, status: "pending" },
    data: { status: "running", leaseUntil: new Date(now.getTime() + 120_000) },
  });
  if (!claim.count) return;
  let status = "succeeded";
  let errorCode: string | null = null;
  try {
    await handler.execute({ email: job.to, body: job.body }, {});
  } catch (error) {
    // Legacy jobs lack the modern retry contract. Retain failures for manual review.
    status =
      error instanceof ActionError && error.outcome === "failed" ? "failed" : "needs_attention";
    errorCode = error instanceof ActionError ? error.code : "ACTION_OUTCOME_UNKNOWN";
  }
  await db.legacyJob.updateMany({
    where: { id, status: "running" },
    data: { status, errorCode, leaseUntil: null },
  });
}
