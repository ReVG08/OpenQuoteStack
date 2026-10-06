import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";
export { Prisma, PrismaClient } from "./generated/prisma/client";
export function createDatabase(connectionString: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      connectionTimeoutMillis: 5000,
      max: 10,
    }),
  });
}
const globalDatabase = globalThis as typeof globalThis & {
  oqsDatabase?: PrismaClient;
};
export function getDatabase(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  globalDatabase.oqsDatabase ??= createDatabase(url);
  return globalDatabase.oqsDatabase;
}
