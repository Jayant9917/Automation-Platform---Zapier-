import type { PrismaClient } from "./generated/prisma-new/client.js";

export function createWebhookHandler(prisma: Pick<PrismaClient, "$transaction">) {
  return async (req: any, res: any) => {
    const { zapId, userId } = req.params;
    try {
      const accepted = await prisma.$transaction(async (tx) => {
        const workflow = await tx.zap.findFirst({
          where: { id: zapId, userId: Number(userId), deletedAt: null },
          include: { actions: true, githubTrigger: true, trigger: true },
        });
        // A GitHub workflow must never bypass signature checks through the generic endpoint.
        if (
          !workflow ||
          workflow.actions.length === 0 ||
          workflow.githubTrigger ||
          workflow.trigger?.triggerId.startsWith("github.") ||
          workflow.trigger?.triggerId === "tally.form_submitted" ||
          workflow.trigger?.triggerId === "schedule"
        )
          return false;
        // Save every action snapshot together with the event. Future edits affect future runs only.
        const run = await tx.zapRun.create({
          data: {
            zapId,
            metadata: req.body,
            actionRuns: {
              create: workflow.actions.map((action) => ({
                actionId: action.id,
                type: action.actionId,
                config: action.Metadata ?? {},
                credentialId: action.credentialId ?? null,
              })),
            },
          },
        });
        await tx.zapRunOutbox.create({ data: { zapRunId: run.id } });
        return true;
      });
      if (!accepted) return res.status(404).json({ error: "Workflow not found or has no actions" });
      return res.status(200).json({ success: true });
    } catch {
      console.error("Webhook transaction failed");
      return res.status(500).json({ error: "Internal server error" });
    }
  };
}
