import { createDiscordHandler } from "./actions/discord.js";
import { config } from "./config.js";
import { Kafka } from "kafkajs";
import { PrismaClient } from "./generated/prisma/client.js";
import { sendEmail } from "./email.js";
import { createSlackHandler } from "./actions/slack.js";
import { createSheetsHandler } from "./actions/google-sheets.js";
import { createEmailHandler } from "./actions/email.js";
import { handleMessage } from "./message-handler.js";

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const kafka = new Kafka({ clientId: "worker", brokers: config.brokers });
const actionRegistry = {
  email: createEmailHandler(sendEmail),
  "slack.send_message": createSlackHandler(),
  "discord.send_message": createDiscordHandler(),
  "google_sheets.append_row": createSheetsHandler(),
};

async function main() {
  const consumer = kafka.consumer({ groupId: config.groupId, sessionTimeout: 180_000 });
  await consumer.connect();
  await consumer.subscribe({ topic: config.topic, fromBeginning: true });
  await consumer.run({
    autoCommit: false,
    eachMessage: (input) =>
      handleMessage(
        prisma,
        actionRegistry,
        input,
        (offsets) => consumer.commitOffsets(offsets),
        config.encryptionKey,
      ),
  });
}

main().catch(async () => {
  console.error("Worker stopped; check database and Kafka connectivity");
  await prisma.$disconnect();
  process.exit(1);
});
