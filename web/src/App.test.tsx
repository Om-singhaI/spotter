import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function mockHealth(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body)))),
  );
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  it("shows the name and the tagline on the home page", () => {
    mockHealth({ ok: true });
    renderAt("/");
    expect(screen.getByRole("heading", { name: "Spotter" })).toBeInTheDocument();
    expect(screen.getByText(/remembers your last set/)).toBeInTheDocument();
  });

  it("reports ok when the API health check succeeds", async () => {
    mockHealth({ ok: true });
    renderAt("/");
    expect(await screen.findByText("ok")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/health");
  });

  it("reports down when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    renderAt("/");
    expect(await screen.findByText("down")).toBeInTheDocument();
  });

  it("routes to the exercise library", () => {
    mockHealth({ exercises: [] });
    renderAt("/exercises");
    expect(screen.getByRole("heading", { name: "Exercises" })).toBeInTheDocument();
  });
});
