import { config } from "./config.js";
import { PrismaClient } from "./generated/prisma-new/client.js";
import { createHooksApp } from "./app.js";

const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
const app = createHooksApp(prisma, config.encryptionKey);
app.listen(config.port, () => {
  console.log(`Hooks server running on port ${config.port}`);
});
