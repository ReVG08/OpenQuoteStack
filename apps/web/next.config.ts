import type { NextConfig } from "next";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
const envPath = resolve(import.meta.dirname, "../../.env");
if (existsSync(envPath)) loadEnvFile(envPath);
const config: NextConfig = {
  agentRules: false,
  logging: { serverFunctions: false },
  output: "standalone",
  serverExternalPackages: ["pdfkit", "sharp"],
  outputFileTracingExcludes: {
    "/*": ["**/.env*", "**/.local/**", "**/.git/**"],
  },
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@openquotestack/database", "@openquotestack/ui"],
  async headers() {
    return [
      {
        source: "/((?!embed/).*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
