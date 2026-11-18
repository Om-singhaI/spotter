import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import App from "../App";
import { fakeSession, state } from "../test/fakeSupabase";

const first = {
  id: "11111111-1111-4111-8111-111111111111",
  started_at: "2026-10-19T10:00:00Z",
  finished_at: "2026-10-19T11:00:00Z",
  exercise_count: 1,
  set_count: 2,
  record_count: 1,
};
const second = {
  ...first,
  id: "22222222-2222-4222-8222-222222222222",
  started_at: "2026-10-18T10:00:00Z",
  finished_at: "2026-10-18T11:00:00Z",
  record_count: 0,
};

function renderHistory() {
  state.session = fakeSession();
  return render(
    <MemoryRouter initialEntries={["/history"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockRequests(
  handleHistory: (url: string) => unknown,
  handleDetail: () => unknown = () => ({ workout: first, sets: [] }),
  unit: "lb" | "kg" = "lb",
) {
  const requests: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      if (url === "/api/me") return Response.json({ weight_unit: unit });
      if (url.startsWith("/api/workouts/history")) return Response.json(handleHistory(url));
      if (url.startsWith("/api/workouts/")) return Response.json(handleDetail());
      return Response.json({ error: "not found" }, { status: 404 });
    }),
  );
  return requests;
}

describe("Workout history", () => {
  it("shows an empty state for users without completed workouts", async () => {
    mockRequests(() => ({ workouts: [], has_more: false }));
    renderHistory();
    expect(await screen.findByText("No completed workouts yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log a workout" })).toHaveAttribute("href", "/workout");
  });

  it("lists summaries and loads an individual workout with sets and records", async () => {
    const requests = mockRequests(
      () => ({ workouts: [first], has_more: false }),
      () => ({
        workout: first,
        sets: [
          {
            id: "set-1",
            exercise_id: "Barbell_Squat",
            exercise_name: "Barbell Squat",
            weight_kg: 61.235,
            reps: 8,
            rpe: null,
            is_warmup: false,
            e1rm_kg: 77.564,
            performed_at: "2026-10-19T10:05:00Z",
            records: ["max_weight"],
          },
        ],
      }),
    );
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    expect(within(list).getByText(/1 exercise · 2 sets · 1 record/)).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: /View/ }));
    expect(await screen.findByText("Barbell Squat")).toBeInTheDocument();
    expect(screen.getByText(/135 lb × 8 reps/)).toBeInTheDocument();
    expect(screen.getByText(/Record: heaviest weight/)).toBeInTheDocument();
    expect(requests).toContain(`/api/workouts/${first.id}`);
    fireEvent.click(within(list).getByRole("button", { name: /Hide/ }));
    expect(screen.queryByText("Barbell Squat")).not.toBeInTheDocument();
  });

  it("loads the next page when more completed workouts exist", async () => {
    const requests = mockRequests((url) =>
      url.includes("offset=0")
        ? { workouts: [first], has_more: true }
        : { workouts: [second], has_more: false },
    );
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(within(list).getAllByRole("button")).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(requests).toContain("/api/workouts/history?limit=20&offset=1");
  });

  it("displays kilograms, warmup sets, and separate exercises", async () => {
    mockRequests(
      () => ({ workouts: [first], has_more: false }),
      () => ({
        workout: first,
        sets: [
          {
            id: "warmup-1",
            exercise_id: "Barbell_Squat",
            exercise_name: "Barbell Squat",
            weight_kg: 20,
            reps: 10,
            rpe: null,
            is_warmup: true,
            e1rm_kg: 26.7,
            performed_at: "2026-10-19T10:05:00Z",
            records: [],
          },
          {
            id: "working-1",
            exercise_id: "Barbell_Squat",
            exercise_name: "Barbell Squat",
            weight_kg: 100,
            reps: 3,
            rpe: null,
            is_warmup: false,
            e1rm_kg: 110,
            performed_at: "2026-10-19T10:10:00Z",
            records: ["max_weight"],
          },
          {
            id: "bench-1",
            exercise_id: "Barbell_Bench_Press",
            exercise_name: "Barbell Bench Press",
            weight_kg: 60,
            reps: 5,
            rpe: null,
            is_warmup: false,
            e1rm_kg: 70,
            performed_at: "2026-10-19T10:15:00Z",
            records: [],
          },
        ],
      }),
      "kg",
    );
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    fireEvent.click(within(list).getByRole("button", { name: /View/ }));
    expect(await screen.findByText("Barbell Squat")).toBeInTheDocument();
    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText(/20 kg × 10 reps · Warmup/)).toBeInTheDocument();
    expect(screen.getByText(/100 kg × 3 reps/)).toBeInTheDocument();
    expect(screen.getByText(/60 kg × 5 reps/)).toBeInTheDocument();
    expect(screen.getByText(/Record: heaviest weight/)).toBeInTheDocument();
  });

  it("shows a load error instead of an empty history when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/me"
          ? Response.json({ weight_unit: "lb" })
          : Response.json({ error: "unavailable" }, { status: 503 }),
      ),
    );
    renderHistory();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load workout history.");
    expect(screen.queryByText("No completed workouts yet.")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Completed workouts" })).not.toBeInTheDocument();
  });

  it("shows a retry button if loading workout details fails", async () => {
    let detailAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/me") return Response.json({ weight_unit: "lb" });
        if (url.startsWith("/api/workouts/history"))
          return Response.json({ workouts: [first], has_more: false });
        if (url === `/api/workouts/${first.id}`) {
          detailAttempts++;
          return detailAttempts === 1
            ? Response.json({ error: "try again" }, { status: 503 })
            : Response.json({
                workout: first,
                sets: [
                  {
                    id: "set-1",
                    exercise_id: "Barbell_Squat",
                    exercise_name: "Barbell Squat",
                    weight_kg: 61.235,
                    reps: 8,
                    rpe: null,
                    is_warmup: false,
                    e1rm_kg: 77.564,
                    performed_at: "2026-10-19T10:05:00Z",
                    records: [],
                  },
                ],
              });
        }
        return Response.json({ error: "not found" }, { status: 404 });
      }),
    );
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    fireEvent.click(within(list).getByRole("button", { name: /View/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load workout details.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Barbell Squat")).toBeInTheDocument();
    expect(detailAttempts).toBe(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses cached details when reopening an already loaded workout", async () => {
    const requests = mockRequests(
      () => ({ workouts: [first], has_more: false }),
      () => ({
        workout: first,
        sets: [
          {
            id: "set-1",
            exercise_id: "Barbell_Squat",
            exercise_name: "Barbell Squat",
            weight_kg: 61.235,
            reps: 8,
            rpe: null,
            is_warmup: false,
            e1rm_kg: 77.564,
            performed_at: "2026-10-19T10:05:00Z",
            records: [],
          },
        ],
      }),
    );
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    fireEvent.click(within(list).getByRole("button", { name: /View/ }));
    expect(await screen.findByText("Barbell Squat")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: /Hide/ }));
    fireEvent.click(within(list).getByRole("button", { name: /View/ }));
    expect(await screen.findByText("Barbell Squat")).toBeInTheDocument();
    expect(requests.filter((url) => url === `/api/workouts/${first.id}`)).toHaveLength(1);
  });

  it("keeps loaded workouts visible when loading more fails", async () => {
    const requests = mockRequests((url) => {
      if (url.includes("offset=0")) return { workouts: [first], has_more: true };
      throw new Error("network failure");
    });
    renderHistory();
    const list = await screen.findByRole("list", {
      name: "Completed workouts",
    });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load more workouts.");
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Load more" })).toBeEnabled();
    expect(requests).toContain("/api/workouts/history?limit=20&offset=1");
  });
});
