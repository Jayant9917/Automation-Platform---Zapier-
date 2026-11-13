import { prismaClient } from "./db/index.js";
import { Router } from "express";
import { authMiddleware } from "./middleware.js";
import { createConnectionHandlers } from "./connections.js";
import { config } from "./config.js";
console.log("[primary-backend] Starting...");
import express from "express";
import { userRouter } from "./router/user.js";
import { zapRouter } from "./router/zap.js";
import cors from "cors";
import { triggerRouter } from "./router/trigger.js";
import { actionRouter } from "./router/action.js";

const PORT = config.port;

const app = express();
app.use(express.json());
app.get("/health", async (_req, res) => {
  try {
    await prismaClient.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});
app.use(cors());

const connections = createConnectionHandlers(prismaClient, config.encryptionKey);
const connectionRouter = Router();
connectionRouter.use(authMiddleware);
connectionRouter.get("/", connections.list);
connectionRouter.post("/", connections.save);
connectionRouter.put("/:connectionId", connections.save);
connectionRouter.delete("/:connectionId", connections.revoke);
app.use("/api/v1/connections", connectionRouter);

app.use("/api/v1/user", userRouter);
app.use("/api/v1/zap", zapRouter);
app.use("/api/v1/trigger", triggerRouter);
app.use("/api/v1/action", actionRouter);

app.listen(PORT, () => {
  process.stdout.write(`Server running on http://localhost:${PORT}\n`);
});
