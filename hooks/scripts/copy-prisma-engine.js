import { readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../src/generated/prisma-new/", import.meta.url));
const target = fileURLToPath(new URL("../dist/generated/prisma-new/", import.meta.url));
const engines = readdirSync(source).filter(name => name.includes("query_engine") || name.endsWith(".node"));
if (!engines.length) throw new Error("Prisma engine missing; run npm run generate before building");
mkdirSync(target, { recursive: true });
for (const name of engines) copyFileSync(`${source}/${name}`, `${target}/${name}`);
console.log(`Packaged ${engines.length} Prisma engine(s)`);
