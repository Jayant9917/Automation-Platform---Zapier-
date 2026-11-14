import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { z } from "zod";
// Keep execution history and credentials; hide the automation and stop future/queued work.
export function createDeleteWorkflowHandler(db: Pick<PrismaClient, "$transaction">) {
  return async (req: Request, res: Response) => {
    const userId = Number(req.id),
      id = z.string().uuid().safeParse(req.params.zapId);
    if (!Number.isSafeInteger(userId) || userId < 1)
      return res.status(403).json({ message: "Unauthorized" });
    if (!id.success) return res.status(400).json({ message: "Invalid workflow ID" });
    try {
      const deleted = await db.$transaction(async (tx) => {
        const result = await tx.zap.updateMany({
          where: { id: id.data, userId, deletedAt: null },
          data: { deletedAt: new Date(), actionsRevision: { increment: 1 } },
        });
        if (!result.count) return false;
        await tx.actionRun.updateMany({
          where: { zapRun: { zapId: id.data }, status: { in: ["pending", "retry"] } },
          data: {
            status: "cancelled",
            errorCode: "WORKFLOW_DELETED",
            claimToken: null,
            leaseUntil: null,
          },
        });
        return true;
      });
      if (!deleted) return res.status(404).json({ message: "Automation not found" });
      return res.json({ success: true });
    } catch {
      return res.status(503).json({ message: "Could not delete automation. Please retry." });
    }
  };
}
