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
      ".local/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [next],
    settings: { next: { rootDir: "apps/web" } },
  },
  {
    files: ["apps/web/public/*.js"],
    languageOptions: {
      globals: Object.fromEntries(
        [
          "document",
          "window",
          "location",
          "URL",
          "crypto",
          "setTimeout",
          "clearTimeout",
        ].map((name) => [name, "readonly"]),
      ),
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly" } },
  },
);
