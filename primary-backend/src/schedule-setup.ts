import { z } from "zod";
import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { nextSchedule } from "./schedule-time.js";
export const ScheduleSchema = z
  .object({
    frequency: z.enum(["every_5_minutes", "daily"]),
    hour: z.number().int().min(0).max(23).default(9),
    minute: z.number().int().min(0).max(59).default(0),
    enabled: z.boolean().default(true),
  })
  .strict();
export function createScheduleHandlers(db: Pick<PrismaClient, "$transaction" | "scheduleTrigger">) {
  return {
    async get(req: Request, res: Response) {
      try {
        const schedule = await db.scheduleTrigger.findFirst({
          where: {
            workflowId: String(req.params.zapId),
            workflow: { userId: Number(req.id), deletedAt: null },
          },
        });
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });
        return res.json({ schedule });
      } catch {
        return res.status(503).json({ message: "Schedule temporarily unavailable" });
      }
    },
    async save(req: Request, res: Response) {
      const parsed = ScheduleSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: "Choose every five minutes or daily, with a valid UTC time." });
      try {
        const schedule = await db.$transaction(async (tx) => {
          const owned = await tx.zap.updateMany({
            where: {
              id: String(req.params.zapId),
              userId: Number(req.id),
              deletedAt: null,
              trigger: { triggerId: "schedule" },
            },
            data: { actionsRevision: { increment: 0 } },
          });
          if (!owned.count) return null;
          return tx.scheduleTrigger.update({
            where: { workflowId: String(req.params.zapId) },
            data: { ...parsed.data, nextRunAt: nextSchedule(parsed.data, new Date()) },
          });
        });
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });
        return res.json({ schedule });
      } catch {
        return res.status(503).json({ message: "Could not save schedule. Try again shortly." });
      }
    },
  };
}
