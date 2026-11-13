import type { PrismaClient } from "./generated/prisma-new/client.js";

// Dependency injection keeps HTTP orchestration testable without a live database.
export function createWebhookHandler(prisma: Pick<PrismaClient, "$transaction">) {
  return async (req: any, res: any) => {
    const { zapId } = req.params;
    const body = req.body;

    try {
      // Store in db a new trigger
      await prisma.$transaction(async (tx: any) => {
        const run = await tx.zapRun.create({
          data: {
            zapId: zapId,
            metadata: body,
          },
        });

        await tx.zapRunOutbox.create({
          data: {
            zapRunId: run.id,
          },
        });
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
