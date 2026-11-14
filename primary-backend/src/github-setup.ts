import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { credentialContext, encryptSecret } from "./credentials.js";

type Database = Pick<PrismaClient, "zap" | "githubTrigger" | "$transaction">;
type Settings = {
  encryptionKey?: string | undefined;
  githubSetupSecret?: string | undefined;
  githubSetupWorkflowId?: string | undefined;
};
export const GitHubSetupSchema = z.object({
  triggerType: z
    .enum(["github.issue_opened", "github.issue_closed", "github.pull_request_opened"])
    .optional(),
  repository: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/)
    .max(201),
  secret: z.string().min(16).max(512).optional(),
  enabled: z.boolean().default(true),
});

export function createGitHubSetupHandlers(db: Database, settings: Settings) {
  // A configured environment secret is importable only by the owner of its one designated workflow.
  const setupAvailable = (workflowId: string) =>
    settings.githubSetupWorkflowId === workflowId &&
    !!settings.githubSetupSecret &&
    settings.githubSetupSecret.length >= 16 &&
    settings.githubSetupSecret.length <= 512;
  const ownerId = (req: Request) => Number(req.id);
  const validOwner = (id: number) => Number.isSafeInteger(id) && id > 0;

  return {
    async get(req: Request, res: Response) {
      const userId = ownerId(req);
      if (!validOwner(userId)) return res.status(403).json({ error: "Unauthorized" });
      const workflowId = String(req.params.zapId);
      try {
        const workflow = await db.zap.findFirst({
          where: { id: workflowId, userId, deletedAt: null },
          select: { id: true, trigger: { select: { triggerId: true } } },
        });
        if (!workflow) return res.status(404).json({ error: "Workflow not found" });
        const connection = await db.githubTrigger.findUnique({
          where: { workflowId },
          select: { repository: true, enabled: true },
        });
        return res.json({
          configured: !!connection,
          repository: connection?.repository ?? "",
          enabled: connection?.enabled ?? true,
          setupSecretAvailable: setupAvailable(workflowId),
          webhookPath: `/hooks/github/${workflowId}`,
        });
      } catch {
        return res.status(503).json({ error: "Connection settings temporarily unavailable" });
      }
    },
    async save(req: Request, res: Response) {
      const userId = ownerId(req);
      if (!validOwner(userId)) return res.status(403).json({ error: "Unauthorized" });
      if (!settings.encryptionKey)
        return res.status(503).json({ error: "Credential encryption is not configured" });
      const parsed = GitHubSetupSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          error: "Enter owner/repository and a secret of 16 to 512 characters if replacing it",
        });
      const workflowId = String(req.params.zapId);
      const input = parsed.data;
      try {
        const outcome = await db.$transaction(async (tx) => {
          const workflow = await tx.zap.findFirst({
            where: { id: workflowId, userId, deletedAt: null },
            select: { id: true, trigger: { select: { triggerId: true } } },
          });
          if (!workflow) return "missing";
          const triggerType =
            input.triggerType ??
            (workflow.trigger?.triggerId?.startsWith("github.")
              ? workflow.trigger.triggerId
              : "github.issue_opened");
          const existing = await tx.githubTrigger.findUnique({
            where: { workflowId },
            include: { credential: true },
          });
          if (
            existing &&
            (existing.credential.ownerId !== userId ||
              existing.credential.provider !== "github.webhook")
          ) {
            return "invalid_reference";
          }
          const secret =
            input.secret ??
            (!existing && setupAvailable(workflowId) ? settings.githubSetupSecret : undefined);
          if (!existing && !secret) return "needs_secret";
          const credentialId = existing?.credentialId ?? randomUUID();
          if (secret) {
            const encryptedSecret = encryptSecret(
              secret,
              settings.encryptionKey!,
              credentialContext({ id: credentialId, ownerId: userId, provider: "github.webhook" }),
            );
            await tx.credential.upsert({
              where: { id: credentialId },
              create: {
                id: credentialId,
                ownerId: userId,
                provider: "github.webhook",
                encryptedSecret,
              },
              update: { encryptedSecret },
            });
          }
          await tx.githubTrigger.upsert({
            where: { workflowId },
            create: {
              workflowId,
              credentialId,
              repository: input.repository.toLowerCase(),
              enabled: input.enabled,
            },
            update: {
              repository: input.repository.toLowerCase(),
              enabled: input.enabled,
              revision: { increment: 1 },
            },
          });
          // Label this workflow as GitHub and close its old generic-webhook entry point.
          const trigger = await tx.trigger.upsert({
            where: { ZapId: workflowId },
            create: { ZapId: workflowId, triggerId: triggerType },
            update: { triggerId: triggerType },
          });
          await tx.zap.update({ where: { id: workflowId }, data: { triggerId: trigger.id } });
          return "saved";
        });
        if (outcome === "missing") return res.status(404).json({ error: "Workflow not found" });
        if (outcome === "invalid_reference")
          return res.status(403).json({ error: "Invalid credential reference" });
        if (outcome === "needs_secret")
          return res.status(400).json({
            error: "Enter the same webhook secret configured in GitHub (at least 16 characters)",
          });
        return res.json({ success: true, webhookPath: `/hooks/github/${workflowId}` });
      } catch {
        return res.status(503).json({ error: "Could not save GitHub connection" });
      }
    },
  };
}
