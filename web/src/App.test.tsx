import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

function mockHealth(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body)))),
  );
}

describe("App", () => {
  it("shows the name and the tagline", () => {
    mockHealth({ ok: true });
    render(<App />);
    expect(screen.getByRole("heading", { name: "Spotter" })).toBeInTheDocument();
    expect(screen.getByText(/remembers your last set/)).toBeInTheDocument();
  });

  it("reports ok when the API health check succeeds", async () => {
    mockHealth({ ok: true });
    render(<App />);
    expect(await screen.findByText("ok")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/health");
  });

  it("reports down when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    render(<App />);
    expect(await screen.findByText("down")).toBeInTheDocument();
  });
});
