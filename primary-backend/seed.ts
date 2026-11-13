import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma-new/client.js";

const prisma = new PrismaClient();

const AVAILABLE_ACTIONS = [
  { id: "email", name: "Email", image: "https://cdn-icons-png.flaticon.com/512/561/561127.png" },
];

async function main() {
  await prisma.availableTriggers.upsert({
    where: { id: "webhook" },
    create: { id: "webhook", name: "Webhook", image: "/next.svg" },
    update: { name: "Webhook" },
  });
  for (const action of AVAILABLE_ACTIONS) {
    await prisma.availableActions.upsert({
      where: { id: action.id },
      create: action,
      update: { name: action.name, image: action.image },
    });
  }
  console.log("Seeded available actions:", AVAILABLE_ACTIONS.map((a) => a.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
