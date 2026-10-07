import "dotenv/config";
import { Kafka } from "kafkajs";
import { sendEmail } from "./email.js";

const TOPIC_NAME = "zap-events";
const kafka = new Kafka({
  clientId: "worker",
  brokers: ["localhost:9092"],
});

async function main() {
  const consumer = kafka.consumer({ groupId: "main-worker" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC_NAME, fromBeginning: true });

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      const raw = message.value?.toString();
      console.log({ topic, partition, offset: message.offset, value: raw });

      try {
        if (raw) {
          const payload = JSON.parse(raw) as { to?: string; body?: string };
          if (payload && typeof payload.to === "string" && typeof payload.body === "string") {
            await sendEmail(payload.to, payload.body);
          } else {
            console.warn("Message missing to/body, skipping email:", raw);
          }
        }
      } catch (err) {
        console.error("Failed to process message:", err);
        throw err;
      }

      await new Promise((r) => setTimeout(r, 5000));
      await consumer.commitOffsets([
        { topic, partition, offset: (parseInt(message.offset, 10) + 1).toString() },
      ]);
    },
  });
}

main().catch(console.error);