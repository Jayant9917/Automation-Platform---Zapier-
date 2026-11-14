import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { credentialContext, encryptSecret } from "./credentials.js";
export const TallySetupSchema = z.object({
  formId: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]+$/)
    .max(100),
  secret: z.string().min(16).max(512).optional(),
  enabled: z.boolean().default(true),
});
export function createTallySetupHandlers(
  db: Pick<PrismaClient, "zap" | "tallyTrigger" | "$transaction">,
  encryptionKey?: string,
) {
  return {
    async get(req: Request, res: Response) {
      const ownerId = Number(req.id),
        workflowId = String(req.params.zapId);
      if (!Number.isSafeInteger(ownerId) || ownerId < 1)
        return res.status(403).json({ error: "Unauthorized" });
      try {
        const workflow = await db.zap.findFirst({
          where: {
            id: workflowId,
            userId: ownerId,
            deletedAt: null,
            trigger: { triggerId: "tally.form_submitted" },
          },
          select: { id: true },
        });
        if (!workflow) return res.status(404).json({ error: "Tally workflow not found" });
        const connection = await db.tallyTrigger.findUnique({
          where: { workflowId },
          select: { formId: true, enabled: true },
        });
        return res.json({
          configured: !!connection,
          formId: connection?.formId ?? "",
          enabled: connection?.enabled ?? true,
          webhookPath: `/hooks/tally/${workflowId}`,
        });
      } catch {
        return res.status(503).json({ error: "Tally settings unavailable" });
      }
    },
    async save(req: Request, res: Response) {
      const ownerId = Number(req.id),
        workflowId = String(req.params.zapId);
      if (!Number.isSafeInteger(ownerId) || ownerId < 1)
        return res.status(403).json({ error: "Unauthorized" });
      if (!encryptionKey)
        return res.status(503).json({ error: "Credential encryption is not configured" });
      const parsed = TallySetupSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Check form ID and signing secret (16�512 characters)" });
      const input = parsed.data;
      try {
        const result = await db.$transaction(async (tx) => {
          const workflow = await tx.zap.findFirst({
            where: {
              id: workflowId,
              userId: ownerId,
              deletedAt: null,
              trigger: { triggerId: "tally.form_submitted" },
            },
            select: { id: true },
          });
          if (!workflow) return "missing";
          const existing = await tx.tallyTrigger.findUnique({
            where: { workflowId },
            include: { credential: true },
          });
          if (
            existing &&
            (existing.credential.ownerId !== ownerId ||
              existing.credential.provider !== "tally.webhook")
          )
            return "invalid";
          if (!existing && !input.secret) return "secret";
          const id = existing?.credentialId ?? randomUUID();
          if (input.secret) {
            const credential = { id, ownerId, provider: "tally.webhook" };
            const encryptedSecret = encryptSecret(
              input.secret,
              encryptionKey,
              credentialContext(credential),
            );
            await tx.credential.upsert({
              where: { id },
              create: { ...credential, encryptedSecret },
              update: { encryptedSecret },
            });
          }
          await tx.tallyTrigger.upsert({
            where: { workflowId },
            create: { workflowId, credentialId: id, formId: input.formId, enabled: input.enabled },
            update: { formId: input.formId, enabled: input.enabled, revision: { increment: 1 } },
          });
          return "saved";
        });
        if (result === "missing")
          return res.status(404).json({ error: "Tally workflow not found" });
        if (result === "invalid")
          return res.status(403).json({ error: "Invalid credential reference" });
        if (result === "secret")
          return res.status(400).json({ error: "Enter your Tally signing secret" });
        return res.json({ success: true });
      } catch {
        return res.status(503).json({ error: "Could not save Tally settings" });
      }
    },
  };
}
