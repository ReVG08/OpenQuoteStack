import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "packages/**/*.integration.test.ts",
      "apps/*/src/**/*.integration.test.ts",
    ],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
  },
});
