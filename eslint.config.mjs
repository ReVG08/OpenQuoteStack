import js from "@eslint/js";
import ts from "typescript-eslint";
import next from "eslint-config-next/core-web-vitals";
export default ts.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/generated/**",
      "**/next-env.d.ts",
      "**/.turbo/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ["apps/web/**/*.{ts,tsx}"], extends: [next] },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
);
