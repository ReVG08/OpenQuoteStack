import { defineConfig } from "prisma/config";
import { config } from "dotenv";
config({ path: "../../.env", quiet: true });
if (!process.env.DATABASE_URL && process.argv.includes("migrate"))
  throw new Error("DATABASE_URL is required for migrations");
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://invalid:invalid@127.0.0.1:1/invalid",
  },
});
