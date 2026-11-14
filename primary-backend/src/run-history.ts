import type { Request, Response } from "express";
import type { Prisma, PrismaClient } from "./generated/prisma-new/client.js";
import { z } from "zod";
import { getExecutionStatus } from "./execution-status.js";
const statuses = [
  "cancelled",
  "pending",
  "running",
  "succeeded",
  "failed",
  "partially_failed",
  "needs_attention",
] as const;
const querySchema = z.object({
  workflowId: z.string().uuid().optional(),
  status: z.enum(statuses).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().max(500).optional(),
});
const actionSelect = {
  id: true,
  actionId: true,
  type: true,
  status: true,
  attempts: true,
  errorCode: true,
  createdAt: true,
  updatedAt: true,
  nextAttemptAt: true,
} as const;
const runSelect = {
  id: true,
  zapId: true,
  createdAt: true,
  zap: { select: { deletedAt: true, trigger: { select: { type: { select: { name: true } } } } } },
  actionRuns: {
    select: actionSelect,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.ZapRunSelect;
const active = ["pending", "running", "retry"];
// Match the same precedence used by getExecutionStatus; filtering happens before pagination.
export function runStatusFilter(status: string): Prisma.ZapRunWhereInput {
  const noneAttention = { actionRuns: { none: { status: "needs_attention" } } };
  const noneActive = { actionRuns: { none: { status: { in: active } } } };
  switch (status) {
    case "cancelled":
      return {
        AND: [{ actionRuns: { some: {} } }, { actionRuns: { every: { status: "cancelled" } } }],
      };
    case "pending":
      return { actionRuns: { none: {} } };
    case "needs_attention":
      return { actionRuns: { some: { status: "needs_attention" } } };
    case "running":
      return { AND: [noneAttention, { actionRuns: { some: { status: { in: active } } } }] };
    case "succeeded":
      return {
        AND: [{ actionRuns: { some: {} } }, { actionRuns: { every: { status: "succeeded" } } }],
      };
    case "partially_failed":
      return {
        AND: [
          noneAttention,
          noneActive,
          { actionRuns: { some: { status: "succeeded" } } },
          { actionRuns: { some: { status: { not: "succeeded" } } } },
        ],
      };
    default:
      return {
        AND: [
          noneAttention,
          noneActive,
          { actionRuns: { some: {} } },
          { actionRuns: { none: { status: "succeeded" } } },
          { actionRuns: { some: { status: { not: "cancelled" } } } },
        ],
      };
  }
}
const cursorSchema = z.object({ id: z.string().uuid(), createdAt: z.string().datetime() });
export function createRunHistoryHandlers(db: Pick<PrismaClient, "zap" | "zapRun">) {
  return {
    async list(req: Request, res: Response) {
      const userId = Number(req.id);
      if (!Number.isSafeInteger(userId) || userId < 1)
        return res.status(403).json({ message: "Unauthorized" });
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success)
        return res.status(400).json({ message: "Check workflow, status, dates and page cursor" });
      const input = parsed.data;
      if (input.from && input.to && new Date(input.from).getTime() > new Date(input.to).getTime())
        return res.status(400).json({ message: "Start date must be before end date" });
      const filters: Prisma.ZapRunWhereInput[] = [{ zap: { userId } }];
      if (input.workflowId) filters.push({ zapId: input.workflowId });
      if (input.status) filters.push(runStatusFilter(input.status));
      if (input.from) filters.push({ createdAt: { gte: new Date(input.from) } });
      if (input.to) filters.push({ createdAt: { lte: new Date(input.to) } });
      if (input.cursor) {
        try {
          const cursor = cursorSchema.parse(
            JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")),
          );
          const createdAt = new Date(cursor.createdAt);
          filters.push({
            OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
          });
        } catch {
          return res.status(400).json({ message: "Invalid page cursor" });
        }
      }
      try {
        const [rows, workflows] = await Promise.all([
          db.zapRun.findMany({
            where: { AND: filters },
            select: runSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 26,
          }),
          db.zap.findMany({
            where: { userId, deletedAt: null },
            select: { id: true, trigger: { select: { type: { select: { name: true } } } } },
            orderBy: { id: "asc" },
          }),
        ]);
        const runs = rows.slice(0, 25).map((run) => ({
          ...run,
          status: getExecutionStatus(run.actionRuns.map((action) => action.status)),
        }));
        const last = runs[runs.length - 1];
        const nextCursor =
          rows.length > 25 && last
            ? Buffer.from(
                JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() }),
              ).toString("base64url")
            : null;
        return res.json({ runs, workflows, nextCursor });
      } catch {
        return res
          .status(503)
          .json({ message: "Task history is temporarily unavailable. Please retry." });
      }
    },
    async detail(req: Request, res: Response) {
      const userId = Number(req.id);
      if (!Number.isSafeInteger(userId) || userId < 1)
        return res.status(403).json({ message: "Unauthorized" });
      const id = z.string().uuid().safeParse(req.params.runId);
      if (!id.success) return res.status(400).json({ message: "Invalid run ID" });
      try {
        const run = await db.zapRun.findFirst({
          where: { id: id.data, zap: { userId } },
          select: runSelect,
        });
        if (!run) return res.status(404).json({ message: "Run not found" });
        return res.json({
          run: {
            ...run,
            status: getExecutionStatus(run.actionRuns.map((action) => action.status)),
          },
        });
      } catch {
        return res
          .status(503)
          .json({ message: "Run details are temporarily unavailable. Please retry." });
      }
    },
  };
}
