import type { PrismaClient } from "./generated/prisma/client.js";
import { nextSchedule } from "./schedule-time.js";
export async function dispatchSchedules(
  db: Pick<PrismaClient, "scheduleTrigger" | "$transaction">,
  now = new Date(),
) {
  const due = await db.scheduleTrigger.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
      workflow: { deletedAt: null, trigger: { triggerId: "schedule" } },
    },
    orderBy: { nextRunAt: "asc" },
    take: 50,
  });
  for (const timer of due) {
    await db.$transaction(async (tx) => {
      // Lock the workflow before taking action snapshots, matching action edits/deletion.
      const owned = await tx.zap.updateMany({
        where: { id: timer.workflowId, deletedAt: null, trigger: { triggerId: "schedule" } },
        data: { actionsRevision: { increment: 0 } },
      });
      if (!owned.count) return;
      const claim = await tx.scheduleTrigger.updateMany({
        where: {
          workflowId: timer.workflowId,
          enabled: true,
          frequency: timer.frequency,
          hour: timer.hour,
          minute: timer.minute,
          nextRunAt: timer.nextRunAt,
        },
        data: { nextRunAt: nextSchedule(timer, now) },
      });
      if (!claim.count) return; // Another processor or a settings change already took this slot.
      const actions = await tx.action.findMany({
        where: { zapId: timer.workflowId },
        orderBy: { sortingOrder: "asc" },
      });
      if (!actions.length) return;
      await tx.zapRun.create({
        data: {
          zapId: timer.workflowId,
          metadata: {
            schedule: {
              scheduledAt: timer.nextRunAt.toISOString(),
              firedAt: now.toISOString(),
              frequency: timer.frequency,
              timezone: "UTC",
            },
          },
          actionRuns: {
            create: actions.map((action) => ({
              actionId: action.id,
              type: action.actionId,
              config: action.Metadata ?? {},
              credentialId: action.credentialId ?? null,
            })),
          },
        },
      });
    });
  }
}
