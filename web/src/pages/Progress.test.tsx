import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import App from "../App";
import { fakeSession, state } from "../test/fakeSupabase";

// The chart is SVG sized by a ResizeObserver, which jsdom lacks; the page is tested
// around it and the chart gets its own stand in.
vi.mock("../progress/ProgressChart", () => ({
  default: ({ points }: { points: unknown[] }) => (
    <div data-testid="chart">{points.length} points</div>
  ),
}));

const me = {
  id: "x",
  display_name: "Ana",
  weight_unit: "lb",
  share_numbers: false,
  email: "ana@example.com",
};
const squat = {
  id: "Barbell_Squat",
  name: "Barbell Squat",
  sessions: 3,
  last_performed_at: "2026-10-22T10:00:00Z",
};
const bench = {
  id: "Bench",
  name: "Bench Press",
  sessions: 1,
  last_performed_at: "2026-10-20T10:00:00Z",
};
const point = (id: string, date: string, e1rm: number, top: number) => ({
  workout_id: id,
  started_at: date,
  best_e1rm_kg: e1rm,
  top_weight_kg: top,
  volume_kg: top * 15,
  sets: 3,
  in_progress: false,
});

function mockApi(handlers: Record<string, () => unknown>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace(/^\/api/, "").split("?")[0];
      calls.push(path);
      const handler = handlers[path];
      return handler ? Response.json(handler()) : new Response("not found", { status: 404 });
    }),
  );
  return calls;
}

function renderAt(path: string) {
  state.session = fakeSession();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ProgressPage", () => {
  it("points new users at the workout page", async () => {
    mockApi({ "/me": () => me, "/progress": () => ({ exercises: [] }) });
    renderAt("/progress");
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it("selects the most recent exercise and shows its chart and sessions", async () => {
    mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat, bench] }),
      "/exercises/Barbell_Squat/progress": () => ({
        points: [
          point("w1", "2026-10-01T18:00:00Z", 71.441, 61.235),
          point("w2", "2026-10-08T18:00:00Z", 73.482, 61.235),
          point("w3", "2026-10-22T18:00:00Z", 77.564, 65.771),
        ],
      }),
    });
    renderAt("/progress");
    const tab = await screen.findByRole("tab", { name: "Barbell Squat", selected: true });
    expect(tab).toBeInTheDocument();
    expect(await screen.findByTestId("chart")).toHaveTextContent("3 points");
    expect(screen.getByText(/3 sessions/)).toBeInTheDocument();
    expect(screen.getByText(/\+9% since the first/)).toBeInTheDocument();
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // header plus three sessions, newest first
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent("145 lb");
  });

  it("switches exercises through the tabs and the URL", async () => {
    const calls = mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat, bench] }),
      "/exercises/Barbell_Squat/progress": () => ({
        points: [point("w1", "2026-10-01T18:00:00Z", 71.441, 61.235)],
      }),
      "/exercises/Bench/progress": () => ({
        points: [point("w9", "2026-10-20T18:00:00Z", 50, 43)],
      }),
    });
    renderAt("/progress");
    await screen.findByText(/One session so far/);
    fireEvent.click(screen.getByRole("tab", { name: "Bench Press" }));
    await waitFor(() => expect(calls).toContain("/exercises/Bench/progress"));
    expect(screen.getByRole("tab", { name: "Bench Press" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("opens straight to the exercise in the link", async () => {
    mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat, bench] }),
      "/exercises/Bench/progress": () => ({
        points: [point("w9", "2026-10-20T18:00:00Z", 50, 43)],
      }),
    });
    renderAt("/progress?exercise=Bench");
    expect(await screen.findByRole("tab", { name: "Bench Press" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to the first exercise when the link names one with no history", async () => {
    mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat, bench] }),
      "/exercises/Barbell_Squat/progress": () => ({
        points: [point("w1", "2026-10-01T18:00:00Z", 71.441, 61.235)],
      }),
    });
    renderAt("/progress?exercise=Nope");
    expect(
      await screen.findByRole("tab", { name: "Barbell Squat", selected: true }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/One session so far/)).toBeInTheDocument();
  });

  it("leaves the open workout out of the headline comparison", async () => {
    mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat] }),
      "/exercises/Barbell_Squat/progress": () => ({
        points: [
          point("w1", "2026-10-01T18:00:00Z", 100, 80),
          point("w2", "2026-10-08T18:00:00Z", 110, 85),
          { ...point("w3", "2026-10-22T18:00:00Z", 50, 40), in_progress: true },
        ],
      }),
    });
    renderAt("/progress");
    expect(await screen.findByText(/\+10% since the first/)).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("moves between exercises with the arrow keys", async () => {
    mockApi({
      "/me": () => me,
      "/progress": () => ({ exercises: [squat, bench] }),
      "/exercises/Barbell_Squat/progress": () => ({ points: [] }),
      "/exercises/Bench/progress": () => ({ points: [] }),
    });
    renderAt("/progress");
    const first = await screen.findByRole("tab", { name: "Barbell Squat", selected: true });
    fireEvent.keyDown(first.parentElement!, { key: "ArrowRight" });
    expect(
      await screen.findByRole("tab", { name: "Bench Press", selected: true }),
    ).toBeInTheDocument();
  });
});
