import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import express from "express";
import { PrismaClient } from "./generated/prisma-new/client.js";

// Load environment variables from .env file
// Get the directory of the current file (hooks/src) and go up to hooks directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "..", ".env") });

// Log which DB we're using (password redacted)
const dbUrl = process.env.DATABASE_URL;
const dbForLog = dbUrl ? dbUrl.replace(/:[^:@]+@/, ":****@") : "(not set)";
console.log("DATABASE_URL (hooks):", dbForLog);

const app = express();
const prisma = new PrismaClient();

// Middleware to parse JSON bodies
app.use(express.json());

app.post("/hooks/catch/:userId/:zapId", async (req: any, res: any) => {
    const { userId, zapId } = req.params;
    const body = req.body;

    try {
        // Store in db a new trigger
        await prisma.$transaction(async (tx: any) => {
            const run = await tx.zapRun.create({
                data: {
                    zapId: zapId,
                    metadata: body,
                }
            });

            await tx.zapRunOutbox.create({
                data: {
                    zapRunId: run.id,
                }
            });
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error processing webhook:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(8000, () => {
    console.log("Server is running on port 8000");
});
const PORT = Number(process.env.PORT) || 3002;
app.listen(PORT, () => {
    console.log(`Hooks server running on http://localhost:${PORT}`);
});