import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetFake } from "./fakeSupabase";

// No test talks to Supabase; every page gets the fake client.
vi.mock("../lib/supabase", async () => {
  const { fake } = await import("./fakeSupabase");
  return { supabase: fake };
});

afterEach(() => {
  cleanup();
  resetFake();
});
