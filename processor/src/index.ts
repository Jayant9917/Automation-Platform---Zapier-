import "dotenv/config";
import { Kafka } from "kafkajs";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TOPIC_NAME = "zap-events"


const kafka = new Kafka({
    clientId: "outbox-processor",
    brokers: ["localhost:9092"],
});



function getEmailPayload(row: unknown): { to: string; body: string } | null {
  const r = row as {
    zapRun?: {
      zap?: {
        actions?: Array<{
          actionId: string;
          Metadata?: unknown;
          metadata?: unknown;
          type?: { id: string };
        }>;
      };
    };
  };
  const actions = r.zapRun?.zap?.actions ?? [];
  const emailAction = actions.find(
    (a) => a.actionId === "email" || a.type?.id === "email"
  );
  if (!emailAction) {
    console.warn("getEmailPayload: no email action. actions:", actions.length, actions.map((a) => ({ actionId: (a as any).actionId, typeId: (a as any).type?.id })));
    return null;
  }
  const meta = (emailAction as any).Metadata ?? (emailAction as any).metadata;
  if (!meta || typeof meta !== "object") {
    console.warn("getEmailPayload: email action has no Metadata. keys:", Object.keys(emailAction));
    return null;
  }
  const m = meta as { email?: string; body?: string };
  if (!m.email || !m.body) {
    console.warn("getEmailPayload: Metadata missing email/body. meta:", JSON.stringify(m));
    return null;
  }
  return { to: m.email, body: m.body };
}


async function main() {
  const producer = kafka.producer();
  await producer.connect();

  while (1) {
    const pendingRows = await prisma.zapRunOutbox.findMany({
      where: {},
      take: 10,
      include: {
        zapRun: {
          include: {
            zap: {
              include: {
                actions: {
                  include: { type: { select: { id: true } } },
                },
              },
            },
          },
        },
      },
    });

    console.log("pendingRows", pendingRows.length);

    const messages: { value: string }[] = [];
    for (const row of pendingRows) {
      const payload = getEmailPayload(row);
      if (payload) {
        console.log("sending email payload for zapRun", row.zapRunId);
        messages.push({ value: JSON.stringify(payload) });
      } else {
        console.warn("No email action payload for zapRunId", row.zapRunId, "- skipping");
      }
    }

    if (messages.length > 0) {
      await producer.send({
        topic: TOPIC_NAME,
        messages,
      });
    }

    await prisma.zapRunOutbox.deleteMany({
      where: { id: { in: pendingRows.map((r) => r.id) } },
    });

    console.log("deleted rows, remaining:", await prisma.zapRunOutbox.count());
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch(console.error);