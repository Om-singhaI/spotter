import { defineConfig } from "vitest/config";

// One root run covers both packages so coverage is a single number.
export default defineConfig({
  test: {
    projects: ["web", "api"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      include: ["web/src/**", "api/src/**"],
      exclude: [
        "**/*.test.*",
        "**/*.css",
        "web/src/test/**",
        "web/src/main.tsx",
        "api/src/index.ts",
      ],
    },
  },
});
