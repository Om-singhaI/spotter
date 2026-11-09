import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetFake } from "./fakeSupabase";

// Node can expose an unusable native localStorage during Vitest runs.
// Supply browser-like in-memory storage for deterministic jsdom tests.
const storedValues = new Map<string, string>();
vi.stubGlobal("localStorage", {
  get length() {
    return storedValues.size;
  },
  clear() {
    storedValues.clear();
  },
  getItem(key: string) {
    return storedValues.get(String(key)) ?? null;
  },
  key(index: number) {
    return [...storedValues.keys()][index] ?? null;
  },
  removeItem(key: string) {
    storedValues.delete(String(key));
  },
  setItem(key: string, value: string) {
    storedValues.set(String(key), String(value));
  },
} satisfies Storage);

// No test talks to Supabase; every page gets the fake client.
vi.mock("../lib/supabase", async () => {
  const { fake } = await import("./fakeSupabase");
  return { supabase: fake };
});

afterEach(() => {
  cleanup();
  resetFake();
});
