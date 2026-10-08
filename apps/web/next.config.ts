import type { NextConfig } from "next";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
const envPath = resolve(import.meta.dirname, "../../.env");
if (existsSync(envPath)) loadEnvFile(envPath);
process.env.NEXT_TELEMETRY_DISABLED = "1";
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
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/((?!embed/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};
export default config;
