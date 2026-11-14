import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { z } from "zod";
const schema = z.object({ payload: z.record(z.unknown()) }).strict();
// Only forwards to our internal hooks service, never a destination supplied by the browser.
export function createTestEventHandler(
  db: Pick<PrismaClient, "zap">,
  enabled: boolean,
  fetcher: typeof fetch = fetch,
) {
  return async (req: Request, res: Response) => {
    if (!enabled) return res.status(404).json({ message: "Not found" });
    const userId = Number(req.id);
    if (!Number.isSafeInteger(userId) || userId < 1)
      return res.status(403).json({ message: "Unauthorized" });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data.payload), "utf8") > 65536)
      return res
        .status(400)
        .json({ message: "Use a JSON object smaller than 64 KB for the sample event" });
    try {
      const workflow = await db.zap.findFirst({
        where: { id: String(req.params.zapId), userId, trigger: { triggerId: "webhook" } },
        select: { id: true, actions: { select: { id: true } } },
      });
      if (!workflow) return res.status(404).json({ message: "Generic webhook workflow not found" });
      if (workflow.actions.length === 0)
        return res.status(400).json({ message: "Save at least one action before testing" });
      const response = await fetcher(
        `http://hooks:3002/hooks/catch/${userId}/${encodeURIComponent(workflow.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data.payload),
          redirect: "manual",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        return res.status(502).json({
          message: "The webhook did not accept the event. Check Task history before trying again.",
        });
      const result = (await response.json()) as { success?: unknown };
      if (result.success !== true) throw new Error();
      return res.status(202).json({ success: true });
    } catch {
      return res.status(503).json({
        message:
          "Event delivery could not be confirmed. Check Task history before trying again; the event may already have been accepted.",
      });
    }
  };
}
