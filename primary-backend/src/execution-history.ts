import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { getExecutionStatus } from "./execution-status.js";

export function createExecutionHistoryHandler(db: Pick<PrismaClient, "zap" | "zapRun">) {
  return async (req: Request, res: Response) => {
    const userId = Number(req.id);
    const zapId = String(req.params.zapId);
    if (!Number.isInteger(userId) || userId < 1)
      return res.status(403).json({ message: "Unauthorized" });
    const workflow = await db.zap.findFirst({
      where: { id: zapId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    // Only return safe status fields, never event contents or snapshotted configuration.
    const runs = await db.zapRun.findMany({
      where: { zapId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        createdAt: true,
        actionRuns: {
          select: {
            id: true,
            actionId: true,
            type: true,
            status: true,
            attempts: true,
            errorCode: true,
            nextAttemptAt: true,
            updatedAt: true,
          },
        },
      },
    });
    return res.json({
      runs: runs.map((run) => ({
        ...run,
        status: getExecutionStatus(run.actionRuns.map((action) => action.status)),
      })),
    });
  };
}
