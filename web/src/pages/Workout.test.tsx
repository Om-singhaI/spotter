import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import App from "../App";
import { fakeSession, state } from "../test/fakeSupabase";
import type { WorkoutSet } from "../workout/types";

const WORKOUT = {
  id: "11111111-1111-4111-8111-111111111111",
  started_at: "2026-10-19T10:00:00Z",
  finished_at: null,
};
const squatSet = (id: string, weight_kg: number, reps: number): WorkoutSet => ({
  id,
  exercise_id: "Barbell_Squat",
  exercise_name: "Barbell Squat",
  weight_kg,
  reps,
  rpe: null,
  is_warmup: false,
  performed_at: "2026-10-19T10:05:00Z",
});

// Routes the fetch stub by method and path so a page can talk to several endpoints.
function mockApi(handlers: Record<string, (body?: unknown) => unknown>) {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = url.replace(/^\/api/, "").split("?")[0];
    const key = `${method} ${path}`;
    calls.push(key);
    const handler = handlers[key];
    if (!handler) return new Response("not found", { status: 404 });
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const result = handler(body);
    return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function renderWorkout() {
  state.session = fakeSession();
  return render(
    <MemoryRouter initialEntries={["/workout"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const me = {
  id: "x",
  display_name: "Ana",
  weight_unit: "lb",
  share_numbers: false,
  email: "ana@example.com",
};

describe("WorkoutPage", () => {
  it("offers to start when nothing is open, then shows the open workout", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: null, sets: [] }),
      "POST /workouts": () => ({ workout: WORKOUT, sets: [] }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Start a workout" }));
    expect(await screen.findByRole("button", { name: "Add exercise" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish workout" })).toBeInTheDocument();
  });

  it("groups the open workout's sets by exercise in the user's unit", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({
        workout: WORKOUT,
        sets: [squatSet("s1", 61.235, 8), squatSet("s2", 61.235, 8)],
      }),
    });
    renderWorkout();
    const list = await screen.findByRole("list", { name: "Exercises in this workout" });
    expect(within(list).getByText("Barbell Squat")).toBeInTheDocument();
    expect(within(list).getByText(/2 sets · best 135 lb/)).toBeInTheDocument();
  });

  it("shows last session as the ghost row and logs a new set", async () => {
    const logged: unknown[] = [];
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
      "GET /exercises": () => ({ exercises: [{ id: "Barbell_Squat", name: "Barbell Squat" }] }),
      "GET /exercises/Barbell_Squat/ghost": () => ({ sets: [squatSet("g1", 61.235, 8)] }),
      "POST /workouts/11111111-1111-4111-8111-111111111111/sets": (body) => {
        logged.push(body);
        return { set: squatSet("s9", 63.503, 9) };
      },
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Add exercise" }));
    fireEvent.click(await screen.findByRole("button", { name: "Barbell Squat" }));
    const last = await screen.findByRole("list", { name: "Last session" });
    expect(within(last).getByText(/135 lb × 8/)).toBeInTheDocument();
    // the form was prefilled from the ghost row
    const weight = screen.getByLabelText(/Weight/) as HTMLInputElement;
    const reps = screen.getByLabelText("Reps") as HTMLInputElement;
    await waitFor(() => expect(weight.value).toBe("135"));
    expect(reps.value).toBe("8");
    fireEvent.change(weight, { target: { value: "140" } });
    fireEvent.change(reps, { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: "Log set" }));
    await waitFor(() => expect(logged).toHaveLength(1));
    expect(logged[0]).toEqual({
      exercise_id: "Barbell_Squat",
      weight: 140,
      unit: "lb",
      reps: 9,
      is_warmup: false,
    });
    const today = screen.getByRole("list", { name: "Today" });
    expect(within(today).getByText(/140 lb × 9/)).toBeInTheDocument();
  });

  it("says it is the first time when there is no earlier session", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
      "GET /exercises": () => ({ exercises: [{ id: "Bench_Dips", name: "Bench Dips" }] }),
      "GET /exercises/Bench_Dips/ghost": () => ({ sets: [] }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Add exercise" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bench Dips" }));
    expect(await screen.findByText(/First time doing this/)).toBeInTheDocument();
  });

  it("finishes after a confirming second tap and reports what was saved", async () => {
    const { calls } = mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [squatSet("s1", 61.235, 8)] }),
      "POST /workouts/11111111-1111-4111-8111-111111111111/finish": () => ({
        workout: { ...WORKOUT, finished_at: "2026-10-19T11:00:00Z" },
        discarded: false,
      }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Finish workout" }));
    // first tap only asks for confirmation
    expect(calls).not.toContain("POST /workouts/11111111-1111-4111-8111-111111111111/finish");
    fireEvent.click(screen.getByRole("button", { name: "Tap again to finish" }));
    expect(await screen.findByRole("status")).toHaveTextContent("1 set across 1 exercise");
    expect(calls).toContain("POST /workouts/11111111-1111-4111-8111-111111111111/finish");
    expect(screen.getByRole("button", { name: "Start a workout" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so when an empty workout is discarded", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
      "POST /workouts/11111111-1111-4111-8111-111111111111/finish": () => ({
        workout: null,
        discarded: true,
      }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Finish workout" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Nothing was logged");
  });

  it("removes a set after a confirming second tap", async () => {
    const { calls } = mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({
        workout: WORKOUT,
        sets: [squatSet("s1", 61.235, 8), squatSet("s2", 61.235, 7)],
      }),
      "GET /exercises/Barbell_Squat/ghost": () => ({ sets: [] }),
      "DELETE /sets/s2": () => undefined,
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: /Barbell Squat/ }));
    const today = await screen.findByRole("list", { name: "Today" });
    expect(within(today).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Remove set 2" }));
    expect(calls).not.toContain("DELETE /sets/s2");
    fireEvent.click(screen.getByRole("button", { name: "Confirm removing set 2" }));
    await waitFor(() => expect(calls).toContain("DELETE /sets/s2"));
    await waitFor(() => expect(within(today).getAllByRole("listitem")).toHaveLength(1));
  });

  it("prefills from today's last set rather than the ghost row", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [squatSet("s1", 65.771, 6)] }),
      "GET /exercises/Barbell_Squat/ghost": () => ({ sets: [squatSet("g1", 61.235, 8)] }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: /Barbell Squat/ }));
    const weight = (await screen.findByLabelText(/Weight/)) as HTMLInputElement;
    await waitFor(() => expect(weight.value).toBe("145"));
    expect((screen.getByLabelText("Reps") as HTMLInputElement).value).toBe("6");
  });

  it("reports when last session cannot be loaded instead of claiming a first time", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
      "GET /exercises": () => ({ exercises: [{ id: "Barbell_Squat", name: "Barbell Squat" }] }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Add exercise" }));
    fireEvent.click(await screen.findByRole("button", { name: "Barbell Squat" }));
    expect(await screen.findByText(/Could not load last session/)).toBeInTheDocument();
    expect(screen.queryByText(/First time doing this/)).not.toBeInTheDocument();
  });

  it("keeps the form hidden until the unit is known", async () => {
    mockApi({
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
    });
    renderWorkout();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load your settings.");
    expect(screen.queryByRole("button", { name: "Add exercise" })).not.toBeInTheDocument();
  });

  it("tells the picker user when nothing matches", async () => {
    mockApi({
      "GET /me": () => me,
      "GET /workouts/current": () => ({ workout: WORKOUT, sets: [] }),
      "GET /exercises": () => ({ exercises: [] }),
    });
    renderWorkout();
    fireEvent.click(await screen.findByRole("button", { name: "Add exercise" }));
    expect(await screen.findByText("Nothing matches that.")).toBeInTheDocument();
  });
});
