import { createWebhookHandler } from "./handler.js";
import { config } from "./config.js";
import express from "express";
import { PrismaClient } from "./generated/prisma-new/client.js";

const app = express();
const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });

// Middleware to parse JSON bodies
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

app.listen(config.port, () => {
  console.log(`Hooks server running on port ${config.port}`);
});
