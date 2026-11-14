import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { credentialContext, decryptSecret } from "./credentials.js";

type Database = Pick<PrismaClient, "githubTrigger" | "githubDelivery" | "$transaction">;
const deliveryPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function verifyGitHubSignature(
  rawBody: Buffer,
  signature: unknown,
  secret: string,
): boolean {
  if (typeof signature !== "string" || !/^sha256=[0-9a-f]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export function createGitHubHandler(db: Database, encryptionKey?: string) {
  return async (req: Request, res: Response) => {
    if (!encryptionKey)
      return res.status(503).json({ error: "GitHub credentials are not configured" });
    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      contentType.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      return res.status(415).json({ error: "Set GitHub webhook Content type to application/json" });
    }
    const workflowId = String(req.params.workflowId);
    try {
      const connection = await db.githubTrigger.findUnique({
        where: { workflowId, workflow: { deletedAt: null } },
        include: {
          credential: true,
          workflow: {
            select: { userId: true, trigger: { select: { triggerId: true } } },
          },
        },
      });
      if (!connection || !connection.enabled)
        return res.status(404).json({ error: "GitHub trigger is not enabled" });
      if (
        connection.credential.ownerId !== connection.workflow.userId ||
        connection.credential.provider !== "github.webhook"
      ) {
        throw new Error("INVALID_CREDENTIAL_REFERENCE");
      }
      const secret = decryptSecret(
        connection.credential.encryptedSecret,
        encryptionKey,
        credentialContext(connection.credential),
      );
      if (
        !Buffer.isBuffer(req.body) ||
        !verifyGitHubSignature(req.body, req.headers["x-hub-signature-256"], secret)
      ) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }
      let payload;
      try {
        payload = JSON.parse(req.body.toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return res.status(400).json({ error: "Invalid event payload" });
      }
      const event = req.headers["x-github-event"];
      const deliveryId = req.headers["x-github-delivery"];
      if (
        typeof event !== "string" ||
        typeof deliveryId !== "string" ||
        !deliveryPattern.test(deliveryId)
      ) {
        return res.status(400).json({ error: "Missing or invalid GitHub delivery headers" });
      }
      if (
        typeof payload.repository?.full_name !== "string" ||
        payload.repository.full_name.toLowerCase() !== connection.repository.toLowerCase()
      ) {
        return res.status(202).json({ ignored: true, reason: "Repository does not match" });
      }
      if (event === "ping") return res.status(200).json({ success: true, event: "ping" });
      const triggerType = connection.workflow.trigger?.triggerId ?? "";
      const rules: Record<string, { event: string; action: string; field: string }> = {
        "github.issue_opened": {
          event: "issues",
          action: "opened",
          field: "issue",
        },
        "github.issue_closed": {
          event: "issues",
          action: "closed",
          field: "issue",
        },
        "github.pull_request_opened": {
          event: "pull_request",
          action: "opened",
          field: "pull_request",
        },
      };
      const rule = rules[triggerType ?? ""];
      if (!rule || event !== rule.event || payload.action !== rule.action)
        return res.status(202).json({ ignored: true });
      const item = payload[rule.field];
      if (
        !item ||
        typeof item.title !== "string" ||
        !Number.isSafeInteger(item.number) ||
        item.number < 1 ||
        typeof item.html_url !== "string"
      ) {
        return res.status(400).json({
          error: rule.field === "issue" ? "Invalid issue payload" : "Invalid pull request payload",
        });
      }
      const payloadHash = createHash("sha256").update(req.body).digest("hex");
      const where = {
        workflowId_deliveryId: {
          workflowId,
          deliveryId: deliveryId.toLowerCase(),
        },
      };
      // Fast path for redelivery. The database unique key also covers concurrent requests.
      const previous = await db.githubDelivery.findUnique({ where });
      if (previous)
        return res
          .status(previous.payloadHash === payloadHash ? 200 : 409)
          .json({ duplicate: true });
      try {
        const result = await db.$transaction(async (tx) => {
          // Recheck revision so a changed repository/secret is not used with stale verification.
          const current = await tx.githubTrigger.findFirst({
            where: {
              workflowId,
              revision: connection.revision,
              enabled: true,
              workflow: { deletedAt: null, trigger: { triggerId: triggerType } },
            },
            include: { workflow: { include: { actions: true } } },
          });
          if (!current || current.workflow.actions.length === 0) return false;
          const run = await tx.zapRun.create({
            data: {
              zapId: workflowId,
              metadata: payload,
              actionRuns: {
                create: current.workflow.actions.map((action) => ({
                  actionId: action.id,
                  type: action.actionId,
                  config: action.Metadata ?? {},
                  credentialId: action.credentialId ?? null,
                })),
              },
            },
          });
          await tx.githubDelivery.create({
            data: {
              workflowId,
              deliveryId: deliveryId.toLowerCase(),
              payloadHash,
              zapRunId: run.id,
            },
          });
          await tx.zapRunOutbox.create({ data: { zapRunId: run.id } });
          return true;
        });
        if (!result) return res.status(409).json({ error: "Workflow changed or has no actions" });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        const duplicate = await db.githubDelivery.findUnique({ where });
        if (!duplicate) throw error;
        return res
          .status(duplicate.payloadHash === payloadHash ? 200 : 409)
          .json({ duplicate: true });
      }
      // Respond only after the event, action snapshots, receipt, and outbox are durable.
      return res.status(202).json({ success: true });
    } catch {
      console.error("GitHub webhook could not be accepted", { workflowId });
      return res.status(503).json({ error: "Webhook temporarily unavailable" });
    }
  };
}
