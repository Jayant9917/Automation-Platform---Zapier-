import { config } from "../config.js";
import { PrismaClient } from "../generated/prisma-new/client.js";

export const prismaClient = new PrismaClient({ datasourceUrl: config.databaseUrl });