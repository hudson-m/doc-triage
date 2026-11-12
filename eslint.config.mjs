import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Package boundaries as lint rules (same idea as ADR 1 in the .NET portfolio).
// core is pure domain: no framework, no SDK, no I/O. A violation fails `npm run lint` in CI.
const forbid = (patterns, message) => ({
  "no-restricted-imports": ["error", { patterns: patterns.map((p) => ({ group: [p], message })) }],
});

export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/dist/**", "test-results/**", "playwright-report/**"]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["**/*.{js,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["packages/core/**/*.ts"],
    rules: forbid(
      [
        "fastify",
        "@fastify/*",
        "react",
        "react-dom",
        "@anthropic-ai/*",
        "node:*",
        "@doc-triage/api",
        "@doc-triage/web",
      ],
      "core is the pure domain: it must not depend on frameworks, SDKs, Node I/O or apps.",
    ),
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...forbid(
        ["fastify", "@fastify/*", "@anthropic-ai/*", "node:*", "@doc-triage/api"],
        "The web app talks to the API over HTTP only; it may import types from @doc-triage/core.",
      ),
    },
  },
  {
    files: ["apps/api/**/*.ts"],
    rules: forbid(
      ["react", "react-dom", "@doc-triage/web"],
      "The API must not depend on the web app.",
    ),
  },
]);
