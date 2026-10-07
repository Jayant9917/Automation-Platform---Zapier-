import "dotenv/config";
console.log("[primary-backend] Starting...");
import express from "express";
import { userRouter } from "./router/user.js";
import { zapRouter } from "./router/zap.js";
import cors from "cors";
import { triggerRouter } from "./router/trigger.js";
import { actionRouter } from "./router/action.js";

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(cors());

app.use("/api/v1/user", userRouter);
app.use("/api/v1/zap", zapRouter);
app.use("/api/v1/trigger", triggerRouter);
app.use("/api/v1/action", actionRouter);

app.listen(PORT, () => {
    process.stdout.write(`Server running on http://localhost:${PORT}\n`);
});