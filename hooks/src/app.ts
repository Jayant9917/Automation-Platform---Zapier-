import { createTallyHandler } from "./tally.js";
import express from "express";
import type { PrismaClient } from "./generated/prisma-new/client.js";
import { createGitHubHandler } from "./github.js";
import { createWebhookHandler } from "./handler.js";

export function createHooksApp(prisma: PrismaClient, encryptionKey?: string) {
  const app = express();

  // GitHub signs the exact request bytes. This route MUST precede the JSON parser.
  app.post(
    "/hooks/github/:workflowId",
    express.raw({ type: "application/json", limit: "1mb", inflate: false }),
    createGitHubHandler(prisma, encryptionKey),
  );
  app.post(
    "/hooks/tally/:workflowId",
    express.raw({ type: "application/json", limit: "1mb", inflate: false }),
    createTallyHandler(prisma, encryptionKey),
  );
  app.use(express.json());
  app.get("/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });

  app.post("/hooks/catch/:userId/:zapId", createWebhookHandler(prisma));

  return app;
}
