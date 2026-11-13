import type { PrismaClient } from "./generated/prisma/client.js";
import type { ActionHandler } from "./actions/registry.js";
import { executeAction } from "./execution.js";
import { executeLegacyEmail } from "./legacy.js";
import { parseJob } from "./jobs.js";

type Message = {
  topic: string;
  partition: number;
  message: { value: Buffer | null; offset: string };
};
export async function handleMessage(
  db: Pick<PrismaClient, "actionRun" | "legacyJob" | "credential">,
  registry: Record<string, ActionHandler>,
  input: Message,
  commit: (offsets: { topic: string; partition: number; offset: string }[]) => Promise<void>,
  encryptionKey?: string,
) {
  const { topic, partition, message } = input;
  let job;
  try {
    job = parseJob(message.value?.toString() ?? "");
  } catch {
    console.error("Invalid action job skipped", { topic, partition, offset: message.offset });
  }
  if (job && "version" in job) {
    await executeAction(db, job, registry, undefined, encryptionKey);
  } else if (job) {
    await executeLegacyEmail(
      db,
      `legacy:${topic}:${partition}:${message.offset}`,
      job,
      registry.email!,
    );
  }
  await commit([{ topic, partition, offset: (BigInt(message.offset) + 1n).toString() }]);
}
