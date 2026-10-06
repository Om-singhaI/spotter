import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // env.ts validates these at import time; no test opens a real connection
    env: { DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test" },
  },
});
