import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
    coverage: {
      provider: "v8",
      // lcov feeds SonarQube Cloud; text-summary is for people reading CI logs.
      reporter: ["text-summary", "lcov"],
      include: ["packages/*/src/**", "apps/*/src/**"],
      // Entry points that only wire things together; they are exercised by E2E, not unit tests.
      exclude: ["apps/api/src/server.ts", "apps/api/src/eval.ts", "apps/web/src/main.tsx"],
      thresholds: { lines: 80, branches: 75 },
    },
  },
});
