import { getEmailPayload } from "./payload.js";
import { config } from "./config.js";
import { Kafka } from "kafkajs";
import { PrismaClient } from "./generated/prisma/client.js";

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const TOPIC_NAME = config.topic;
const kafka = new Kafka({ clientId: "outbox-processor", brokers: config.brokers });

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

main().catch(async (error) => {
  console.error("Processor failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});