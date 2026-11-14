import { randomUUID } from "node:crypto";
import { credentialContext, encryptSecret } from "./credentials.js";
import type { Request, Response } from "express";
import type { Prisma, PrismaClient } from "./generated/prisma-new/client.js";
import { z } from "zod";
import { ZapCreateSchema } from "./types.js";
import { ActionsSchema, actionProviders } from "./action-config.js";
import type { ActionInput } from "./action-config.js";
class InputError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function checkConnections(
  tx: Prisma.TransactionClient,
  actions: ActionInput[],
  ownerId: number,
) {
  for (const action of actions) {
    const provider = actionProviders[action.availableActionId];
    if (!provider) continue;
    const connection = await tx.credential.findFirst({
      where: { id: action.credentialId!, ownerId, provider, revokedAt: null },
      select: { id: true },
    });
    if (!connection) throw new InputError(403, "Choose your own active connection for each action");
  }
}
const actionData = (action: ActionInput, index: number) => ({
  actionId: action.availableActionId,
  Metadata: action.actionMetadata,
  credentialId: action.credentialId ?? null,
  sortingOrder: index,
});
const updateSchema = z.object({ actions: ActionsSchema, revision: z.number().int().min(0) });
export function createWorkflowActionHandlers(
  db: Pick<PrismaClient, "$transaction">,
  encryptionKey?: string,
) {
  const respond = (error: unknown, res: Response) =>
    error instanceof InputError
      ? res.status(error.status).json({ message: error.message })
      : res.status(503).json({ message: "Workflow temporarily unavailable" });
  return {
    async create(req: Request, res: Response) {
      const userId = Number(req.id);
      if (!Number.isSafeInteger(userId) || userId < 1)
        return res.status(403).json({ message: "Unauthorized" });
      const parsed = ZapCreateSchema.safeParse(req.body);
      if (!parsed.success || parsed.data.actions.some((action) => action.id))
        return res
          .status(400)
          .json({ message: "Check trigger, action fields, templates, and connections" });
      if (
        parsed.data.github &&
        (!parsed.data.availableTriggerId.startsWith("github.") || !parsed.data.github.secret)
      )
        return res
          .status(400)
          .json({ message: "Configure the GitHub repository and webhook secret" });
      if (
        (parsed.data.availableTriggerId === "tally.form_submitted" && !parsed.data.tally?.secret) ||
        (parsed.data.tally && parsed.data.availableTriggerId !== "tally.form_submitted")
      )
        return res.status(400).json({ message: "Configure the Tally form ID and signing secret" });
      if (parsed.data.tally && !encryptionKey)
        return res.status(503).json({ message: "Credential encryption is not configured" });
      if (parsed.data.github && !encryptionKey)
        return res.status(503).json({ message: "Credential encryption is not configured" });
      try {
        const zapId = await db.$transaction(async (tx) => {
          await checkConnections(tx, parsed.data.actions, userId);
          const zap = await tx.zap.create({
            data: { userId, actions: { create: parsed.data.actions.map(actionData) } },
          });
          const trigger = await tx.trigger.create({
            data: { ZapId: zap.id, triggerId: parsed.data.availableTriggerId },
          });
          await tx.zap.update({ where: { id: zap.id }, data: { triggerId: trigger.id } });
          // Save new GitHub trigger credentials with the workflow, so publishing is atomic.
          if (parsed.data.github) {
            const credentialId = randomUUID();
            const credential = { id: credentialId, ownerId: userId, provider: "github.webhook" };
            await tx.credential.create({
              data: {
                ...credential,
                encryptedSecret: encryptSecret(
                  parsed.data.github.secret!,
                  encryptionKey!,
                  credentialContext(credential),
                ),
              },
            });
            await tx.githubTrigger.create({
              data: {
                workflowId: zap.id,
                credentialId,
                repository: parsed.data.github.repository.toLowerCase(),
                enabled: parsed.data.github.enabled,
              },
            });
          }
          if (parsed.data.tally) {
            const id = randomUUID();
            const credential = { id, ownerId: userId, provider: "tally.webhook" };
            await tx.credential.create({
              data: {
                ...credential,
                encryptedSecret: encryptSecret(
                  parsed.data.tally.secret!,
                  encryptionKey!,
                  credentialContext(credential),
                ),
              },
            });
            await tx.tallyTrigger.create({
              data: {
                workflowId: zap.id,
                credentialId: id,
                formId: parsed.data.tally.formId,
                enabled: parsed.data.tally.enabled,
              },
            });
          }
          return zap.id;
        });
        return res.status(201).json({ zapId });
      } catch (error) {
        return respond(error, res);
      }
    },
    async update(req: Request, res: Response) {
      const userId = Number(req.id),
        zapId = String(req.params.zapId);
      if (!Number.isSafeInteger(userId) || userId < 1)
        return res.status(403).json({ message: "Unauthorized" });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ message: "Check action fields, templates, connections, and revision" });
      const ids = parsed.data.actions.flatMap((action) => (action.id ? [action.id] : []));
      if (new Set(ids).size !== ids.length)
        return res.status(400).json({ message: "Duplicate action IDs" });
      try {
        await db.$transaction(async (tx) => {
          // Claim the expected workflow revision before touching actions. Concurrent saves must reload.
          const claim = await tx.zap.updateMany({
            where: { id: zapId, userId, deletedAt: null, actionsRevision: parsed.data.revision },
            data: { actionsRevision: { increment: 1 } },
          });
          if (!claim.count) {
            const owned = await tx.zap.findFirst({
              where: { id: zapId, userId, deletedAt: null },
              select: { id: true },
            });
            throw new InputError(
              owned ? 409 : 404,
              owned ? "Workflow changed. Reload before saving." : "Workflow not found",
            );
          }
          await checkConnections(tx, parsed.data.actions, userId);
          const existing = await tx.action.findMany({ where: { zapId }, select: { id: true } });
          if (ids.some((id) => !existing.some((action) => action.id === id)))
            throw new InputError(403, "Action does not belong to this workflow");
          await tx.action.deleteMany({ where: { zapId, id: { notIn: ids } } });
          for (const [index, action] of parsed.data.actions.entries()) {
            if (action.id)
              await tx.action.update({ where: { id: action.id }, data: actionData(action, index) });
            else await tx.action.create({ data: { zapId, ...actionData(action, index) } });
          }
        });
        return res.json({ success: true, revision: parsed.data.revision + 1 });
      } catch (error) {
        return respond(error, res);
      }
    },
  };
}
