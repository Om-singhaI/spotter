import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["src/**/*.test.ts"],
    // env.ts validates these at import time; no test opens a real connection
    env: {
      DATABASE_URL: "postgresql://test:test@127.0.0.1:1/test",
      SUPABASE_URL: "http://127.0.0.1:1",
      SUPABASE_JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    },
  },
});
