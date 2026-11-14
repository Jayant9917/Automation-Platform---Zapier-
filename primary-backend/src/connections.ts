import { parseHttpConnection } from "./http-config.js";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import {
  parseSlackConnection,
  parseGoogleConnection,
  parseDiscordConnection,
} from "./connection-secrets.js";
import { encryptSecret, credentialContext } from "./credentials.js";
const providers = [
  "slack.webhook",
  "google.service_account",
  "discord.webhook",
  "http.headers",
] as const;
const schema = z.object({
  name: z.string().trim().min(1).max(80),
  provider: z.enum(providers),
  secret: z.unknown(),
});
const safeFields = { id: true, name: true, provider: true, createdAt: true } as const;

export function validateConnectionSecret(provider: string, input: unknown): unknown {
  if (provider === "http.headers") return parseHttpConnection(input);
  if (provider === "discord.webhook") return parseDiscordConnection(input);
  if (provider === "slack.webhook") return parseSlackConnection(input);
  if (provider === "google.service_account") return parseGoogleConnection(input);
  throw new Error("INVALID_CONNECTION_PROVIDER");
}

export function createConnectionHandlers(
  db: Pick<PrismaClient, "credential">,
  encryptionKey?: string,
) {
  return {
    async list(req: Request, res: Response) {
      const ownerId = Number(req.id);
      if (!Number.isSafeInteger(ownerId) || ownerId < 1)
        return res.status(403).json({ error: "Unauthorized" });
      try {
        const connections = await db.credential.findMany({
          where: { ownerId, revokedAt: null, provider: { in: [...providers] } },
          select: safeFields,
          orderBy: { createdAt: "desc" },
        });
        return res.json({ connections });
      } catch {
        return res.status(503).json({ error: "Connections temporarily unavailable" });
      }
    },
    async save(req: Request, res: Response) {
      const ownerId = Number(req.id);
      if (!Number.isSafeInteger(ownerId) || ownerId < 1)
        return res.status(403).json({ error: "Unauthorized" });
      if (!encryptionKey)
        return res.status(503).json({ error: "Credential encryption is not configured" });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({ error: "Enter a connection name, provider, and valid credentials" });
      let secret;
      try {
        secret = validateConnectionSecret(parsed.data.provider, parsed.data.secret);
      } catch {
        return res.status(400).json({
          error:
            "Invalid connection credentials. For HTTP, enter an HTTPS origin and a headers JSON object.",
        });
      }
      const id =
        typeof req.params.connectionId === "string" ? req.params.connectionId : randomUUID();
      try {
        const encryptedSecret = encryptSecret(
          JSON.stringify(secret),
          encryptionKey,
          credentialContext({ id, ownerId, provider: parsed.data.provider }),
        );
        if (req.params.connectionId) {
          const result = await db.credential.updateMany({
            where: { id, ownerId, provider: parsed.data.provider, revokedAt: null },
            data: { name: parsed.data.name, encryptedSecret },
          });
          if (!result.count) return res.status(404).json({ error: "Connection not found" });
          return res.json({ success: true, id });
        }
        const connection = await db.credential.create({
          data: {
            id,
            ownerId,
            provider: parsed.data.provider,
            name: parsed.data.name,
            encryptedSecret,
          },
          select: safeFields,
        });
        return res.status(201).json({ connection });
      } catch {
        return res.status(503).json({ error: "Could not save connection" });
      }
    },
    async revoke(req: Request, res: Response) {
      const ownerId = Number(req.id);
      if (!Number.isSafeInteger(ownerId) || ownerId < 1)
        return res.status(403).json({ error: "Unauthorized" });
      try {
        const result = await db.credential.updateMany({
          where: {
            id: String(req.params.connectionId),
            ownerId,
            revokedAt: null,
            provider: { in: [...providers] },
          },
          data: { revokedAt: new Date() },
        });
        if (!result.count) return res.status(404).json({ error: "Connection not found" });
        return res.json({ success: true });
      } catch {
        return res.status(503).json({ error: "Could not revoke connection" });
      }
    },
  };
}
