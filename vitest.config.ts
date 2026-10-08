import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20000,
  },
});
