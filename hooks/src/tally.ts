import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { credentialContext, decryptSecret } from "./credentials.js";

type Database = Pick<PrismaClient, "tallyTrigger" | "tallyDelivery" | "$transaction">;
// Tally documents HMAC-SHA256 over JSON.stringify(payload), encoded as base64.
export function verifyTallySignature(
  payload: unknown,
  signature: unknown,
  secret: string,
): boolean {
  if (typeof signature !== "string" || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(JSON.stringify(payload)).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "base64"));
}
export function normalizeTally(payload: any) {
  const answers: Record<string, string | number | boolean | null> = Object.create(null);
  const aliases: Record<string, (string | number | boolean | null)[]> = {
    name: [],
    email: [],
    message: [],
  };
  for (const field of payload.data.fields) {
    if (
      !field ||
      typeof field.key !== "string" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.key) ||
      ["constructor", "prototype", "__proto__"].includes(field.key)
    )
      continue;
    let value = field.value;
    if (Array.isArray(value) && !value.every((item: unknown) => typeof item === "string")) continue;
    if (Array.isArray(value))
      value = value
        .map((item: unknown) => {
          if (typeof item !== "string") return "";
          return Array.isArray(field.options)
            ? (field.options.find((option: any) => option.id === item)?.text ?? item)
            : item;
        })
        .join(", ");
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) continue;
    if (Object.hasOwn(answers, field.key)) throw new Error("Duplicate field key");
    answers[field.key] = value;
    const label = typeof field.label === "string" ? field.label.trim().toLowerCase() : "";
    if (Object.hasOwn(aliases, label)) aliases[label]!.push(value);
  }
  // Standard aliases require a unique question labelled Name, Email or Message.
  return {
    tally: {
      formId: payload.data.formId,
      formName: typeof payload.data.formName === "string" ? payload.data.formName : "",
      submissionId: payload.data.submissionId,
      name: aliases.name!.length === 1 ? aliases.name![0] : null,
      email: aliases.email!.length === 1 ? aliases.email![0] : null,
      message: aliases.message!.length === 1 ? aliases.message![0] : null,
      answers,
    },
  };
}
export function createTallyHandler(db: Database, encryptionKey?: string) {
  return async (req: Request, res: Response) => {
    if (!encryptionKey)
      return res.status(503).json({ error: "Tally credentials are not configured" });
    const contentType = req.headers["content-type"];
    if (
      typeof contentType !== "string" ||
      contentType.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      return res.status(415).json({ error: "Set Tally webhook Content type to application/json" });
    }
    const workflowId = String(req.params.workflowId);
    try {
      const connection = await db.tallyTrigger.findUnique({
        where: { workflowId },
        include: {
          credential: true,
          workflow: {
            select: { userId: true, trigger: { select: { triggerId: true } } },
          },
        },
      });
      if (!connection || !connection.enabled)
        return res.status(404).json({ error: "Tally trigger is not enabled" });
      if (
        connection.credential.ownerId !== connection.workflow.userId ||
        connection.credential.provider !== "tally.webhook"
      ) {
        throw new Error("INVALID_CREDENTIAL_REFERENCE");
      }
      const secret = decryptSecret(
        connection.credential.encryptedSecret,
        encryptionKey,
        credentialContext(connection.credential),
      );
      if (!Buffer.isBuffer(req.body))
        return res.status(400).json({ error: "Expected raw JSON body" });
      let payload;
      try {
        payload = JSON.parse(req.body.toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid JSON" });
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return res.status(400).json({ error: "Invalid event payload" });
      }
      if (!verifyTallySignature(payload, req.headers["tally-signature"], secret))
        return res.status(401).json({ error: "Invalid webhook signature" });
      if (payload.eventType !== "FORM_RESPONSE") return res.status(202).json({ ignored: true });
      if (payload.data?.formId !== connection.formId)
        return res.status(202).json({ ignored: true, reason: "Form does not match" });
      if (
        typeof payload.eventId !== "string" ||
        !payload.eventId ||
        payload.eventId.length > 200 ||
        typeof payload.data.submissionId !== "string" ||
        !payload.data.submissionId ||
        payload.data.submissionId.length > 200 ||
        !Array.isArray(payload.data.fields)
      )
        return res.status(400).json({ error: "Invalid submission payload" });
      let metadata;
      try {
        metadata = normalizeTally(payload);
      } catch {
        return res.status(400).json({ error: "Invalid form fields" });
      }
      const deliveryId = payload.data.submissionId;
      const triggerType = "tally.form_submitted";
      const payloadHash = createHash("sha256").update(JSON.stringify(payload.data)).digest("hex");
      const where = {
        workflowId_deliveryId: {
          workflowId,
          deliveryId: deliveryId,
        },
      };
      // Fast path for redelivery. The database unique key also covers concurrent requests.
      const previous = await db.tallyDelivery.findUnique({ where });
      if (previous)
        return res
          .status(previous.payloadHash === payloadHash ? 200 : 409)
          .json({ duplicate: true });
      try {
        const result = await db.$transaction(async (tx) => {
          // Recheck revision so a changed formId/secret is not used with stale verification.
          const current = await tx.tallyTrigger.findFirst({
            where: {
              workflowId,
              revision: connection.revision,
              enabled: true,
              workflow: { trigger: { triggerId: triggerType } },
            },
            include: { workflow: { include: { actions: true } } },
          });
          if (!current || current.workflow.actions.length === 0) return false;
          const run = await tx.zapRun.create({
            data: {
              zapId: workflowId,
              metadata,
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
          await tx.tallyDelivery.create({
            data: {
              workflowId,
              deliveryId: deliveryId,
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
        const duplicate = await db.tallyDelivery.findUnique({ where });
        if (!duplicate) throw error;
        return res
          .status(duplicate.payloadHash === payloadHash ? 200 : 409)
          .json({ duplicate: true });
      }
      // Respond only after the event, action snapshots, receipt, and outbox are durable.
      return res.status(202).json({ success: true });
    } catch {
      console.error("Tally webhook could not be accepted", { workflowId });
      return res.status(503).json({ error: "Webhook temporarily unavailable" });
    }
  };
}
