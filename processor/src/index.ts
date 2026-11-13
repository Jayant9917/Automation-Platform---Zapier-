import { config } from "./config.js";
import { Kafka } from "kafkajs";
import { PrismaClient } from "./generated/prisma/client.js";
import { dispatchActions } from "./dispatch.js";

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const kafka = new Kafka({ clientId: "outbox-processor", brokers: config.brokers });

async function main() {
  const producer = kafka.producer();
  await producer.connect();
  while (true) {
    try {
      await dispatchActions(prisma, async (job) => {
        await producer.send({
          topic: config.topic,
          messages: [{ key: job.actionExecutionId, value: JSON.stringify(job) }],
        });
      });
    } catch {
      console.error("Dispatch cycle failed; pending work will be retried");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

main().catch(async () => {
  console.error("Processor stopped; check database and Kafka connectivity");
  await prisma.$disconnect();
  process.exit(1);
});
