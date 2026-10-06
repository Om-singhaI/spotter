import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ExercisesPage, { type Exercise } from "./Exercises";

const bench: Exercise = {
  id: "Barbell_Bench_Press_-_Medium_Grip",
  name: "Barbell Bench Press",
  category: "strength",
  equipment: "barbell",
  primary_muscles: ["chest"],
  images: ["Barbell_Bench_Press_-_Medium_Grip/0.jpg"],
};

const squat: Exercise = { ...bench, id: "Barbell_Squat", name: "Barbell Squat", images: [] };

function respond(exercises: Exercise[]) {
  return new Response(JSON.stringify({ exercises }));
}

function mockSearch(exercises: Exercise[]) {
  const fetchMock = vi.fn(() => Promise.resolve(respond(exercises)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ExercisesPage />
    </MemoryRouter>,
  );
}

describe("ExercisesPage", () => {
  it("loads the library and shows a result with its muscles and equipment", async () => {
    const fetchMock = mockSearch([bench]);
    renderPage();
    expect(await screen.findByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("chest \u00b7 barbell")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 exercises");
    expect(fetchMock).toHaveBeenCalledWith("/api/exercises?q=");
  });

  it("says so when nothing matches", async () => {
    mockSearch([]);
    renderPage();
    expect(await screen.findByText("Nothing matches that.")).toBeInTheDocument();
  });

  it("shows an error when the API is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network"))),
    );
    renderPage();
    expect(await screen.findByText("Could not reach the API.")).toBeInTheDocument();
  });

  it("sends one debounced request for a burst of typing", async () => {
    const fetchMock = mockSearch([bench]);
    renderPage();
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "b" } });
    fireEvent.change(box, { target: { value: "be" } });
    fireEvent.change(box, { target: { value: "ben" } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/exercises?q=ben"));
    // typing within 250 ms of mount cancels the initial empty query, so one request for the burst
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a slow response that arrives after a newer search", async () => {
    const pending: Array<{ url: string; resolve: (r: Response) => void }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (url: string) =>
          new Promise<Response>((resolve) => {
            pending.push({ url, resolve });
          }),
      ),
    );
    renderPage();
    const box = screen.getByRole("searchbox");
    fireEvent.change(box, { target: { value: "a" } });
    await waitFor(() => expect(pending.some((p) => p.url.endsWith("q=a"))).toBe(true));
    fireEvent.change(box, { target: { value: "ab" } });
    await waitFor(() => expect(pending.some((p) => p.url.endsWith("q=ab"))).toBe(true));
    // the newest search answers first, then the stale one straggles in
    pending.find((p) => p.url.endsWith("q=ab"))!.resolve(respond([bench]));
    expect(await screen.findByText("Barbell Bench Press")).toBeInTheDocument();
    pending.find((p) => p.url.endsWith("q=a"))!.resolve(respond([squat]));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 exercises"));
    expect(screen.queryByText("Barbell Squat")).not.toBeInTheDocument();
    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
  });
});
